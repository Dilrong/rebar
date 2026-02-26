import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, ok } from "@/lib/http"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const ParamsSchema = z.object({ id: z.string().uuid() })
const CreateAnnotationSchema = z.object({
  kind: z.enum(["highlight", "comment", "correction"]),
  body: z.string().min(1)
})

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
  const result = await supabase
    .from("annotations")
    .select("*")
    .eq("record_id", parsed.data.id)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (result.error) {
    return fail(result.error.message, 500)
  }

  return ok({ data: result.data })
}

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
  const parsedBody = CreateAnnotationSchema.safeParse(body)
  if (!parsedBody.success) {
    return fail(parsedBody.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const supabase = getSupabaseAdmin()
  const record = await supabase
    .from("records")
    .select("id")
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .single()

  if (record.error) {
    if (record.error.code === "PGRST116") {
      return fail("Record not found", 404)
    }

    return fail(record.error.message, 500)
  }

  const result = await supabase
    .from("annotations")
    .insert({
      record_id: parsedParams.data.id,
      user_id: userId,
      kind: parsedBody.data.kind,
      body: parsedBody.data.body
    })
    .select("*")
    .single()

  if (result.error) {
    return fail(result.error.message, 500)
  }

  return ok(result.data, { status: 201 })
}
