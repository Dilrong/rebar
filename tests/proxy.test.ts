import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const PREV_ENV = { ...process.env }

const isAllowedOriginMock = vi.fn<(origin: string | null, host: string | null) => boolean>()
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

vi.mock("@/lib/security/origin", () => ({
  isAllowedOrigin: (origin: string | null, host: string | null) => isAllowedOriginMock(origin, host)
}))

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

describe("proxy middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...PREV_ENV }

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.com"
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key"

    isAllowedOriginMock.mockReturnValue(true)
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock
      }
    })
  })

  it("rejects OPTIONS preflight when origin is not allowed", async () => {
    isAllowedOriginMock.mockReturnValue(false)

    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "OPTIONS",
        headers: {
          origin: "https://evil.example.com",
          host: "localhost:3000"
        }
      })
    )

    expect(response.status).toBe(403)
  })

  it("returns CORS headers for allowed OPTIONS preflight", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.example.com",
          host: "localhost:3000"
        }
      })
    )

    expect(response.status).toBe(204)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true")
  })

  it("rejects OPTIONS requests without Origin header", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "OPTIONS",
        headers: {
          host: "localhost:3000"
        }
      })
    )

    expect(response.status).toBe(403)
  })

  it("blocks non-GET requests when origin is disallowed", async () => {
    isAllowedOriginMock.mockReturnValue(false)

    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "POST",
        headers: {
          origin: "https://evil.example.com",
          host: "localhost:3000"
        }
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" })
  })

  it("allows GET requests even when origin is disallowed", async () => {
    isAllowedOriginMock.mockReturnValue(false)

    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "GET",
        headers: {
          origin: "https://evil.example.com",
          host: "localhost:3000"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()
    expect(getUserMock).toHaveBeenCalledTimes(1)
  })

  it("attaches response CORS headers when origin is allowed", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "GET",
        headers: {
          origin: "https://app.example.com",
          host: "localhost:3000"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true")
  })

  it("skips supabase session refresh when env is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "GET",
        headers: {
          origin: "https://app.example.com",
          host: "localhost:3000"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(createServerClientMock).not.toHaveBeenCalled()
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it("keeps request available when session refresh fails", async () => {
    getUserMock.mockRejectedValueOnce(new Error("temporary outage"))

    const response = await proxy(
      new NextRequest("http://localhost/api/records", {
        method: "GET",
        headers: {
          origin: "https://app.example.com",
          host: "localhost:3000"
        }
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com")
  })
})
