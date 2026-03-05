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

import { routePostCaptureExtract as POST } from "./helpers/routes"

describe("POST /api/capture/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("11111111-1111-1111-1111-111111111111")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("returns 400 for non-http protocols", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "ftp://example.com/file.txt" })
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Only http/https URLs are allowed" })
  })

  it("returns 400 for blocked private hosts", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://127.0.0.1/internal" })
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "URL host is not allowed" })
  })

  it("returns 400 for blocked metadata hosts", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://metadata.google.internal/computeMetadata/v1" })
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "URL host is not allowed" })
  })

  it("returns 400 for blocked .internal hosts", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://api.internal/private" })
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "URL host is not allowed" })
  })

  it("returns 400 for blocked .local hosts", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://service.local/private" })
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "URL host is not allowed" })
  })

  it("returns 401 when user is not authenticated", async () => {
    getUserIdMock.mockResolvedValueOnce(null)

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/page" })
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("returns 429 when rate limited", async () => {
    rateLimitMock.mockResolvedValueOnce({ ok: false, retryAfterSec: 17, remaining: 0 })

    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ url: "http://example.com/page" })
      })
    )

    expect(response.status).toBe(429)
  })

  it("returns 400 for invalid payload", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/capture/extract", {
        method: "POST",
        body: JSON.stringify({ bad: true })
      })
    )

    expect(response.status).toBe(400)
  })
})
