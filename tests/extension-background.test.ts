import { beforeEach, describe, expect, it, vi } from "vitest"
const { getAccessToken, authHeaders } = await import("../extension/shared.js")

// ── Chrome API mock ──

const storage: Record<string, unknown> = {}
const cookieStore: Array<{ name: string; value: string; domain: string }> = []
const createdTabs: Array<unknown> = []
const sentMessages: Array<unknown> = []
const badgeState = { text: "", color: "", title: "" }
const contextMenusCreated: Array<unknown> = []
let permissionsGranted = true

function resetChromeState() {
  Object.keys(storage).forEach((k) => delete storage[k])
  cookieStore.length = 0
  createdTabs.length = 0
  sentMessages.length = 0
  contextMenusCreated.length = 0
  badgeState.text = ""
  badgeState.color = ""
  badgeState.title = ""
  permissionsGranted = true
}

const chromeMock = {
  storage: {
    sync: {
      get: vi.fn(async (defaults: Record<string, unknown>) => ({ ...defaults, ...storage })),
      set: vi.fn(async (obj: Record<string, unknown>) => Object.assign(storage, obj))
    }
  },
  cookies: {
    getAll: vi.fn(async ({ domain }: { domain: string }) =>
      cookieStore.filter((c) => c.domain === domain || domain.endsWith(c.domain))
    )
  },
  tabs: {
    sendMessage: vi.fn(async () => ({ ok: true })),
    create: vi.fn(async (opts: unknown) => { createdTabs.push(opts); return { id: 999 } })
  },
  runtime: {
    lastError: null as null | { message: string },
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn() },
    openOptionsPage: vi.fn(),
    sendMessage: vi.fn()
  },
  scripting: {
    executeScript: vi.fn((_opts: unknown, cb: (...args: unknown[]) => void) => cb())
  },
  action: {
    onClicked: { addListener: vi.fn() },
    setBadgeBackgroundColor: vi.fn(async () => {}),
    setBadgeText: vi.fn(async () => {}),
    setTitle: vi.fn(async () => {})
  },
  contextMenus: {
    removeAll: vi.fn((cb: () => void) => cb()),
    create: vi.fn((_opts: unknown, cb: () => void) => cb()),
    onClicked: { addListener: vi.fn() }
  },
  permissions: {
    request: vi.fn(async () => permissionsGranted),
    contains: vi.fn(async () => permissionsGranted)
  }
}

Object.defineProperty(globalThis, "chrome", { value: chromeMock, writable: true })

// Mock navigator for i18n
Object.defineProperty(globalThis, "navigator", {
  value: { language: "en-US" },
  writable: true
})

// ── Helper: set up Supabase auth cookies ──

function setAuthCookie(domain: string, accessToken: string) {
  const payload = JSON.stringify({ access_token: accessToken, refresh_token: "rt_123" })
  cookieStore.push({
    name: "sb-testref-auth-token",
    value: payload,
    domain
  })
}

function setBase64AuthCookie(domain: string, accessToken: string) {
  const payload = JSON.stringify({ access_token: accessToken })
  cookieStore.push({
    name: "sb-testref-auth-token",
    value: btoa(payload),
    domain
  })
}

function setChunkedAuthCookies(domain: string, accessToken: string) {
  const payload = JSON.stringify({ access_token: accessToken, refresh_token: "rt_456" })
  const mid = Math.floor(payload.length / 2)
  cookieStore.push(
    { name: "sb-testref-auth-token.0", value: payload.slice(0, mid), domain },
    { name: "sb-testref-auth-token.1", value: payload.slice(mid), domain }
  )
}

// ── Tests ──

