import { beforeEach, describe, expect, it, vi } from "vitest"

const getUserMock = vi.fn<(...args: unknown[]) => Promise<{ data: { user: { id: string } | null }; error: unknown }>>()

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    auth: {
      getUser: getUserMock
    }
  })
}))

import { getUserId } from "@/lib/auth"

const PREV_ENV = { ...process.env }

describe("getUserId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...PREV_ENV }
    delete process.env.REBAR_INGEST_API_KEY
    delete process.env.REBAR_DEV_USER_ID
    Object.assign(process.env, { NODE_ENV: "test" })
  })

  it("returns user id for valid Bearer token", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "11111111-1111-1111-1111-111111111111" } }, error: null })

    const headers = new Headers({ authorization: "Bearer token-1" })
    const userId = await getUserId(headers)

    expect(userId).toBe("11111111-1111-1111-1111-111111111111")
  })

  it("does not fallback when Bearer token is invalid", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error("invalid") })
    process.env.REBAR_INGEST_API_KEY = "ingest-key"

    const headers = new Headers({
      authorization: "Bearer bad-token",
      "x-rebar-ingest-key": "ingest-key",
      "x-user-id": "22222222-2222-2222-2222-222222222222"
    })

    const userId = await getUserId(headers)
    expect(userId).toBeNull()
  })

  it("returns user id for valid ingest key auth", async () => {
    process.env.REBAR_INGEST_API_KEY = "ingest-key"
    const headers = new Headers({
      "x-rebar-ingest-key": "ingest-key",
      "x-user-id": "33333333-3333-3333-3333-333333333333"
    })

    const userId = await getUserId(headers)
    expect(userId).toBe("33333333-3333-3333-3333-333333333333")
  })

  it("rejects invalid ingest key", async () => {
    process.env.REBAR_INGEST_API_KEY = "ingest-key"
    const headers = new Headers({
      "x-rebar-ingest-key": "wrong-key",
      "x-user-id": "33333333-3333-3333-3333-333333333333"
    })

    const userId = await getUserId(headers)
    expect(userId).toBeNull()
  })

  it("allows dev fallback only in development", async () => {
    process.env.REBAR_DEV_USER_ID = "44444444-4444-4444-4444-444444444444"
    Object.assign(process.env, { NODE_ENV: "development" })
    const devUserId = await getUserId(new Headers())
    expect(devUserId).toBe("44444444-4444-4444-4444-444444444444")

    Object.assign(process.env, { NODE_ENV: "production" })
    const prodUserId = await getUserId(new Headers())
    expect(prodUserId).toBeNull()
  })
})
