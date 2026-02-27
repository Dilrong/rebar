import { NextRequest } from "next/server"
import { getUserId } from "@/lib/auth"
import { fail, ok, rateLimited } from "@/lib/http"
import { IngestPayloadSchema, processIngest } from "@/lib/ingest"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `ingest-jobs:retry:${resolveClientKey(request.headers)}`,
    limit: 20,
    windowMs: 60_000
  })
  if (!limitResult.ok) {
    return rateLimited(limitResult.retryAfterSec)
  }

  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const supabase = getSupabaseAdmin()
  const jobs = await supabase
    .from("ingest_jobs")
    .select("id,payload,attempts")
    .eq("user_id", userId)
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(20)

  if (jobs.error) {
    return fail(jobs.error.message, 500)
  }

  let done = 0
  let failed = 0

  for (const job of jobs.data) {
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
        .eq("user_id", userId)
      failed += 1
      continue
    }

    try {
      await processIngest(userId, parsed.data)
      await supabase
        .from("ingest_jobs")
        .update({
          status: "DONE",
          attempts: job.attempts + 1,
          last_error: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id)
        .eq("user_id", userId)
      done += 1
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
        .eq("user_id", userId)
      failed += 1
    }
  }

  const pendingCount = await supabase.from("ingest_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "PENDING")
  if (pendingCount.error) {
    return fail(pendingCount.error.message, 500)
  }

  return ok({ done, failed, pending: pendingCount.count ?? 0 })
}
