import { randomUUID } from "node:crypto"
import { z } from "zod"
import { sha256 } from "@/lib/hash"
import { RecordKindSchema, TagNameSchema } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import type { ImportChannel, JsonValue, RecordRow, SourceRow, SourceType } from "@/lib/types"

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

const SourceTypeSchema = z.enum(["book", "article", "service", "manual", "ai", "unknown"])
const ImportChannelSchema = z.enum(["manual", "csv", "json", "api", "share", "extension", "url", "ocr"])

export class DuplicateRecordError extends Error {
  recordId: string | null

  constructor(recordId: string | null) {
    super("Duplicated content")
    this.name = "DuplicateRecordError"
    this.recordId = recordId
  }
}

export const ExternalTagSchema = z.union([TagNameSchema, z.object({ name: TagNameSchema })])

export const ExternalItemSchema = z
  .object({
    content: z.string().max(50_000).optional(),
    text: z.string().max(50_000).optional(),
    highlight: z.string().max(50_000).optional(),
    note: z.string().max(50_000).optional(),
    title: z.string().max(500).optional(),
    source_title: z.string().max(500).optional(),
    book_title: z.string().max(500).optional(),
    bookauthor: z.string().max(500).optional(),
    book_author: z.string().max(500).optional(),
    author: z.string().max(500).optional(),
    url: z.string().url().optional(),
    source_url: z.string().url().optional(),
    kind: RecordKindSchema.optional(),
    tags: z.array(ExternalTagSchema).optional(),
    source_type: SourceTypeSchema.optional(),
    source_service: z.string().max(200).optional(),
    service: z.string().max(200).optional(),
    source_identity: z.string().max(500).optional(),
    external_source_id: z.string().max(500).optional(),
    external_item_id: z.string().max(500).optional(),
    anchor: z.string().max(1_000).optional(),
    location: z.string().max(1_000).optional(),
    adopted_from_ai: z.boolean().optional()
  })
  .passthrough()

export const IngestPayloadSchema = z.object({
  items: z.array(ExternalItemSchema).min(1).max(300),
  default_kind: RecordKindSchema.optional(),
  default_tags: z.array(TagNameSchema).optional(),
  import_channel: ImportChannelSchema.optional()
})

export type IngestPayload = z.infer<typeof IngestPayloadSchema>

type TagRow = {
  id: string
  name: string
}

type ProcessIngestOptions = {
  duplicateMode?: "error" | "merge"
  importChannel?: ImportChannel
}

type PreparedSource = {
  sourceType: SourceType
  identityKey: string
  title: string | null
  author: string | null
  url: string | null
  service: string | null
  externalSourceId: string | null
}

type PreparedRecord = {
  content: string
  contentHash: string
  kind: z.infer<typeof RecordKindSchema>
  sourceKey: string
  currentNote: string | null
  noteSnapshot: string | null
  adoptedFromAi: boolean
  tagNames: Set<string>
  source: PreparedSource
  externalItemId: string | null
  externalAnchor: string | null
}

function resolveTagName(tag: z.infer<typeof ExternalTagSchema>): string {
  if (typeof tag === "string") {
    return tag.trim()
  }

  return tag.name.trim()
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = asTrimmedString(value)
    if (trimmed) {
      return trimmed
    }
  }

  return null
}

export function resolveContent(item: z.infer<typeof ExternalItemSchema>) {
  return firstNonEmpty(item.content, item.text, item.highlight, item.note) ?? ""
}

function resolvePrimaryContent(item: z.infer<typeof ExternalItemSchema>) {
  return firstNonEmpty(item.content, item.text, item.highlight)
}

function resolveNote(item: z.infer<typeof ExternalItemSchema>) {
  return asTrimmedString(item.note)
}

function resolveRecordContent(item: z.infer<typeof ExternalItemSchema>) {
  return resolvePrimaryContent(item) ?? resolveNote(item) ?? ""
}

function resolveCurrentNote(item: z.infer<typeof ExternalItemSchema>) {
  const primary = resolvePrimaryContent(item)
  const note = resolveNote(item)
  return primary && note ? note : null
}

