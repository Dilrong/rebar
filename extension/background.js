import { DEFAULT_SETTINGS, MSG, parseTags, normalizeTagList, isValidUrl, normalizeUrl, errorMessage, CONTENT_LIMIT } from "./shared.js"
import { t } from "./i18n.js"

const tagCache = {
  rebarUrl: "",
  expiresAt: 0,
  names: []
}

function chromeAsync(fn) {
  return new Promise((resolve, reject) => {
    fn((...args) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
      else resolve(...args)
    })
  })
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS)
  const rebarUrl = normalizeUrl(stored.rebarUrl || DEFAULT_SETTINGS.rebarUrl)
  if (!isValidUrl(rebarUrl)) throw new Error(t("ext.opt.invalidUrl"))
  return { rebarUrl, defaultTags: stored.defaultTags || DEFAULT_SETTINGS.defaultTags }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchWithRetry(url, options, { maxRetries = 2, signal, totalTimeoutMs = 30_000 } = {}) {
  let lastError
  const deadline = Date.now() + totalTimeoutMs
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError")
    if (Date.now() >= deadline) throw new Error(t("ext.tooManyReq"))
    try {
      const res = await fetch(url, { ...options, signal })
      if (res.status === 429) {
        if (attempt < maxRetries) {
          const retryAfter = res.headers.get("Retry-After")
          const delayMs = Math.min(Number(retryAfter) || (attempt + 1) * 2, 10) * 1000
          await wait(Math.min(delayMs, deadline - Date.now()))
          continue
        }
        throw new Error(t("ext.tooManyReq"))
      }
      return res
    } catch (error) {
      lastError = error
      if (error.name === "AbortError") throw error
      if (error instanceof TypeError && attempt < maxRetries) {
        await wait(Math.min((attempt + 1) * 1000, deadline - Date.now()))
        continue
      }
      throw error
    }
  }
  throw lastError
}

async function checkAuth(rebarUrl) {
  try { return (await fetch(`${rebarUrl}/api/auth/check`, { credentials: "include" })).ok }
  catch { return false }
}

async function fetchAvailableTags(rebarUrl, signal) {
  const now = Date.now()
  if (tagCache.rebarUrl === rebarUrl && tagCache.expiresAt > now) {
    return tagCache.names
  }

  const res = await fetchWithRetry(`${rebarUrl}/api/tags`, { credentials: "include" }, { signal, maxRetries: 1 })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error(t("ext.status.authRequired"))
    throw new Error(`${t("ext.saveFailed")}: ${res.status}`)
  }

  const payload = await res.json().catch(() => ({ data: [] }))
  const names = Array.isArray(payload?.data)
    ? normalizeTagList(payload.data.map((tag) => (typeof tag?.name === "string" ? tag.name : ""))).sort((a, b) => a.localeCompare(b))
    : []

  tagCache.rebarUrl = rebarUrl
  tagCache.expiresAt = now + 30_000
  tagCache.names = names
  return names
}

function rememberAvailableTags(rebarUrl, tags) {
  if (!rebarUrl) return

  const nextNames = normalizeTagList([
    ...(tagCache.rebarUrl === rebarUrl ? tagCache.names : []),
    ...normalizeTagList(tags)
  ]).sort((a, b) => a.localeCompare(b))

  tagCache.rebarUrl = rebarUrl
  tagCache.expiresAt = Date.now() + 30_000
  tagCache.names = nextNames
}

async function saveCapture(payload, signal, { mergeDefaultTags = true } = {}) {
  const settings = await getSettings()
  const content = (payload.content || "").trim()
  if (!content) throw new Error(t("ext.noArticle"))

  const tags = normalizeTagList(mergeDefaultTags ? [...(payload.tags || []), ...parseTags(settings.defaultTags)] : [...(payload.tags || [])])
  const body = {
    content,
    note: payload.note || undefined,
    title: payload.title || undefined,
    url: payload.url || undefined,
    kind: payload.kind || undefined,
    tags: tags.length > 0 ? tags : undefined
  }

  const res = await fetchWithRetry(
    `${settings.rebarUrl}/api/capture/share`,
    { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) },
    { signal }
  )

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error(t("ext.status.authRequired"))
    throw new Error(`${t("ext.saveFailed")}: ${res.status}`)
  }

  rememberAvailableTags(settings.rebarUrl, tags)
  return res.json()
}

