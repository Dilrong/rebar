import { beforeEach, describe, expect, it, vi } from "vitest"

type TagRow = { id: string; name: string }
type SourceRow = {
  id: string
  user_id: string
  source_type: string
  identity_key: string
  title: string | null
  author: string | null
  url: string | null
  service: string | null
  external_source_id: string | null
  created_at: string
  updated_at: string
}
type RecordRow = {
  id: string
  user_id: string
  source_id: string
  kind: string
  content: string
  content_hash: string
  url: string | null
  source_title: string | null
  favicon_url: string | null
  current_note: string | null
  note_updated_at: string | null
  adopted_from_ai: boolean
  state: string
  interval_days: number
  due_at: null
  last_reviewed_at: null
  review_count: number
  created_at: string
  updated_at: string
}

type FailureState = {
  tagsSelect: string | null
  tagsUpsert: string | null
  sourcesSelect: string | null
  sourcesUpsert: string | null
  recordsSelect: string | null
  recordsUpsert: string | null
  recordsUpdate: string | null
  recordTagsUpsert: string | null
  noteVersionsInsert: string | null
  ingestEventsInsert: string | null
}

const mockState: {
  tags: TagRow[]
  sources: SourceRow[]
  records: RecordRow[]
  insertedRecordTags: Array<{ record_id: string; tag_id: string }>
  noteVersions: Array<{ record_id: string; body: string; import_channel: string }>
  ingestEvents: Array<{ record_id: string; import_channel: string; note_snapshot: string | null }>
  fail: FailureState
} = {
  tags: [],
  sources: [],
  records: [],
  insertedRecordTags: [],
  noteVersions: [],
  ingestEvents: [],
  fail: {
    tagsSelect: null,
    tagsUpsert: null,
    sourcesSelect: null,
    sourcesUpsert: null,
    recordsSelect: null,
    recordsUpsert: null,
    recordsUpdate: null,
    recordTagsUpsert: null,
    noteVersionsInsert: null,
    ingestEventsInsert: null
  }
}

function nowIso() {
  return "2026-03-06T00:00:00.000Z"
}

function createSourceId() {
  return `src-${mockState.sources.length + 1}`
}

function createRecordId() {
  return `rec-${mockState.records.length + 1}`
}