function resolveUrl(item: z.infer<typeof ExternalItemSchema>) {
  return firstNonEmpty(item.url, item.source_url)
}

function resolveSourceTitleParts(item: z.infer<typeof ExternalItemSchema>) {
  return {
    title: firstNonEmpty(item.book_title, item.source_title, item.title),
    author: firstNonEmpty(item.book_author, item.bookauthor, item.author)
  }
}

function resolveSourceService(item: z.infer<typeof ExternalItemSchema>) {
  return firstNonEmpty(item.source_service, item.service)
}

function resolveSourceType(item: z.infer<typeof ExternalItemSchema>, importChannel: ImportChannel): SourceType {
  if (item.source_type) {
    return item.source_type
  }

  const { title, author } = resolveSourceTitleParts(item)
  const url = resolveUrl(item)
  const service = resolveSourceService(item)
  const kind = item.kind

  if (title && author) {
    return "book"
  }

  if (url) {
    return service ? "service" : "article"
  }

  if (service) {
    return "service"
  }

  if (kind === "ai" || item.adopted_from_ai) {
    return "ai"
  }

  if (importChannel === "manual") {
    return "manual"
  }

  return "unknown"
}

function buildSourceIdentityKey(
  item: z.infer<typeof ExternalItemSchema>,
  sourceType: SourceType,
  importChannel: ImportChannel
) {
  const explicitIdentity = firstNonEmpty(item.source_identity, item.external_source_id)
  if (explicitIdentity) {
    return `${sourceType}:${explicitIdentity.toLowerCase()}`
  }

  const { title, author } = resolveSourceTitleParts(item)
  const url = resolveUrl(item)
  const service = resolveSourceService(item)

  if (sourceType === "book" && title) {
    return `book:${title.toLowerCase()}::${(author ?? "").toLowerCase()}`
  }

  if (sourceType === "article" && url) {
    return `article:${url.toLowerCase()}`
  }

  if (sourceType === "service") {
    const externalSourceId = firstNonEmpty(item.external_source_id)
    if (service && externalSourceId) {
      return `service:${service.toLowerCase()}::${externalSourceId.toLowerCase()}`
    }
    if (service && url) {
      return `service:${service.toLowerCase()}::${url.toLowerCase()}`
    }
    if (service && title) {
      return `service:${service.toLowerCase()}::${title.toLowerCase()}`
    }
  }

  if ((sourceType === "manual" || sourceType === "ai") && !url && !title && !author) {
    return `${sourceType}:${importChannel}:${randomUUID()}`
  }

  if (url) {
    return `${sourceType}:${url.toLowerCase()}`
  }

  if (title) {
    return `${sourceType}:${title.toLowerCase()}::${(author ?? "").toLowerCase()}`
  }

  return `${sourceType}:${importChannel}:${randomUUID()}`
}

function buildDisplaySourceTitle(source: Pick<PreparedSource, "title" | "author">) {
  if (source.title && source.author) {
    return `${source.title} - ${source.author}`
  }

  return source.title ?? source.author ?? null
}

export function resolveKind(item: z.infer<typeof ExternalItemSchema>, fallback: z.infer<typeof RecordKindSchema>) {
  if (item.kind) {
    return item.kind
  }

  if (!resolvePrimaryContent(item) && resolveNote(item)) {
    return "note"
  }

  return resolveUrl(item) ? "link" : fallback
}

function addTagsToMap(tagMap: Map<string, string>, tags: TagRow[]) {
  for (const tag of tags) {
    tagMap.set(tag.name.toLowerCase(), tag.id)
  }
}

