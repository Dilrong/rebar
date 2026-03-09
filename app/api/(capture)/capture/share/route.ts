import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId, isValidOrigin } from "@/lib/auth"
import { fail, ok, rateLimited } from "@/lib/http"
import { processIngest } from "@feature-lib/capture/ingest"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { RecordKindSchema, SourceTypeSchema, TagNameSchema } from "@/lib/schemas"

const ShareBodySchema = z
  .object({
    content: z.string().optional(),
    text: z.string().optional(),
    note: z.string().max(50_000).optional(),
    title: z.string().optional(),
    source_title: z.string().optional(),
    url: z.string().url().optional(),
    tags: z.array(TagNameSchema).optional(),
    kind: RecordKindSchema.optional(),
    source_type: SourceTypeSchema.optional(),
    source_service: z.string().max(200).optional(),
    source_identity: z.string().max(500).optional(),
    adopted_from_ai: z.boolean().optional(),
    default_kind: RecordKindSchema.optional(),
    default_tags: z.array(TagNameSchema).optional()
  })
  .passthrough()

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request.headers)) {
    return fail("Forbidden", 403)
  }

  const limitResult = await checkRateLimitDistributed({
    key: `capture:share:${resolveClientKey(request.headers)}`,
    limit: 60,
    windowMs: 60_000
  })
  if (!limitResult.ok) {
    return rateLimited(limitResult.retryAfterSec)
  }

  const body = await request.json().catch(() => null)
  const parsed = ShareBodySchema.safeParse(body)

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const content = (parsed.data.content ?? parsed.data.text ?? "").trim()
  if (!content) {
    return fail("content is required", 400)
  }

  const ingestBody = {
    items: [
      {
        content,
        note: parsed.data.note,
        title: parsed.data.title,
        source_title: parsed.data.source_title,
        url: parsed.data.url,
        tags: parsed.data.tags,
        kind: parsed.data.kind,
        source_type: parsed.data.source_type,
        source_service: parsed.data.source_service,
        source_identity: parsed.data.source_identity,
        adopted_from_ai: parsed.data.adopted_from_ai
      }
    ],
    default_kind: parsed.data.default_kind,
    default_tags: parsed.data.default_tags
  }

  const userId = await getUserId(request.headers, { allowIngestKey: true })
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  try {
    const result = await processIngest(userId, ingestBody, { importChannel: "share" })
    return ok(result)
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Ingest failed", 500)
  }
}
