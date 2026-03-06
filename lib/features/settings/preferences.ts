export const START_PAGE_KEY = "rebar.startPage"
export const FONT_FAMILY_KEY = "rebar.fontFamily"

export type StartPage = "/review" | "/capture" | "/library" | "/search"
export type FontFamily = "sans" | "mono"

const START_PAGES: StartPage[] = ["/review", "/capture", "/library", "/search"]
const FONT_FAMILIES: FontFamily[] = ["sans", "mono"]

function isStartPage(value: string): value is StartPage {
  return START_PAGES.includes(value as StartPage)
}

function isFontFamily(value: string): value is FontFamily {
  return FONT_FAMILIES.includes(value as FontFamily)
}

export function parseStartPage(value: string | null | undefined): StartPage | null {
  if (!value) {
    return null
  }

  return isStartPage(value) ? value : null
}

export function parseFontFamily(value: string | null | undefined): FontFamily | null {
  if (!value) {
    return null
  }

  return isFontFamily(value) ? value : null
}

export function getStartPagePreference(): StartPage {
  if (typeof window === "undefined") {
    return "/library"
  }

  const value = parseStartPage(window.localStorage.getItem(START_PAGE_KEY))
  if (value) {
    return value
  }

  return "/library"
}

export function getFontFamilyPreference(): FontFamily {
  if (typeof window === "undefined") {
    return "sans"
  }

  const value = parseFontFamily(window.localStorage.getItem(FONT_FAMILY_KEY))
  if (value) {
    return value
  }

  return "sans"
}

export function setStartPagePreference(value: StartPage) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(START_PAGE_KEY, value)
}

export function setFontFamilyPreference(value: FontFamily) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(FONT_FAMILY_KEY, value)
}

export async function getPreferencesServer(): Promise<{ startPage: StartPage | null, fontFamily: FontFamily | null }> {
  try {
    const response = await fetch("/api/settings/preferences", {
      method: "GET",
      cache: "no-store"
    })

    if (!response.ok) {
      return { startPage: null, fontFamily: null }
    }

    const payload = (await response.json()) as { startPage?: string, fontFamily?: string }
    return {
      startPage: parseStartPage(payload.startPage),
      fontFamily: parseFontFamily(payload.fontFamily)
    }
  } catch {
    return { startPage: null, fontFamily: null }
  }
}

export async function setPreferencesServer(values: { startPage?: StartPage, fontFamily?: FontFamily }): Promise<boolean> {
  try {
    const response = await fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(values)
    })

    return response.ok
  } catch {
    return false
  }
}
