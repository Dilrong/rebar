export const DEFAULT_SETTINGS = {
  apiBaseUrl: "http://localhost:3000",
  defaultTags: "web,clipper",
  enableDomainTags: true,
  apiKey: ""
}

export const DOMAIN_TAG_RULES = [
  { pattern: "youtube.com|youtu.be", tags: ["video", "youtube"] },
  { pattern: "github.com", tags: ["code", "github"] },
  { pattern: "medium.com", tags: ["article", "medium"] },
  { pattern: "x.com|twitter.com", tags: ["social", "x"] },
  { pattern: "reddit.com", tags: ["social", "reddit"] },
  { pattern: "naver.com", tags: ["korea", "naver"] }
]

export function parseTags(tagText) {
  return (tagText || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

export function normalizeBaseUrl(value) {
  const trimmed = (value || "").trim()
  if (!trimmed) {
    return ""
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return withProtocol.replace(/\/+$/, "")
}
