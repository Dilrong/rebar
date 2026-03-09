import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers, options?: { allowIngestKey?: boolean }) => Promise<string | null>>()
const isValidOriginMock = vi.fn<(headers: Headers) => boolean>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()
const processIngestMock = vi.fn<
  (userId: string, payload: { items: Array<Record<string, unknown>>; default_kind?: string; default_tags?: string[] }, options?: Record<string, unknown>) =>
    Promise<{ created: number; ids: string[]; skipped_empty: number; skipped_duplicate: number; total: number }>
>()

vi.mock("@/lib/auth", () => ({
  getUserId: (headers: Headers, options?: { allowIngestKey?: boolean }) => getUserIdMock(headers, options),
  isValidOrigin: (headers: Headers) => isValidOriginMock(headers)
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitDistributed: () => rateLimitMock(),
  resolveClientKey: () => "test-client"
}))

vi.mock("@feature-lib/capture/ingest", () => ({
  processIngest: (
    userId: string,
    payload: { items: Array<Record<string, unknown>>; default_kind?: string; default_tags?: string[] },
    options?: Record<string, unknown>
  ) => processIngestMock(userId, payload, options)
}))

import { routePostCaptureShare as POST } from "./helpers/routes"

describe("POST /api/capture/share", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isValidOriginMock.mockReturnValue(true)
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
    processIngestMock.mockResolvedValue({
      created: 1,
      ids: ["rec-1"],
      skipped_empty: 0,
      skipped_duplicate: 0,
      total: 1
    })
  })

  it("saves share payload directly through processIngest", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/capture/share", {
        method: "POST",
        body: JSON.stringify({
          content: "shared text",
          note: "surrounding context",
          title: "Shared Title",
          url: "https://example.com/article",
          tags: ["alpha"],
          default_tags: ["beta"]
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      created: 1,
      ids: ["rec-1"],
      skipped_empty: 0,
      skipped_duplicate: 0,
      total: 1
    })
    expect(getUserIdMock).toHaveBeenCalledWith(expect.any(Headers), { allowIngestKey: true })
    expect(processIngestMock).toHaveBeenCalledWith("user-1", {
      items: [
        {
          content: "shared text",
          note: "surrounding context",
          title: "Shared Title",
          source_title: undefined,
          url: "https://example.com/article",
          tags: ["alpha"],
          kind: undefined,
          source_type: undefined,
          source_service: undefined,
          source_identity: undefined,
          adopted_from_ai: undefined
        }
      ],
      default_kind: undefined,
      default_tags: ["beta"]
    }, {
      importChannel: "share"
    })
  })

  it("returns 403 when origin is not allowed", async () => {
    isValidOriginMock.mockReturnValueOnce(false)

    const response = await POST(
      new NextRequest("http://localhost/api/capture/share", {
        method: "POST",
        body: JSON.stringify({ content: "shared text" })
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
    expect(getUserIdMock).not.toHaveBeenCalled()
    expect(processIngestMock).not.toHaveBeenCalled()
  })

  it("returns 401 when no authenticated user is available", async () => {
    getUserIdMock.mockResolvedValueOnce(null)

    const response = await POST(
      new NextRequest("http://localhost/api/capture/share", {
        method: "POST",
        body: JSON.stringify({ content: "shared text" })
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
    expect(processIngestMock).not.toHaveBeenCalled()
  })

  it("rejects oversized tag names before ingest processing", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/capture/share", {
        method: "POST",
        body: JSON.stringify({
          content: "shared text",
          tags: ["x".repeat(51)]
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
    expect(processIngestMock).not.toHaveBeenCalled()
  })
})
