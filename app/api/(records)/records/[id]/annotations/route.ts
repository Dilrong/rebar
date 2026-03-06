import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { PGRST_NOT_FOUND } from "@/lib/constants"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const ParamsSchema = z.object({ id: z.string().uuid() })
const CreateAnnotationSchema = z.object({
  kind: z.enum(["highlight", "comment", "correction"]),
  body: z.string().min(1).max(10_000),
  anchor: z.string().optional()
})

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limitResult = await checkRateLimitDistributed({
    key: `annotations:get:${resolveClientKey(request.headers)}`,
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
    return internalError("annotations.get", result.error)
  }

  return ok({ data: result.data })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limitResult = await checkRateLimitDistributed({
    key: `annotations:post:${resolveClientKey(request.headers)}`,
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
    if (record.error.code === PGRST_NOT_FOUND) {
      return fail("Record not found", 404)
    }

    return internalError("annotations.post", record.error)
  }

  const result = await supabase
    .from("annotations")
    .insert({
      record_id: parsedParams.data.id,
      user_id: userId,
      kind: parsedBody.data.kind,
      body: parsedBody.data.body,
      anchor: parsedBody.data.anchor ?? null
    })
    .select("*")
    .single()

  if (result.error) {
    return internalError("annotations.post", result.error)
  }

  return ok(result.data, { status: 201 })
}
