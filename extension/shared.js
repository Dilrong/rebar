export const DEFAULT_SETTINGS = {
  rebarUrl: "https://rebarops.com",
  defaultTags: "web,clipper"
}

export const CONTENT_LIMIT = 12000

export const MSG = {
  GET_SELECTION: "GET_SELECTION",
  GET_ARTICLE: "GET_ARTICLE",
  SHOW_BANNER: "SHOW_BANNER",
  HIDE_BANNER: "HIDE_BANNER",
  PICK_TAGS: "PICK_TAGS",
  CANCEL_SAVE: "CANCEL_SAVE",
  SAVE_CAPTURE: "SAVE_CAPTURE",
  GET_SETTINGS: "GET_SETTINGS"
}

export function normalizeTagList(tags) {
  return Array.from(new Set((tags || []).map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean)))
}

export function parseTags(tagText) {
  return normalizeTagList((tagText || "").split(","))
}

export function isValidUrl(value) {
  try { return ["http:", "https:"].includes(new URL(value).protocol) }
  catch { return false }
}

export function normalizeUrl(value) {
  return (value || "").trim().replace(/\/+$/, "")
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || "Unknown error")
}

export async function getAccessToken(rebarUrl, cookiesApi = chrome.cookies) {
  try {
    const url = new URL(rebarUrl)
    const cookies = await cookiesApi.getAll({ domain: url.hostname })
    const authCookies = cookies
      .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
      .sort((a, b) => a.name.localeCompare(b.name))

    if (authCookies.length === 0) return null

    const baseName = authCookies[0].name.replace(/\.\d+$/, "")
    const chunked = authCookies.filter((c) => c.name === baseName || c.name.startsWith(baseName + "."))
    const raw = chunked.length > 1
      ? chunked.sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.value).join("")
      : authCookies[0].value

    let json
    try { json = JSON.parse(atob(raw)) } catch { json = JSON.parse(raw) }
    return json?.access_token ?? null
  } catch {
    return null
  }
}

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function shouldSkipTagPicker(mode) {
  return mode === "quick-article"
}
