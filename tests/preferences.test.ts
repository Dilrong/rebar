import { afterEach, describe, expect, it, vi } from "vitest"
import {
  START_PAGE_KEY,
  getStartPagePreference,
  getPreferencesServer,
  parseStartPage,
  setStartPagePreference,
  setPreferencesServer
} from "@feature-lib/settings/preferences"

function makeLocalStorage(seed: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(seed))

  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("parseStartPage", () => {
  it("accepts only supported paths", () => {
    expect(parseStartPage("/review")).toBe("/review")
    expect(parseStartPage("/capture")).toBe("/capture")
    expect(parseStartPage("/library")).toBe("/library")
    expect(parseStartPage("/search")).toBe("/search")
  })

  it("returns null for invalid values", () => {
    expect(parseStartPage("/admin")).toBeNull()
    expect(parseStartPage("")).toBeNull()
    expect(parseStartPage(null)).toBeNull()
    expect(parseStartPage(undefined)).toBeNull()
  })
})

describe("client preference helpers", () => {
  it("falls back to /library when window is not available", () => {
    expect(getStartPagePreference()).toBe("/library")
  })

  it("returns stored start page from localStorage", () => {
    vi.stubGlobal("window", {
      localStorage: makeLocalStorage({ [START_PAGE_KEY]: "/review" })
    })

    expect(getStartPagePreference()).toBe("/review")
  })

  it("ignores invalid localStorage values", () => {
    vi.stubGlobal("window", {
      localStorage: makeLocalStorage({ [START_PAGE_KEY]: "/evil" })
    })

    expect(getStartPagePreference()).toBe("/library")
  })

  it("writes start page to localStorage", () => {
    const localStorage = makeLocalStorage()
    vi.stubGlobal("window", { localStorage })

    setStartPagePreference("/search")

    expect(localStorage.getItem(START_PAGE_KEY)).toBe("/search")
  })

  it("does not throw when writing without window", () => {
    expect(() => setStartPagePreference("/capture")).not.toThrow()
  })
})

describe("server preference helpers", () => {
  it("returns parsed start page when API succeeds", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ startPage: "/capture" }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const value = await getPreferencesServer()

    expect(value.startPage).toBe("/capture")
    expect(fetchMock).toHaveBeenCalledWith("/api/settings/preferences", {
      method: "GET",
      cache: "no-store"
    })
  })

  it("returns null on API failure or malformed payload", async () => {
    const notOkFetch = vi.fn(async () => new Response(JSON.stringify({ startPage: "/review" }), { status: 500 }))
    vi.stubGlobal("fetch", notOkFetch)
    let prefs = await getPreferencesServer()
    expect(prefs.startPage).toBeNull()

    const malformedFetch = vi.fn(async () => new Response(JSON.stringify({ startPage: "/invalid" }), { status: 200 }))
    vi.stubGlobal("fetch", malformedFetch)
    prefs = await getPreferencesServer()
    expect(prefs.startPage).toBeNull()
  })

  it("returns false when PATCH fails and true when it succeeds", async () => {
    const okFetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal("fetch", okFetch)

    await expect(setPreferencesServer({ startPage: "/review" })).resolves.toBe(true)
    expect(okFetch).toHaveBeenCalledWith("/api/settings/preferences", {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ startPage: "/review" })
    })

    const notOkFetch = vi.fn(async () => new Response(JSON.stringify({ error: "x" }), { status: 400 }))
    vi.stubGlobal("fetch", notOkFetch)
    await expect(setPreferencesServer({ startPage: "/review" })).resolves.toBe(false)

    const throwFetch = vi.fn(async () => {
      throw new Error("network")
    })
    vi.stubGlobal("fetch", throwFetch)
    await expect(setPreferencesServer({ startPage: "/review" })).resolves.toBe(false)
  })
})