function sendBanner(tabId, state, message) {
  return chrome.tabs.sendMessage(tabId, { type: MSG.SHOW_BANNER, state, message, cancelLabel: t("ui.cancel") })
    .catch((e) => console.warn("[REBAR] sendBanner:", e.message))
}

function hideBanner(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: MSG.HIDE_BANNER })
    .catch(() => {})
}

function sendToTab(tabId, message) {
  return chromeAsync((cb) => chrome.tabs.sendMessage(tabId, message, cb))
}

function injectContentScript(tabId) {
  return chromeAsync((cb) => chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, cb))
}

async function queryTabMessage(tabId, message) {
  try { return await sendToTab(tabId, message) }
  catch {
    try { await injectContentScript(tabId) } catch (injectError) {
      console.warn("[REBAR] injectContentScript:", errorMessage(injectError))
      throw new Error(t("ext.blockedPage"))
    }
    return sendToTab(tabId, message)
  }
}

async function promptForQuickTags(tabId, payload, signal) {
  const settings = await getSettings()
  const defaultTags = parseTags(settings.defaultTags)
  const selectedTags = normalizeTagList([...(payload.tags || []), ...defaultTags])
  let availableTags = []
  let tagLoadFailed = false

  try {
    availableTags = await fetchAvailableTags(settings.rebarUrl, signal)
  } catch (error) {
    console.warn("[REBAR] fetchAvailableTags:", errorMessage(error))
    tagLoadFailed = true
  }

  const response = await queryTabMessage(tabId, {
    type: MSG.PICK_TAGS,
    tags: availableTags,
    selectedTags,
    tagLoadFailed
  })

  if (!response?.ok || response.cancelled) {
    return null
  }

  const nextTags = Array.isArray(response.tags) ? response.tags : selectedTags
  return { ...payload, tags: nextTags }
}

const BLOCKED_PREFIXES = ["chrome://", "chrome-extension://", "edge://", "about:", "moz-extension://"]
const isBlockedPage = (url) => typeof url !== "string" || BLOCKED_PREFIXES.some((p) => url.startsWith(p))

const saveControllers = new Map()

async function oneShotSave(tab) {
  const tabId = tab?.id
  if (!tab || typeof tabId !== "number" || saveControllers.has(tabId)) return

  if (isBlockedPage(tab.url)) {
    await sendBanner(tabId, "error", t("ext.blockedPage"))
    return
  }

  const settings = await getSettings()
  if (!(await checkAuth(settings.rebarUrl))) {
    chrome.tabs.create({ url: `${settings.rebarUrl}/signup`, active: true })
    return
  }

  const controller = new AbortController()
  saveControllers.set(tabId, controller)

  try {
    const { payload } = await queryTabMessage(tabId, { type: MSG.GET_ARTICLE })
    if (!payload?.content) throw new Error(t("ext.noArticle"))
    if (controller.signal.aborted) return

    const taggedPayload = await promptForQuickTags(tabId, payload, controller.signal)
    if (controller.signal.aborted || !taggedPayload) {
      await hideBanner(tabId)
      return
    }

    await sendBanner(tabId, "loading", t("ext.status.saving"))
    await saveCapture(taggedPayload, controller.signal, { mergeDefaultTags: false })
    await sendBanner(tabId, "success", t("ext.savedSuccess"))
  } catch (error) {
    if (error?.name === "AbortError") return
    await sendBanner(tabId, "error", errorMessage(error))
  } finally {
    saveControllers.delete(tabId)
  }
}

const MENU_SAVE_HIGHLIGHT = "rebar-save-highlight"
const MENU_CLIP_ARTICLE = "rebar-clip-article"
const MENU_OPEN_SETTINGS = "rebar-open-settings"

