import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()
const sendRecordStateChangedEventMock = vi.fn<(payload: unknown) => Promise<{ ok: boolean; status?: number }>>()

const mockRows = [
  { id: "11111111-1111-1111-1111-111111111111", state: "ACTIVE" },
  { id: "22222222-2222-2222-2222-222222222222", state: "PINNED" }
]

vi.mock("@/lib/auth", () => ({
  getUserId: (headers: Headers) => getUserIdMock(headers)
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitDistributed: () => rateLimitMock(),
  resolveClientKey: () => "test-client"
}))

vi.mock("@feature-lib/notifications/webhooks", () => ({
  sendRecordStateChangedEvent: (payload: unknown) => sendRecordStateChangedEventMock(payload)
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "records") {
        throw new Error(`Unexpected table ${table}`)
      }

      return {
        select: () => ({
          eq: () => ({
            in: async () => ({
              data: mockRows,
              error: null
            })
          })
        }),
        update: () => ({
          eq: () => ({
            in: async () => ({
              error: null
            })
          })
        })
      }
    }
  })
}))

import { routePatchRecordsBulk as PATCH } from "./helpers/routes"

describe("PATCH /api/records/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
    sendRecordStateChangedEventMock.mockResolvedValue({ ok: true, status: 200 })
  })

  it("updates records and dispatches state-change webhooks", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/records/bulk", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ids: mockRows.map((row) => row.id),
          state: "ARCHIVED"
        })
      })
    )

    expect(response.status).toBe(200)
    expect(sendRecordStateChangedEventMock).toHaveBeenCalledTimes(2)
    expect(sendRecordStateChangedEventMock).toHaveBeenNthCalledWith(1, {
      userId: "user-1",
      recordId: "11111111-1111-1111-1111-111111111111",
      previousState: "ACTIVE",
      nextState: "ARCHIVED",
      source: "records.bulk"
    })
    expect(sendRecordStateChangedEventMock).toHaveBeenNthCalledWith(2, {
      userId: "user-1",
      recordId: "22222222-2222-2222-2222-222222222222",
      previousState: "PINNED",
      nextState: "ARCHIVED",
      source: "records.bulk"
    })
    await expect(response.json()).resolves.toEqual({
      requested: 2,
      updated: 2,
      failed: 0,
      failures: []
    })
  })
})
