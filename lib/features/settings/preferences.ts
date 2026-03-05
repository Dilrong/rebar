export const START_PAGE_KEY = "rebar.startPage"

export type StartPage = "/review" | "/capture" | "/library" | "/search"

const START_PAGES: StartPage[] = ["/review", "/capture", "/library", "/search"]

function isStartPage(value: string): value is StartPage {
  return START_PAGES.includes(value as StartPage)
}

export function parseStartPage(value: string | null | undefined): StartPage | null {
  if (!value) {
    return null
  }

  return isStartPage(value) ? value : null
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

export function setStartPagePreference(value: StartPage) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(START_PAGE_KEY, value)
}

export async function getStartPagePreferenceServer(): Promise<StartPage | null> {
  try {
    const response = await fetch("/api/settings/preferences", {
      method: "GET",
      cache: "no-store"
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as { startPage?: string }
    return parseStartPage(payload.startPage)
  } catch {
    return null
  }
}

export async function setStartPagePreferenceServer(value: StartPage): Promise<boolean> {
  try {
    const response = await fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ startPage: value })
    })

    return response.ok
  } catch {
    return false
  }
}
