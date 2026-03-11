import { beforeEach, describe, expect, it } from "vitest"

type TestCookie = { name: string; value: string; domain: string }

// extension/shared.js is plain JS — import directly
const {
  DEFAULT_SETTINGS,
  CONTENT_LIMIT,
  MSG,
  normalizeTagList,
  parseTags,
  isValidUrl,
  normalizeUrl,
  errorMessage,
  decodeSupabaseCookie,
  getAuthSession,
  getAccessToken,
  authHeaders,
  shouldSkipTagPicker,
  hostPermissionOrigin,
  ensureHostPermission
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

  describe("decodeSupabaseCookie", () => {
    it("decodes base64url-prefixed cookie (supabase/ssr 0.8+)", () => {
      const payload = { access_token: "tok_b64url", refresh_token: "rt_1" }
      const json = JSON.stringify(payload)
      // Encode as base64url: replace +→-, /→_, strip =
      const b64url = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
      const cookieValue = `base64-${b64url}`
      expect(decodeSupabaseCookie(cookieValue)).toEqual(payload)
    })

    it("decodes plain base64 cookie (legacy)", () => {
      const payload = { access_token: "tok_b64" }
      expect(decodeSupabaseCookie(btoa(JSON.stringify(payload)))).toEqual(payload)
    })

    it("decodes plain JSON cookie (legacy)", () => {
      const payload = { access_token: "tok_json" }
      expect(decodeSupabaseCookie(JSON.stringify(payload))).toEqual(payload)
    })

    it("decodes base64url with JWT-like access_token containing special chars", () => {
      const payload = { access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", refresh_token: "rt_real", expires_at: 1741700000 }
      const json = JSON.stringify(payload)
      const b64url = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
      expect(decodeSupabaseCookie(`base64-${b64url}`)).toEqual(payload)
    })

    it("returns null for malformed data", () => {
      expect(decodeSupabaseCookie("not-valid-anything")).toBeNull()
    })
  })

  describe("authHeaders", () => {
    it("returns Authorization header when token exists", () => {
      expect(authHeaders("abc123")).toEqual({ Authorization: "Bearer abc123" })
    })

    it("returns empty object when token is missing", () => {
      expect(authHeaders(null)).toEqual({})
    })
  })

  describe("getAuthSession", () => {
    const cookieStore: TestCookie[] = []
    const cookiesApi = {
      getAll: async ({ domain }: { domain: string }) => cookieStore.filter((cookie) => cookie.domain === domain || domain.endsWith(cookie.domain))
    }

    beforeEach(() => {
      cookieStore.length = 0
    })

    it("returns access_token and refresh_token from cookie", async () => {
      cookieStore.push({ name: "sb-test-auth-token", value: JSON.stringify({ access_token: "at_1", refresh_token: "rt_1" }), domain: "rebarops.com" })
      const session = await getAuthSession("https://rebarops.com", cookiesApi)
      expect(session).toEqual({ access_token: "at_1", refresh_token: "rt_1" })
    })

    it("returns null refresh_token when cookie has no refresh_token", async () => {
      cookieStore.push({ name: "sb-test-auth-token", value: JSON.stringify({ access_token: "at_2" }), domain: "rebarops.com" })
      const session = await getAuthSession("https://rebarops.com", cookiesApi)
      expect(session).toEqual({ access_token: "at_2", refresh_token: null })
    })

    it("returns null when no cookies exist", async () => {
      await expect(getAuthSession("https://rebarops.com", cookiesApi)).resolves.toBeNull()
    })

    it("returns null when access_token is missing", async () => {
      cookieStore.push({ name: "sb-test-auth-token", value: JSON.stringify({ refresh_token: "rt_only" }), domain: "rebarops.com" })
      await expect(getAuthSession("https://rebarops.com", cookiesApi)).resolves.toBeNull()
    })

    it("decodes base64url-prefixed cookie from supabase/ssr 0.8+", async () => {
      const payload = { access_token: "at_b64url", refresh_token: "rt_b64url" }
      const json = JSON.stringify(payload)
      const b64url = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
      cookieStore.push({ name: "sb-test-auth-token", value: `base64-${b64url}`, domain: "rebarops.com" })
      const session = await getAuthSession("https://rebarops.com", cookiesApi)
      expect(session).toEqual({ access_token: "at_b64url", refresh_token: "rt_b64url" })
    })

    it("decodes chunked base64url cookies (large session)", async () => {
      const payload = { access_token: "at_chunked_b64", refresh_token: "rt_chunked_b64", user: { data: "x".repeat(3000) } }
      const json = JSON.stringify(payload)
      const b64url = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
      const encoded = `base64-${b64url}`
      const mid = Math.floor(encoded.length / 2)
      cookieStore.push(
        { name: "sb-test-auth-token.0", value: encoded.slice(0, mid), domain: "rebarops.com" },
        { name: "sb-test-auth-token.1", value: encoded.slice(mid), domain: "rebarops.com" }
      )
      const session = await getAuthSession("https://rebarops.com", cookiesApi)
      expect(session?.access_token).toBe("at_chunked_b64")
      expect(session?.refresh_token).toBe("rt_chunked_b64")
    })
  })

  describe("getAccessToken", () => {
    const cookieStore: TestCookie[] = []
    const cookiesApi = {
      getAll: async ({ domain }: { domain: string }) => cookieStore.filter((cookie) => cookie.domain === domain || domain.endsWith(cookie.domain))
    }

    beforeEach(() => {
      cookieStore.length = 0
    })

    it("extracts access token from plain json cookie", async () => {
      cookieStore.push({ name: "sb-test-auth-token", value: JSON.stringify({ access_token: "tok_plain" }), domain: "rebarops.com" })
      await expect(getAccessToken("https://rebarops.com", cookiesApi)).resolves.toBe("tok_plain")
    })

    it("extracts access token from chunked cookies", async () => {
      const payload = JSON.stringify({ access_token: "tok_chunked" })
      const mid = Math.floor(payload.length / 2)
      cookieStore.push(
        { name: "sb-test-auth-token.0", value: payload.slice(0, mid), domain: "rebarops.com" },
        { name: "sb-test-auth-token.1", value: payload.slice(mid), domain: "rebarops.com" }
      )
      await expect(getAccessToken("https://rebarops.com", cookiesApi)).resolves.toBe("tok_chunked")
    })

    it("returns null for invalid url or missing cookies", async () => {
      await expect(getAccessToken("not-a-url", cookiesApi)).resolves.toBeNull()
      await expect(getAccessToken("https://rebarops.com", cookiesApi)).resolves.toBeNull()
    })

    it("finds auth cookies stored on the root domain when the app uses www", async () => {
      cookieStore.push({ name: "sb-test-auth-token", value: JSON.stringify({ access_token: "tok_root" }), domain: ".rebarops.com" })
      await expect(getAccessToken("https://www.rebarops.com", cookiesApi)).resolves.toBe("tok_root")
    })
  })

  describe("shouldSkipTagPicker", () => {
    it("skips tag picker for quick article mode", () => {
      expect(shouldSkipTagPicker("quick-article")).toBe(true)
    })

    it("keeps guided mode interactive", () => {
      expect(shouldSkipTagPicker("guided")).toBe(false)
    })
  })

  describe("host permission helpers", () => {
    it("builds a Chrome host permission origin pattern", () => {
      expect(hostPermissionOrigin("https://rebarops.com/path")).toBe("https://rebarops.com/*")
    })

    it("reuses an existing granted permission without requesting again", async () => {
      const permissionsApi = {
        contains: async () => true,
        request: async () => false
      }

      await expect(ensureHostPermission("https://rebarops.com", permissionsApi)).resolves.toBe(true)
    })

    it("requests permission when not already granted", async () => {
      let requested = false
      const permissionsApi = {
        contains: async () => false,
        request: async () => {
          requested = true
          return true
        }
      }

      await expect(ensureHostPermission("https://rebarops.com", permissionsApi)).resolves.toBe(true)
      expect(requested).toBe(true)
    })
  })
})
