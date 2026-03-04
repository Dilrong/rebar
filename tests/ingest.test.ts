import { beforeEach, describe, expect, it, vi } from "vitest"

type TagRow = { id: string; name: string }
type CreatedRecordRow = { id: string; content_hash: string }

const mockState: {
  tags: TagRow[]
  createdRecords: CreatedRecordRow[]
  insertedRecordTags: Array<{ record_id: string; tag_id: string }>
} = {
  tags: [],
  createdRecords: [],
  insertedRecordTags: []
}

function createSupabaseMock() {
  return {
    from: (table: string) => {
      if (table === "tags") {
        return {
          select: () => ({
            eq: async () => ({ data: mockState.tags, error: null })
          }),
          upsert: async (rows: Array<{ user_id: string; name: string }>) => {
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
          upsert: (_rows: unknown[], _opts: unknown) => ({
            select: async () => ({ data: mockState.createdRecords, error: null })
          })
        }
      }

      if (table === "record_tags") {
        return {
          upsert: async (rows: Array<{ record_id: string; tag_id: string }>) => {
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
})
