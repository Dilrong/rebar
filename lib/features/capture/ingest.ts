import { z } from "zod"
import { sha256 } from "@/lib/hash"
import { RecordKindSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

/** Resolve a favicon URL from a page URL using Google's favicon service. */
function resolveFaviconUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const { hostname } = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`
  } catch {
    return null
  }
}

export const ExternalTagSchema = z.union([z.string().min(1), z.object({ name: z.string().min(1) })])

export const ExternalItemSchema = z
  .object({
    content: z.string().max(50_000).optional(),
    text: z.string().max(50_000).optional(),
    highlight: z.string().max(50_000).optional(),
    note: z.string().max(50_000).optional(),
    title: z.string().max(500).optional(),
    source_title: z.string().max(500).optional(),
    url: z.string().url().optional(),
    source_url: z.string().url().optional(),
    kind: RecordKindSchema.optional(),
    tags: z.array(ExternalTagSchema).optional()
  })
  .passthrough()

export const IngestPayloadSchema = z.object({
  items: z.array(ExternalItemSchema).min(1).max(300),
  default_kind: RecordKindSchema.optional(),
  default_tags: z.array(z.string().min(1)).optional()
})

export type IngestPayload = z.infer<typeof IngestPayloadSchema>

function resolveTagName(tag: z.infer<typeof ExternalTagSchema>): string {
  if (typeof tag === "string") {
    return tag.trim()
  }

  return tag.name.trim()
}

export function resolveContent(item: z.infer<typeof ExternalItemSchema>) {
  return (item.content ?? item.text ?? item.highlight ?? item.note ?? "").trim()
}

function resolveUrl(item: z.infer<typeof ExternalItemSchema>) {
  return item.url ?? item.source_url ?? null
}

function resolveSourceTitle(item: z.infer<typeof ExternalItemSchema>) {
  const value = (item.source_title ?? item.title ?? "").trim()
  return value.length > 0 ? value : null
}

export function resolveKind(item: z.infer<typeof ExternalItemSchema>, fallback: z.infer<typeof RecordKindSchema>) {
  if (item.kind) {
    return item.kind
  }

  return resolveUrl(item) ? "link" : fallback
}

export async function processIngest(userId: string, payload: IngestPayload) {
  const supabase = getSupabaseAdmin()
  const defaultKind = payload.default_kind ?? "note"
  const defaultTagNames = (payload.default_tags ?? []).map((name) => name.trim()).filter((name) => name.length > 0)
  const defaultTagSet = new Set(defaultTagNames)

  let skippedEmpty = 0

  const byHash = new Map<
    string,
    {
      content: string
      content_hash: string
      kind: z.infer<typeof RecordKindSchema>
      url: string | null
      source_title: string | null
      favicon_url: string | null
      tagNames: Set<string>
    }
  >()

  for (const item of payload.items) {
    const content = resolveContent(item)
    if (!content) {
      skippedEmpty += 1
      continue
    }

    const contentHash = sha256(content)
    const existing = byHash.get(contentHash)
    const itemTagNames = (item.tags ?? []).map(resolveTagName).filter((name) => name.length > 0)
    const mergedTags = [...defaultTagSet, ...itemTagNames]

    if (!existing) {
      byHash.set(contentHash, {
        content,
        content_hash: contentHash,
        kind: resolveKind(item, defaultKind),
        url: resolveUrl(item),
        source_title: resolveSourceTitle(item),
        favicon_url: resolveFaviconUrl(resolveUrl(item)),
        tagNames: new Set(mergedTags)
      })
      continue
    }

    if (!existing.url) {
      existing.url = resolveUrl(item)
      existing.favicon_url = resolveFaviconUrl(existing.url)
    }
    if (!existing.source_title) {
      existing.source_title = resolveSourceTitle(item)
    }
    for (const tagName of mergedTags) {
      existing.tagNames.add(tagName)
    }
  }

  const preparedRows = Array.from(byHash.values())
  if (preparedRows.length === 0) {
    return {
      created: 0,
      ids: [],
      skipped_empty: skippedEmpty,
      skipped_duplicate: 0,
      total: payload.items.length
    }
  }

  const allTagNames = new Set<string>(defaultTagNames)
  for (const row of preparedRows) {
    for (const tagName of row.tagNames) {
      allTagNames.add(tagName)
    }
  }

  const existingTags = await supabase.from("tags").select("id, name").eq("user_id", userId)
  if (existingTags.error) {
    throw new Error(existingTags.error.message)
  }

  const tagMap = new Map<string, string>()
  for (const tag of existingTags.data) {
    tagMap.set(tag.name.toLowerCase(), tag.id)
  }

  const missingTags: string[] = []
  for (const tagName of allTagNames) {
    if (!tagMap.has(tagName.toLowerCase())) {
      missingTags.push(tagName)
    }
  }

  if (missingTags.length > 0) {
    const upsertedTags = await supabase.from("tags").upsert(
      missingTags.map((name) => ({ user_id: userId, name })),
      { onConflict: "user_id,name", ignoreDuplicates: true }
    )
    if (upsertedTags.error) {
      throw new Error(upsertedTags.error.message)
    }

    const refreshedTags = await supabase.from("tags").select("id, name").eq("user_id", userId)
    if (refreshedTags.error) {
      throw new Error(refreshedTags.error.message)
    }

    for (const tag of refreshedTags.data) {
      tagMap.set(tag.name.toLowerCase(), tag.id)
    }
  }

  const recordRows = preparedRows.map((row) => ({
    user_id: userId,
    kind: row.kind,
    content: row.content,
    content_hash: row.content_hash,
    url: row.url,
    source_title: row.source_title,
    favicon_url: row.favicon_url,
    state: "INBOX" as const,
    interval_days: 1,
    due_at: null,
    last_reviewed_at: null,
    review_count: 0
  }))

  const createdRecords = await supabase
    .from("records")
    .upsert(recordRows, { onConflict: "user_id,content_hash", ignoreDuplicates: true })
    .select("id, content_hash")

  if (createdRecords.error) {
    throw new Error(createdRecords.error.message)
  }

  const createdIds = createdRecords.data.map((row) => row.id)
  const createdHashToId = new Map(createdRecords.data.map((row) => [row.content_hash, row.id]))

  const recordTagLinks: Array<{ record_id: string; tag_id: string }> = []
  for (const row of preparedRows) {
    const recordId = createdHashToId.get(row.content_hash)
    if (!recordId) {
      continue
    }

    for (const tagName of row.tagNames) {
      const tagId = tagMap.get(tagName.toLowerCase())
      if (tagId) {
        recordTagLinks.push({ record_id: recordId, tag_id: tagId })
      }
    }
  }

  if (recordTagLinks.length > 0) {
    const linked = await supabase.from("record_tags").upsert(recordTagLinks, { onConflict: "record_id,tag_id" })
    if (linked.error) {
      throw new Error(linked.error.message)
    }
  }

  const skippedDuplicate = preparedRows.length - createdIds.length

  return {
    created: createdIds.length,
    ids: createdIds,
    skipped_empty: skippedEmpty,
    skipped_duplicate: Math.max(skippedDuplicate, 0),
    total: payload.items.length
  }
}
