import { IngestPayloadSchema, processIngest } from "@feature-lib/capture/ingest"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const CONCURRENCY = 8
const MAX_ATTEMPTS = 5

type IngestJob = {
  id: string
  user_id: string
  payload: unknown
  attempts: number
}

async function processOneJob(supabase: ReturnType<typeof getSupabaseAdmin>, job: IngestJob) {
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
        status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
        attempts,
        last_error: error instanceof Error ? error.message : "Retry failed",
        updated_at: new Date().toISOString()
      })
      .eq("id", job.id)
    return { done: 0, failed: 1 }
  }
}

export async function retryPendingIngestJobs() {
  const supabase = getSupabaseAdmin()
  const jobs = await supabase
    .from("ingest_jobs")
    .select("id,user_id,payload,attempts")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(100)

  if (jobs.error) {
    return { error: jobs.error.message }
  }

  let done = 0
  let failed = 0

  for (let i = 0; i < jobs.data.length; i += CONCURRENCY) {
    const chunk = jobs.data.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(chunk.map((job) => processOneJob(supabase, job)))
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
