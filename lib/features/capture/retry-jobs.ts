import { IngestPayloadSchema, processIngest } from "@feature-lib/capture/ingest"
import { RetryableIngestJobScopeSchema, type RetryableIngestJobScope } from "@feature-lib/capture/ingest-jobs"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const CONCURRENCY = 8
const MAX_ATTEMPTS = 5

type IngestJob = {
  id: string
  user_id: string
  payload: unknown
  attempts: number
  status: "PENDING" | "PROCESSING" | "FAILED" | "DONE"
}

type RetryIngestJobOptions = {
  userId?: string
  scope?: RetryableIngestJobScope
}

function resolveRetryStatuses(scope: RetryableIngestJobScope) {
  if (scope === "ALL") {
    return ["PENDING", "FAILED"] as const
  }

  return [scope] as const
}

async function claimJob(supabase: ReturnType<typeof getSupabaseAdmin>, job: IngestJob) {
  const claimed = await supabase
    .from("ingest_jobs")
    .update({
      status: "PROCESSING",
      updated_at: new Date().toISOString()
    })
    .eq("id", job.id)
    .eq("status", job.status)
    .select("id")

  if (claimed.error) {
    return { claimed: false, error: claimed.error.message }
  }

  return { claimed: (claimed.data ?? []).length > 0, error: null }
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
      .eq("user_id", job.user_id)
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
      .eq("user_id", job.user_id)
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
      .eq("user_id", job.user_id)
    return { done: 0, failed: 1 }
  }
}

export async function retryPendingIngestJobs(options: RetryIngestJobOptions = {}) {
  const supabase = getSupabaseAdmin()
  const parsedScope = RetryableIngestJobScopeSchema.safeParse(options.scope ?? "PENDING")
  const scope = parsedScope.success ? parsedScope.data : "PENDING"
  const statuses = resolveRetryStatuses(scope)

  let jobsQuery = supabase
    .from("ingest_jobs")
    .select("id,user_id,payload,attempts,status")

  if (options.userId) {
    jobsQuery = jobsQuery.eq("user_id", options.userId)
  }

  if (statuses.length === 1) {
    jobsQuery = jobsQuery.eq("status", statuses[0])
  } else {
    jobsQuery = jobsQuery.in("status", [...statuses])
  }

  const jobs = await jobsQuery.order("created_at", { ascending: true }).limit(100)

  if (jobs.error) {
    return { error: jobs.error.message }
  }

  let done = 0
  let failed = 0

  for (let i = 0; i < jobs.data.length; i += CONCURRENCY) {
    const chunk = jobs.data.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      chunk.map(async (job) => {
        const claim = await claimJob(supabase, job)
        if (claim.error) {
          throw new Error(claim.error)
        }

        if (!claim.claimed) {
          return { done: 0, failed: 0 }
        }

        return processOneJob(supabase, job)
      })
    )
    for (const result of settled) {
      if (result.status === "fulfilled") {
        done += result.value.done
        failed += result.value.failed
      } else {
        failed += 1
      }
    }
  }

  const pendingCountQuery = supabase.from("ingest_jobs").select("id", { count: "exact", head: true }).eq("status", "PENDING")
  const pendingCount = options.userId ? await pendingCountQuery.eq("user_id", options.userId) : await pendingCountQuery

  return {
    done,
    failed,
    pending: pendingCount.count ?? 0
  }
}
