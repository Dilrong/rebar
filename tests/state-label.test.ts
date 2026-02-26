import { describe, expect, it } from "vitest"
import { getStateLabel } from "@/lib/i18n/state-label"

const t = (key: string, fallback?: string) => {
  const map: Record<string, string> = {
    "state.inbox": "수집함",
    "state.active": "활성",
    "state.pinned": "중요",
    "state.archived": "보관",
    "state.trashed": "휴지통"
  }

  return map[key] ?? fallback ?? key
}

describe("getStateLabel", () => {
  it("maps INBOX to translated label", () => {
    expect(getStateLabel("INBOX", t)).toBe("수집함")
  })

  it("maps ACTIVE to translated label", () => {
    expect(getStateLabel("ACTIVE", t)).toBe("활성")
  })

  it("maps PINNED to translated label", () => {
    expect(getStateLabel("PINNED", t)).toBe("중요")
  })

  it("maps ARCHIVED to translated label", () => {
    expect(getStateLabel("ARCHIVED", t)).toBe("보관")
  })

  it("maps TRASHED to translated label", () => {
    expect(getStateLabel("TRASHED", t)).toBe("휴지통")
  })
})
