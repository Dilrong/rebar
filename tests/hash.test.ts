import { describe, expect, it } from "vitest"
import { sha256 } from "@/lib/hash"

describe("sha256", () => {
  it("returns identical hash for identical input", () => {
    expect(sha256("same input")).toBe(sha256("same input"))
  })

  it("supports unicode input", () => {
    expect(sha256("한글🙂")).toBe("dfe2c239b4dd154b386d368f1a32320bf4d637035d973e943c9b7b3b790aa047")
  })

  it("supports empty string", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
  })
})
