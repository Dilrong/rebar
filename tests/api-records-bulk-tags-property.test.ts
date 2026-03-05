import fc from "fast-check"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()

const mockState = {
  existingRecordIds: [] as string[],
  ownedTagIds: [] as string[]
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
      if (table === "records") {
        return {
          select: () => ({
            eq: () => ({
              in: async (_column: string, ids: string[]) => {
                const existing = new Set(mockState.existingRecordIds)
                return {
                  data: ids.filter((id) => existing.has(id)).map((id) => ({ id })),
                  error: null
                }
              }
            })
          })
        }
      }

      if (table === "tags") {
        return {
          select: () => ({
            eq: () => ({
              in: async (_column: string, tagIds: string[]) => {
                const owned = new Set(mockState.ownedTagIds)
                return {
                  data: tagIds.filter((id) => owned.has(id)).map((id) => ({ id })),
                  error: null
                }
              }
            })
          })
        }
      }

      if (table === "record_tags") {
        return {
          upsert: async () => ({ error: null }),
          delete: () => ({
            in: async () => ({ error: null })
          }),
          select: () => ({
            in: async () => ({ data: [], error: null })
          })
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }
  })
}))

import { routePostRecordsBulkTags as POST } from "./helpers/routes"

describe("POST /api/records/bulk/tags property tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
    mockState.existingRecordIds = []
    mockState.ownedTagIds = []
  })

  it("deduplicates ids and only processes owned records", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.uuid(), { minLength: 1, maxLength: 60 }), async (ids) => {
        const uniqueIds = [...new Set(ids)]
        mockState.existingRecordIds = uniqueIds.filter((_id, index) => index % 2 === 0)
        mockState.ownedTagIds = []

        const response = await POST(
          new NextRequest("http://localhost/api/records/bulk/tags", {
            method: "POST",
            body: JSON.stringify({
              ids,
              tag_ids: [],
              mode: "add"
            }),
            headers: { "Content-Type": "application/json" }
          })
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
          requested: uniqueIds.length,
          processed: mockState.existingRecordIds.length,
          mode: "add",
          tag_count: 0
        })
      }),
      { numRuns: 80 }
    )
  })

  it("rejects any payload containing non-owned tag ids", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 40 }),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
        async (ids, tagIds) => {
          const uniqueIds = [...new Set(ids)]
          const uniqueTagIds = [...new Set(tagIds)]

          fc.pre(uniqueTagIds.length > 0)

          mockState.existingRecordIds = uniqueIds
          mockState.ownedTagIds = uniqueTagIds.slice(0, Math.max(0, uniqueTagIds.length - 1))

          const response = await POST(
            new NextRequest("http://localhost/api/records/bulk/tags", {
              method: "POST",
              body: JSON.stringify({
                ids: uniqueIds,
                tag_ids: uniqueTagIds,
                mode: "add"
              }),
              headers: { "Content-Type": "application/json" }
            })
          )

          expect(response.status).toBe(400)
          await expect(response.json()).resolves.toEqual({ error: "Invalid tag_ids" })
        }
      ),
      { numRuns: 80 }
    )
  })
})
