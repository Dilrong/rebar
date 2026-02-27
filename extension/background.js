const DEFAULT_SETTINGS = {
  apiBaseUrl: "http://localhost:3000",
  defaultTags: "web,clipper"
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "")
}

function parseTags(tagText) {
  return tagText
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS)
  return {
    apiBaseUrl: normalizeBaseUrl(stored.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl),
    defaultTags: stored.defaultTags || DEFAULT_SETTINGS.defaultTags
  }
}

async function openSharePage(payload) {
  const settings = await getSettings()

  const params = new URLSearchParams()
  params.set("content", payload.content)
  if (payload.title) {
    params.set("title", payload.title)
  }
  if (payload.url) {
    params.set("url", payload.url)
  }

  const tags = Array.from(new Set([...(payload.tags || []), ...parseTags(settings.defaultTags)]))
  if (tags.length > 0) {
    params.set("tags", tags.join(","))
  }
  params.set("auto", "1")

  const shareUrl = `${settings.apiBaseUrl}/share?${params.toString()}`
  await chrome.tabs.create({ url: shareUrl })
  return { opened: true }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SAVE_CAPTURE") {
    openSharePage(message.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }))
    return true
  }

  if (message?.type === "GET_SETTINGS") {
    getSettings()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }))
    return true
  }

  return false
})
