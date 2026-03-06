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

  it("returns 400 for invalid tag_id format", async () => {
    const response = await GET(new NextRequest("http://localhost/api/search?q=test&tag_id=not-a-uuid", { method: "GET" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid tag_id" })
  })

  it("returns 400 for invalid cursor", async () => {
    const response = await GET(new NextRequest("http://localhost/api/search?q=test&cursor=bad-cursor", { method: "GET" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid cursor" })
  })

  it("returns 400 for overly long search query", async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/search?q=${"a".repeat(201)}`, { method: "GET" })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Search query must be 200 characters or fewer" })
  })
})
