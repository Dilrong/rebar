import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { PG_UNIQUE_VIOLATION } from "@/lib/constants"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { TagNameSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const CreateTagSchema = z.object({
  name: TagNameSchema
})

export async function GET(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `tags:get:${resolveClientKey(request.headers)}`,
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

  const supabase = getSupabaseAdmin()
  const result = await supabase
    .from("tags")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true })

  if (result.error) {
    return internalError("tags", result.error)
  }

  return ok({ data: result.data })
}

export async function POST(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `tags:post:${resolveClientKey(request.headers)}`,
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
  const parsed = CreateTagSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const normalized = parsed.data.name.trim()
  if (!normalized) {
    return fail("Tag name is required", 400)
  }

  const supabase = getSupabaseAdmin()
  const created = await supabase
    .from("tags")
    .insert({ user_id: userId, name: normalized })
    .select("*")
    .single()

  if (created.error) {
    if (created.error.code === PG_UNIQUE_VIOLATION) {
      return fail("Tag already exists", 409)
    }

    return internalError("tags", created.error)
  }

  return ok({ tag: created.data }, { status: 201 })
}
