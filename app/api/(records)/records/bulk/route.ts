import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { isValidStateTransition, RecordStateSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const BodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  state: RecordStateSchema
})

export async function PATCH(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `records:bulk:patch:${resolveClientKey(request.headers)}`,
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

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const ids = Array.from(new Set(parsed.data.ids))
  const supabase = getSupabaseAdmin()
  const rows = await supabase
    .from("records")
    .select("id, state")
    .eq("user_id", userId)
    .in("id", ids)

  if (rows.error) {
    return fail(rows.error.message, 500)
  }

  const byId = new Map(rows.data.map((row) => [row.id, row.state]))
  const updatableIds: string[] = []
  const failed: Array<{ id: string; reason: string }> = []

  for (const id of ids) {
    const fromState = byId.get(id)
    if (!fromState) {
      failed.push({ id, reason: "Record not found" })
      continue
    }

    if (!isValidStateTransition(fromState, parsed.data.state)) {
      failed.push({ id, reason: "Invalid state transition" })
      continue
    }

    updatableIds.push(id)
  }

  if (updatableIds.length > 0) {
    const updated = await supabase
      .from("records")
      .update({ state: parsed.data.state, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", updatableIds)

    if (updated.error) {
      return fail(updated.error.message, 500)
    }
  }

  return ok({
    requested: ids.length,
    updated: updatableIds.length,
    failed: failed.length,
    failures: failed
  })
}
