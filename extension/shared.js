export const DEFAULT_SETTINGS = {
  rebarUrl: "https://rebarops.com",
  defaultTags: "web,clipper"
}

export const CONTENT_LIMIT = 12000

export const MSG = {
  GET_ARTICLE: "GET_ARTICLE",
  SHOW_BANNER: "SHOW_BANNER",
  CANCEL_SAVE: "CANCEL_SAVE",
  SAVE_CAPTURE: "SAVE_CAPTURE",
  GET_SETTINGS: "GET_SETTINGS"
}

export function parseTags(tagText) {
  return (tagText || "").split(",").map((tag) => tag.trim()).filter(Boolean)
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
