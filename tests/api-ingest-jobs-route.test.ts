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

const jobs = [
  {
    id: "job-1",
    user_id: "user-1",
    status: "FAILED",
    attempts: 2,
    last_error: "network",
    created_at: "2026-03-11T00:00:00.000Z",
    payload: {
      import_channel: "json",
      items: [{ source_title: "Article title", content: "Snippet" }]
    }
  },
  {
    id: "job-2",
    user_id: "user-1",
    status: "PENDING",
    attempts: 0,
    last_error: null,
    created_at: "2026-03-11T00:01:00.000Z",
    payload: {
      import_channel: "csv",
      items: [{ book_title: "Deep Work", content: "Important quote" }, { content: "Second quote" }]
    }
  }
]

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "ingest_jobs") {
        throw new Error(`Unexpected table ${table}`)
      }

      return {
        select: (_columns: string, options?: { count?: "exact"; head?: boolean }) => {
          if (options?.head) {
            return {
              eq: (_column: string, _value: string) => ({
                eq: async (_statusColumn: string, status: string) => ({
                  count: jobs.filter((job) => job.status === status).length,
                  error: null
                })
              })
            }
          }

          return {
            eq: (_column: string, _value: string) => ({
              order: () => ({
                limit: async () => ({ data: jobs, count: jobs.length, error: null })
              }),
              eq: (_statusColumn: string, status: string) => ({
                order: () => ({
                  limit: async () => ({
                    data: jobs.filter((job) => job.status === status),
                    count: jobs.filter((job) => job.status === status).length,
                    error: null
                  })
                })
              })
            })
          }
        },
        delete: () => ({
          eq: (_column: string, _value: string) => ({
            eq: async () => ({ error: null })
          })
        })
      }
    }
  })
}))

import { routeDeleteIngestJobs as DELETE, routeGetIngestJobs as GET } from "./helpers/routes"

describe("/api/ingest-jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("returns recent jobs with derived pipeline metadata and counts", async () => {
    const response = await GET(new NextRequest("http://localhost/api/ingest-jobs?status=ALL"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: "job-1",
          status: "FAILED",
          attempts: 2,
          last_error: "network",
          created_at: "2026-03-11T00:00:00.000Z",
          item_count: 1,
          import_channel: "json",
          preview: "Article title"
        },
        {
          id: "job-2",
          status: "PENDING",
          attempts: 0,
          last_error: null,
          created_at: "2026-03-11T00:01:00.000Z",
          item_count: 2,
          import_channel: "csv",
          preview: "Deep Work"
        }
      ],
      total: 2,
      counts: {
        pending: 1,
        processing: 0,
        done: 0,
        failed: 1
      }
    })
  })

  it("clears jobs for the requested status", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/ingest-jobs?status=FAILED", { method: "DELETE" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ cleared: true })
  })
})
