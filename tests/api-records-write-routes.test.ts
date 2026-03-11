import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()
const processIngestMock = vi.fn<
  (userId: string, payload: { items: Array<Record<string, unknown>> }, options?: Record<string, unknown>) =>
    Promise<{ created: number; ids: string[]; skipped_empty: number; skipped_duplicate: number; total: number }>
>()
const sendRecordStateChangedEventMock = vi.fn<(payload: unknown) => Promise<{ ok: boolean; skipped?: boolean; status?: number }>>()

const mockState = {
  ownedTagRows: [] as Array<{ id: string; name: string }>,
  selectedRecord: {
    id: "rec-1",
    user_id: "user-1",
    source_id: null,
    kind: "note",
    content: "hello",
    content_hash: "hash-1",
    url: null,
    source_title: null,
    favicon_url: null,
    current_note: null,
    note_updated_at: null,
    adopted_from_ai: false,
    state: "ACTIVE",
    interval_days: 1,
    due_at: null,
    last_reviewed_at: null,
    review_count: 0,
    created_at: "2026-03-06T00:00:00.000Z",
    updated_at: "2026-03-06T00:00:00.000Z"
  },
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>
}

vi.mock("@/lib/auth", () => ({
  getUserId: (headers: Headers) => getUserIdMock(headers)
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitDistributed: () => rateLimitMock(),
  resolveClientKey: () => "test-client"
}))

vi.mock("@feature-lib/capture/ingest", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@feature-lib/capture/ingest")>()

  return {
    ...actual,
    processIngest: (
      userId: string,
      payload: { items: Array<Record<string, unknown>> },
      options?: Record<string, unknown>
    ) => processIngestMock(userId, payload, options)
  }
})

vi.mock("@feature-lib/notifications/webhooks", () => ({
  sendRecordStateChangedEvent: (payload: unknown) => sendRecordStateChangedEventMock(payload)
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "tags") {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: mockState.ownedTagRows, error: null })
            })
          })
        }
      }

      if (table === "records") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: mockState.selectedRecord,
                  error: null
                })
              })
            })
          }),
          update: () => ({
            eq: () => ({
              eq: async () => ({ error: null })
            })
          })
        }
      }

      if (table === "record_tags") {
        return {
          insert: async () => ({ error: null }),
          upsert: async () => ({ error: null }),
          select: () => ({
            eq: async () => ({ data: [], error: null })
          }),
          delete: () => ({
            eq: () => ({
              in: async () => ({ error: null })
            })
          })
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      mockState.rpcCalls.push({ fn, args })
      return {
        single: async () => ({
          data: {
            id: "rec-1",
            state: typeof args.p_state === "string" ? args.p_state : mockState.selectedRecord.state
          },
          error: null
        })
      }
    }
  })
}))

import { routePatchRecordById as PATCH, routePostRecords as POST } from "./helpers/routes"

describe("records write routes enforce owned tag ids", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
    processIngestMock.mockResolvedValue({
      created: 1,
      ids: ["rec-1"],
      skipped_empty: 0,
      skipped_duplicate: 0,
      total: 1
    })
    sendRecordStateChangedEventMock.mockResolvedValue({ ok: true, status: 200 })
    mockState.ownedTagRows = [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "owned" }]
    mockState.rpcCalls = []
  })

  it("rejects record creation when tag_ids include a non-owned tag", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/records", {
        method: "POST",
        body: JSON.stringify({
          kind: "note",
          content: "hello",
          tag_ids: [
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
          ]
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid tag_ids" })
    expect(mockState.rpcCalls).toHaveLength(0)
    expect(processIngestMock).not.toHaveBeenCalled()
  })

  it("rejects record patch when tag_ids include a non-owned tag before updating the record", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/records/11111111-1111-1111-1111-111111111111", {
        method: "PATCH",
        body: JSON.stringify({
          tag_ids: [
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
          ]
        }),
        headers: { "Content-Type": "application/json" }
      }),
      {
        params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" })
      }
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "Invalid tag_ids" })
    expect(mockState.rpcCalls).toHaveLength(0)
  })

  it("creates records through the ingest pipeline", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/records", {
        method: "POST",
        body: JSON.stringify({
          kind: "note",
          content: "hello",
          tag_ids: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(201)
    expect(processIngestMock).toHaveBeenCalledWith("user-1", {
      items: [
        {
          content: "hello",
          source_title: undefined,
          url: undefined,
          kind: "note",
          tags: ["owned"],
          source_type: undefined,
          source_service: undefined,
          source_identity: undefined,
          adopted_from_ai: undefined
        }
      ]
    }, {
      importChannel: "manual",
      duplicateMode: "error"
    })
  })

  it("patches records through the atomic RPC path", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/records/11111111-1111-1111-1111-111111111111", {
        method: "PATCH",
        body: JSON.stringify({
          source_title: "Updated",
          tag_ids: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]
        }),
        headers: { "Content-Type": "application/json" }
      }),
      {
        params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" })
      }
    )

    expect(response.status).toBe(200)
    expect(mockState.rpcCalls).toHaveLength(1)
    expect(mockState.rpcCalls[0]).toMatchObject({
      fn: "update_record_with_tags",
      args: {
        p_user_id: "user-1",
        p_record_id: "11111111-1111-1111-1111-111111111111",
        p_update_tags: true,
        p_tag_ids: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]
      }
    })
    expect(sendRecordStateChangedEventMock).not.toHaveBeenCalled()
  })

  it("dispatches export webhook when record state changes", async () => {
    mockState.selectedRecord.state = "ACTIVE"
    mockState.rpcCalls = []
    sendRecordStateChangedEventMock.mockClear()

    const response = await PATCH(
      new NextRequest("http://localhost/api/records/11111111-1111-1111-1111-111111111111", {
        method: "PATCH",
        body: JSON.stringify({
          state: "PINNED"
        }),
        headers: { "Content-Type": "application/json" }
      }),
      {
        params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" })
      }
    )

    expect(response.status).toBe(200)
    expect(mockState.rpcCalls).toHaveLength(1)
    expect(sendRecordStateChangedEventMock).toHaveBeenCalledWith({
      userId: "user-1",
      recordId: "11111111-1111-1111-1111-111111111111",
      previousState: "ACTIVE",
      nextState: "PINNED",
      source: "record.patch"
    })
  })
})