async function ensureTags(userId: string, tagNames: Set<string>) {
  const supabase = getSupabaseAdmin()
  const existingTags = await supabase.from("tags").select("id, name").eq("user_id", userId)
  if (existingTags.error) {
    throw new Error(existingTags.error.message)
  }

  const tagMap = new Map<string, string>()
  addTagsToMap(tagMap, existingTags.data)

  const missingTags = Array.from(tagNames).filter((name) => !tagMap.has(name.toLowerCase()))

  if (missingTags.length > 0) {
    const upsertedTags = await supabase
      .from("tags")
      .upsert(
        missingTags.map((name) => ({ user_id: userId, name })),
        { onConflict: "user_id,name", ignoreDuplicates: true }
      )
      .select("id, name")

    if (upsertedTags.error) {
      throw new Error(upsertedTags.error.message)
    }

    addTagsToMap(tagMap, upsertedTags.data ?? [])

    const unresolvedTagNames = missingTags.filter((name) => !tagMap.has(name.toLowerCase()))
    if (unresolvedTagNames.length > 0) {
      const refreshedTags = await supabase.from("tags").select("id, name").eq("user_id", userId)
      if (refreshedTags.error) {
        throw new Error(refreshedTags.error.message)
      }

      addTagsToMap(tagMap, refreshedTags.data)
    }
  }

  return tagMap
}

function mergePreparedSource(existing: PreparedSource, next: PreparedSource): PreparedSource {
  return {
    sourceType: existing.sourceType,
    identityKey: existing.identityKey,
    title: existing.title ?? next.title,
    author: existing.author ?? next.author,
    url: existing.url ?? next.url,
    service: existing.service ?? next.service,
    externalSourceId: existing.externalSourceId ?? next.externalSourceId
  }
}

function mergePreparedRecord(existing: PreparedRecord, next: PreparedRecord): PreparedRecord {
  const currentNote = next.currentNote ?? existing.currentNote
  const noteSnapshot = next.noteSnapshot ?? existing.noteSnapshot

  for (const tagName of next.tagNames) {
    existing.tagNames.add(tagName)
  }

  return {
    ...existing,
    kind: existing.kind,
    currentNote,
    noteSnapshot,
    adoptedFromAi: existing.adoptedFromAi || next.adoptedFromAi,
    source: mergePreparedSource(existing.source, next.source),
    externalItemId: next.externalItemId ?? existing.externalItemId,
    externalAnchor: next.externalAnchor ?? existing.externalAnchor
  }
}

function buildSourceSnapshot(source: PreparedSource): JsonValue {
  return {
    source_type: source.sourceType,
    identity_key: source.identityKey,
    title: source.title,
    author: source.author,
    url: source.url,
    service: source.service,
    external_source_id: source.externalSourceId
  }
}

function buildSourceKey(sourceType: SourceType, identityKey: string) {
  return `${sourceType}::${identityKey}`
}

async function loadSourcesByType(userId: string, sourceType: SourceType, identityKeys: string[]) {
  const supabase = getSupabaseAdmin()
  const result = await supabase
    .from("sources")
    .select("id, user_id, source_type, identity_key, title, author, url, service, external_source_id, created_at, updated_at")
    .eq("user_id", userId)
    .eq("source_type", sourceType)
    .in("identity_key", identityKeys)

  if (result.error) {
    throw new Error(result.error.message)
  }

  return (result.data ?? []) as SourceRow[]
}

