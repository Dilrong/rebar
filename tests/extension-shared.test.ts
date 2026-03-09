import { beforeEach, describe, expect, it } from "vitest"

// extension/shared.js is plain JS — import directly
const {
  DEFAULT_SETTINGS,
  CONTENT_LIMIT,
  MSG,
  normalizeTagList,
  parseTags,
  isValidUrl,
  normalizeUrl,
  errorMessage
} = await import("../extension/shared.js")

describe("extension/shared", () => {
  describe("DEFAULT_SETTINGS", () => {
    it("has a valid rebarUrl", () => {
      expect(DEFAULT_SETTINGS.rebarUrl).toBe("https://rebarops.com")
    })

    it("has default tags", () => {
      expect(DEFAULT_SETTINGS.defaultTags).toBe("web,clipper")
    })
  })

  describe("CONTENT_LIMIT", () => {
    it("is 12000", () => {
      expect(CONTENT_LIMIT).toBe(12000)
    })
  })

  describe("MSG", () => {
    it("contains all expected message types", () => {
      expect(MSG).toEqual({
        GET_SELECTION: "GET_SELECTION",
        GET_ARTICLE: "GET_ARTICLE",
        SHOW_BANNER: "SHOW_BANNER",
        HIDE_BANNER: "HIDE_BANNER",
        PICK_TAGS: "PICK_TAGS",
        CANCEL_SAVE: "CANCEL_SAVE",
        SAVE_CAPTURE: "SAVE_CAPTURE",
        GET_SETTINGS: "GET_SETTINGS"
      })
    })
  })

  describe("normalizeTagList", () => {
    it("deduplicates tags", () => {
      expect(normalizeTagList(["a", "b", "a"])).toEqual(["a", "b"])
    })

    it("trims whitespace", () => {
      expect(normalizeTagList(["  foo  ", "bar "])).toEqual(["foo", "bar"])
    })

    it("filters empty strings and non-strings", () => {
      expect(normalizeTagList(["a", "", "  ", null, undefined, 42, "b"])).toEqual(["a", "b"])
    })

    it("returns empty array for null/undefined input", () => {
      expect(normalizeTagList(null)).toEqual([])
      expect(normalizeTagList(undefined)).toEqual([])
    })

    it("preserves order of first occurrence", () => {
      expect(normalizeTagList(["c", "a", "b", "a", "c"])).toEqual(["c", "a", "b"])
    })
  })

  describe("parseTags", () => {
    it("splits comma-separated string into tags", () => {
      expect(parseTags("web,clipper,test")).toEqual(["web", "clipper", "test"])
    })

    it("trims each tag", () => {
      expect(parseTags(" web , clipper ")).toEqual(["web", "clipper"])
    })

    it("filters empty segments", () => {
      expect(parseTags("a,,b,,,c")).toEqual(["a", "b", "c"])
    })

    it("handles empty string", () => {
      expect(parseTags("")).toEqual([])
    })

    it("handles null/undefined", () => {
      expect(parseTags(null)).toEqual([])
      expect(parseTags(undefined)).toEqual([])
    })
  })

  describe("isValidUrl", () => {
    it("accepts https URLs", () => {
      expect(isValidUrl("https://rebarops.com")).toBe(true)
    })

    it("accepts http URLs", () => {
      expect(isValidUrl("http://localhost:3000")).toBe(true)
    })

    it("rejects ftp URLs", () => {
      expect(isValidUrl("ftp://example.com")).toBe(false)
    })

    it("rejects invalid strings", () => {
      expect(isValidUrl("not-a-url")).toBe(false)
    })

    it("rejects empty string", () => {
      expect(isValidUrl("")).toBe(false)
    })

    it("rejects javascript: protocol", () => {
      expect(isValidUrl("javascript:alert(1)")).toBe(false)
    })
  })

  describe("normalizeUrl", () => {
    it("trims whitespace", () => {
      expect(normalizeUrl("  https://rebarops.com  ")).toBe("https://rebarops.com")
    })

    it("removes trailing slashes", () => {
      expect(normalizeUrl("https://rebarops.com///")).toBe("https://rebarops.com")
    })

    it("handles empty/null input", () => {
      expect(normalizeUrl("")).toBe("")
      expect(normalizeUrl(null)).toBe("")
      expect(normalizeUrl(undefined)).toBe("")
    })
  })

  describe("errorMessage", () => {
    it("extracts message from Error instances", () => {
      expect(errorMessage(new Error("test error"))).toBe("test error")
    })

    it("converts non-Error values to string", () => {
      expect(errorMessage("string error")).toBe("string error")
      expect(errorMessage(42)).toBe("42")
    })

    it("returns 'Unknown error' for falsy values", () => {
      expect(errorMessage(null)).toBe("Unknown error")
      expect(errorMessage(undefined)).toBe("Unknown error")
      expect(errorMessage("")).toBe("Unknown error")
    })
  })
})
