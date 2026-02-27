import { DEFAULT_SETTINGS, parseTags } from "./shared.js"
import { t } from "./i18n.js"

const MENU_SAVE_HIGHLIGHT = "rebar-save-highlight"
const MENU_CLIP_ARTICLE = "rebar-clip-article"

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS)
  return {
    rebarUrl: stored.rebarUrl || DEFAULT_SETTINGS.rebarUrl,
    defaultTags: stored.defaultTags || DEFAULT_SETTINGS.defaultTags,
    enableDomainTags: stored.enableDomainTags ?? DEFAULT_SETTINGS.enableDomainTags
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url, options, maxRetries = 2) {
  let lastError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options)

      if (res.status === 429) {
        if (attempt < maxRetries) {
          const retryAfter = res.headers.get("Retry-After")
          const delaySec = retryAfter ? Math.min(Number(retryAfter) || 2, 10) : (attempt + 1) * 2
          await wait(delaySec * 1000)
          continue
        }
        throw new Error(t("ext.tooManyReq"))
      }

      return res
    } catch (error) {
      lastError = error
      if (error instanceof TypeError && attempt < maxRetries) {
        // Network error — retry with backoff
        await wait((attempt + 1) * 1000)
        continue
      }
      throw error
    }
  }

  throw lastError
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

  const res = await fetchWithRetry(`${settings.rebarUrl}/api/capture/share`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Login required. Please sign in to your REBAR instance.`)
    }
    throw new Error(`Save failed: ${res.status}`)
  }

  return res.json()
}

function normalizeSelectionText(value) {
  return (value || "").replace(/\s+/g, " ").trim()
}

function setActionStatus(text, color, title) {
  chrome.action.setBadgeBackgroundColor({ color }).catch(() => { })
  chrome.action.setBadgeText({ text }).catch(() => { })
  chrome.action.setTitle({ title }).catch(() => { })
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" }).catch(() => { })
    chrome.action.setTitle({ title: "REBAR Clipper" }).catch(() => { })
  }, 3000)
}

function removeAllContextMenus() {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve()
    })
  })
}

function createContextMenu(options) {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create(options, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve()
    })
  })
}

async function ensureContextMenus() {
  try {
    await removeAllContextMenus()
    await createContextMenu({
      id: MENU_SAVE_HIGHLIGHT,
      title: "Save Highlight to REBAR",
      contexts: ["selection"]
    })
    await createContextMenu({
      id: MENU_CLIP_ARTICLE,
      title: "Clip Article to REBAR",
      contexts: ["page"]
    })
  } catch {
  }
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(response)
    })
  })
}

function injectContentScript(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: ["content.js"]
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve()
      }
    )
  })
}

async function requestPayloadFromTab(tabId, type) {
  try {
    return await sendMessageToTab(tabId, { type })
  } catch {
    await injectContentScript(tabId)
    return sendMessageToTab(tabId, { type })
  }
}

function buildHighlightPayload(info, tab) {
  const content = normalizeSelectionText(info.selectionText)
  if (!content) {
    throw new Error("No selected text")
  }

  return {
    content,
    title: tab?.title || "",
    url: info.pageUrl || tab?.url || "",
    kind: "quote",
    tags: ["highlight"]
  }
}

async function buildArticlePayload(tab) {
  if (!tab || typeof tab.id !== "number") {
    throw new Error("No active tab")
  }

  const response = await requestPayloadFromTab(tab.id, "GET_ARTICLE")
  const payload = response?.payload
  if (!payload || !payload.content) {
    throw new Error("Could not extract article text")
  }
  return payload
}

chrome.runtime.onInstalled.addListener(() => {
  ensureContextMenus().catch(() => { })
})

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenus().catch(() => { })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_SAVE_HIGHLIGHT) {
    Promise.resolve()
      .then(() => buildHighlightPayload(info, tab))
      .then((payload) => saveCapture(payload))
      .then(() => setActionStatus("OK", "#166534", "Saved highlight to REBAR"))
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Save failed"
        setActionStatus("ERR", "#991b1b", message)
      })
    return
  }

  if (info.menuItemId === MENU_CLIP_ARTICLE) {
    Promise.resolve()
      .then(() => buildArticlePayload(tab))
      .then((payload) => saveCapture(payload))
      .then(() => setActionStatus("OK", "#166534", "Saved article to REBAR"))
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Save failed"
        setActionStatus("ERR", "#991b1b", message)
      })
  }
})

ensureContextMenus().catch(() => { })

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
