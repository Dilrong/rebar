import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()

const logSingleMock = vi.fn<() => Promise<unknown>>()
const recordSingleMock = vi.fn<() => Promise<unknown>>()

vi.mock("@/lib/auth", () => ({
  getUserId: (headers: Headers) => getUserIdMock(headers)
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "review_log") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    single: () => logSingleMock()
                  })
                })
              })
            })
          })
        }
      }

      if (table === "records") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => recordSingleMock()
              })
            })
          })
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }
  })
}))

import { routePostReviewUndo as POST } from "./helpers/routes"

describe("POST /api/review/:id/undo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    logSingleMock.mockResolvedValue({
      data: {
        id: "log-1",
        reviewed_at: new Date().toISOString(),
        action: "reviewed",
        prev_state: "ACTIVE",
        prev_interval_days: 1,
        prev_due_at: null,
        prev_review_count: 2,
        prev_last_reviewed_at: null
      },
      error: null
    })
  })

  it("returns 409 when current review_count is stale", async () => {
    recordSingleMock.mockResolvedValue({
      data: { updated_at: new Date().toISOString(), review_count: 9 },
      error: null
    })

    const request = new NextRequest("http://localhost/api/review/11111111-1111-1111-1111-111111111111/undo", {
      method: "POST"
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" })
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: "Undo target is stale" })
  })
})
