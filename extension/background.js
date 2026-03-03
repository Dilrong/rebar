import { DEFAULT_SETTINGS, parseTags } from "./shared.js"
import { t } from "./i18n.js"

const MENU_SAVE_HIGHLIGHT = "rebar-save-highlight"
const MENU_CLIP_ARTICLE = "rebar-clip-article"
const MENU_OPEN_SETTINGS = "rebar-open-settings"

// ─────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS)
  return {
    rebarUrl: stored.rebarUrl || DEFAULT_SETTINGS.rebarUrl,
    defaultTags: stored.defaultTags || DEFAULT_SETTINGS.defaultTags
  }
}

// ─────────────────────────────────────────────
// Networking
// ─────────────────────────────────────────────

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url, options, maxRetries = 2, signal) {
  let lastError
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError")
    try {
      const res = await fetch(url, { ...options, signal })
      if (res.status === 429) {
        if (attempt < maxRetries) {
          const retryAfter = res.headers.get("Retry-After")
          await wait(Math.min(Number(retryAfter) || (attempt + 1) * 2, 10) * 1000)
          continue
        }
        throw new Error(t("ext.tooManyReq"))
      }
      return res
    } catch (error) {
      lastError = error
      if (error.name === "AbortError") throw error
      if (error instanceof TypeError && attempt < maxRetries) { await wait((attempt + 1) * 1000); continue }
      throw error
    }
  }
  throw lastError
}

async function checkAuth(rebarUrl) {
  try {
    const res = await fetch(`${rebarUrl}/api/auth/check`, { credentials: "include" })
    return res.ok
  } catch {
    return false
  }
}

async function saveCapture(payload, signal) {
  const settings = await getSettings()
  const trimmedContent = (payload.content || "").trim()
  if (!trimmedContent) throw new Error(t("ext.noArticle"))

  const tags = Array.from(new Set([...(payload.tags || []), ...parseTags(settings.defaultTags)]))
  const body = {
    content: trimmedContent,
    title: payload.title || undefined,
    url: payload.url || undefined,
    tags: tags.length > 0 ? tags : undefined
  }

  const res = await fetchWithRetry(
    `${settings.rebarUrl}/api/capture/share`,
    { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) },
    2,
    signal
  )

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error(t("ext.status.authRequired"))
    throw new Error(`${t("ext.saveFailed")}: ${res.status}`)
  }

  return res.json()
}

// ─────────────────────────────────────────────
// Tab helpers
// ─────────────────────────────────────────────

function sendBanner(tabId, state, message) {
  return chrome.tabs.sendMessage(tabId, { type: "SHOW_BANNER", state, message }).catch(() => { })
}

function hideBanner(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "HIDE_BANNER" }).catch(() => { })
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return }
      resolve(response)
    })
  })
}

function injectContentScript(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return }
      resolve()
    })
  })
}

async function tryGetMessage(tabId, type) {
  try { return await sendMessageToTab(tabId, { type }) }
  catch { await injectContentScript(tabId); return sendMessageToTab(tabId, { type }) }
}

function isBlockedPage(url) {
  if (typeof url !== "string") return true
  return ["chrome://", "chrome-extension://", "edge://", "about:", "moz-extension://"].some((p) => url.startsWith(p))
}

// ─────────────────────────────────────────────
// One-click save (Instapaper style)
// ─────────────────────────────────────────────

// Map tabId → AbortController for cancel support
const saveControllers = new Map()

