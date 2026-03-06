import { verifyCronRequest } from "@/lib/cron"
import { retryPendingIngestJobs } from "@feature-lib/capture/retry-jobs"
import { fail, ok } from "@/lib/http"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

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
    console.error("[cron.run] cleanup query failed:", deleted.error.message)
    return { error: true, deleted: 0, cutoff }
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
    return fail("Cron run failed", 500)
  }

  return ok({ ingest, cleanup })
}
