import { verifyCronRequest } from "@/lib/cron"
import { internalError, ok } from "@/lib/http"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: Request) {
  const verified = verifyCronRequest(request.headers)
  if (!verified.ok) {
    return verified.response
  }

  const supabase = getSupabaseAdmin()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const deleted = await supabase
    .from("records")
    .delete()
    .eq("state", "TRASHED")
    .lt("updated_at", cutoff)
    .select("id")

  if (deleted.error) {
    return internalError("cron.cleanup", deleted.error)
  }

  return ok({ deleted: deleted.data.length, cutoff })
}