async function oneShotSave(tab) {
  const tabId = tab?.id
  if (!tab || typeof tabId !== "number") return

  if (isBlockedPage(tab.url)) {
    await sendBanner(tabId, "error", t("ext.blockedPage"))
    return
  }

  // Check auth first
  const settings = await getSettings()
  const authed = await checkAuth(settings.rebarUrl)

  if (!authed) {
    // Open login page in new tab
    chrome.tabs.create({ url: `${settings.rebarUrl}/signup`, active: true })
    return
  }

  // Show loading banner
  await sendBanner(tabId, "loading", t("ext.status.saving"))

  // Create abort controller for cancel support
  const controller = new AbortController()
  saveControllers.set(tabId, controller)

  try {
    const response = await tryGetMessage(tabId, "GET_ARTICLE")
    const payload = response?.payload
    if (!payload?.content) throw new Error(t("ext.noArticle"))

    if (controller.signal.aborted) return

    await saveCapture(payload, controller.signal)
    await sendBanner(tabId, "success", t("ext.savedSuccess"))
  } catch (error) {
    if (error?.name === "AbortError") return // User cancelled — banner already gone
    await sendBanner(tabId, "error", error instanceof Error ? error.message : t("ui.error"))
  } finally {
    saveControllers.delete(tabId)
  }
}

// ─────────────────────────────────────────────
// Context menus
// ─────────────────────────────────────────────

function removeAllContextMenus() {
  return new Promise((resolve) => { chrome.contextMenus.removeAll(() => resolve()) })
}

function createContextMenu(options) {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create(options, () => {
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return }
      resolve()
    })
  })
}

async function ensureContextMenus() {
  try {
    await removeAllContextMenus()
    await createContextMenu({ id: MENU_SAVE_HIGHLIGHT, title: "Save Highlight to REBAR", contexts: ["selection"] })
    await createContextMenu({ id: MENU_CLIP_ARTICLE, title: "Clip Article to REBAR", contexts: ["page"] })
    await createContextMenu({ id: MENU_OPEN_SETTINGS, title: "REBAR Settings…", contexts: ["action"] })
  } catch { }
}

// ─────────────────────────────────────────────
// Badge helpers
// ─────────────────────────────────────────────

function setActionStatus(text, color, title) {
  chrome.action.setBadgeBackgroundColor({ color }).catch(() => { })
  chrome.action.setBadgeText({ text }).catch(() => { })
  chrome.action.setTitle({ title }).catch(() => { })
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" }).catch(() => { })
    chrome.action.setTitle({ title: "Save to REBAR" }).catch(() => { })
  }, 3000)
}

// ─────────────────────────────────────────────
// Listeners
// ─────────────────────────────────────────────

// 🔑 ONE-CLICK: icon click → immediate save
chrome.action.onClicked.addListener((tab) => {
  oneShotSave(tab).catch(() => { })
})

chrome.runtime.onInstalled.addListener(() => { ensureContextMenus().catch(() => { }) })
chrome.runtime.onStartup.addListener(() => { ensureContextMenus().catch(() => { }) })
ensureContextMenus().catch(() => { })

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) return

  if (info.menuItemId === MENU_OPEN_SETTINGS) {
    chrome.runtime.openOptionsPage()
    return
  }

  if (info.menuItemId === MENU_SAVE_HIGHLIGHT) {
    const content = (info.selectionText || "").replace(/\s+/g, " ").trim()
    if (!content) { setActionStatus("ERR", "#991b1b", "No text selected"); return }
    saveCapture({ content, title: tab?.title || "", url: info.pageUrl || tab?.url || "", kind: "quote", tags: ["highlight"] }, null)
      .then(() => setActionStatus("OK", "#166534", "Saved highlight to REBAR"))
      .catch((error) => { const msg = error instanceof Error ? error.message : "Save failed"; setActionStatus("ERR", "#991b1b", msg) })
    return
  }

  if (info.menuItemId === MENU_CLIP_ARTICLE) {
    oneShotSave(tab).catch(() => { })
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Cancel from in-page banner cancel button
  if (message?.type === "CANCEL_SAVE") {
    const tabId = _sender.tab?.id
    if (tabId !== undefined) {
      const controller = saveControllers.get(tabId)
      if (controller) { controller.abort(); saveControllers.delete(tabId) }
    }
    sendResponse({ ok: true })
    return true
  }

  if (message?.type === "SAVE_CAPTURE") {
    saveCapture(message.payload, null)
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
