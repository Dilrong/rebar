import { beforeEach, describe, expect, it, vi } from "vitest"

const verifyCronRequestMock = vi.fn<(headers: Headers) => { ok: boolean; response?: Response }>()
const processIngestMock = vi.fn<(userId: string, payload: unknown) => Promise<void>>()

vi.mock("@/lib/cron", () => ({
  verifyCronRequest: (headers: Headers) => verifyCronRequestMock(headers)
}))

vi.mock("@feature-lib/capture/ingest", () => ({
  IngestPayloadSchema: {
    safeParse: (payload: unknown) => ({ success: true, data: payload })
  },
  processIngest: (userId: string, payload: unknown) => processIngestMock(userId, payload)
}))

vi.mock("@/lib/supabase-admin", () => {
  const from = (table: string) => {
    if (table === "ingest_jobs") {
      return {
        select: (_columns: string, options?: { count?: "exact"; head?: boolean }) => {
          if (options?.head) {
            return {
              eq: async () => ({ count: 0 })
            }
          }

          return {
            eq: () => ({
              order: () => ({
                limit: async () => ({
                  data: [{ id: "job-1", user_id: "user-1", payload: { title: "t" }, attempts: 0 }],
                  error: null
                })
              })
            })
          }
        },
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: async () => ({ data: [{ id: "job-1" }], error: null })
            }),
            then: undefined
          })
        })
      }
    }

    if (table === "records") {
      return {
        delete: () => ({
          eq: () => ({
            lt: () => ({
              select: async () => ({ data: [{ id: "record-1" }], error: null })
            })
          })
        })
      }
    }

    throw new Error(`Unexpected table ${table}`)
  }

  return {
    getSupabaseAdmin: () => ({ from })
  }
})

import { routePostCronRun as POST } from "./helpers/routes"

describe("POST /api/cron/run", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when verification fails", async () => {
    verifyCronRequestMock.mockReturnValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    })

    const response = await POST(new Request("http://localhost/api/cron/run", { method: "POST" }))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("runs ingest retry and cleanup in one request", async () => {
    verifyCronRequestMock.mockReturnValueOnce({ ok: true })
    processIngestMock.mockResolvedValueOnce()

    const response = await POST(new Request("http://localhost/api/cron/run", { method: "POST" }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ingest: { done: 1, failed: 0, pending: 0 },
      cleanup: { deleted: 1, cutoff: expect.any(String) }
    })
    expect(processIngestMock).toHaveBeenCalledWith("user-1", { title: "t" })
  })

  it("returns failed ingest count when job processing throws", async () => {
    verifyCronRequestMock.mockReturnValueOnce({ ok: true })
    processIngestMock.mockRejectedValueOnce(new Error("ingest failed"))

    const response = await POST(new Request("http://localhost/api/cron/run", { method: "POST" }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ingest: { done: 0, failed: 1, pending: 0 },
      cleanup: { deleted: 1, cutoff: expect.any(String) }
    })
  })
})
