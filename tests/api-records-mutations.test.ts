import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()

const mockState = {
  ownedTagIds: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"],
  existingRecord: {
    id: "11111111-1111-1111-1111-111111111111",
    state: "INBOX"
  }
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
    from: (table: string) => {
      if (table === "tags") {
        return {
          select: () => ({
            eq: () => ({
              in: async (_column: string, tagIds: string[]) => ({
                data: tagIds.filter((tagId) => mockState.ownedTagIds.includes(tagId)).map((id) => ({ id })),
                error: null
              })
            })
          })
        }
      }

      if (table === "records") {
        return {
          insert: () => {
            throw new Error("records.insert should not be called for invalid tag_ids")
          },
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: mockState.existingRecord, error: null })
              })
            })
          }),
          update: () => {
            throw new Error("records.update should not be called for invalid tag_ids")
          }
        }
      }

      if (table === "record_tags") {
        return {
          insert: async () => {
            throw new Error("record_tags.insert should not be called for invalid tag_ids")
          },
          upsert: async () => {
            throw new Error("record_tags.upsert should not be called for invalid tag_ids")
          }
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }
  })
}))

import { routePatchRecordById as PATCH, routePostRecords as POST } from "./helpers/routes"

describe("record mutation tag ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("returns 400 when POST /api/records includes non-owned tag ids", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/records", {
        method: "POST",
        body: JSON.stringify({
          kind: "note",
          content: "hello",
          tag_ids: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"]
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid tag_ids" })
  })

  it("returns 400 when PATCH /api/records/:id includes non-owned tag ids", async () => {
    const response = await PATCH(
      new NextRequest(`http://localhost/api/records/${mockState.existingRecord.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          tag_ids: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"]
        }),
        headers: { "Content-Type": "application/json" }
      }),
      {
        params: Promise.resolve({ id: mockState.existingRecord.id })
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid tag_ids" })
  })
})
