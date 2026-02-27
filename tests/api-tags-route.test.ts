import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()
const insertSingleMock = vi.fn<() => Promise<unknown>>()

vi.mock("@/lib/auth", () => ({
  getUserId: (headers: Headers) => getUserIdMock(headers)
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitDistributed: () => rateLimitMock(),
  resolveClientKey: () => "test-client"
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => insertSingleMock()
        })
      }),
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [], error: null })
        })
      })
    })
  })
}))

import { GET, POST } from "@/app/api/tags/route"

describe("/api/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("returns 401 when unauthenticated on GET", async () => {
    getUserIdMock.mockResolvedValueOnce(null)
    const response = await GET(new NextRequest("http://localhost/api/tags", { method: "GET" }))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("returns 409 when creating duplicated tag", async () => {
    insertSingleMock.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" }
    })

    const response = await POST(
      new NextRequest("http://localhost/api/tags", {
        method: "POST",
        body: JSON.stringify({ name: "reading" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: "Tag already exists" })
  })
})
