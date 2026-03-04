import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, ok, rateLimited } from "@/lib/http"
import { decodeTimestampCursor, encodeTimestampCursor } from "@/lib/pagination"
import { toPositiveInt } from "@/lib/query"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { TriageActionTypeSchema, TriageDecisionTypeSchema, TriageDeferReasonSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const ActionSchema = z.enum(["reviewed", "resurface", "undo"])

export async function GET(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `review:history:${resolveClientKey(request.headers)}`,
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

  const params = request.nextUrl.searchParams
  const page = toPositiveInt(params.get("page"), 1)
  const limit = Math.min(toPositiveInt(params.get("limit"), 20), 100)
  const actionParam = params.get("action")
  const decisionTypeParam = params.get("decision_type")
  const actionTypeParam = params.get("action_type")
  const deferReasonParam = params.get("defer_reason")
  const fromParam = params.get("from")
  const toParam = params.get("to")
  const cursorParam = params.get("cursor")
  const from = (page - 1) * limit
  const to = from + limit - 1
  const cursorTs = cursorParam ? decodeTimestampCursor(cursorParam) : null

  if (cursorParam && !cursorTs) {
    return fail("Invalid cursor", 400)
  }

  if (actionParam) {
    const parsedAction = ActionSchema.safeParse(actionParam)
    if (!parsedAction.success) {
      return fail("Invalid action", 400)
    }
  }

  if (decisionTypeParam) {
    const parsedDecisionType = TriageDecisionTypeSchema.safeParse(decisionTypeParam)
    if (!parsedDecisionType.success) {
      return fail("Invalid decision_type", 400)
    }
  }

  if (actionTypeParam) {
    const parsedActionType = TriageActionTypeSchema.safeParse(actionTypeParam)
    if (!parsedActionType.success) {
      return fail("Invalid action_type", 400)
    }
  }

  if (deferReasonParam) {
    const parsedDeferReason = TriageDeferReasonSchema.safeParse(deferReasonParam)
    if (!parsedDeferReason.success) {
      return fail("Invalid defer_reason", 400)
    }
  }

  const fromDate = fromParam ? new Date(fromParam) : null
  const toDate = toParam ? new Date(toParam) : null
  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
    return fail("Invalid date filter", 400)
  }

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from("review_log")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })

  if (actionParam) {
    query = query.eq("action", actionParam)
  }

  if (decisionTypeParam) {
    query = query.eq("decision_type", decisionTypeParam)
  }

  if (actionTypeParam) {
    query = query.eq("action_type", actionTypeParam)
  }

  if (deferReasonParam) {
    query = query.eq("defer_reason", deferReasonParam)
  }

  if (fromDate) {
    query = query.gte("reviewed_at", fromDate.toISOString())
  }

  if (toDate) {
    const inclusiveTo = new Date(toDate)
    inclusiveTo.setHours(23, 59, 59, 999)
    query = query.lte("reviewed_at", inclusiveTo.toISOString())
  }

  if (cursorTs) {
    query = query.lt("reviewed_at", cursorTs)
  }

  const logsResult = cursorTs ? await query.limit(limit) : await query.range(from, to)

  if (logsResult.error) {
    return fail(logsResult.error.message, 500)
  }

  const logs = logsResult.data
  if (logs.length === 0) {
    return ok({ data: [], total: logsResult.count ?? 0, next_cursor: null })
  }

  const recordIds = Array.from(new Set(logs.map((log) => log.record_id)))
  const recordsResult = await supabase
    .from("records")
    .select("id, kind, source_title, content")
    .eq("user_id", userId)
    .in("id", recordIds)

  if (recordsResult.error) {
    return fail(recordsResult.error.message, 500)
  }

  const recordsById = new Map(recordsResult.data.map((record) => [record.id, record]))
  const merged = logs.map((log) => {
    const record = recordsById.get(log.record_id)
    return {
      ...log,
      record: record
        ? {
            id: record.id,
            kind: record.kind,
            source_title: record.source_title,
            content_preview: record.content.slice(0, 220)
          }
        : null
    }
  })

  const nextCursor = merged.length === limit ? encodeTimestampCursor(merged[merged.length - 1].reviewed_at) : null

  return ok({ data: merged, total: logsResult.count ?? 0, next_cursor: nextCursor })
}
