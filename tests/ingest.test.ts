import { beforeEach, describe, expect, it, vi } from "vitest"

type TagRow = { id: string; name: string }
type CreatedRecordRow = { id: string; content_hash: string }
type FailureState = {
  tagsSelect: string | null
  tagsRefresh: string | null
  tagsUpsert: string | null
  recordsUpsert: string | null
  recordTagsUpsert: string | null
}

const mockState: {
  tags: TagRow[]
  createdRecords: CreatedRecordRow[]
  insertedRecordTags: Array<{ record_id: string; tag_id: string }>
  recordRows: Array<{
    user_id: string
    kind: string
    content: string
    content_hash: string
    url: string | null
    source_title: string | null
    favicon_url: string | null
    state: string
    interval_days: number
    due_at: null
    last_reviewed_at: null
    review_count: number
  }>
  tagSelectCalls: number
  fail: FailureState
} = {
  tags: [],
  createdRecords: [],
  insertedRecordTags: [],
  recordRows: [],
  tagSelectCalls: 0,
  fail: {
    tagsSelect: null,
    tagsRefresh: null,
    tagsUpsert: null,
    recordsUpsert: null,
    recordTagsUpsert: null
  }
}

function createSupabaseMock() {
  return {
    from: (table: string) => {
      if (table === "tags") {
        return {
          select: () => ({
            eq: async () => {
              mockState.tagSelectCalls += 1
              const message = mockState.tagSelectCalls === 1 ? mockState.fail.tagsSelect : mockState.fail.tagsRefresh
              if (message) {
                return { data: null, error: { message } }
              }

              return { data: mockState.tags, error: null }
            }
          }),
          upsert: async (rows: Array<{ user_id: string; name: string }>) => {
            if (mockState.fail.tagsUpsert) {
              return { error: { message: mockState.fail.tagsUpsert } }
            }

            for (const row of rows) {
              if (!mockState.tags.find((tag) => tag.name === row.name)) {
                mockState.tags.push({ id: `tag-${mockState.tags.length + 1}`, name: row.name })
              }
            }
            return { error: null }
          }
        }
      }

      if (table === "records") {
        return {
          upsert: (rows: typeof mockState.recordRows, _opts: unknown) => ({
            select: async () => {
              mockState.recordRows = rows

              if (mockState.fail.recordsUpsert) {
                return { data: null, error: { message: mockState.fail.recordsUpsert } }
              }

              return { data: mockState.createdRecords, error: null }
            }
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

      throw new Error(`Unexpected table: ${table}`)
    }
  }
}

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => createSupabaseMock()
}))

import { processIngest, resolveContent, resolveKind } from "@feature-lib/capture/ingest"
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

  it("returns fallback when url does not exist", () => {
    expect(resolveKind({ content: "x" }, "note")).toBe("note")
  })
})

describe("processIngest", () => {
  beforeEach(() => {
    mockState.tags = [{ id: "tag-1", name: "default" }]
    mockState.createdRecords = []
    mockState.insertedRecordTags = []
    mockState.recordRows = []
    mockState.tagSelectCalls = 0
    mockState.fail = {
      tagsSelect: null,
      tagsRefresh: null,
      tagsUpsert: null,
      recordsUpsert: null,
      recordTagsUpsert: null
    }
  })

  it("counts empty and duplicate skips, creates tags and links", async () => {
    mockState.createdRecords = [{ id: "rec-1", content_hash: sha256("a") }]

    const result = await processIngest("user-1", {
      default_kind: "note",
      default_tags: ["default"],
      items: [
        { content: "a", tags: ["x"] },
        { content: "a", tags: ["y"] },
        { content: "   " }
      ]
    })

    expect(result.created).toBe(1)
    expect(result.skipped_empty).toBe(1)
    expect(result.skipped_duplicate).toBe(0)
    expect(result.total).toBe(3)
    expect(mockState.tags.find((tag) => tag.name === "x")).toBeTruthy()
    expect(mockState.tags.find((tag) => tag.name === "y")).toBeTruthy()
    expect(mockState.insertedRecordTags.length).toBeGreaterThan(0)
  })

  it("backfills favicon when duplicate item later provides a url", async () => {
    mockState.createdRecords = [{ id: "rec-1", content_hash: sha256("same") }]

    await processIngest("user-1", {
      default_kind: "note",
      items: [{ content: "same" }, { content: "same", url: "https://example.com/article" }]
    })

    expect(mockState.recordRows).toHaveLength(1)
    expect(mockState.recordRows[0]?.url).toBe("https://example.com/article")
    expect(mockState.recordRows[0]?.favicon_url).toBe(
      "https://www.google.com/s2/favicons?domain=example.com&sz=64"
    )
  })

  it("throws when initial tag lookup fails", async () => {
    mockState.fail.tagsSelect = "tags select failed"

    await expect(
      processIngest("user-1", {
        default_kind: "note",
        items: [{ content: "a" }]
      })
    ).rejects.toThrow("tags select failed")
  })

  it("throws when missing tag upsert fails", async () => {
    mockState.fail.tagsUpsert = "tags upsert failed"

    await expect(
      processIngest("user-1", {
        default_kind: "note",
        items: [{ content: "a", tags: ["new-tag"] }]
      })
    ).rejects.toThrow("tags upsert failed")
  })

  it("throws when refreshed tag lookup fails after upsert", async () => {
    mockState.fail.tagsRefresh = "tags refresh failed"

    await expect(
      processIngest("user-1", {
        default_kind: "note",
        items: [{ content: "a", tags: ["new-tag"] }]
      })
    ).rejects.toThrow("tags refresh failed")
  })

  it("throws when records upsert fails", async () => {
    mockState.fail.recordsUpsert = "records upsert failed"

    await expect(
      processIngest("user-1", {
        default_kind: "note",
        default_tags: ["default"],
        items: [{ content: "a" }]
      })
    ).rejects.toThrow("records upsert failed")
  })

  it("throws when record tag link upsert fails", async () => {
    mockState.fail.recordTagsUpsert = "record_tags upsert failed"
    mockState.createdRecords = [{ id: "rec-1", content_hash: sha256("a") }]

    await expect(
      processIngest("user-1", {
        default_kind: "note",
        default_tags: ["default"],
        items: [{ content: "a" }]
      })
    ).rejects.toThrow("record_tags upsert failed")
  })
})
