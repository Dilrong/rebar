import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()
const maybeSingleMock = vi.fn<() => Promise<unknown>>()
const upsertSingleMock = vi.fn<() => Promise<unknown>>()

vi.mock("@/lib/auth", () => ({
  getUserId: (headers: Headers) => getUserIdMock(headers)
}))

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitDistributed: () => rateLimitMock(),
  resolveClientKey: () => "test-client"
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => maybeSingleMock()
        })
      }),
      upsert: () => ({
        select: () => ({
          single: () => upsertSingleMock()
        })
      })
    })
  })
}))

import { routeGetSettingsPreferences as GET, routePatchSettingsPreferences as PATCH } from "./helpers/routes"

describe("/api/settings/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("returns 401 when unauthenticated on GET", async () => {
    getUserIdMock.mockResolvedValueOnce(null)

    const response = await GET(new NextRequest("http://localhost/api/settings/preferences", { method: "GET" }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("returns default start page when no stored preference exists", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })

    const response = await GET(new NextRequest("http://localhost/api/settings/preferences", { method: "GET" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ startPage: "/library", fontFamily: "sans" })
  })

  it("returns defaults when preferences table is unavailable on GET", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the table 'public.user_preferences' in the schema cache"
      }
    })

    const response = await GET(new NextRequest("http://localhost/api/settings/preferences", { method: "GET" }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ startPage: "/library", fontFamily: "sans" })
  })

  it("persists and returns selected start page", async () => {
    upsertSingleMock.mockResolvedValueOnce({ data: { start_page: "/review" }, error: null })

    const response = await PATCH(
      new NextRequest("http://localhost/api/settings/preferences", {
        method: "PATCH",
        body: JSON.stringify({ startPage: "/review" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ startPage: "/review", fontFamily: "sans" })
  })

  it("returns requested values when preferences table is unavailable on PATCH", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the table 'public.user_preferences' in the schema cache"
      }
    })

    const response = await PATCH(
      new NextRequest("http://localhost/api/settings/preferences", {
        method: "PATCH",
        body: JSON.stringify({ fontFamily: "mono" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ startPage: "/library", fontFamily: "mono" })
  })
})
