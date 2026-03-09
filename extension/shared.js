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
