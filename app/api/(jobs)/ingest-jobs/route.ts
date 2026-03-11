import { NextRequest } from "next/server"
import { z } from "zod"
import type { Json } from "@/lib/database.types"
import { getUserId } from "@/lib/auth"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { IngestPayloadSchema } from "@feature-lib/capture/ingest"
import { IngestJobScopeSchema, IngestJobStatusSchema, toIngestJobListItem } from "@feature-lib/capture/ingest-jobs"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const StatusSchema = z.enum(["PENDING", "DONE", "FAILED"])
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

  const parsedStatus = IngestJobScopeSchema.safeParse(request.nextUrl.searchParams.get("status") ?? "PENDING")
  if (!parsedStatus.success) {
    return fail("Invalid status", 400)
  }

  const status = parsedStatus.data
  const supabase = getSupabaseAdmin()

  let queryBuilder = supabase
    .from("ingest_jobs")
    .select("id,status,attempts,last_error,created_at,payload", { count: "exact" })
    .eq("user_id", userId)

  if (status !== "ALL") {
    queryBuilder = queryBuilder.eq("status", status)
  }

  const query = await queryBuilder.order("created_at", { ascending: false }).limit(20)

  if (query.error) {
    return internalError("ingest-jobs", query.error)
  }

  const countJobs = async (jobStatus: z.infer<typeof IngestJobStatusSchema>) => {
    const result = await supabase
      .from("ingest_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", jobStatus)

    if (result.error) {
      throw result.error
    }

    return result.count ?? 0
  }

  try {
    const [pending, done, failed] = await Promise.all([countJobs("PENDING"), countJobs("DONE"), countJobs("FAILED")])
    const processing = await countJobs("PROCESSING")

    return ok({
      data: (query.data ?? []).map(toIngestJobListItem),
      total: query.count ?? 0,
      counts: { pending, processing, done, failed }
    })
  } catch (error) {
    return internalError("ingest-jobs.counts", error)
  }
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
      payload: parsed.data.payload as Json,
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

  const parsedStatus = StatusSchema.safeParse(request.nextUrl.searchParams.get("status") ?? "PENDING")
  if (!parsedStatus.success) {
    return fail("Invalid status", 400)
  }

  const status = parsedStatus.data
  const supabase = getSupabaseAdmin()

  const deleted = await supabase.from("ingest_jobs").delete().eq("user_id", userId).eq("status", status)
  if (deleted.error) {
    return internalError("ingest-jobs", deleted.error)
  }

  return ok({ cleared: true })
}
