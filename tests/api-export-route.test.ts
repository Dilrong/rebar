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

import { GET } from "@/app/api/export/route"

describe("GET /api/export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("returns 400 for unsupported format", async () => {
    const request = new NextRequest("http://localhost/api/export?format=pdf", { method: "GET" })
    const response = await GET(request)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Supported formats: markdown, obsidian" })
  })

  it("returns 429 when rate limited", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSec: 12, remaining: 0 })
    const response = await GET(new NextRequest("http://localhost/api/export?format=markdown", { method: "GET" }))

    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("12")
  })
})
