import { NextRequest } from "next/server"
import { getUserId } from "@/lib/auth"
import { fail, ok } from "@/lib/http"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

function ymd(input: Date): string {
  return input.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const supabase = getSupabaseAdmin()
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const todayReviewed = await supabase
    .from("review_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("action", ["reviewed", "resurface"])
    .gte("reviewed_at", todayStart.toISOString())

  if (todayReviewed.error) {
    return fail(todayReviewed.error.message, 500)
  }

  const dueCounts = await Promise.all([
    supabase
      .from("records")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("state", ["ACTIVE", "PINNED"])
      .lte("due_at", now.toISOString()),
    supabase
      .from("records")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("state", ["ACTIVE", "PINNED"]),
    supabase
      .from("records")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("state", "TRASHED")
  ])

  for (const result of dueCounts) {
    if (result.error) {
      return fail(result.error.message, 500)
    }
  }

  const streakLogs = await supabase
    .from("review_log")
    .select("reviewed_at, action")
    .eq("user_id", userId)
    .in("action", ["reviewed", "resurface"])
    .order("reviewed_at", { ascending: false })
    .limit(400)

  if (streakLogs.error) {
    return fail(streakLogs.error.message, 500)
  }

  const days = Array.from(new Set(streakLogs.data.map((row) => ymd(new Date(row.reviewed_at))))).sort((a, b) => (a > b ? -1 : 1))
  let streakDays = 0
  let cursor = new Date(todayStart)
  while (days.includes(ymd(cursor))) {
    streakDays += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return ok({
    today_reviewed: todayReviewed.count ?? 0,
    today_remaining: dueCounts[0].count ?? 0,
    streak_days: streakDays,
    total_active: dueCounts[1].count ?? 0,
    total_records: dueCounts[2].count ?? 0
  })
}
