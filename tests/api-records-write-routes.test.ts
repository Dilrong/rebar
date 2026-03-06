import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()

const mockState = {
  ownedTagRows: [] as Array<{ id: string }>,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>
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
                  data: { id: "11111111-1111-1111-1111-111111111111", state: "ACTIVE" },
                  error: null
                })
              })
            })
          }),
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
        single: async () => ({ data: { id: "rec-1" }, error: null })
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
    mockState.ownedTagRows = [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }]
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

  it("creates records through the atomic RPC path", async () => {
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
    expect(mockState.rpcCalls).toHaveLength(1)
    expect(mockState.rpcCalls[0]).toMatchObject({
      fn: "create_record_with_tags",
      args: {
        p_user_id: "user-1",
        p_tag_ids: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]
      }
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
  })
})
