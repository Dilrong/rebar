import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()

const currentRecordSingleMock = vi.fn<() => Promise<unknown>>()
const updatedRecordSingleMock = vi.fn<() => Promise<unknown>>()
const reviewLogInsertMock = vi.fn<(payload: unknown) => Promise<{ error: null | { message: string } }>>()
const sendRecordStateChangedEventMock = vi.fn<(payload: unknown) => Promise<{ ok: boolean; skipped?: boolean; status?: number }>>()

const updatedPayloads: Array<Record<string, unknown>> = []

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
      if (table === "records") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => currentRecordSingleMock()
              })
            })
          }),
          update: (payload: Record<string, unknown>) => {
            updatedPayloads.push(payload)
            return {
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: () => updatedRecordSingleMock()
                  })
                })
              })
            }
          }
        }
      }

      if (table === "review_log") {
        return {
          insert: (payload: unknown) => reviewLogInsertMock(payload)
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }
  })
}))

import { routePostReview as POST } from "./helpers/routes"

describe("POST /api/review/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updatedPayloads.length = 0
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
    currentRecordSingleMock.mockResolvedValue({
      data: {
        id: "11111111-1111-1111-1111-111111111111",
        state: "INBOX",
        interval_days: 1,
        due_at: null,
        last_reviewed_at: null,
        review_count: 0
      },
      error: null
    })
    updatedRecordSingleMock.mockResolvedValue({
      data: {
        id: "11111111-1111-1111-1111-111111111111",
        state: "ARCHIVED",
        interval_days: 2,
        due_at: null,
        review_count: 1
      },
      error: null
    })
    reviewLogInsertMock.mockResolvedValue({ error: null })
    sendRecordStateChangedEventMock.mockResolvedValue({ ok: true, status: 200 })
  })

  it("returns 400 for invalid triage payload", async () => {
    const request = new NextRequest("http://localhost/api/review/11111111-1111-1111-1111-111111111111", {
      method: "POST",
      body: JSON.stringify({ decisionType: "ACT" })
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" })
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid payload" })
  })

  it("accepts ARCHIVE decision and clears due date", async () => {
    const request = new NextRequest("http://localhost/api/review/11111111-1111-1111-1111-111111111111", {
      method: "POST",
      body: JSON.stringify({ decisionType: "ARCHIVE" })
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" })
    })

    expect(response.status).toBe(200)
    expect(updatedPayloads[0]?.state).toBe("ARCHIVED")
    expect(updatedPayloads[0]?.due_at).toBeNull()
    expect(sendRecordStateChangedEventMock).toHaveBeenCalledWith({
      userId: "user-1",
      recordId: "11111111-1111-1111-1111-111111111111",
      previousState: "INBOX",
      nextState: "ARCHIVED",
      source: "review"
    })
    await expect(response.json()).resolves.toEqual({
      record: {
        id: "11111111-1111-1111-1111-111111111111",
        state: "ARCHIVED",
        interval_days: 2,
        due_at: null,
        review_count: 1
      }
    })
  })
})
