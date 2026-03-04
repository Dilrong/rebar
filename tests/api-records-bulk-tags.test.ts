import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()

const recordsRows = [{ id: "11111111-1111-1111-1111-111111111111" }]
const ownedTagRows = [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }]

vi.mock("@/lib/auth", () => ({
  getUserId: (headers: Headers) => getUserIdMock(headers)
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "records") {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: recordsRows, error: null })
            })
          })
        }
      }

      if (table === "tags") {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: ownedTagRows, error: null })
            })
          })
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }
  })
}))

import { routePostRecordsBulkTags as POST } from "./helpers/routes"

describe("POST /api/records/bulk/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
  })

  it("returns 400 when tag_ids include non-owned tags", async () => {
    const request = new NextRequest("http://localhost/api/records/bulk/tags", {
      method: "POST",
      body: JSON.stringify({
        ids: ["11111111-1111-1111-1111-111111111111"],
        tag_ids: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"],
        mode: "add"
      }),
      headers: { "Content-Type": "application/json" }
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid tag_ids" })
  })
})
