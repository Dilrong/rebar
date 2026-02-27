import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, ok, rateLimited } from "@/lib/http"
import { decodeTimestampCursor, encodeTimestampCursor } from "@/lib/pagination"
import { checkRateLimit, resolveClientKey } from "@/lib/rate-limit"
import { RecordStateSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const UuidSchema = z.string().uuid()

export async function GET(request: NextRequest) {
  const limitResult = checkRateLimit({
    key: `search:get:${resolveClientKey(request.headers)}`,
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

  const params = request.nextUrl.searchParams
  const q = params.get("q")?.trim() ?? ""
  const state = params.get("state")?.trim() ?? ""
  const tagId = params.get("tag_id")?.trim() ?? ""
  const fromDate = params.get("from")?.trim() ?? ""
  const toDate = params.get("to")?.trim() ?? ""
  const limit = Math.min(Number(params.get("limit") ?? "50") || 50, 100)
  const cursorParam = params.get("cursor")
  const cursorTs = cursorParam ? decodeTimestampCursor(cursorParam) : null
  let validState: z.infer<typeof RecordStateSchema> | undefined

  if (!q && !state && !tagId && !fromDate && !toDate) {
    return fail("At least one filter is required", 400)
  }

  if (cursorParam && !cursorTs) {
    return fail("Invalid cursor", 400)
  }

  if (state) {
    const parsedState = RecordStateSchema.safeParse(state)
    if (!parsedState.success) {
      return fail("Invalid state", 400)
    }

    validState = parsedState.data
  }

  if (tagId) {
    const parsedTag = UuidSchema.safeParse(tagId)
    if (!parsedTag.success) {
      return fail("Invalid tag_id", 400)
    }
  }

  const supabase = getSupabaseAdmin()
  let filteredRecordIds: string[] | null = null

  if (tagId) {
    const tagged = await supabase
      .from("record_tags")
      .select("record_id")
      .eq("tag_id", tagId)

    if (tagged.error) {
      return fail(tagged.error.message, 500)
    }

    filteredRecordIds = tagged.data.map((row) => row.record_id)
    if (filteredRecordIds.length === 0) {
      return ok({ data: [] })
    }
  }

  let query = supabase
    .from("records")
    .select("*")
    .eq("user_id", userId)
    .neq("state", "TRASHED")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (validState) {
    query = query.eq("state", validState)
  }

  if (fromDate) {
    query = query.gte("created_at", `${fromDate}T00:00:00.000Z`)
  }

  if (toDate) {
    query = query.lte("created_at", `${toDate}T23:59:59.999Z`)
  }

  if (filteredRecordIds) {
    query = query.in("id", filteredRecordIds)
  }

  if (cursorTs) {
    query = query.lt("created_at", cursorTs)
  }

  const runQuery = async (useTextSearch: boolean) => {
    let runnable = query

    if (q) {
      if (useTextSearch) {
        runnable = runnable.textSearch("fts", q, { type: "plain", config: "simple" })
      } else {
        const escaped = q.replace(/[,%]/g, "")
        runnable = runnable.or(`content.ilike.%${escaped}%,source_title.ilike.%${escaped}%`)
      }
    }

    return runnable
  }

  let result = await runQuery(true)
  if (q && result.error && /fts|textSearch|column/i.test(result.error.message)) {
    result = await runQuery(false)
  }

  if (result.error) {
    return fail(result.error.message, 500)
  }

  const rows = result.data ?? []
  const nextCursor = rows.length === limit ? encodeTimestampCursor(rows[rows.length - 1].created_at) : null

  return ok({ data: rows, next_cursor: nextCursor })
}
