import { beforeEach, describe, expect, it } from "vitest"
import { isAllowedOrigin } from "@/lib/security/origin"

const PREV_ENV = { ...process.env }

describe("isAllowedOrigin", () => {
  beforeEach(() => {
    process.env = { ...PREV_ENV }
    delete process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.REBAR_ALLOWED_EXTENSION_IDS
    delete process.env.REBAR_ALLOW_ALL_EXTENSION_ORIGINS
    Object.assign(process.env, { NODE_ENV: "test" })
  })

  it("allows requests when origin header is absent", () => {
    expect(isAllowedOrigin(null, "localhost:3000")).toBe(true)
  })

  it("allows same-host origin", () => {
    expect(isAllowedOrigin("https://example.com", "example.com")).toBe(true)
  })

  it("rejects malformed origin values", () => {
    expect(isAllowedOrigin("not-a-url", "example.com")).toBe(false)
  })

  it("allows any chrome extension origin in development", () => {
    Object.assign(process.env, { NODE_ENV: "development" })
    expect(isAllowedOrigin("chrome-extension://randomid", "example.com")).toBe(true)
  })

  it("allows configured extension id in production", () => {
    Object.assign(process.env, { NODE_ENV: "production", REBAR_ALLOWED_EXTENSION_IDS: "allowed123" })
    expect(isAllowedOrigin("chrome-extension://allowed123", "example.com")).toBe(true)
    expect(isAllowedOrigin("chrome-extension://denied999", "example.com")).toBe(false)
  })

  it("allows all extension origins only when override flag is true", () => {
    Object.assign(process.env, { NODE_ENV: "production", REBAR_ALLOW_ALL_EXTENSION_ORIGINS: "true" })
    expect(isAllowedOrigin("chrome-extension://any-extension", "example.com")).toBe(true)
  })

  it("allows configured site origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://rebar.example.com/path"
    expect(isAllowedOrigin("https://rebar.example.com", "api.other-host.com")).toBe(true)
  })
})
