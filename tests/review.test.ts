import { describe, expect, it } from "vitest"
import { calcNextInterval, MAX_INTERVAL_DAYS } from "@feature-lib/review/review"

describe("calcNextInterval", () => {
  it("returns 1 when action is resurface", () => {
    expect(calcNextInterval(10, "resurface")).toBe(1)
  })

  it("doubles interval when action is reviewed", () => {
    expect(calcNextInterval(2, "reviewed")).toBe(4)
  })

  it("caps interval at MAX_INTERVAL_DAYS", () => {
    expect(calcNextInterval(60, "reviewed")).toBe(MAX_INTERVAL_DAYS)
  })
})
