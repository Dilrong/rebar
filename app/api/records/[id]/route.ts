import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, ok } from "@/lib/http"
import { isValidStateTransition, UpdateRecordSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const ParamsSchema = z.object({ id: z.string().uuid() })

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
  const recordResult = await supabase
    .from("records")
    .select("*")
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .single()

  if (recordResult.error) {
    if (recordResult.error.code === "PGRST116") {
      return fail("Record not found", 404)
    }

    return fail(recordResult.error.message, 500)
  }

  const [annotationsResult, linksResult] = await Promise.all([
    supabase
      .from("annotations")
      .select("*")
      .eq("record_id", parsed.data.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase.from("record_tags").select("tag_id").eq("record_id", parsed.data.id)
  ])

  if (annotationsResult.error) {
    return fail(annotationsResult.error.message, 500)
  }

  if (linksResult.error) {
    return fail(linksResult.error.message, 500)
  }

  const tagIds = linksResult.data.map((item) => item.tag_id)
  let tags: { id: string; name: string }[] = []

  if (tagIds.length > 0) {
    const tagsResult = await supabase
      .from("tags")
      .select("id, name")
      .eq("user_id", userId)
      .in("id", tagIds)
      .order("name", { ascending: true })

    if (tagsResult.error) {
      return fail(tagsResult.error.message, 500)
    }

    tags = tagsResult.data
  }

  return ok({
    record: recordResult.data,
    annotations: annotationsResult.data,
    tags
  })
}

export async function PATCH(
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
  const parsedBody = UpdateRecordSchema.safeParse(body)
  if (!parsedBody.success) {
    return fail(parsedBody.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const supabase = getSupabaseAdmin()
  const existing = await supabase
    .from("records")
    .select("id, state")
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .single()

  if (existing.error) {
    if (existing.error.code === "PGRST116") {
      return fail("Record not found", 404)
    }

    return fail(existing.error.message, 500)
  }

  if (
    parsedBody.data.state &&
    !isValidStateTransition(existing.data.state, parsedBody.data.state)
  ) {
    return fail("Invalid state transition", 400)
  }

  const patch: {
    state?: string
    url?: string | null
    source_title?: string | null
    updated_at: string
  } = {
    updated_at: new Date().toISOString()
  }

  if (parsedBody.data.state) {
    patch.state = parsedBody.data.state
  }

  if (Object.prototype.hasOwnProperty.call(parsedBody.data, "url")) {
    patch.url = parsedBody.data.url ?? null
  }

  if (Object.prototype.hasOwnProperty.call(parsedBody.data, "source_title")) {
    patch.source_title = parsedBody.data.source_title ?? null
  }

  const updated = await supabase
    .from("records")
    .update(patch)
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (updated.error) {
    return fail(updated.error.message, 500)
  }

  if (parsedBody.data.tag_ids) {
    const deleted = await supabase
      .from("record_tags")
      .delete()
      .eq("record_id", parsedParams.data.id)

    if (deleted.error) {
      return fail(deleted.error.message, 500)
    }

    if (parsedBody.data.tag_ids.length > 0) {
      const inserted = await supabase.from("record_tags").insert(
        parsedBody.data.tag_ids.map((tagId) => ({
          record_id: parsedParams.data.id,
          tag_id: tagId
        }))
      )

      if (inserted.error) {
        return fail(inserted.error.message, 500)
      }
    }
  }

  return ok({ record: updated.data })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
  const deleted = await supabase
    .from("records")
    .update({ state: "TRASHED", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (deleted.error) {
    if (deleted.error.code === "PGRST116") {
      return fail("Record not found", 404)
    }

    return fail(deleted.error.message, 500)
  }

  return ok({ record: deleted.data })
}