function createSupabaseMock() {
  return {
    from: (table: string) => {
      if (table === "tags") {
        return {
          select: () => ({
            eq: async () => {
              if (mockState.fail.tagsSelect) {
                return { data: null, error: { message: mockState.fail.tagsSelect } }
              }

              return { data: mockState.tags, error: null }
            }
          }),
          upsert: (rows: Array<{ user_id: string; name: string }>) => ({
            select: async () => {
              if (mockState.fail.tagsUpsert) {
                return { data: null, error: { message: mockState.fail.tagsUpsert } }
              }

              const inserted: TagRow[] = []
              for (const row of rows) {
                if (!mockState.tags.find((tag) => tag.name === row.name)) {
                  const tag = { id: `tag-${mockState.tags.length + 1}`, name: row.name }
                  mockState.tags.push(tag)
                  inserted.push(tag)
                }
              }

              return { data: inserted, error: null }
            }
          })
        }
      }

      if (table === "sources") {
        return {
          select: () => ({
            eq: (_col1: string, userId: string) => ({
              eq: (_col2: string, sourceType: string) => ({
                in: async (_col3: string, identityKeys: string[]) => {
                  if (mockState.fail.sourcesSelect) {
                    return { data: null, error: { message: mockState.fail.sourcesSelect } }
                  }

                  return {
                    data: mockState.sources.filter((row) => row.user_id === userId && row.source_type === sourceType && identityKeys.includes(row.identity_key)),
                    error: null
                  }
                }
              })
            })
          }),
          upsert: (rows: Array<Omit<SourceRow, "id" | "created_at" | "updated_at">>) => ({
            select: async () => {
              if (mockState.fail.sourcesUpsert) {
                return { data: null, error: { message: mockState.fail.sourcesUpsert } }
              }

              const inserted: SourceRow[] = []
              for (const row of rows) {
                if (!mockState.sources.find((source) => source.user_id === row.user_id && source.source_type === row.source_type && source.identity_key === row.identity_key)) {
                  const source = {
                    id: createSourceId(),
                    ...row,
                    created_at: nowIso(),
                    updated_at: nowIso()
                  }
                  mockState.sources.push(source)
                  inserted.push(source)
                }
              }

              return { data: inserted, error: null }
            }
          }),
          update: (patch: Partial<SourceRow>) => ({
            eq: (_col1: string, id: string) => ({
              eq: async (_col2: string, userId: string) => {
                const source = mockState.sources.find((row) => row.id === id && row.user_id === userId)
                if (source) {
                  Object.assign(source, patch)
                }
                return { error: null }
              }
            })
          })
        }
      }

      if (table === "records") {
        return {
          select: () => ({
            eq: (_col1: string, userId: string) => ({
              in: (_col2: string, sourceIds: string[]) => ({
                in: async (_col3: string, contentHashes: string[]) => {
                  if (mockState.fail.recordsSelect) {
                    return { data: null, error: { message: mockState.fail.recordsSelect } }
                  }

                  return {
                    data: mockState.records.filter((row) => row.user_id === userId && sourceIds.includes(row.source_id) && contentHashes.includes(row.content_hash)),
                    error: null
                  }
                }
              })
            })
          }),
          upsert: (rows: Array<Omit<RecordRow, "id" | "created_at" | "updated_at">>, _opts: unknown) => ({
            select: async () => {
              if (mockState.fail.recordsUpsert) {
                return { data: null, error: { message: mockState.fail.recordsUpsert } }
              }

              const inserted: Array<{ id: string; source_id: string; content_hash: string }> = []
              for (const row of rows) {
                if (!mockState.records.find((record) => record.user_id === row.user_id && record.source_id === row.source_id && record.content_hash === row.content_hash)) {
                  const record: RecordRow = {
                    id: createRecordId(),
                    ...row,
                    created_at: nowIso(),
                    updated_at: nowIso()
                  }
                  mockState.records.push(record)
                  inserted.push({ id: record.id, source_id: record.source_id, content_hash: record.content_hash })
                }
              }

              return { data: inserted, error: null }
            }
          }),
          update: (patch: Partial<RecordRow>) => ({
            eq: (_col1: string, value1: string) => ({
              eq: async (_col2: string, value2: string) => {
                if (mockState.fail.recordsUpdate) {
                  return { error: { message: mockState.fail.recordsUpdate } }
                }

                mockState.records.forEach((record) => {
                  const matchesRecordId = _col1 === "id" && record.id === value1 && record.user_id === value2
                  const matchesSourceId = _col1 === "user_id" && record.user_id === value1 && record.source_id === value2

                  if (matchesRecordId || matchesSourceId) {
                    Object.assign(record, patch)
                  }
                })

                return { error: null }
              }
            })
          })
        }
      }

      if (table === "record_tags") {
        return {
          upsert: async (rows: Array<{ record_id: string; tag_id: string }>) => {
            if (mockState.fail.recordTagsUpsert) {
              return { error: { message: mockState.fail.recordTagsUpsert } }
            }

            mockState.insertedRecordTags.push(...rows)
            return { error: null }
          }
        }
      }

      if (table === "record_note_versions") {
        return {
          insert: async (rows: Array<{ record_id: string; body: string; import_channel: string }>) => {
            if (mockState.fail.noteVersionsInsert) {
              return { error: { message: mockState.fail.noteVersionsInsert } }
            }

            mockState.noteVersions.push(...rows)
            return { error: null }
          }
        }
      }

      if (table === "record_ingest_events") {
        return {
          insert: async (rows: Array<{ record_id: string; import_channel: string; note_snapshot: string | null }>) => {
            if (mockState.fail.ingestEventsInsert) {
              return { error: { message: mockState.fail.ingestEventsInsert } }
            }

            mockState.ingestEvents.push(...rows)
            return { error: null }
          }
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }
  }
}

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => createSupabaseMock()
}))

import { IngestPayloadSchema, processIngest, resolveContent, resolveKind } from "@feature-lib/capture/ingest"
import { sha256 } from "@/lib/hash"

describe("resolveContent", () => {
  it("uses content first", () => {
    expect(resolveContent({ content: "A", text: "B" })).toBe("A")
  })

  it("falls back text -> highlight -> note", () => {
    expect(resolveContent({ text: "B" })).toBe("B")
    expect(resolveContent({ highlight: "C" })).toBe("C")
    expect(resolveContent({ note: "D" })).toBe("D")
  })

  it("returns empty string when all fields empty", () => {
    expect(resolveContent({ content: "  ", text: "" })).toBe("")
  })
})

describe("resolveKind", () => {
  it("returns link when url exists", () => {
    expect(resolveKind({ content: "x", url: "https://example.com" }, "note")).toBe("link")
  })

  it("returns note when only note exists", () => {
    expect(resolveKind({ note: "x" }, "quote")).toBe("note")
  })
})

