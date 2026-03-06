import { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { PG_UNIQUE_VIOLATION } from "@/lib/constants"
import { sha256 } from "@/lib/hash"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { decodeTimestampCursor, encodeTimestampCursor } from "@/lib/pagination"
import { toPositiveInt } from "@/lib/query"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { applyRecordSearchFilter, isTextSearchUnavailable, parseSearchQuery } from "@/lib/record-search"
import { getInvalidOwnedTagIds } from "@/lib/record-tags"
import { CreateRecordSchema, RecordKindSchema, RecordStateSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import type { RecordRow } from "@/lib/types"

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
    .select("id, kind, content, url, source_title, favicon_url, state, interval_days, due_at, last_reviewed_at, review_count, created_at, updated_at", { count: "exact" })
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

  const tagIds = Array.from(new Set(parsed.data.tag_ids ?? []))
  const contentHash = sha256(parsed.data.content)
  const supabase = getSupabaseAdmin()

  if (tagIds.length > 0) {
    const validation = await getInvalidOwnedTagIds(supabase, userId, tagIds)
    if (validation.error) {
      return internalError("records.post", validation.error)
    }

    if (validation.invalidTagIds.length > 0) {
      return fail("Invalid tag_ids", 400)
    }
  }

  const created = await supabase
    .rpc("create_record_with_tags", {
      p_user_id: userId,
      p_kind: parsed.data.kind,
      p_content: parsed.data.content,
      p_content_hash: contentHash,
      p_url: parsed.data.url ?? null,
      p_source_title: parsed.data.source_title ?? null,
      p_tag_ids: tagIds
    })
    .single()

  if (created.error) {
    if (created.error.code === PG_UNIQUE_VIOLATION) {
      if (parsed.data.on_duplicate === "merge") {
        const existing = await supabase
          .from("records")
          .select("*")
          .eq("user_id", userId)
          .eq("content_hash", contentHash)
          .single()

        if (existing.error) {
          return internalError("records.post", existing.error)
        }

        const merged = await supabase
          .rpc("merge_record_with_tags", {
            p_user_id: userId,
            p_content_hash: contentHash,
            p_url: parsed.data.url ?? null,
            p_source_title: parsed.data.source_title ?? null,
            p_tag_ids: tagIds
          })
          .single()

        if (merged.error) {
          return internalError("records.post", merged.error)
        }

        return ok({ ...merged.data, merged: true })
      }

      const existing = await supabase
        .from("records")
        .select("id")
        .eq("user_id", userId)
        .eq("content_hash", contentHash)
        .single()

      return NextResponse.json(
        { error: "Duplicated content", data: { record_id: existing.data?.id ?? null } },
        { status: 409 }
      )
    }

    return internalError("records.post", created.error)
  }
  return ok(created.data, { status: 201 })
}
