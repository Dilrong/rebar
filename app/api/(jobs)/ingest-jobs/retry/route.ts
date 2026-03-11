import { NextRequest } from "next/server"
import { getUserId } from "@/lib/auth"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { RetryableIngestJobScopeSchema } from "@feature-lib/capture/ingest-jobs"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { retryPendingIngestJobs } from "@feature-lib/capture/retry-jobs"

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

  const parsedScope = RetryableIngestJobScopeSchema.safeParse(request.nextUrl.searchParams.get("status") ?? "ALL")
  if (!parsedScope.success) {
    return fail("Invalid status", 400)
  }

  const result = await retryPendingIngestJobs({ userId, scope: parsedScope.data })
  if ("error" in result) {
    return internalError("ingest-jobs.retry", result.error)
  }

  return ok(result)
}