describe("processIngest", () => {
  beforeEach(() => {
    mockState.tags = [{ id: "tag-1", name: "default" }]
    mockState.sources = []
    mockState.records = []
    mockState.insertedRecordTags = []
    mockState.noteVersions = []
    mockState.ingestEvents = []
    mockState.fail = {
      tagsSelect: null,
      tagsUpsert: null,
      sourcesSelect: null,
      sourcesUpsert: null,
      recordsSelect: null,
      recordsUpsert: null,
      recordsUpdate: null,
      recordTagsUpsert: null,
      noteVersionsInsert: null,
      ingestEventsInsert: null
    }
  })

  it("splits note from highlight and stores provenance", async () => {
    const result = await processIngest("user-1", {
      default_kind: "quote",
      import_channel: "csv",
      items: [
        {
          highlight: "highlight text",
          note: "my note",
          book_title: "Book",
          book_author: "Author",
          tags: ["default"]
        }
      ]
    })

    expect(result.created).toBe(1)
    expect(mockState.records).toHaveLength(1)
    expect(mockState.records[0]?.content).toBe("highlight text")
    expect(mockState.records[0]?.current_note).toBe("my note")
    expect(mockState.records[0]?.source_title).toBe("Book - Author")
    expect(mockState.ingestEvents[0]).toMatchObject({
      import_channel: "csv",
      note_snapshot: "my note"
    })
  })

  it("dedupes same text from the same source but not across different sources", async () => {
    const result = await processIngest("user-1", {
      default_kind: "quote",
      import_channel: "json",
      items: [
        { content: "same", url: "https://example.com/a" },
        { content: "same", url: "https://example.com/a" },
        { content: "same", url: "https://example.com/b" }
      ]
    })

    expect(result.created).toBe(2)
    expect(mockState.records).toHaveLength(2)
    expect(mockState.sources).toHaveLength(2)
  })

  it("updates the current note and preserves the previous note in history on duplicate merge", async () => {
    mockState.sources = [
      {
        id: "src-1",
        user_id: "user-1",
        source_type: "article",
        identity_key: "article:https://example.com/article",
        title: "Article",
        author: null,
        url: "https://example.com/article",
        service: null,
        external_source_id: null,
        created_at: nowIso(),
        updated_at: nowIso()
      }
    ]
    mockState.records = [
      {
        id: "rec-1",
        user_id: "user-1",
        source_id: "src-1",
        kind: "quote",
        content: "same",
        content_hash: sha256("same"),
        url: "https://example.com/article",
        source_title: "Article",
        favicon_url: "https://www.google.com/s2/favicons?domain=example.com&sz=64",
        current_note: "old note",
        note_updated_at: nowIso(),
        adopted_from_ai: false,
        state: "INBOX",
        interval_days: 1,
        due_at: null,
        last_reviewed_at: null,
        review_count: 0,
        created_at: nowIso(),
        updated_at: nowIso()
      }
    ]

    const result = await processIngest("user-1", {
      default_kind: "quote",
      import_channel: "json",
      items: [{ highlight: "same", note: "new note", url: "https://example.com/article" }]
    })

    expect(result.created).toBe(0)
    expect(result.skipped_duplicate).toBe(1)
    expect(mockState.records[0]?.current_note).toBe("new note")
    expect(mockState.noteVersions).toEqual([
      { record_id: "rec-1", user_id: "user-1", body: "old note", import_channel: "json" }
    ])
  })

  it("throws when record upsert fails", async () => {
    mockState.fail.recordsUpsert = "records upsert failed"

    await expect(
      processIngest("user-1", {
        default_kind: "note",
        items: [{ content: "a" }]
      })
    ).rejects.toThrow("records upsert failed")
  })

  it("throws when record tag link upsert fails", async () => {
    mockState.fail.recordTagsUpsert = "record_tags upsert failed"

    await expect(
      processIngest("user-1", {
        default_kind: "note",
        default_tags: ["default"],
        items: [{ content: "a" }]
      })
    ).rejects.toThrow("record_tags upsert failed")
  })
})

describe("IngestPayloadSchema", () => {
  it("rejects tag names longer than 50 characters", () => {
    const parsed = IngestPayloadSchema.safeParse({
      items: [{ content: "a", tags: ["x".repeat(51)] }]
    })

    expect(parsed.success).toBe(false)
  })
})
