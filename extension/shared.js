export const DEFAULT_SETTINGS = {
  rebarUrl: "https://rebarops.com",
  defaultTags: "web,clipper"
}

export function parseTags(tagText) {
  return (tagText || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}
