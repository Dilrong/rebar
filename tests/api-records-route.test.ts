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

import { routeGetRecords as GET } from "./helpers/routes"

describe("GET /api/records", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("returns 400 for cursor with non-created_at sort", async () => {
    const request = new NextRequest(
      "http://localhost/api/records?cursor=eyJ2IjoidjEiLCJ0cyI6IjIwMjYtMDItMjdUMDA6MDA6MDAuMDAwWiJ9&sort=review_count",
      { method: "GET" }
    )

    const response = await GET(request)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Cursor pagination supports created_at sort only" })
  })

  it("returns 400 for overly long search query", async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/records?q=${"a".repeat(201)}`, { method: "GET" })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Search query must be 200 characters or fewer" })
  })
})
