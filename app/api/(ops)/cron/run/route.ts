import { verifyCronRequest } from "@/lib/cron"
import { ok } from "@/lib/http"
import { IngestPayloadSchema, processIngest } from "@feature-lib/capture/ingest"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

async function retryPendingIngestJobs() {
  const supabase = getSupabaseAdmin()
  const jobs = await supabase
    .from("ingest_jobs")
    .select("id,user_id,payload,attempts")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(100)

  if (jobs.error) {
    return { error: jobs.error.message, done: 0, failed: 0, pending: 0 }
  }

  let done = 0
  let failed = 0

  const processOne = async (job: (typeof jobs.data)[number]) => {
    const parsed = IngestPayloadSchema.safeParse(job.payload)
    if (!parsed.success) {
      await supabase
        .from("ingest_jobs")
        .update({
          status: "FAILED",
          attempts: job.attempts + 1,
          last_error: "Invalid payload",
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id)
      return { done: 0, failed: 1 }
    }

    try {
      await processIngest(job.user_id, parsed.data)
      await supabase
        .from("ingest_jobs")
        .update({
          status: "DONE",
          attempts: job.attempts + 1,
          last_error: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id)
      return { done: 1, failed: 0 }
    } catch (error) {
      const attempts = job.attempts + 1
      await supabase
        .from("ingest_jobs")
        .update({
          status: attempts >= 5 ? "FAILED" : "PENDING",
          attempts,
          last_error: error instanceof Error ? error.message : "Retry failed",
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id)
      return { done: 0, failed: 1 }
    }
  }

  const CONCURRENCY = 8
  for (let i = 0; i < jobs.data.length; i += CONCURRENCY) {
    const chunk = jobs.data.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(chunk.map((job) => processOne(job)))
    for (const result of settled) {
      if (result.status === "fulfilled") {
        done += result.value.done
        failed += result.value.failed
      } else {
        failed += 1
      }
    }
  }

  const pendingCount = await supabase
    .from("ingest_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDING")

  return {
    done,
    failed,
    pending: pendingCount.count ?? 0
  }
}

async function cleanupTrashedRecords() {
  const supabase = getSupabaseAdmin()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const deleted = await supabase
    .from("records")
    .delete()
    .eq("state", "TRASHED")
    .lt("updated_at", cutoff)
    .select("id")

  if (deleted.error) {
    return { error: deleted.error.message, deleted: 0, cutoff }
  }

  return { deleted: deleted.data.length, cutoff }
}

export async function POST(request: Request) {
  const verified = verifyCronRequest(request.headers)
  if (!verified.ok) {
    return verified.response
  }

  const ingest = await retryPendingIngestJobs()
  const cleanup = await cleanupTrashedRecords()

  if ("error" in ingest || "error" in cleanup) {
    return ok(
      {
        error: "Cron run failed",
        ingest,
        cleanup
      },
      { status: 500 }
    )
  }

  return ok({ ingest, cleanup })
}