async function ensureSources(userId: string, preparedSources: Map<string, PreparedSource>) {
  const supabase = getSupabaseAdmin()
  const byType = new Map<SourceType, Set<string>>()

  for (const source of preparedSources.values()) {
    const keys = byType.get(source.sourceType) ?? new Set<string>()
    keys.add(source.identityKey)
    byType.set(source.sourceType, keys)
  }

  for (const [sourceType, identityKeysSet] of byType) {
    const identityKeys = Array.from(identityKeysSet)
    if (identityKeys.length === 0) {
      continue
    }

    const existingRows = await loadSourcesByType(userId, sourceType, identityKeys)
    const existingByIdentity = new Map(existingRows.map((row) => [row.identity_key, row]))
    const missingRows = identityKeys
      .filter((identityKey) => !existingByIdentity.has(identityKey))
      .map((identityKey) => {
        const source = preparedSources.get(buildSourceKey(sourceType, identityKey))
        if (!source) {
          return null
        }

        return {
          user_id: userId,
          source_type: source.sourceType,
          identity_key: source.identityKey,
          title: source.title,
          author: source.author,
          url: source.url,
          service: source.service,
          external_source_id: source.externalSourceId
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    if (missingRows.length > 0) {
      const created = await supabase
        .from("sources")
        .upsert(missingRows, { onConflict: "user_id,source_type,identity_key", ignoreDuplicates: true })
        .select("id, user_id, source_type, identity_key, title, author, url, service, external_source_id, created_at, updated_at")

      if (created.error) {
        throw new Error(created.error.message)
      }
    }

    const refreshedRows = await loadSourcesByType(userId, sourceType, identityKeys)
    const updates = refreshedRows.flatMap((row) => {
      const source = preparedSources.get(buildSourceKey(row.source_type, row.identity_key))
      if (!source) {
        return []
      }

      const patch = {
        title: row.title ?? source.title,
        author: row.author ?? source.author,
        url: row.url ?? source.url,
        service: row.service ?? source.service,
        external_source_id: row.external_source_id ?? source.externalSourceId
      }

      const changed =
        patch.title !== row.title ||
        patch.author !== row.author ||
        patch.url !== row.url ||
        patch.service !== row.service ||
        patch.external_source_id !== row.external_source_id

      if (!changed) {
        return []
      }

      return [{ id: row.id, patch }]
    })

    if (updates.length > 0) {
      await Promise.all(
        updates.map(async ({ id, patch }) => {
          const updated = await supabase
            .from("sources")
            .update(patch)
            .eq("id", id)
            .eq("user_id", userId)
          if (updated.error) {
            throw new Error(updated.error.message)
          }
        })
      )
    }
  }

  const resolvedSources: SourceRow[] = []
  for (const [sourceType, identityKeysSet] of byType) {
    resolvedSources.push(...(await loadSourcesByType(userId, sourceType, Array.from(identityKeysSet))))
  }

  return new Map(resolvedSources.map((row) => [buildSourceKey(row.source_type, row.identity_key), row]))
}

async function syncSourceDisplayFields(userId: string, sources: SourceRow[]) {
  const supabase = getSupabaseAdmin()
  const uniqueSources = Array.from(new Map(sources.map((source) => [source.id, source])).values())

  await Promise.all(
    uniqueSources.map(async (source) => {
      const updated = await supabase
        .from("records")
        .update({
          source_title: buildDisplaySourceTitle({
            title: source.title,
            author: source.author
          }),
          url: source.url,
          favicon_url: resolveFaviconUrl(source.url)
        })
        .eq("user_id", userId)
        .eq("source_id", source.id)

      if (updated.error) {
        throw new Error(updated.error.message)
      }
    })
  )
}

async function loadRecordsBySourceAndHash(userId: string, sourceIds: string[], contentHashes: string[]) {
  if (sourceIds.length === 0 || contentHashes.length === 0) {
    return [] as RecordRow[]
  }

  const supabase = getSupabaseAdmin()
  const result = await supabase
    .from("records")
    .select("id, user_id, source_id, kind, content, content_hash, url, source_title, favicon_url, current_note, note_updated_at, adopted_from_ai, state, interval_days, due_at, last_reviewed_at, review_count, created_at, updated_at")
    .eq("user_id", userId)
    .in("source_id", sourceIds)
    .in("content_hash", contentHashes)

  if (result.error) {
    throw new Error(result.error.message)
  }

  return (result.data ?? []) as RecordRow[]
}

export async function processIngest(userId: string, payload: IngestPayload, options: ProcessIngestOptions = {}) {
  const supabase = getSupabaseAdmin()
  const defaultKind = payload.default_kind ?? "note"
  const defaultTagNames = (payload.default_tags ?? []).map((name) => name.trim()).filter((name) => name.length > 0)
  const importChannel = options.importChannel ?? payload.import_channel ?? "api"
  const duplicateMode = options.duplicateMode ?? "merge"
  const defaultTagSet = new Set(defaultTagNames)
  const preparedByKey = new Map<string, PreparedRecord>()

  let skippedEmpty = 0

  for (const item of payload.items) {
    const content = resolveRecordContent(item)
    if (!content) {
      skippedEmpty += 1
      continue
    }

    const sourceType = resolveSourceType(item, importChannel)
    const source = {
      sourceType,
      identityKey: buildSourceIdentityKey(item, sourceType, importChannel),
      title: resolveSourceTitleParts(item).title,
      author: resolveSourceTitleParts(item).author,
      url: resolveUrl(item),
      service: resolveSourceService(item),
      externalSourceId: firstNonEmpty(item.external_source_id)
    } satisfies PreparedSource
    const sourceKey = buildSourceKey(source.sourceType, source.identityKey)
    const contentHash = sha256(content)
    const itemTagNames = (item.tags ?? []).map(resolveTagName).filter((name) => name.length > 0)
    const prepared: PreparedRecord = {
      content,
      contentHash,
      kind: resolveKind(item, defaultKind),
      sourceKey,
      currentNote: resolveCurrentNote(item),
      noteSnapshot: resolveNote(item),
      adoptedFromAi: Boolean(item.adopted_from_ai || sourceType === "ai" || item.kind === "ai"),
      tagNames: new Set([...defaultTagSet, ...itemTagNames]),
      source,
      externalItemId: firstNonEmpty(item.external_item_id),
      externalAnchor: firstNonEmpty(item.anchor, item.location)
    }

    const dedupeKey = `${sourceKey}::${contentHash}`
    const existing = preparedByKey.get(dedupeKey)
    if (!existing) {
      preparedByKey.set(dedupeKey, prepared)
      continue
    }

    preparedByKey.set(dedupeKey, mergePreparedRecord(existing, prepared))
  }

  const preparedRows = Array.from(preparedByKey.values())
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
  const preparedSources = new Map<string, PreparedSource>()
  for (const row of preparedRows) {
    preparedSources.set(row.sourceKey, row.source)
    for (const tagName of row.tagNames) {
      allTagNames.add(tagName)
    }
  }

  const [tagMap, sourceMap] = await Promise.all([ensureTags(userId, allTagNames), ensureSources(userId, preparedSources)])

  const sourceIds = Array.from(new Set(preparedRows.map((row) => sourceMap.get(row.sourceKey)?.id).filter((id): id is string => Boolean(id))))
  const contentHashes = Array.from(new Set(preparedRows.map((row) => row.contentHash)))
  const existingRecords = await loadRecordsBySourceAndHash(userId, sourceIds, contentHashes)
  const existingByKey = new Map(existingRecords.map((record) => [`${record.source_id}::${record.content_hash}`, record]))

  if (duplicateMode === "error") {
    const duplicate = preparedRows.find((row) => {
      const sourceId = sourceMap.get(row.sourceKey)?.id
      if (!sourceId) {
        return false
      }

      return existingByKey.has(`${sourceId}::${row.contentHash}`)
    })

    if (duplicate) {
      const sourceId = sourceMap.get(duplicate.sourceKey)?.id ?? null
      const existing = sourceId ? existingByKey.get(`${sourceId}::${duplicate.contentHash}`) : null
      throw new DuplicateRecordError(existing?.id ?? null)
    }
  }

  const recordRows = preparedRows
    .map((row) => {
      const source = sourceMap.get(row.sourceKey)
      if (!source?.id) {
        return null
      }

      return {
        user_id: userId,
        source_id: source.id,
        kind: row.kind,
        content: row.content,
        content_hash: row.contentHash,
        url: source.url,
        source_title: buildDisplaySourceTitle({
          title: source.title,
          author: source.author
        }),
        favicon_url: resolveFaviconUrl(source.url),
        current_note: row.currentNote,
        note_updated_at: row.currentNote ? new Date().toISOString() : null,
        adopted_from_ai: row.adoptedFromAi,
        state: "INBOX" as const,
        interval_days: 1,
        due_at: null,
        last_reviewed_at: null,
        review_count: 0
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  const newRecordRows = recordRows.filter((row) => !existingByKey.has(`${row.source_id}::${row.content_hash}`))
  let createdIds: string[] = []

  if (newRecordRows.length > 0) {
    const createdRecords = await supabase
      .from("records")
      .upsert(newRecordRows, { onConflict: "user_id,source_id,content_hash", ignoreDuplicates: true })
      .select("id, source_id, content_hash")

    if (createdRecords.error) {
      throw new Error(createdRecords.error.message)
    }

    createdIds = (createdRecords.data ?? []).map((row) => row.id)
  }

  const finalRecords = await loadRecordsBySourceAndHash(userId, sourceIds, contentHashes)
  const finalByKey = new Map(finalRecords.map((record) => [`${record.source_id}::${record.content_hash}`, record]))
  const resolvedIds = new Set<string>()
  const noteVersionRows: Array<{ record_id: string; user_id: string; body: string; import_channel: ImportChannel }> = []
  const recordUpdates: Array<{ id: string; patch: Partial<RecordRow> }> = []

  for (const row of preparedRows) {
    const source = sourceMap.get(row.sourceKey)
    if (!source?.id) {
      continue
    }

    const record = finalByKey.get(`${source.id}::${row.contentHash}`)
    if (!record) {
      continue
    }

    resolvedIds.add(record.id)

    const patch: Partial<RecordRow> = {}
    if (row.currentNote && row.currentNote !== record.current_note) {
      if (record.current_note) {
        noteVersionRows.push({
          record_id: record.id,
          user_id: userId,
          body: record.current_note,
          import_channel: importChannel
        })
      }

      patch.current_note = row.currentNote
      patch.note_updated_at = new Date().toISOString()
    }

    if (row.adoptedFromAi && !record.adopted_from_ai) {
      patch.adopted_from_ai = true
    }

    if (Object.keys(patch).length > 0) {
      recordUpdates.push({ id: record.id, patch })
    }
  }

  if (noteVersionRows.length > 0) {
    const insertedVersions = await supabase.from("record_note_versions").insert(noteVersionRows)
    if (insertedVersions.error) {
      throw new Error(insertedVersions.error.message)
    }
  }

  if (recordUpdates.length > 0) {
    await Promise.all(
      recordUpdates.map(async ({ id, patch }) => {
        const updated = await supabase
          .from("records")
          .update(patch)
          .eq("id", id)
          .eq("user_id", userId)

        if (updated.error) {
          throw new Error(updated.error.message)
        }
      })
    )
  }

  await syncSourceDisplayFields(userId, Array.from(sourceMap.values()))

  const recordTagLinks: Array<{ record_id: string; tag_id: string }> = []
  const ingestEvents: Array<{
    record_id: string
    source_id: string
    user_id: string
    import_channel: ImportChannel
    source_snapshot: JsonValue
    note_snapshot: string | null
    external_item_id: string | null
    external_anchor: string | null
  }> = []

  for (const row of preparedRows) {
    const source = sourceMap.get(row.sourceKey)
    if (!source?.id) {
      continue
    }

    const record = finalByKey.get(`${source.id}::${row.contentHash}`)
    if (!record) {
      continue
    }

    for (const tagName of row.tagNames) {
      const tagId = tagMap.get(tagName.toLowerCase())
      if (tagId) {
        recordTagLinks.push({ record_id: record.id, tag_id: tagId })
      }
    }

    ingestEvents.push({
      record_id: record.id,
      source_id: source.id,
      user_id: userId,
      import_channel: importChannel,
      source_snapshot: buildSourceSnapshot(row.source),
      note_snapshot: row.noteSnapshot,
      external_item_id: row.externalItemId,
      external_anchor: row.externalAnchor
    })
  }

  if (recordTagLinks.length > 0) {
    const linked = await supabase.from("record_tags").upsert(recordTagLinks, { onConflict: "record_id,tag_id" })
    if (linked.error) {
      throw new Error(linked.error.message)
    }
  }

  if (ingestEvents.length > 0) {
    const insertedEvents = await supabase.from("record_ingest_events").insert(ingestEvents)
    if (insertedEvents.error) {
      throw new Error(insertedEvents.error.message)
    }
  }

  return {
    created: createdIds.length,
    ids: Array.from(resolvedIds),
    skipped_empty: skippedEmpty,
    skipped_duplicate: Math.max(preparedRows.length - createdIds.length, 0),
    total: payload.items.length
  }
}
