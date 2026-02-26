import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { sha256 } from "@/lib/hash"
import { fail, ok } from "@/lib/http"
import { toPositiveInt } from "@/lib/query"
import { CreateRecordSchema, RecordKindSchema, RecordStateSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const UuidSchema = z.string().uuid()

export async function GET(request: NextRequest) {
  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const params = request.nextUrl.searchParams
  const stateParam = params.get("state")
  const kindParam = params.get("kind")
  const tagIdParam = params.get("tag_id")
  const qParam = params.get("q")
  const page = toPositiveInt(params.get("page"), 1)
  const limit = Math.min(toPositiveInt(params.get("limit"), 20), 100)
  const from = (page - 1) * limit
  const to = from + limit - 1

  if (stateParam) {
    const parsedState = RecordStateSchema.safeParse(stateParam)
    if (!parsedState.success) {
      return fail("Invalid state", 400)
    }
  }

  if (kindParam) {
    const parsedKind = RecordKindSchema.safeParse(kindParam)
    if (!parsedKind.success) {
      return fail("Invalid kind", 400)
    }
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
    const tagged = await supabase
      .from("record_tags")
      .select("record_id")
      .eq("tag_id", tagIdParam)

    if (tagged.error) {
      return fail(tagged.error.message, 500)
    }

    filteredRecordIds = tagged.data.map((row) => row.record_id)
    if (filteredRecordIds.length === 0) {
      return ok({ data: [], total: 0 })
    }
  }

  let query = supabase
    .from("records")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (stateParam) {
    query = query.eq("state", stateParam)
  }

  if (kindParam) {
    query = query.eq("kind", kindParam)
  }

  if (!stateParam) {
    query = query.neq("state", "TRASHED")
  }

  if (qParam) {
    const escaped = qParam.replace(/,/g, "")
    query = query.or(`content.ilike.%${escaped}%,source_title.ilike.%${escaped}%`)
  }

  if (filteredRecordIds) {
    query = query.in("id", filteredRecordIds)
  }

  const result = await query.range(from, to)
  if (result.error) {
    return fail(result.error.message, 500)
  }

  return ok({ data: result.data, total: result.count ?? 0 })
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const body = await request.json().catch(() => null)
  const parsed = CreateRecordSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const contentHash = sha256(parsed.data.content)
  const supabase = getSupabaseAdmin()
  const created = await supabase
    .from("records")
    .insert({
      user_id: userId,
      kind: parsed.data.kind,
      content: parsed.data.content,
      content_hash: contentHash,
      url: parsed.data.url ?? null,
      source_title: parsed.data.source_title ?? null,
      state: "INBOX",
      interval_days: 1,
      due_at: null,
      last_reviewed_at: null,
      review_count: 0
    })
    .select("*")
    .single()

  if (created.error) {
    if (created.error.code === "23505") {
      return fail("Duplicated content", 409)
    }

    return fail(created.error.message, 500)
  }

  if (parsed.data.tag_ids && parsed.data.tag_ids.length > 0) {
    const links = parsed.data.tag_ids.map((tagId) => ({
      record_id: created.data.id,
      tag_id: tagId
    }))

    const tagged = await supabase.from("record_tags").insert(links)
    if (tagged.error) {
      return fail(tagged.error.message, 500)
    }
  }

  return ok(created.data, { status: 201 })
}
