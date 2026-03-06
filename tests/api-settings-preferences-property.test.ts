import fc from "fast-check"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const getUserIdMock = vi.fn<(headers: Headers) => Promise<string | null>>()
const rateLimitMock = vi.fn<() => Promise<{ ok: boolean; retryAfterSec: number; remaining: number }>>()
const maybeSingleMock = vi.fn<() => Promise<unknown>>()
const upsertSingleMock = vi.fn<() => Promise<unknown>>()

const ALLOWED_START_PAGES = ["/review", "/capture", "/library", "/search"]
const ALLOWED_START_PAGE_SET = new Set(ALLOWED_START_PAGES)
const ALLOWED_FONT_FAMILIES = ["sans", "mono"]
const ALLOWED_FONT_FAMILY_SET = new Set(ALLOWED_FONT_FAMILIES)

function isValidPreferencesPayload(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false
  }

  const startPage = (value as { startPage?: unknown }).startPage
  const fontFamily = (value as { fontFamily?: unknown }).fontFamily
  const hasValidStartPage = typeof startPage === "string" && ALLOWED_START_PAGE_SET.has(startPage)
  const hasValidFontFamily = typeof fontFamily === "string" && ALLOWED_FONT_FAMILY_SET.has(fontFamily)

  return hasValidStartPage || hasValidFontFamily
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

describe("/api/settings/preferences property tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserIdMock.mockResolvedValue("user-1")
    rateLimitMock.mockResolvedValue({ ok: true, retryAfterSec: 1, remaining: 999 })
  })

  it("rejects any unsupported startPage value", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 40 }).filter((value) => !ALLOWED_START_PAGE_SET.has(value)),
        async (invalidStartPage) => {
          const response = await PATCH(
            new NextRequest("http://localhost/api/settings/preferences", {
              method: "PATCH",
              body: JSON.stringify({ startPage: invalidStartPage }),
              headers: { "Content-Type": "application/json" }
            })
          )

          expect(response.status).toBe(400)
          const payload = (await response.json()) as { error?: string }
          expect(typeof payload.error).toBe("string")
        }
      ),
      { numRuns: 60 }
    )
  })

  it("accepts and persists all allowed startPage values", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...ALLOWED_START_PAGES), async (startPage) => {
        upsertSingleMock.mockResolvedValueOnce({ data: { start_page: startPage }, error: null })

        const response = await PATCH(
          new NextRequest("http://localhost/api/settings/preferences", {
            method: "PATCH",
            body: JSON.stringify({ startPage }),
            headers: { "Content-Type": "application/json" }
          })
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({ startPage, fontFamily: "sans" })
      }),
      { numRuns: 40 }
    )
  })

  it("falls back to default when stored start_page is malformed", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 40 }).filter((value) => !ALLOWED_START_PAGE_SET.has(value)),
        async (storedValue) => {
          maybeSingleMock.mockResolvedValueOnce({ data: { start_page: storedValue }, error: null })

          const response = await GET(new NextRequest("http://localhost/api/settings/preferences", { method: "GET" }))

          expect(response.status).toBe(200)
          await expect(response.json()).resolves.toEqual({ startPage: "/library", fontFamily: "sans" })
        }
      ),
      { numRuns: 60 }
    )
  })

  it("rejects arbitrary non-conforming JSON payloads", async () => {
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (payload) => {
        fc.pre(!isValidPreferencesPayload(payload))

        const response = await PATCH(
          new NextRequest("http://localhost/api/settings/preferences", {
            method: "PATCH",
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" }
          })
        )

        expect(response.status).toBe(400)
      }),
      { numRuns: 80 }
    )
  })
})
