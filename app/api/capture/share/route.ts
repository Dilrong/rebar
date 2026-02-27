import { NextRequest } from "next/server"
import { z } from "zod"
import { POST as ingestPost } from "@/app/api/capture/ingest/route"
import { fail, rateLimited } from "@/lib/http"
import { checkRateLimit, resolveClientKey } from "@/lib/rate-limit"
import { RecordKindSchema } from "@/lib/schemas"

const ShareBodySchema = z
  .object({
    content: z.string().optional(),
    text: z.string().optional(),
    title: z.string().optional(),
    source_title: z.string().optional(),
    url: z.string().url().optional(),
    tags: z.array(z.string().min(1)).optional(),
    kind: RecordKindSchema.optional(),
    default_kind: RecordKindSchema.optional(),
    default_tags: z.array(z.string().min(1)).optional()
  })
  .passthrough()

export async function POST(request: NextRequest) {
  const limitResult = checkRateLimit({
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
        title: parsed.data.title,
        source_title: parsed.data.source_title,
        url: parsed.data.url,
        tags: parsed.data.tags,
        kind: parsed.data.kind
      }
    ],
    default_kind: parsed.data.default_kind,
    default_tags: parsed.data.default_tags
  }

  const ingestRequest = new NextRequest(new URL("/api/capture/ingest", request.url), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(ingestBody)
  })

  return ingestPost(ingestRequest)
}
