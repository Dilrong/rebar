import { describe, expect, it } from "vitest"
import { isLocalRequestHost, isLoopbackHostname } from "@/lib/security/localhost"

describe("localhost security helpers", () => {
  it("matches only exact loopback hostnames", () => {
    expect(isLoopbackHostname("localhost")).toBe(true)
    expect(isLoopbackHostname("127.0.0.1")).toBe(true)
    expect(isLoopbackHostname("::1")).toBe(true)
    expect(isLoopbackHostname("localhost.attacker.com")).toBe(false)
    expect(isLoopbackHostname("127.0.0.1.attacker.com")).toBe(false)
  })

  it("parses host values with ports and forwarded lists", () => {
    expect(isLocalRequestHost("localhost:4173")).toBe(true)
    expect(isLocalRequestHost("127.0.0.1:4173")).toBe(true)
    expect(isLocalRequestHost("[::1]:4173")).toBe(true)
    expect(isLocalRequestHost("localhost:4173, proxy.example.com")).toBe(true)
  })

  it("rejects empty and malformed local-like hosts", () => {
    expect(isLocalRequestHost(null)).toBe(false)
    expect(isLocalRequestHost("")).toBe(false)
    expect(isLocalRequestHost("localhost.evil.com")).toBe(false)
    expect(isLocalRequestHost("127.0.0.1.evil.com")).toBe(false)
    expect(isLocalRequestHost("[::1")).toBe(false)
  })
})
