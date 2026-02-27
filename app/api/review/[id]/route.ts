import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { PGRST_NOT_FOUND } from "@/lib/constants"
import { fail, ok } from "@/lib/http"
import { calcNextInterval } from "@/lib/review"
import { ReviewRecordSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const ParamsSchema = z.object({ id: z.string().uuid() })

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const params = await context.params
  const parsedParams = ParamsSchema.safeParse(params)
  if (!parsedParams.success) {
    return fail("Invalid id", 400)
  }

  const body = await request.json().catch(() => null)
  const parsedBody = ReviewRecordSchema.safeParse(body)
  if (!parsedBody.success) {
    return fail(parsedBody.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const supabase = getSupabaseAdmin()
  const current = await supabase
    .from("records")
    .select("id, state, interval_days, due_at, review_count")
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .single()

  if (current.error) {
    if (current.error.code === PGRST_NOT_FOUND) {
      return fail("Record not found", 404)
    }

    return fail(current.error.message, 500)
  }

  if (!["INBOX", "ACTIVE", "PINNED"].includes(current.data.state)) {
    return fail("Cannot review archived or trashed records", 400)
  }

  const now = new Date()
  const nextInterval =
    parsedBody.data.action === "resurface" && parsedBody.data.snooze_days
      ? parsedBody.data.snooze_days
      : calcNextInterval(current.data.interval_days, parsedBody.data.action)
  const nextDue = new Date(now)
  nextDue.setDate(nextDue.getDate() + nextInterval)

  const nextState = current.data.state === "INBOX" ? "ACTIVE" : current.data.state
  const updated = await supabase
    .from("records")
    .update({
      state: nextState,
      interval_days: nextInterval,
      due_at: nextDue.toISOString(),
      last_reviewed_at: now.toISOString(),
      review_count: current.data.review_count + 1,
      updated_at: now.toISOString()
    })
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (updated.error) {
    return fail(updated.error.message, 500)
  }

  const logInserted = await supabase.from("review_log").insert({
    user_id: userId,
    record_id: parsedParams.data.id,
    action: parsedBody.data.action,
    prev_state: current.data.state,
    prev_interval_days: current.data.interval_days,
    prev_due_at: current.data.due_at,
    prev_review_count: current.data.review_count
  })

  if (logInserted.error) {
    return fail(logInserted.error.message, 500)
  }

  return ok({ record: updated.data })
}
