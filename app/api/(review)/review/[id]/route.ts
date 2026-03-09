import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { PGRST_NOT_FOUND } from "@/lib/constants"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { calcNextInterval } from "@feature-lib/review/review"
import { sendRecordStateChangedEvent } from "@feature-lib/notifications/webhooks"
import { ReviewRecordSchema, TriageDecisionSchema, type ReviewAction, type TriageActionType, type TriageDecisionType, type TriageDeferReason } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const ParamsSchema = z.object({ id: z.string().uuid() })

type NormalizedDecision = {
  action: ReviewAction
  snoozeDays?: number
  decisionType: TriageDecisionType | null
  actionType: TriageActionType | null
  deferReason: TriageDeferReason | null
}

function normalizeDecision(body: unknown): NormalizedDecision | null {
  const parsedTriage = TriageDecisionSchema.safeParse(body)
  if (parsedTriage.success) {
    const decision = parsedTriage.data
    if (decision.decisionType === "ARCHIVE") {
      return {
        action: "reviewed",
        decisionType: "ARCHIVE",
        actionType: null,
        deferReason: null
      }
    }

    if (decision.decisionType === "ACT") {
      return {
        action: "reviewed",
        decisionType: "ACT",
        actionType: decision.actionType ?? null,
        deferReason: null
      }
    }

    return {
      action: "resurface",
      snoozeDays: decision.snooze_days ?? 1,
      decisionType: "DEFER",
      actionType: null,
      deferReason: decision.deferReason ?? null
    }
  }

  const parsedReview = ReviewRecordSchema.safeParse(body)
  if (parsedReview.success) {
    return {
      action: parsedReview.data.action,
      snoozeDays: parsedReview.data.snooze_days,
      decisionType: null,
      actionType: null,
      deferReason: null
    }
  }

  return null
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limitResult = await checkRateLimitDistributed({
    key: `review:post:${resolveClientKey(request.headers)}`,
    limit: 60,
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
  const parsedParams = ParamsSchema.safeParse(params)
  if (!parsedParams.success) {
    return fail("Invalid id", 400)
  }

  const body = await request.json().catch(() => null)
  const normalized = normalizeDecision(body)
  if (!normalized) {
    return fail("Invalid payload", 400)
  }

  const supabase = getSupabaseAdmin()
  const current = await supabase
    .from("records")
    .select("id, state, interval_days, due_at, last_reviewed_at, review_count")
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .single()

  if (current.error) {
    if (current.error.code === PGRST_NOT_FOUND) {
      return fail("Record not found", 404)
    }

    return internalError("review", current.error)
  }

  if (!["INBOX", "ACTIVE", "PINNED"].includes(current.data.state)) {
    return fail("Cannot review archived or trashed records", 400)
  }

  const now = new Date()
  const nextInterval =
    normalized.action === "resurface" && normalized.snoozeDays
      ? normalized.snoozeDays
      : calcNextInterval(current.data.interval_days, normalized.action)
  const nextDue = new Date(now)
  nextDue.setDate(nextDue.getDate() + nextInterval)

  const nextState =
    normalized.decisionType === "ARCHIVE"
      ? "ARCHIVED"
      : normalized.decisionType === "ACT"
        ? "PINNED"
        : current.data.state === "INBOX"
          ? "ACTIVE"
          : current.data.state

  const dueAt = normalized.decisionType === "ARCHIVE" ? null : nextDue.toISOString()
  const updated = await supabase
    .from("records")
    .update({
      state: nextState,
      interval_days: nextInterval,
      due_at: dueAt,
      last_reviewed_at: now.toISOString(),
      review_count: current.data.review_count + 1,
      updated_at: now.toISOString()
    })
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (updated.error) {
    return internalError("review", updated.error)
  }

  const logInserted = await supabase.from("review_log").insert({
    user_id: userId,
    record_id: parsedParams.data.id,
    action: normalized.action,
    decision_type: normalized.decisionType,
    action_type: normalized.actionType,
    defer_reason: normalized.deferReason,
    prev_state: current.data.state,
    prev_interval_days: current.data.interval_days,
    prev_due_at: current.data.due_at,
    prev_review_count: current.data.review_count,
    prev_last_reviewed_at: current.data.last_reviewed_at
  })

  if (logInserted.error) {
    return internalError("review", logInserted.error)
  }

  if (current.data.state !== updated.data.state) {
    const webhookResult = await sendRecordStateChangedEvent({
      userId,
      recordId: parsedParams.data.id,
      previousState: current.data.state,
      nextState: updated.data.state,
      source: "review"
    })

    if (!webhookResult.ok) {
      console.error("[review] webhook dispatch failed:", webhookResult.error)
    }
  }

  return ok({ record: updated.data })
}
