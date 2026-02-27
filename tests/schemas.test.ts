import { describe, expect, it } from "vitest"
import { CreateRecordSchema, ReviewRecordSchema, isValidStateTransition, type RecordState } from "@/lib/schemas"

describe("isValidStateTransition", () => {
  it("allows all defined valid transitions", () => {
    const validPairs: Array<[RecordState, RecordState]> = [
      ["INBOX", "ACTIVE"],
      ["INBOX", "TRASHED"],
      ["ACTIVE", "PINNED"],
      ["ACTIVE", "ARCHIVED"],
      ["ACTIVE", "TRASHED"],
      ["PINNED", "ACTIVE"],
      ["PINNED", "ARCHIVED"],
      ["PINNED", "TRASHED"],
      ["ARCHIVED", "ACTIVE"],
      ["ARCHIVED", "TRASHED"]
    ]

    for (const [from, to] of validPairs) {
      expect(isValidStateTransition(from, to)).toBe(true)
    }
  })

  it("allows same-state transitions", () => {
    expect(isValidStateTransition("INBOX", "INBOX")).toBe(true)
    expect(isValidStateTransition("TRASHED", "TRASHED")).toBe(true)
  })

  it("rejects invalid transitions", () => {
    const invalidPairs: Array<[RecordState, RecordState]> = [
      ["INBOX", "ARCHIVED"],
      ["INBOX", "PINNED"],
      ["TRASHED", "ACTIVE"],
      ["TRASHED", "INBOX"],
      ["ACTIVE", "INBOX"]
    ]

    for (const [from, to] of invalidPairs) {
      expect(isValidStateTransition(from, to)).toBe(false)
    }
  })
})

describe("CreateRecordSchema", () => {
  it("requires url for link kind", () => {
    const parsed = CreateRecordSchema.safeParse({ kind: "link", content: "x" })
    expect(parsed.success).toBe(false)
  })

  it("rejects empty content", () => {
    const parsed = CreateRecordSchema.safeParse({ kind: "note", content: "" })
    expect(parsed.success).toBe(false)
  })

  it("accepts on_duplicate merge option", () => {
    const parsed = CreateRecordSchema.safeParse({ kind: "note", content: "x", on_duplicate: "merge" })
    expect(parsed.success).toBe(true)
  })
})

describe("ReviewRecordSchema", () => {
  it("rejects snooze_days with reviewed action", () => {
    const parsed = ReviewRecordSchema.safeParse({ action: "reviewed", snooze_days: 3 })
    expect(parsed.success).toBe(false)
  })

  it("accepts snooze_days with resurface action", () => {
    const parsed = ReviewRecordSchema.safeParse({ action: "resurface", snooze_days: 3 })
    expect(parsed.success).toBe(true)
  })
})
