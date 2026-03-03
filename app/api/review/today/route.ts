import { NextRequest } from "next/server"
import { getUserId } from "@/lib/auth"
import { fail, ok, rateLimited } from "@/lib/http"
import { toPositiveInt } from "@/lib/query"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export async function GET(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `review:today:${resolveClientKey(request.headers)}`,
    limit: 90,
    windowMs: 60_000
  })
  if (!limitResult.ok) {
    return rateLimited(limitResult.retryAfterSec)
  }

  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const n = Math.min(toPositiveInt(request.nextUrl.searchParams.get("n"), 20), 100)
  const now = new Date().toISOString()
  const supabase = getSupabaseAdmin()

  const [pinned, active] = await Promise.all([
    supabase
      .from("records")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .eq("state", "PINNED")
      .lte("due_at", now)
      .order("due_at", { ascending: true })
      .range(0, n - 1),
    supabase
      .from("records")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .eq("state", "ACTIVE")
      .lte("due_at", now)
      .order("due_at", { ascending: true })
      .range(0, n - 1)
  ])

  if (pinned.error) return fail(pinned.error.message, 500)
  if (active.error) return fail(active.error.message, 500)

  const pinnedData = pinned.data
  const activeData = active.data

  // Trim active to fill up to n total
  const trimmedActive = activeData.slice(0, Math.max(0, n - pinnedData.length))

  return ok({
    data: [...pinnedData, ...trimmedActive],
    total: (pinned.count ?? 0) + (active.count ?? 0)
  })
}
