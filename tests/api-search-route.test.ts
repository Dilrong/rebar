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

import { routeGetSearch as GET } from "./helpers/routes"

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("returns 400 when no filters are provided", async () => {
    const response = await GET(new NextRequest("http://localhost/api/search", { method: "GET" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "At least one filter is required" })
  })

  it("returns 400 for invalid state value", async () => {
    const response = await GET(new NextRequest("http://localhost/api/search?state=INVALID", { method: "GET" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid state" })
  })
})