async function ensureContextMenus() {
  try {
    await chromeAsync((cb) => chrome.contextMenus.removeAll(cb))
    const create = (opts) => chromeAsync((cb) => chrome.contextMenus.create(opts, cb))
    await create({ id: MENU_SAVE_HIGHLIGHT, title: t("ext.highlightBtn"), contexts: ["selection"] })
    await create({ id: MENU_CLIP_ARTICLE, title: t("ext.articleBtn"), contexts: ["page"] })
    await create({ id: MENU_OPEN_SETTINGS, title: t("ext.openSettings"), contexts: ["action"] })
  } catch (e) { console.warn("[REBAR] ensureContextMenus:", e.message) }
}

function flashBadge(text, color, title) {
  chrome.action.setBadgeBackgroundColor({ color }).catch(() => {})
  chrome.action.setBadgeText({ text }).catch(() => {})
  chrome.action.setTitle({ title }).catch(() => {})
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" }).catch(() => {})
    chrome.action.setTitle({ title: "Save to REBAR" }).catch(() => {})
  }, 3000)
}

const menuHandlers = {
  [MENU_OPEN_SETTINGS]() {
    chrome.runtime.openOptionsPage()
  },
  async [MENU_SAVE_HIGHLIGHT](info, tab) {
    const tabId = tab?.id
    if (typeof tabId !== "number") return

    const settings = await getSettings()
    if (!(await checkAuth(settings.rebarUrl))) {
      chrome.tabs.create({ url: `${settings.rebarUrl}/signup`, active: true })
      return
    }

    let payload = null
    try {
      const response = await queryTabMessage(tabId, { type: MSG.GET_SELECTION })
      if (response?.payload?.content) {
        payload = {
          ...response.payload,
          content: String(response.payload.content).slice(0, CONTENT_LIMIT)
        }
      }
    } catch (error) {
      console.warn("[REBAR] GET_SELECTION:", errorMessage(error))
    }

    if (!payload) {
      const content = (info.selectionText || "").replace(/\s+/g, " ").trim().slice(0, CONTENT_LIMIT)
      if (!content) { flashBadge("ERR", "#991b1b", t("ext.noHighlight")); return }
      payload = {
        content,
        title: tab.title || "",
        url: info.pageUrl || tab.url || "",
        kind: "quote",
        tags: ["highlight"]
      }
    }

    const taggedPayload = await promptForQuickTags(tabId, payload, null)
    if (!taggedPayload) return

    saveCapture(taggedPayload, null, { mergeDefaultTags: false })
      .then(() => flashBadge("OK", "#166534", t("ext.savedSuccess")))
      .catch((e) => flashBadge("ERR", "#991b1b", errorMessage(e)))
  },
  [MENU_CLIP_ARTICLE](_info, tab) {
    oneShotSave(tab).catch((e) => console.warn("[REBAR] clip article:", e.message))
  }
}

const messageHandlers = {
  [MSG.CANCEL_SAVE](_msg, sender) {
    const tabId = sender.tab?.id
    if (tabId !== undefined) {
      const ctrl = saveControllers.get(tabId)
      if (ctrl) { ctrl.abort(); saveControllers.delete(tabId) }
    }
    return { ok: true }
  },
  [MSG.SAVE_CAPTURE](msg) {
    return saveCapture(msg.payload, null).then((data) => ({ ok: true, data }))
  },
  [MSG.GET_SETTINGS]() {
    return getSettings().then((settings) => ({ ok: true, settings }))
  }
}

chrome.action.onClicked.addListener((tab) => {
  oneShotSave(tab).catch((e) => console.warn("[REBAR] oneShotSave:", e.message))
})

chrome.runtime.onInstalled.addListener(() => ensureContextMenus().catch(() => {}))
chrome.runtime.onStartup.addListener(() => ensureContextMenus().catch(() => {}))
ensureContextMenus().catch(() => {})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) return
  menuHandlers[info.menuItemId]?.(info, tab)
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message?.type]
  if (!handler) return false

  const result = handler(message, sender)
  if (result instanceof Promise) {
    result
      .then((data) => sendResponse(data))
      .catch((e) => sendResponse({ ok: false, error: errorMessage(e) }))
  } else {
    sendResponse(result)
  }
  return true
})
