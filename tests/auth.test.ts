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
    delete process.env.REBAR_E2E_BYPASS_AUTH
    delete process.env.REBAR_E2E_TEST_USER_ID
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

    const userId = await getUserId(headers, { allowIngestKey: true })
    expect(userId).toBe("33333333-3333-3333-3333-333333333333")
  })

  it("does not accept ingest key auth unless explicitly enabled", async () => {
    process.env.REBAR_INGEST_API_KEY = "ingest-key"
    const headers = new Headers({
      "x-rebar-ingest-key": "ingest-key",
      "x-user-id": "33333333-3333-3333-3333-333333333333"
    })

    const userId = await getUserId(headers)
    expect(userId).toBeNull()
  })

  it("rejects invalid ingest key", async () => {
    process.env.REBAR_INGEST_API_KEY = "ingest-key"
    const headers = new Headers({
      "x-rebar-ingest-key": "wrong-key",
      "x-user-id": "33333333-3333-3333-3333-333333333333"
    })

    const userId = await getUserId(headers, { allowIngestKey: true })
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

  it("allows e2e bypass only for localhost hosts", async () => {
    process.env.REBAR_E2E_BYPASS_AUTH = "true"
    process.env.REBAR_E2E_TEST_USER_ID = "55555555-5555-4555-8555-555555555555"

    const localhostUserId = await getUserId(new Headers({ host: "localhost:4173" }))
    expect(localhostUserId).toBe("55555555-5555-4555-8555-555555555555")

    const loopbackUserId = await getUserId(new Headers({ host: "127.0.0.1:4173" }))
    expect(loopbackUserId).toBe("55555555-5555-4555-8555-555555555555")
  })

  it("ignores x-forwarded-host for e2e bypass (spoofable)", async () => {
    process.env.REBAR_E2E_BYPASS_AUTH = "true"
    process.env.REBAR_E2E_TEST_USER_ID = "55555555-5555-4555-8555-555555555555"

    const userId = await getUserId(new Headers({ "x-forwarded-host": "127.0.0.1:4173" }))
    expect(userId).toBeNull()
  })

  it("rejects e2e bypass for non-local hosts", async () => {
    process.env.REBAR_E2E_BYPASS_AUTH = "true"
    process.env.REBAR_E2E_TEST_USER_ID = "55555555-5555-4555-8555-555555555555"

    const userId = await getUserId(new Headers({ host: "example.com" }))
    expect(userId).toBeNull()
  })

  it("rejects spoofed localhost-like hostnames", async () => {
    process.env.REBAR_E2E_BYPASS_AUTH = "true"
    process.env.REBAR_E2E_TEST_USER_ID = "55555555-5555-4555-8555-555555555555"

    const localhostSuffix = await getUserId(new Headers({ host: "localhost.attacker.com" }))
    expect(localhostSuffix).toBeNull()

    const loopbackSuffix = await getUserId(new Headers({ host: "127.0.0.1.attacker.com" }))
    expect(loopbackSuffix).toBeNull()
  })

  it("rejects bypass when x-forwarded-host claims localhost but host does not", async () => {
    process.env.REBAR_E2E_BYPASS_AUTH = "true"
    process.env.REBAR_E2E_TEST_USER_ID = "55555555-5555-4555-8555-555555555555"

    const userId = await getUserId(
      new Headers({
        host: "example.com",
        "x-forwarded-host": "localhost:4173"
      })
    )

    expect(userId).toBeNull()
  })

  it("allows bypass for IPv6 loopback host", async () => {
    process.env.REBAR_E2E_BYPASS_AUTH = "true"
    process.env.REBAR_E2E_TEST_USER_ID = "55555555-5555-4555-8555-555555555555"

    const userId = await getUserId(new Headers({ host: "[::1]:4173" }))
    expect(userId).toBe("55555555-5555-4555-8555-555555555555")
  })

  it("rejects e2e bypass with invalid test user id", async () => {
    process.env.REBAR_E2E_BYPASS_AUTH = "true"
    process.env.REBAR_E2E_TEST_USER_ID = "not-a-uuid"

    const userId = await getUserId(new Headers({ host: "localhost:4173" }))
    expect(userId).toBeNull()
  })
})
