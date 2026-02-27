import { describe, expect, it } from "vitest"
import { decodeTimestampCursor, encodeTimestampCursor } from "@/lib/pagination"

describe("timestamp cursor", () => {
  it("encodes and decodes timestamp", () => {
    const ts = "2026-02-27T00:00:00.000Z"
    const cursor = encodeTimestampCursor(ts)
    expect(decodeTimestampCursor(cursor)).toBe(ts)
  })

  it("returns null for malformed cursor", () => {
    expect(decodeTimestampCursor("bad-cursor")).toBeNull()
  })

  it("returns null for invalid timestamp payload", () => {
    const bad = Buffer.from(JSON.stringify({ v: "v1", ts: "not-date" }), "utf8").toString("base64url")
    expect(decodeTimestampCursor(bad)).toBeNull()
  })
})
