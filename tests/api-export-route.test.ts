import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { RecordRow, RecordTagRow, SourceRow, TagRow } from "@/lib/types"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()

type MockDb = {
  records: RecordRow[]
  record_tags: RecordTagRow[]
  tags: TagRow[]
  sources: SourceRow[]
}

let mockDb: MockDb

function createRecord(overrides: Partial<RecordRow>): RecordRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "user-1",
    source_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    kind: "note",
    content: "Default content",
    content_hash: "hash-1",
    url: "https://example.com/default",
    source_title: "Default source",
    favicon_url: null,
    current_note: null,
    note_updated_at: null,
    adopted_from_ai: false,
    state: "ACTIVE",
    interval_days: 1,
    due_at: null,
    last_reviewed_at: null,
    review_count: 0,
    created_at: "2026-02-20T00:00:00.000Z",
    updated_at: "2026-02-20T00:00:00.000Z",
    ...overrides
  }
}

function resetMockDb() {
  mockDb = {
    records: [
      createRecord({
        id: "11111111-1111-1111-1111-111111111111",
        content: "Older note",
        source_title: "Pinned source",
        state: "PINNED",
        current_note: "Alpha, \"Beta\"",
        created_at: "2026-02-01T00:00:00.000Z",
        updated_at: "2026-02-10T00:00:00.000Z"
      }),
      createRecord({
        id: "22222222-2222-2222-2222-222222222222",
        source_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        kind: "quote",
        content: "Recent highlight",
        current_note: "Follow up",
        source_title: "Readwise import",
        url: "https://example.com/recent",
        review_count: 3,
        created_at: "2026-03-05T10:00:00.000Z",
        updated_at: "2026-03-06T11:30:00.000Z"
      }),
      createRecord({
        id: "33333333-3333-3333-3333-333333333333",
        source_id: null,
        kind: "note",
        content: "Trashed draft",
        source_title: "Hidden trash",
        current_note: "Should stay out of library exports",
        state: "TRASHED",
        created_at: "2026-03-07T08:00:00.000Z",
        updated_at: "2026-03-07T08:00:00.000Z"
      })
    ],
    record_tags: [
      { record_id: "11111111-1111-1111-1111-111111111111", tag_id: "aaaaaaaa-0000-0000-0000-000000000001" },
      { record_id: "22222222-2222-2222-2222-222222222222", tag_id: "aaaaaaaa-0000-0000-0000-000000000001" },
      { record_id: "22222222-2222-2222-2222-222222222222", tag_id: "aaaaaaaa-0000-0000-0000-000000000002" }
    ],
    tags: [
      { id: "aaaaaaaa-0000-0000-0000-000000000001", user_id: "user-1", name: "readwise" },
      { id: "aaaaaaaa-0000-0000-0000-000000000002", user_id: "user-1", name: "research" },
      { id: "aaaaaaaa-0000-0000-0000-000000000003", user_id: "other-user", name: "private" }
    ],
    sources: [
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        user_id: "user-1",
        source_type: "manual",
        identity_key: "legacy:pinned",
        title: "Pinned source",
        author: null,
        url: null,
        service: null,
        external_source_id: null,
        created_at: "2026-02-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z"
      },
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        user_id: "user-1",
        source_type: "book",
        identity_key: "readwise:book:deep-work",
        title: "Readwise import",
        author: "Cal Newport",
        url: "https://example.com/recent",
        service: "readwise",
        external_source_id: "rw-42",
        created_at: "2026-03-05T10:00:00.000Z",
        updated_at: "2026-03-05T10:00:00.000Z"
      }
    ]
  }
}

function compareValues(left: unknown, right: unknown) {
  if (left === right) {
    return 0
  }
  if (left == null) {
    return 1
  }
  if (right == null) {
    return -1
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right
  }
  return String(left).localeCompare(String(right))
}

function createQuery(table: keyof MockDb) {
  let rows = [...mockDb[table]]

  const builder = {
    select: (_columns?: string, _options?: { count?: "exact" }) => builder,
    eq: (column: string, value: unknown) => {
      rows = rows.filter((row) => row[column as keyof typeof row] === value)
      return builder
    },
    neq: (column: string, value: unknown) => {
      rows = rows.filter((row) => row[column as keyof typeof row] !== value)
      return builder
    },
    in: (column: string, values: unknown[]) => {
      rows = rows.filter((row) => values.includes(row[column as keyof typeof row]))
      return builder
    },
    gte: (column: string, value: string) => {
      rows = rows.filter((row) => {
        const current = row[column as keyof typeof row] as unknown
        return typeof current === "string" && current >= value
      })
      return builder
    },
    order: (column: string, { ascending }: { ascending: boolean }) => {
      rows = [...rows].sort((left, right) => {
        const comparison = compareValues(left[column as keyof typeof left], right[column as keyof typeof right])
        return ascending ? comparison : comparison * -1
      })
      return builder
    },
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve, reject)
  }

  return builder
}

