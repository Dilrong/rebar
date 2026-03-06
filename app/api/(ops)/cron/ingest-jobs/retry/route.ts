import { verifyCronRequest } from "@/lib/cron"
import { retryPendingIngestJobs } from "@feature-lib/capture/retry-jobs"
import { internalError, ok } from "@/lib/http"

export async function POST(request: Request) {
  const verified = verifyCronRequest(request.headers)
  if (!verified.ok) {
    return verified.response
  }

  const result = await retryPendingIngestJobs()
  if ("error" in result) {
    return internalError("cron.ingest-retry", result.error)
  }

  return ok(result)
}
