import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const PREV_ENV = { ...process.env }

const getUserMock = vi.fn<() => Promise<{ data: { user: null }; error: null }>>()
const createServerClientMock = vi.fn<
  (
    url: string,
    key: string,
    options: {
      cookies: {
        getAll: () => unknown[]
        setAll: (cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void
      }
    }
  ) => { auth: { getUser: () => Promise<{ data: { user: null }; error: null }> } }
>()

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    url: string,
    key: string,
    options: {
      cookies: {
        getAll: () => unknown[]
        setAll: (cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void
      }
    }
  ) => createServerClientMock(url, key, options)
}))

import { proxy } from "@/proxy"

describe("proxy + origin integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...PREV_ENV }
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com"
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key"
    Object.assign(process.env, { NODE_ENV: "production" })
    delete process.env.REBAR_ALLOW_ALL_EXTENSION_ORIGINS
    delete process.env.REBAR_ALLOWED_EXTENSION_IDS
    delete process.env.NEXT_PUBLIC_SITE_URL

    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock
      }
    })
  })

  it("allows POST without Origin header", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "POST",
        headers: {
          host: "localhost:3000"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })

  it("blocks malformed Origin header on mutating requests", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "PATCH",
        headers: {
          origin: "not-a-valid-origin",
          host: "localhost:3000"
        }
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("allows configured site origin", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://rebar.example.com/path"

    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "GET",
        headers: {
          origin: "https://rebar.example.com",
          host: "api.rebar.example.com"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://rebar.example.com")
  })

  it("allows whitelisted extension origin in production", async () => {
    process.env.REBAR_ALLOWED_EXTENSION_IDS = "ext-allowed-123"

    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "POST",
        headers: {
          origin: "chrome-extension://ext-allowed-123",
          host: "api.rebar.example.com"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("chrome-extension://ext-allowed-123")
  })

  it("blocks non-whitelisted extension origin in production", async () => {
    process.env.REBAR_ALLOWED_EXTENSION_IDS = "ext-allowed-123"

    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "POST",
        headers: {
          origin: "chrome-extension://ext-denied-999",
          host: "api.rebar.example.com"
        }
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("allows extension origin in development mode", async () => {
    Object.assign(process.env, { NODE_ENV: "development" })

    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "POST",
        headers: {
          origin: "chrome-extension://any-extension-id",
          host: "localhost:3000"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("chrome-extension://any-extension-id")
  })
})
