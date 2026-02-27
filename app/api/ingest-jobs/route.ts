import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, ok } from "@/lib/http"
import { IngestPayloadSchema } from "@/lib/ingest"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const BodySchema = z.object({
  payload: IngestPayloadSchema,
  error: z.string().optional()
})

export async function GET(request: NextRequest) {
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
    return fail(query.error.message, 500)
  }

  return ok({ data: query.data, total: query.count ?? 0 })
}

export async function POST(request: NextRequest) {
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
    return fail(inserted.error.message, 500)
  }

  return ok({ id: inserted.data.id }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserId(request.headers)
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  const status = request.nextUrl.searchParams.get("status") ?? "PENDING"
  const supabase = getSupabaseAdmin()

  const deleted = await supabase.from("ingest_jobs").delete().eq("user_id", userId).eq("status", status)
  if (deleted.error) {
    return fail(deleted.error.message, 500)
  }

  return ok({ cleared: true })
}
