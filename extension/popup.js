import { DEFAULT_SETTINGS, DOMAIN_TAG_RULES, parseTags } from "./shared.js"
import { t } from "./i18n.js"

const statusEl = document.getElementById("status")
const saveHighlightButton = document.getElementById("saveHighlight")
const saveArticleButton = document.getElementById("saveArticle")
const previewSection = document.getElementById("preview")
const previewTitleInput = document.getElementById("previewTitle")
const previewUrlInput = document.getElementById("previewUrl")
const previewTagsInput = document.getElementById("previewTags")
const previewContentInput = document.getElementById("previewContent")
const charCountEl = document.getElementById("charCount")
const openShareButton = document.getElementById("openShare")
const cancelPreviewButton = document.getElementById("cancelPreview")
const domainTagBadgeEl = document.getElementById("domainTagBadge")
const loginMessageEl = document.getElementById("loginMessage")
const goToLoginButton = document.getElementById("goToLogin")
const actionsEl = document.getElementById("actions")

let lastPayload = null
let cachedSettings = null
const CONTENT_WARNING_LENGTH = 2500

function setStatus(message, isError = false) {
  statusEl.textContent = message
  statusEl.style.color = isError ? "#b91c1c" : "#111"
}

function setBusy(busy) {
  if (saveHighlightButton) {
    saveHighlightButton.disabled = busy
  }
  if (saveArticleButton) {
    saveArticleButton.disabled = busy
  }
  if (openShareButton) {
    openShareButton.disabled = busy
  }
  if (cancelPreviewButton) {
    cancelPreviewButton.disabled = busy
  }
}

function updateCharCount(value) {
  if (!charCountEl) {
    return
  }

  const length = (value || "").length
  charCountEl.textContent = `${length} / ${CONTENT_WARNING_LENGTH}`
  charCountEl.classList.toggle("warning", length > CONTENT_WARNING_LENGTH)
}

function setDomainBadge(enabled) {
  const on = enabled !== false
  const prefix = t("ext.domainTags")
  domainTagBadgeEl.textContent = `${prefix}: ${on ? "ON" : "OFF"}`
  domainTagBadgeEl.classList.toggle("off", !on)
}

function dedupeTags(tags) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)))
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
      if (!response?.ok || !response.settings) {
        resolve(DEFAULT_SETTINGS)
        return
      }

      resolve(response.settings)
    })
  })
}

function saveSettingsPatch(patch) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(patch, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      resolve()
    })
  })
}

async function refreshSettings() {
  cachedSettings = await getSettings()
  setDomainBadge(cachedSettings?.enableDomainTags !== false)

  if (!cachedSettings.rebarUrl) {
    return
  }

  try {
    setBusy(true)
    setStatus(t("ext.status.checking"))

    const res = await fetch(`${cachedSettings.rebarUrl}/api/auth/check`, { credentials: "include" })
    if (!res.ok) {
      // Unauthenticated
      loginMessageEl.classList.remove("hidden")
      actionsEl.classList.add("hidden")
      domainTagBadgeEl.classList.add("hidden")

      goToLoginButton.onclick = () => {
        window.open(`${cachedSettings.rebarUrl}/signup`, "_blank")
      }
      setStatus(t("ext.status.ready"))
    } else {
      // Authenticated
      loginMessageEl.classList.add("hidden")
      actionsEl.classList.remove("hidden")
      domainTagBadgeEl.classList.remove("hidden")
      setStatus(t("ext.status.ready"))
    }
  } catch (err) {
    console.error("Failed to check auth status", err)
    loginMessageEl.classList.remove("hidden")
    actionsEl.classList.add("hidden")
    domainTagBadgeEl.classList.add("hidden")
    setStatus(t("ext.status.connError"), true)
  } finally {
    setBusy(false)
  }
}

function toHostTag(urlValue) {
  try {
    const url = new URL(urlValue)
    const host = url.hostname.replace(/^www\./i, "").toLowerCase()
    if (!host) {
      return null
    }

    return host.replace(/\./g, "-")
  } catch {
    return null
  }
}

function guessDomainTags(urlValue) {
  try {
    const host = new URL(urlValue).hostname.replace(/^www\./i, "").toLowerCase()

    return DOMAIN_TAG_RULES.filter((rule) => rule.pattern.split("|").some((segment) => host.includes(segment))).flatMap((rule) => rule.tags)
  } catch {
    return []
  }
}

function suggestTags(payload, settings) {
  const existing = Array.isArray(payload.tags) ? payload.tags : []
  const domainEnabled = settings?.enableDomainTags !== false
  const hostTag = domainEnabled && payload.url ? toHostTag(payload.url) : null
  const domainTags = domainEnabled && payload.url ? guessDomainTags(payload.url) : []
  const kindTags = payload.kind === "quote" ? ["highlight"] : payload.kind === "link" ? ["web"] : []

  return dedupeTags([...existing, ...kindTags, ...domainTags, ...(hostTag ? [hostTag] : [])])
}

function showPreview(payload, settings) {
  lastPayload = payload
  previewTitleInput.value = payload.title || ""
  previewUrlInput.value = payload.url || ""
  previewTagsInput.value = suggestTags(payload, settings).join(",")
  previewContentInput.value = payload.content || ""
  updateCharCount(previewContentInput.value)
  previewSection.classList.remove("hidden")
}