vi.mock("@/lib/auth", () => ({
  getUserId: (headers: Headers) => getUserIdMock(headers)
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitDistributed: () => rateLimitMock(),
  resolveClientKey: () => "test-client"
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: keyof MockDb) => createQuery(table)
  })
}))

import { routeGetExport as GET } from "./helpers/routes"

describe("GET /api/export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockDb()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("returns 400 for unsupported format", async () => {
    const request = new NextRequest("http://localhost/api/export?format=pdf", { method: "GET" })
    const response = await GET(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Supported formats: markdown, obsidian, json, csv, logseq" })
  })

  it("returns 400 for invalid since values", async () => {
    const request = new NextRequest("http://localhost/api/export?format=json&since=not-a-date", { method: "GET" })
    const response = await GET(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid since" })
  })

  it("returns 429 when rate limited", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSec: 12, remaining: 0 })
    const response = await GET(new NextRequest("http://localhost/api/export?format=markdown", { method: "GET" }))

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("12")
  })

  it("exports json with source metadata, tags, and since filtering", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/export?format=json&since=2026-03-01&tag_id=aaaaaaaa-0000-0000-0000-000000000001",
        { method: "GET" }
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("application/json")
    expect(response.headers.get("Content-Disposition")).toContain(".json")

    const payload = (await response.json()) as {
      filters: { since: string | null; tagId: string | null; kind: string | null }
      total: number
      records: Array<RecordRow & { tags: string[]; source: SourceRow | null }>
    }

    expect(payload.total).toBe(1)
    expect(payload.filters.tagId).toBe("aaaaaaaa-0000-0000-0000-000000000001")
    expect(payload.filters.kind).toBe(null)
    expect(payload.filters.since).toBe("2026-03-01T00:00:00.000Z")
    expect(payload.records[0]?.id).toBe("22222222-2222-2222-2222-222222222222")
    expect(payload.records[0]?.tags).toEqual(["readwise", "research"])
    expect(payload.records[0]?.source).toMatchObject({
      source_type: "book",
      author: "Cal Newport",
      service: "readwise",
      external_source_id: "rw-42"
    })
  })

  it("exports csv with escaped values and state filtering", async () => {
    const response = await GET(new NextRequest("http://localhost/api/export?format=csv&state=PINNED", { method: "GET" }))

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("text/csv")
    expect(response.headers.get("Content-Disposition")).toContain(".csv")

    const body = await response.text()
    expect(body).toContain("id,kind,state,content,current_note")
    expect(body).toContain("\"Alpha, \"\"Beta\"\"\"")
    expect(body).toContain("readwise")
    expect(body).toContain("legacy:pinned")
  })

  it("exports logseq blocks with logseq-style tags", async () => {
    const response = await GET(new NextRequest("http://localhost/api/export?format=logseq&since=2026-03-01", { method: "GET" }))

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Disposition")).toContain("rebar-logseq-export")

    const body = await response.text()
    expect(body).toContain("- Rebar export")
    expect(body).toContain("filters:: since=2026-03-01T00:00:00.000Z")
    expect(body).toContain("tags:: #[[readwise]] #[[research]]")
    expect(body).toContain("id:: 22222222-2222-2222-2222-222222222222")
  })

  it("returns empty export when accessing another user's tag", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/export?format=json&tag_id=aaaaaaaa-0000-0000-0000-000000000003",
        { method: "GET" }
      )
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { total: number; records: unknown[] }
    expect(payload.total).toBe(0)
    expect(payload.records).toEqual([])
  })

  it("matches library scope by excluding trashed rows and honoring kind filters", async () => {
    const response = await GET(new NextRequest("http://localhost/api/export?format=json&kind=quote", { method: "GET" }))

    expect(response.status).toBe(200)

    const payload = (await response.json()) as {
      total: number
      filters: { kind: string | null }
      records: Array<RecordRow>
    }

    expect(payload.total).toBe(1)
    expect(payload.filters.kind).toBe("quote")
    expect(payload.records.map((record) => record.id)).toEqual(["22222222-2222-2222-2222-222222222222"])
  })
})
