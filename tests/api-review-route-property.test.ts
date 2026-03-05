import fc from "fast-check"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { ReviewRecordSchema, TriageDecisionSchema } from "@/lib/schemas"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()
const reviewLogInsertMock = vi.fn<(payload: unknown) => Promise<{ error: null | { message: string } }>>()

const updatedPayloads: Array<Record<string, unknown>> = []

const currentRecord = {
  id: "11111111-1111-1111-1111-111111111111",
  state: "INBOX" as "INBOX" | "ACTIVE" | "PINNED",
  interval_days: 1,
  due_at: null as string | null,
  last_reviewed_at: null as string | null,
  review_count: 0
}

vi.mock("@/lib/auth", () => ({
  getUserId: (headers: Headers) => getUserIdMock(headers)
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitDistributed: () => rateLimitMock(),
  resolveClientKey: () => "test-client"
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "records") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: { ...currentRecord }, error: null })
              })
            })
          }),
          update: (payload: Record<string, unknown>) => {
            updatedPayloads.push(payload)
            return {
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: {
                        id: currentRecord.id,
                        ...payload
                      },
                      error: null
                    })
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

function createRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/review/${currentRecord.id}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  })
}

describe("POST /api/review/:id property tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updatedPayloads.length = 0

    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
    reviewLogInsertMock.mockResolvedValue({ error: null })

    currentRecord.state = "INBOX"
    currentRecord.interval_days = 1
    currentRecord.review_count = 0
    currentRecord.due_at = null
    currentRecord.last_reviewed_at = null
  })

  it("rejects arbitrary non-conforming payloads", async () => {
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (payload) => {
        fc.pre(!TriageDecisionSchema.safeParse(payload).success)
        fc.pre(!ReviewRecordSchema.safeParse(payload).success)

        const response = await POST(createRequest(payload), {
          params: Promise.resolve({ id: currentRecord.id })
        })

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({ error: "Invalid payload" })
      }),
      { numRuns: 80 }
    )
  })

  it("enforces ARCHIVE transition to archived state with null due date", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("INBOX", "ACTIVE", "PINNED" as const),
        fc.integer({ min: 0, max: 1000 }),
        async (state, reviewCount) => {
          updatedPayloads.length = 0
          currentRecord.state = state
          currentRecord.review_count = reviewCount

          const response = await POST(createRequest({ decisionType: "ARCHIVE" }), {
            params: Promise.resolve({ id: currentRecord.id })
          })

          expect(response.status).toBe(200)
          const updated = updatedPayloads.at(-1)
          expect(updated?.state).toBe("ARCHIVED")
          expect(updated?.due_at).toBeNull()
          expect(updated?.review_count).toBe(reviewCount + 1)
        }
      ),
      { numRuns: 40 }
    )
  })

  it("enforces ACT transition to pinned state", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("INBOX", "ACTIVE", "PINNED" as const),
        fc.constantFrom("EXPERIMENT", "SHARE", "TODO" as const),
        async (state, actionType) => {
          updatedPayloads.length = 0
          currentRecord.state = state

          const response = await POST(createRequest({ decisionType: "ACT", actionType }), {
            params: Promise.resolve({ id: currentRecord.id })
          })

          expect(response.status).toBe(200)
          const updated = updatedPayloads.at(-1)
          expect(updated?.state).toBe("PINNED")
          expect(typeof updated?.due_at).toBe("string")
        }
      ),
      { numRuns: 40 }
    )
  })

  it("enforces DEFER interval and state mapping invariants", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("INBOX", "ACTIVE", "PINNED" as const),
        fc.constantFrom("NEED_INFO", "LOW_CONFIDENCE", "NO_TIME" as const),
        fc.integer({ min: 1, max: 30 }),
        async (state, deferReason, snoozeDays) => {
          updatedPayloads.length = 0
          currentRecord.state = state

          const response = await POST(createRequest({ decisionType: "DEFER", deferReason, snooze_days: snoozeDays }), {
            params: Promise.resolve({ id: currentRecord.id })
          })

          expect(response.status).toBe(200)
          const updated = updatedPayloads.at(-1)
          expect(updated?.interval_days).toBe(snoozeDays)
          expect(typeof updated?.due_at).toBe("string")
          expect(updated?.state).toBe(state === "INBOX" ? "ACTIVE" : state)
        }
      ),
      { numRuns: 40 }
    )
  })
})
