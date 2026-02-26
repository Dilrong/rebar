import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { sha256 } from "@/lib/hash"
import { fail, ok } from "@/lib/http"
import { RecordKindSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const ExternalTagSchema = z.union([
  z.string().min(1),
  z.object({ name: z.string().min(1) })
])

const ExternalItemSchema = z
  .object({
    content: z.string().optional(),
    text: z.string().optional(),
    highlight: z.string().optional(),
    note: z.string().optional(),
    title: z.string().optional(),
    source_title: z.string().optional(),
    url: z.string().url().optional(),
    source_url: z.string().url().optional(),
    kind: RecordKindSchema.optional(),
    tags: z.array(ExternalTagSchema).optional()
  })
  .passthrough()

const IngestPayloadSchema = z.object({
  items: z.array(ExternalItemSchema).min(1).max(300),
  default_kind: RecordKindSchema.optional(),
  default_tags: z.array(z.string().min(1)).optional()
})

const UuidSchema = z.string().uuid()

function resolveTagName(tag: z.infer<typeof ExternalTagSchema>): string {
  if (typeof tag === "string") {
    return tag.trim()
  }

  return tag.name.trim()
}

function resolveContent(item: z.infer<typeof ExternalItemSchema>) {
  return (item.content ?? item.text ?? item.highlight ?? item.note ?? "").trim()
}

function resolveUrl(item: z.infer<typeof ExternalItemSchema>) {
  return (item.url ?? item.source_url ?? null)
}

function resolveSourceTitle(item: z.infer<typeof ExternalItemSchema>) {
  const value = (item.source_title ?? item.title ?? "").trim()
  return value.length > 0 ? value : null
}

function resolveKind(item: z.infer<typeof ExternalItemSchema>, fallback: z.infer<typeof RecordKindSchema>) {
  if (item.kind) {
    return item.kind
  }

  return resolveUrl(item) ? "link" : fallback
}

export async function POST(request: NextRequest) {
  const authenticatedUserId = await getUserId(request.headers)

  let userId = authenticatedUserId
  if (!userId) {
    const externalKey = request.headers.get("x-rebar-ingest-key")
    const expectedKey = process.env.REBAR_INGEST_API_KEY
    const externalUserId = request.headers.get("x-user-id")

    if (!externalKey || !expectedKey || externalKey !== expectedKey) {
      return fail("Unauthorized", 401)
    }

    const parsedUserId = UuidSchema.safeParse(externalUserId)
    if (!parsedUserId.success) {
      return fail("Invalid x-user-id", 400)
    }

    userId = parsedUserId.data
  }

  const body = await request.json().catch(() => null)
  const parsed = IngestPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 400)
  }

  const supabase = getSupabaseAdmin()
  const defaultKind = parsed.data.default_kind ?? "note"
  const defaultTagNames = (parsed.data.default_tags ?? []).map((name) => name.trim()).filter((name) => name.length > 0)

  const existingTags = await supabase.from("tags").select("id, name").eq("user_id", userId)
  if (existingTags.error) {
    return fail(existingTags.error.message, 500)
  }

  const tagMap = new Map<string, string>()
  for (const tag of existingTags.data) {
    tagMap.set(tag.name.toLowerCase(), tag.id)
  }

  const createdIds: string[] = []

  for (const item of parsed.data.items) {
    const content = resolveContent(item)
    if (!content) {
      continue
    }

    const url = resolveUrl(item)
    const sourceTitle = resolveSourceTitle(item)
    const kind = resolveKind(item, defaultKind)
    const contentHash = sha256(content)

    const created = await supabase
      .from("records")
      .insert({
        user_id: userId,
        kind,
        content,
        content_hash: contentHash,
        url,
        source_title: sourceTitle,
        state: "INBOX",
        interval_days: 1,
        due_at: null,
        last_reviewed_at: null,
        review_count: 0
      })
      .select("id")
      .single()

    if (created.error) {
      if (created.error.code === "23505") {
        continue
      }

      return fail(created.error.message, 500)
    }

    createdIds.push(created.data.id)

    const itemTagNames = (item.tags ?? []).map(resolveTagName).filter((name) => name.length > 0)
    const mergedTagNames = Array.from(new Set([...defaultTagNames, ...itemTagNames]))

    const linkRows: Array<{ record_id: string; tag_id: string }> = []

    for (const tagName of mergedTagNames) {
      const key = tagName.toLowerCase()
      let tagId = tagMap.get(key)

      if (!tagId) {
        const createdTag = await supabase
          .from("tags")
          .insert({ user_id: userId, name: tagName })
          .select("id")
          .single()

        if (createdTag.error) {
          if (createdTag.error.code === "23505") {
            const loaded = await supabase
              .from("tags")
              .select("id")
              .eq("user_id", userId)
              .eq("name", tagName)
              .single()

            if (loaded.error) {
              return fail(loaded.error.message, 500)
            }

            tagId = loaded.data.id
          } else {
            return fail(createdTag.error.message, 500)
          }
        } else {
          tagId = createdTag.data.id
        }

        if (!tagId) {
          continue
        }

        tagMap.set(key, tagId)
      }

      if (!tagId) {
        continue
      }

      linkRows.push({ record_id: created.data.id, tag_id: tagId })
    }

    if (linkRows.length > 0) {
      const linked = await supabase.from("record_tags").insert(linkRows)
      if (linked.error) {
        return fail(linked.error.message, 500)
      }
    }
  }

  return ok({ created: createdIds.length, ids: createdIds })
}
