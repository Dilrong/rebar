import { beforeEach, describe, expect, it, vi } from "vitest"
import { checkRateLimit, checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"

const PREV_ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...PREV_ENV }
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
})

describe("checkRateLimit", () => {
  it("blocks requests after limit in same window", () => {
    const key = `k-${Date.now()}-1`
    expect(checkRateLimit({ key, limit: 2, windowMs: 10_000 }).ok).toBe(true)
    expect(checkRateLimit({ key, limit: 2, windowMs: 10_000 }).ok).toBe(true)
    expect(checkRateLimit({ key, limit: 2, windowMs: 10_000 }).ok).toBe(false)
  })

  it("allows requests again after window reset", async () => {
    const key = `k-${Date.now()}-2`
    expect(checkRateLimit({ key, limit: 1, windowMs: 30 }).ok).toBe(true)
    expect(checkRateLimit({ key, limit: 1, windowMs: 30 }).ok).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 35))
    expect(checkRateLimit({ key, limit: 1, windowMs: 30 }).ok).toBe(true)
  })
})

describe("checkRateLimitDistributed", () => {
  it("falls back to in-memory limiter without Upstash env", async () => {
    const key = `d-${Date.now()}-1`
    expect((await checkRateLimitDistributed({ key, limit: 1, windowMs: 10_000 })).ok).toBe(true)
    expect((await checkRateLimitDistributed({ key, limit: 1, windowMs: 10_000 })).ok).toBe(false)
  })

  it("uses Upstash path when env is configured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.test"
    process.env.UPSTASH_REDIS_REST_TOKEN = "token"

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => [{ result: 1 }] } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => [{ result: "OK" }] } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => [{ result: "9000" }] } as Response)

    const result = await checkRateLimitDistributed({ key: "d-upstash-1", limit: 2, windowMs: 10_000 })
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalled()

    fetchMock.mockRestore()
  })

  it("falls back when Upstash request fails", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.test"
    process.env.UPSTASH_REDIS_REST_TOKEN = "token"

    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"))

    const key = `d-fallback-${Date.now()}`
    expect((await checkRateLimitDistributed({ key, limit: 1, windowMs: 10_000 })).ok).toBe(true)
    expect((await checkRateLimitDistributed({ key, limit: 1, windowMs: 10_000 })).ok).toBe(false)

    fetchMock.mockRestore()
  })
})

describe("resolveClientKey", () => {
  it("uses first x-forwarded-for ip", () => {
    const headers = new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })
    expect(resolveClientKey(headers)).toBe("1.1.1.1")
  })

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "3.3.3.3" })
    expect(resolveClientKey(headers)).toBe("3.3.3.3")
  })

  it("returns unknown when no headers exist", () => {
    expect(resolveClientKey(new Headers())).toBe("unknown")
  })
})
