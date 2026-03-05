import fc from "fast-check"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()

const NON_HTTP_SCHEMES = ["ftp", "ws", "wss", "gopher", "ssh", "telnet"]

const hostLabelArb = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), { minLength: 1, maxLength: 16 })
  .map((chars) => chars.join(""))

vi.mock("@/lib/auth", () => ({
  getUserId: (headers: Headers) => getUserIdMock(headers)
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitDistributed: () => rateLimitMock(),
  resolveClientKey: () => "test-client"
}))

import { routePostCaptureExtract as POST } from "./helpers/routes"

describe("POST /api/capture/extract property tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("11111111-1111-1111-1111-111111111111")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("rejects all non-http(s) URL schemes", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...NON_HTTP_SCHEMES), async (scheme) => {
        const response = await POST(
          new NextRequest("http://localhost/api/capture/extract", {
            method: "POST",
            body: JSON.stringify({ url: `${scheme}://example.com/file` })
          })
        )

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({ error: "Only http/https URLs are allowed" })
      }),
      { numRuns: 60 }
    )
  })

  it("blocks all generated .internal hosts", async () => {
    await fc.assert(
      fc.asyncProperty(hostLabelArb, async (label) => {
        const response = await POST(
          new NextRequest("http://localhost/api/capture/extract", {
            method: "POST",
            body: JSON.stringify({ url: `http://${label}.internal/private` })
          })
        )

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({ error: "URL host is not allowed" })
      }),
      { numRuns: 80 }
    )
  })

  it("blocks all generated .local hosts", async () => {
    await fc.assert(
      fc.asyncProperty(hostLabelArb, async (label) => {
        const response = await POST(
          new NextRequest("http://localhost/api/capture/extract", {
            method: "POST",
            body: JSON.stringify({ url: `http://${label}.local/private` })
          })
        )

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({ error: "URL host is not allowed" })
      }),
      { numRuns: 80 }
    )
  })
})
