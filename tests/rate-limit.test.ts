import { describe, expect, it } from "vitest"
import { checkRateLimit, resolveClientKey } from "@/lib/rate-limit"

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
