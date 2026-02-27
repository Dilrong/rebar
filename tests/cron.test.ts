import { beforeEach, describe, expect, it } from "vitest"
import { verifyCronRequest } from "@/lib/cron"

const PREV_ENV = { ...process.env }

describe("verifyCronRequest", () => {
  beforeEach(() => {
    process.env = { ...PREV_ENV }
    delete process.env.REBAR_CRON_SECRET
  })

  it("returns 401 when cron secret is not configured", () => {
    const result = verifyCronRequest(new Headers())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
  })

  it("accepts x-cron-secret header", () => {
    process.env.REBAR_CRON_SECRET = "secret-1"
    const result = verifyCronRequest(new Headers({ "x-cron-secret": "secret-1" }))
    expect(result.ok).toBe(true)
  })

  it("accepts bearer token", () => {
    process.env.REBAR_CRON_SECRET = "secret-2"
    const result = verifyCronRequest(new Headers({ authorization: "Bearer secret-2" }))
    expect(result.ok).toBe(true)
  })

  it("rejects invalid secret", () => {
    process.env.REBAR_CRON_SECRET = "secret-3"
    const result = verifyCronRequest(new Headers({ "x-cron-secret": "wrong" }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
  })
})