describe("extension/background — getAccessToken logic", () => {
  beforeEach(() => {
    resetChromeState()
    vi.clearAllMocks()
  })

  it("returns null when no cookies exist", async () => {
    const token = await getAccessToken("https://rebarops.com", chromeMock.cookies)
    expect(token).toBeNull()
  })

  it("extracts access_token from plain JSON cookie", async () => {
    setAuthCookie("rebarops.com", "token_abc")
    const token = await getAccessToken("https://rebarops.com", chromeMock.cookies)
    expect(token).toBe("token_abc")
  })

  it("extracts access_token from base64-encoded cookie", async () => {
    setBase64AuthCookie("rebarops.com", "token_b64")
    const token = await getAccessToken("https://rebarops.com", chromeMock.cookies)
    expect(token).toBe("token_b64")
  })

  it("extracts access_token from chunked cookies", async () => {
    setChunkedAuthCookies("rebarops.com", "token_chunked")
    const token = await getAccessToken("https://rebarops.com", chromeMock.cookies)
    expect(token).toBe("token_chunked")
  })

  it("returns null for non-auth cookies", async () => {
    cookieStore.push({ name: "session_id", value: "xyz", domain: "rebarops.com" })
    const token = await getAccessToken("https://rebarops.com", chromeMock.cookies)
    expect(token).toBeNull()
  })

  it("returns null for malformed cookie value", async () => {
    cookieStore.push({ name: "sb-ref-auth-token", value: "not-json", domain: "rebarops.com" })
    const token = await getAccessToken("https://rebarops.com", chromeMock.cookies)
    expect(token).toBeNull()
  })

  it("returns null for cookie without access_token field", async () => {
    cookieStore.push({
      name: "sb-ref-auth-token",
      value: JSON.stringify({ refresh_token: "rt" }),
      domain: "rebarops.com"
    })
    const token = await getAccessToken("https://rebarops.com", chromeMock.cookies)
    expect(token).toBeNull()
  })

  it("returns null for invalid URL", async () => {
    const token = await getAccessToken("not-a-url", chromeMock.cookies)
    expect(token).toBeNull()
  })

  it("scopes cookies by hostname", async () => {
    setAuthCookie("other-domain.com", "wrong_token")
    const token = await getAccessToken("https://rebarops.com", chromeMock.cookies)
    expect(token).toBeNull()
  })

  it("handles localhost URLs", async () => {
    setAuthCookie("localhost", "local_token")
    const token = await getAccessToken("http://localhost:3000", chromeMock.cookies)
    expect(token).toBe("local_token")
  })
})

describe("extension/background — authHeaders", () => {
  it("returns Authorization header when token is provided", () => {
    expect(authHeaders("abc123")).toEqual({ Authorization: "Bearer abc123" })
  })

  it("returns empty object when token is null", () => {
    expect(authHeaders(null)).toEqual({})
  })
})

describe("extension/background — chrome.storage integration", () => {
  beforeEach(() => {
    resetChromeState()
    vi.clearAllMocks()
  })

  it("returns default settings when nothing is stored", async () => {
    const defaults = { rebarUrl: "https://rebarops.com", defaultTags: "web,clipper" }
    const result = await chromeMock.storage.sync.get(defaults)
    expect(result.rebarUrl).toBe("https://rebarops.com")
    expect(result.defaultTags).toBe("web,clipper")
  })

  it("returns stored settings merged with defaults", async () => {
    storage.rebarUrl = "https://custom.com"
    const defaults = { rebarUrl: "https://rebarops.com", defaultTags: "web,clipper" }
    const result = await chromeMock.storage.sync.get(defaults)
    expect(result.rebarUrl).toBe("https://custom.com")
    expect(result.defaultTags).toBe("web,clipper")
  })

  it("persists settings via set", async () => {
    await chromeMock.storage.sync.set({ rebarUrl: "https://new.com" })
    expect(storage.rebarUrl).toBe("https://new.com")
  })
})

describe("extension/background — cookie chunking edge cases", () => {
  beforeEach(() => {
    resetChromeState()
    vi.clearAllMocks()
  })

  it("handles single cookie alongside unrelated sb- cookies", async () => {
    cookieStore.push(
      { name: "sb-ref-auth-token", value: JSON.stringify({ access_token: "real" }), domain: "rebarops.com" },
      { name: "sb-ref-other-data", value: "irrelevant", domain: "rebarops.com" }
    )
    const token = await getAccessToken("https://rebarops.com", chromeMock.cookies)
    expect(token).toBe("real")
  })

  it("reassembles 3-chunk cookies correctly", async () => {
    const payload = JSON.stringify({ access_token: "three_chunks", extra: "data".repeat(100) })
    const third = Math.floor(payload.length / 3)
    cookieStore.push(
      { name: "sb-ref-auth-token.0", value: payload.slice(0, third), domain: "rebarops.com" },
      { name: "sb-ref-auth-token.1", value: payload.slice(third, third * 2), domain: "rebarops.com" },
      { name: "sb-ref-auth-token.2", value: payload.slice(third * 2), domain: "rebarops.com" }
    )
    const token = await getAccessToken("https://rebarops.com", chromeMock.cookies)
    expect(token).toBe("three_chunks")
  })

  it("sorts chunks by name to ensure correct order", async () => {
    const payload = JSON.stringify({ access_token: "ordered" })
    const mid = Math.floor(payload.length / 2)
    // Insert in reverse order
    cookieStore.push(
      { name: "sb-ref-auth-token.1", value: payload.slice(mid), domain: "rebarops.com" },
      { name: "sb-ref-auth-token.0", value: payload.slice(0, mid), domain: "rebarops.com" }
    )
    const token = await getAccessToken("https://rebarops.com", chromeMock.cookies)
    expect(token).toBe("ordered")
  })
})
