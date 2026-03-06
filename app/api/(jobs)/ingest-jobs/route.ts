import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { IngestPayloadSchema } from "@feature-lib/capture/ingest"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const BodySchema = z.object({
  payload: IngestPayloadSchema,
  error: z.string().optional()
})

export async function GET(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `ingest-jobs:get:${resolveClientKey(request.headers)}`,
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

  const status = request.nextUrl.searchParams.get("status") ?? "PENDING"
  const supabase = getSupabaseAdmin()

  const query = await supabase
    .from("ingest_jobs")
    .select("id,status,attempts,last_error,created_at", { count: "exact" })
    .eq("user_id", userId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(20)

  if (query.error) {
    return internalError("ingest-jobs", query.error)
  }

  return ok({ data: query.data, total: query.count ?? 0 })
}

export async function POST(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `ingest-jobs:post:${resolveClientKey(request.headers)}`,
    limit: 40,
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
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const supabase = getSupabaseAdmin()
  const inserted = await supabase
    .from("ingest_jobs")
    .insert({
      user_id: userId,
      status: "PENDING",
      payload: parsed.data.payload,
      last_error: parsed.data.error ?? null,
      attempts: 0
    })
    .select("id")
    .single()

  if (inserted.error) {
    return internalError("ingest-jobs", inserted.error)
  }

  return ok({ id: inserted.data.id }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `ingest-jobs:delete:${resolveClientKey(request.headers)}`,
    limit: 30,
    windowMs: 60_000
  })
  if (!limitResult.ok) {
    return rateLimited(limitResult.retryAfterSec)
  }

  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const status = request.nextUrl.searchParams.get("status") ?? "PENDING"
  const supabase = getSupabaseAdmin()

  const deleted = await supabase.from("ingest_jobs").delete().eq("user_id", userId).eq("status", status)
  if (deleted.error) {
    return internalError("ingest-jobs", deleted.error)
  }

  return ok({ cleared: true })
}
