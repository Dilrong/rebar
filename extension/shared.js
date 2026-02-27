export const DEFAULT_SETTINGS = {
  rebarUrl: "https://rebarops.com",
  defaultTags: "web,clipper",
  enableDomainTags: true
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
