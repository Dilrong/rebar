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
    from: () => ({})
  })
}))

import { routeGetReviewStats as GET } from "./helpers/routes"

describe("GET /api/review/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("returns 429 when rate limited", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSec: 8, remaining: 0 })

    const response = await GET(new NextRequest("http://localhost/api/review/stats", { method: "GET" }))
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("8")
  })

  it("returns 401 when unauthenticated", async () => {
    getUserIdMock.mockResolvedValueOnce(null)

    const response = await GET(new NextRequest("http://localhost/api/review/stats", { method: "GET" }))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })
})
