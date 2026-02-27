import { NextRequest } from "next/server"
import { getUserId } from "@/lib/auth"
import { fail, ok, rateLimited } from "@/lib/http"
import { IngestPayloadSchema, processIngest } from "@/lib/ingest"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  const limitResult = await checkRateLimitDistributed({
    key: `capture:ingest:${resolveClientKey(request.headers)}`,
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
  const parsed = IngestPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  try {
    const result = await processIngest(userId, parsed.data)
    return ok(result)
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Ingest failed", 500)
  }
}
