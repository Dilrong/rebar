import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()
const retryPendingIngestJobsMock = vi.fn<
  (options: { userId: string; scope: "PENDING" | "DONE" | "FAILED" | "ALL" }) => Promise<{ done: number; failed: number; pending: number } | { error: string }>
>()

vi.mock("@/lib/auth", () => ({
  getUserId: (headers: Headers) => getUserIdMock(headers)
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitDistributed: () => rateLimitMock(),
  resolveClientKey: () => "test-client"
}))

vi.mock("@feature-lib/capture/retry-jobs", () => ({
  retryPendingIngestJobs: (options: { userId: string; scope: "PENDING" | "DONE" | "FAILED" | "ALL" }) => retryPendingIngestJobsMock(options)
}))

import { routePostIngestJobsRetry as POST } from "./helpers/routes"

describe("POST /api/ingest-jobs/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
    retryPendingIngestJobsMock.mockResolvedValue({ done: 2, failed: 1, pending: 3 })
  })

  it("retries all retriable jobs when status=ALL is requested", async () => {
    const response = await POST(new NextRequest("http://localhost/api/ingest-jobs/retry?status=ALL", { method: "POST" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ done: 2, failed: 1, pending: 3 })
    expect(retryPendingIngestJobsMock).toHaveBeenCalledWith({ userId: "user-1", scope: "ALL" })
  })

  it("returns 400 for invalid status values", async () => {
    const response = await POST(new NextRequest("http://localhost/api/ingest-jobs/retry?status=NOPE", { method: "POST" }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid status" })
    expect(retryPendingIngestJobsMock).not.toHaveBeenCalled()
  })
})
