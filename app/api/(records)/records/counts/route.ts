import { NextRequest } from "next/server"
import { getUserId } from "@/lib/auth"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function GET(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `records:counts:${resolveClientKey(request.headers)}`,
    limit: 120,
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
  const results = await Promise.all([
    supabase.from("records").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("state", "INBOX"),
    supabase.from("records").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("state", "ACTIVE"),
    supabase.from("records").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("state", "PINNED"),
    supabase.from("records").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("state", "ARCHIVED")
  ])

  for (const result of results) {
    if (result.error) {
      return internalError("records.counts", result.error)
    }
  }

  return ok({
    inbox: results[0].count ?? 0,
    active: results[1].count ?? 0,
    pinned: results[2].count ?? 0,
    archived: results[3].count ?? 0
  })
}
