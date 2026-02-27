import { DEFAULT_SETTINGS, normalizeBaseUrl, parseTags } from "./shared.js"

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS)
  return {
    apiBaseUrl: normalizeBaseUrl(stored.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl),
    defaultTags: stored.defaultTags || DEFAULT_SETTINGS.defaultTags,
    enableDomainTags: stored.enableDomainTags ?? DEFAULT_SETTINGS.enableDomainTags,
    apiKey: (stored.apiKey || "").trim()
  }
}

async function saveCapture(payload) {
  const settings = await getSettings()
  const trimmedContent = (payload.content || "").trim()
  if (!trimmedContent) {
    throw new Error("No content to share")
  }

  const tags = Array.from(new Set([...(payload.tags || []), ...parseTags(settings.defaultTags)]))

  const body = {
    content: trimmedContent,
    title: payload.title || undefined,
    url: payload.url || undefined,
    tags: tags.length > 0 ? tags : undefined
  }

  const headers = {
    "Content-Type": "application/json"
  }

  if (settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`
  }

  const res = await fetch(`${settings.apiBaseUrl}/api/capture/share`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    throw new Error(`Save failed: ${res.status}`)
  }

  return res.json()
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SAVE_CAPTURE") {
    saveCapture(message.payload)
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
