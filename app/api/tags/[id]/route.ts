import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, ok } from "@/lib/http"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const ParamsSchema = z.object({ id: z.string().uuid() })
const UpdateTagSchema = z.object({
  name: z.string().min(1).max(50)
})

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
  const parsedBody = UpdateTagSchema.safeParse(body)
  if (!parsedBody.success) {
    return fail(parsedBody.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const normalized = parsedBody.data.name.trim()
  if (!normalized) {
    return fail("Tag name is required", 400)
  }

  const supabase = getSupabaseAdmin()
  const updated = await supabase
    .from("tags")
    .update({ name: normalized })
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .select("*")
    .single()

  if (updated.error) {
    if (updated.error.code === "PGRST116") {
      return fail("Tag not found", 404)
    }

    if (updated.error.code === "23505") {
      return fail("Tag already exists", 409)
    }

    return fail(updated.error.message, 500)
  }

  return ok({ tag: updated.data })
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
  const parsedParams = ParamsSchema.safeParse(params)
  if (!parsedParams.success) {
    return fail("Invalid id", 400)
  }

  const supabase = getSupabaseAdmin()
  const deleted = await supabase
    .from("tags")
    .delete()
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .select("id")
    .single()

  if (deleted.error) {
    if (deleted.error.code === "PGRST116") {
      return fail("Tag not found", 404)
    }

    return fail(deleted.error.message, 500)
  }

  return ok({ deleted: true })
}
