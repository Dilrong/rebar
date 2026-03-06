import { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { decodeTimestampCursor, encodeTimestampCursor } from "@/lib/pagination"
import { toPositiveInt } from "@/lib/query"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { applyRecordSearchFilter, isTextSearchUnavailable, parseSearchQuery } from "@/lib/record-search"
import { CreateRecordSchema, RecordKindSchema, RecordStateSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import type { RecordRow } from "@/lib/types"
import { DuplicateRecordError, processIngest } from "@feature-lib/capture/ingest"

const UuidSchema = z.string().uuid()
const SortSchema = z.enum(["created_at", "review_count", "due_at"])
const OrderSchema = z.enum(["asc", "desc"])

export async function GET(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `records:get:${resolveClientKey(request.headers)}`,
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
  const stateParam = params.get("state")
  const kindParam = params.get("kind")
  const tagIdParam = params.get("tag_id")
  const parsedSearch = parseSearchQuery(params.get("q"))
  const cursorParam = params.get("cursor")
  const sortParam = params.get("sort")
  const orderParam = params.get("order")
  const page = toPositiveInt(params.get("page"), 1)
  const limit = Math.min(toPositiveInt(params.get("limit"), 20), 100)
  const from = (page - 1) * limit
  const to = from + limit - 1

  if (parsedSearch.error) {
    return fail(parsedSearch.error, 400)
  }

  const qParam = parsedSearch.value

  const cursorTs = cursorParam ? decodeTimestampCursor(cursorParam) : null
  if (cursorParam && !cursorTs) {
    return fail("Invalid cursor", 400)
  }

  if (cursorParam && sortParam && sortParam !== "created_at") {
    return fail("Cursor pagination supports created_at sort only", 400)
  }

  let validState: z.infer<typeof RecordStateSchema> | undefined
  let validKind: z.infer<typeof RecordKindSchema> | undefined
  let validSort: z.infer<typeof SortSchema> = "created_at"
  let validOrder: z.infer<typeof OrderSchema> = "desc"

  if (stateParam) {
    const parsedState = RecordStateSchema.safeParse(stateParam)
    if (!parsedState.success) {
      return fail("Invalid state", 400)
    }
    validState = parsedState.data
  }

  if (kindParam) {
    const parsedKind = RecordKindSchema.safeParse(kindParam)
    if (!parsedKind.success) {
      return fail("Invalid kind", 400)
    }
    validKind = parsedKind.data
  }

  if (sortParam) {
    const parsedSort = SortSchema.safeParse(sortParam)
    if (!parsedSort.success) {
      return fail("Invalid sort", 400)
    }
    validSort = parsedSort.data
  }

  if (orderParam) {
    const parsedOrder = OrderSchema.safeParse(orderParam)
    if (!parsedOrder.success) {
      return fail("Invalid order", 400)
    }
    validOrder = parsedOrder.data
  }

  if (tagIdParam) {
    const parsedTag = UuidSchema.safeParse(tagIdParam)
    if (!parsedTag.success) {
      return fail("Invalid tag_id", 400)
    }
  }

  const supabase = getSupabaseAdmin()

  let filteredRecordIds: string[] | null = null
  if (tagIdParam) {
    const ownedTag = await supabase
      .from("tags")
      .select("id")
      .eq("id", tagIdParam)
      .eq("user_id", userId)
      .maybeSingle()

    if (ownedTag.error) {
      return internalError("records.get", ownedTag.error)
    }

    if (!ownedTag.data) {
      return ok({ data: [], total: 0 })
    }

    const tagged = await supabase.from("record_tags").select("record_id").eq("tag_id", tagIdParam)
    if (tagged.error) return internalError("records.get", tagged.error)
    filteredRecordIds = tagged.data.map((r) => r.record_id)
    if (filteredRecordIds.length === 0) return ok({ data: [], total: 0 })
  }

  let query = supabase
    .from("records")
    .select("id, user_id, source_id, kind, content, content_hash, url, source_title, favicon_url, current_note, note_updated_at, adopted_from_ai, state, interval_days, due_at, last_reviewed_at, review_count, created_at, updated_at", { count: "exact" })
    .eq("user_id", userId)
    .order(validSort, { ascending: validOrder === "asc", nullsFirst: validSort === "due_at" })

  if (validState) {
    query = query.eq("state", validState)
  }

  if (validKind) {
    query = query.eq("kind", validKind)
  }

  if (!validState) {
    query = query.neq("state", "TRASHED")
  }

  if (filteredRecordIds) {
    query = query.in("id", filteredRecordIds)
  }

  const runQuery = async (useTextSearch: boolean) => {
    let runnable = query

    if (cursorTs) {
      runnable = runnable.lt("created_at", cursorTs)
    }

    if (qParam) {
      runnable = applyRecordSearchFilter(runnable, qParam, useTextSearch)
    }

    if (cursorTs) {
      return runnable.limit(limit)
    }

    return runnable.range(from, to)
  }

  let result = await runQuery(true)
  if (qParam && isTextSearchUnavailable(result.error)) {
    result = await runQuery(false)
  }

  if (result.error) {
    return internalError("records.get", result.error)
  }

  const rows = (result.data ?? []) as RecordRow[]
  const nextCursor = rows.length === limit ? encodeTimestampCursor(rows[rows.length - 1].created_at) : null

  return ok({ data: rows, total: result.count ?? 0, next_cursor: nextCursor })
}

export async function POST(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `records:post:${resolveClientKey(request.headers)}`,
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

  const body = await request.json().catch(() => null)
  const parsed = CreateRecordSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const supabase = getSupabaseAdmin()
  const tagIds = Array.from(new Set(parsed.data.tag_ids ?? []))
  let tagNames: string[] = []

  if (tagIds.length > 0) {
    const ownedTags = await supabase
      .from("tags")
      .select("id, name")
      .eq("user_id", userId)
      .in("id", tagIds)

    if (ownedTags.error) {
      return internalError("records.post", ownedTags.error)
    }

    if ((ownedTags.data ?? []).length !== tagIds.length) {
      return fail("Invalid tag_ids", 400)
    }

    tagNames = ownedTags.data.map((tag) => tag.name)
  }

  try {
    const result = await processIngest(
      userId,
      {
        items: [
          {
            content: parsed.data.content,
            source_title: parsed.data.source_title,
            url: parsed.data.url,
            kind: parsed.data.kind,
            tags: tagNames,
            source_type: parsed.data.source_type,
            source_service: parsed.data.source_service,
            source_identity: parsed.data.source_identity,
            adopted_from_ai: parsed.data.adopted_from_ai
          }
        ]
      },
      {
        importChannel: "manual",
        duplicateMode: parsed.data.on_duplicate === "merge" ? "merge" : "error"
      }
    )

    const recordId = result.ids[0]
    if (!recordId) {
      return fail("Record could not be created", 500)
    }

    const record = await supabase
      .from("records")
      .select("*")
      .eq("id", recordId)
      .eq("user_id", userId)
      .single()

    if (record.error) {
      return internalError("records.post", record.error)
    }

    if (result.created === 0) {
      return ok({ ...(record.data as RecordRow), merged: true })
    }

    return ok(record.data as RecordRow, { status: 201 })
  } catch (error) {
    if (error instanceof DuplicateRecordError) {
      return NextResponse.json(
        { error: "Duplicated content", data: { record_id: error.recordId } },
        { status: 409 }
      )
    }

    return fail(error instanceof Error ? error.message : "Create failed", 500)
  }
}
