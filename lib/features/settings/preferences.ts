export const START_PAGE_KEY = "rebar.startPage"

export type StartPage = "/review" | "/capture" | "/library" | "/search"

const START_PAGES: StartPage[] = ["/review", "/capture", "/library", "/search"]

export function getStartPagePreference(): StartPage {
  if (typeof window === "undefined") {
    return "/library"
  }

  const value = window.localStorage.getItem(START_PAGE_KEY)
  if (value && START_PAGES.includes(value as StartPage)) {
    return value as StartPage
  }

  return "/library"
}

export function setStartPagePreference(value: StartPage) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(START_PAGE_KEY, value)
}