function refreshPreviewTagsFromSettings() {
  if (!lastPayload) {
    return
  }

  previewTagsInput.value = suggestTags(lastPayload, cachedSettings).join(",")
}

function hidePreview() {
  previewSection.classList.add("hidden")
  lastPayload = null
  updateCharCount("")
}

function buildPreviewPayload() {
  return {
    ...lastPayload,
    title: previewTitleInput.value.trim(),
    url: previewUrlInput.value.trim(),
    tags: dedupeTags(parseTags(previewTagsInput.value)),
    content: previewContentInput.value.trim()
  }
}

function queryActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (!tab || typeof tab.id !== "number") {
        reject(new Error("No active tab"))
        return
      }
      resolve(tab)
    })
  })
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

function sendCapture(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SAVE_CAPTURE", payload }, (response) => {
      resolve(response)
    })
  })
}

async function runCapture(mode) {
  try {
    setBusy(true)
    setStatus(t("ext.status.collecting"))
    await refreshSettings()
    const tab = await queryActiveTab()

    if (typeof tab.url === "string") {
      const blockedPrefixes = ["chrome://", "chrome-extension://", "edge://", "about:"]
      const isBlockedPage = blockedPrefixes.some((prefix) => tab.url.startsWith(prefix))
      if (isBlockedPage) {
        throw new Error(t("ext.blockedPage"))
      }
    }

    let response

    try {
      response = await sendMessageToTab(tab.id, mode === "highlight" ? { type: "GET_SELECTION" } : { type: "GET_ARTICLE" })
    } catch {
      await injectContentScript(tab.id)
      response = await sendMessageToTab(tab.id, mode === "highlight" ? { type: "GET_SELECTION" } : { type: "GET_ARTICLE" })
    }

    const payload = response?.payload

    if (!payload || !payload.content) {
      throw new Error(mode === "highlight" ? t("ext.noHighlight") : t("ext.noArticle"))
    }

    showPreview(payload, cachedSettings)
    setStatus(t("ext.previewLoaded"))
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("ui.error"), true)
  } finally {
    setBusy(false)
  }
}

async function clipArticleInstantly() {
  try {
    setBusy(true)
    setStatus(t("ext.status.collecting"))
    await refreshSettings()
    const tab = await queryActiveTab()

    if (typeof tab.url === "string") {
      const blockedPrefixes = ["chrome://", "chrome-extension://", "edge://", "about:"]
      const isBlockedPage = blockedPrefixes.some((prefix) => tab.url.startsWith(prefix))
      if (isBlockedPage) {
        throw new Error(t("ext.blockedPage"))
      }
    }

    let response

    try {
      response = await sendMessageToTab(tab.id, { type: "GET_ARTICLE" })
    } catch {
      await injectContentScript(tab.id)
      response = await sendMessageToTab(tab.id, { type: "GET_ARTICLE" })
    }

    const payload = response?.payload
    if (!payload || !payload.content) {
      throw new Error(t("ext.noArticle"))
    }

    setStatus(t("ext.status.saving"))
    const saved = await sendCapture(payload)
    if (!saved?.ok) {
      throw new Error(saved?.error || t("ui.error"))
    }

    hidePreview()
    setStatus(t("ext.savedSuccess"))
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("ui.error"), true)
  } finally {
    setBusy(false)
  }
}

async function openShareFromPreview() {
  if (!lastPayload) {
    setStatus(t("ext.noClipPreview"), true)
    return
  }

  const payload = buildPreviewPayload()
  if (!payload.content) {
    setStatus(t("ext.contentReq"), true)
    return
  }

  try {
    setBusy(true)
    setStatus(t("ext.status.saving"))
    const saved = await sendCapture(payload)
    if (!saved?.ok) {
      throw new Error(saved?.error || t("ui.error"))
    }

    setStatus(t("ext.savedSuccess"))
    hidePreview()
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("ui.error"), true)
  } finally {
    setBusy(false)
  }
}

async function toggleDomainTags() {
  try {
    const current = cachedSettings?.enableDomainTags !== false
    const next = !current
    await saveSettingsPatch({ enableDomainTags: next })
    cachedSettings = { ...(cachedSettings || {}), enableDomainTags: next }
    setDomainBadge(next)
    refreshPreviewTagsFromSettings()
    setStatus(next ? t("ext.domainTagsEnabled") : t("ext.domainTagsDisabled"))
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("ext.domainTagsFail"), true)
  }
}

// Auto-refresh settings when changed in options page
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.rebarUrl || changes.defaultTags || changes.enableDomainTags)) {
    cachedSettings = null
    refreshSettings().catch(() => {
      setDomainBadge(true)
    })
  }
})

if (saveHighlightButton) {
  saveHighlightButton.addEventListener("click", () => {
    runCapture("highlight")
  })
}

if (saveArticleButton) {
  saveArticleButton.addEventListener("click", () => {
    clipArticleInstantly()
  })
}

openShareButton.addEventListener("click", () => {
  openShareFromPreview()
})

cancelPreviewButton.addEventListener("click", () => {
  hidePreview()
  setStatus(t("ext.previewCanceled"))
})

previewContentInput.addEventListener("input", () => {
  updateCharCount(previewContentInput.value)
})

domainTagBadgeEl.addEventListener("click", () => {
  toggleDomainTags()
})

refreshSettings().catch(() => {
  setDomainBadge(true)
})

updateCharCount("")
