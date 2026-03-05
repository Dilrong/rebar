import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()

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
      select: () => ({
        eq: () => ({
          order: () => ({
            range: () => Promise.resolve({ data: [], count: 0, error: null })
          })
        })
      })
    })
  })
}))

import { routeGetReviewHistory as GET } from "./helpers/routes"

describe("GET /api/review/history", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("returns 400 for invalid decision_type filter", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/review/history?decision_type=WRONG", { method: "GET" })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid decision_type" })
  })

  it("returns 400 for invalid action_type filter", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/review/history?action_type=WRONG", { method: "GET" })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid action_type" })
  })

  it("returns 400 for invalid defer_reason filter", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/review/history?defer_reason=WRONG", { method: "GET" })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid defer_reason" })
  })
})
