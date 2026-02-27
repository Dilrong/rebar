import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { PGRST_NOT_FOUND } from "@/lib/constants"
import { fail, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const ParamsSchema = z.object({ id: z.string().uuid() })

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limitResult = await checkRateLimitDistributed({
    key: `review:undo:${resolveClientKey(request.headers)}`,
    limit: 40,
    windowMs: 60_000
  })
  if (!limitResult.ok) {
    return rateLimited(limitResult.retryAfterSec)
  }

  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const params = await context.params
  const parsed = ParamsSchema.safeParse(params)
  if (!parsed.success) {
    return fail("Invalid id", 400)
  }

  const supabase = getSupabaseAdmin()
  const lastLog = await supabase
    .from("review_log")
    .select("id, reviewed_at, action, prev_state, prev_interval_days, prev_due_at, prev_review_count, prev_last_reviewed_at")
    .eq("user_id", userId)
    .eq("record_id", parsed.data.id)
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .single()

  if (lastLog.error) {
    if (lastLog.error.code === PGRST_NOT_FOUND) {
      return fail("No review log found", 404)
    }
    return fail(lastLog.error.message, 500)
  }

  if (lastLog.data.action === "undo") {
    return fail("Last review action is already undo", 400)
  }

  const diffMs = Date.now() - new Date(lastLog.data.reviewed_at).getTime()
  if (diffMs > 4000) {
    return fail("Undo window expired", 400)
  }

  if (
    !lastLog.data.prev_state ||
    lastLog.data.prev_interval_days === null ||
    lastLog.data.prev_review_count === null
  ) {
    return fail("Undo metadata missing", 400)
  }

  const currentRecord = await supabase
    .from("records")
    .select("updated_at, review_count")
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .single()

  if (currentRecord.error) {
    if (currentRecord.error.code === PGRST_NOT_FOUND) {
      return fail("Record not found", 404)
    }

    return fail(currentRecord.error.message, 500)
  }

  if (currentRecord.data.review_count !== lastLog.data.prev_review_count + 1) {
    return fail("Undo target is stale", 409)
  }

  const restored = await supabase
    .from("records")
    .update({
      state: lastLog.data.prev_state,
      interval_days: lastLog.data.prev_interval_days,
      due_at: lastLog.data.prev_due_at,
      last_reviewed_at: lastLog.data.prev_last_reviewed_at,
      review_count: lastLog.data.prev_review_count,
      updated_at: new Date().toISOString()
    })
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .eq("updated_at", currentRecord.data.updated_at)
    .select("*")
    .single()

  if (restored.error) {
    if (restored.error.code === PGRST_NOT_FOUND) {
      return fail("Undo already applied or record changed", 409)
    }

    return fail(restored.error.message, 500)
  }

  const inserted = await supabase.from("review_log").insert({
    user_id: userId,
    record_id: parsed.data.id,
    action: "undo",
    prev_state: restored.data.state,
    prev_interval_days: restored.data.interval_days,
    prev_due_at: restored.data.due_at,
    prev_review_count: restored.data.review_count,
    prev_last_reviewed_at: restored.data.last_reviewed_at
  })

  if (inserted.error) {
    return fail(inserted.error.message, 500)
  }

  return ok({ record: restored.data })
}
