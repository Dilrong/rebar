import { DEFAULT_SETTINGS } from "./shared.js"
import { t } from "./i18n.js"

const statusEl = document.getElementById("status")
const saveArticleButton = document.getElementById("saveArticle")
const saveHighlightButton = document.getElementById("saveHighlight")
const loginMessageEl = document.getElementById("loginMessage")
const goToLoginButton = document.getElementById("goToLogin")
const actionsEl = document.getElementById("actions")

let cachedSettings = null

function setStatus(message, tone = "normal") {
  statusEl.textContent = message
  statusEl.className = "status"
  if (tone === "error") statusEl.classList.add("is-error")
  else if (tone === "success") statusEl.classList.add("is-success")
}

function setBusy(busy) {
  if (saveArticleButton) saveArticleButton.disabled = busy
  if (saveHighlightButton) saveHighlightButton.disabled = busy
}

function setLoggedInUi(loggedIn) {
  if (loggedIn) {
    loginMessageEl.classList.add("hidden")
    actionsEl.classList.remove("hidden")
    return
  }
  loginMessageEl.classList.remove("hidden")
  actionsEl.classList.add("hidden")
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

async function refreshSettings() {
  cachedSettings = await getSettings()

  if (!cachedSettings.rebarUrl) {
    setLoggedInUi(false)
    setStatus(t("ext.status.connError"), "error")
    return
  }

  try {
    setBusy(true)
    setStatus(t("ext.status.checking"))
    const res = await fetch(`${cachedSettings.rebarUrl}/api/auth/check`, { credentials: "include" })

    if (res.ok) {
      setLoggedInUi(true)
      setStatus(t("ext.status.ready"))
      return
    }

    setLoggedInUi(false)
    goToLoginButton.onclick = () => {
      window.open(`${cachedSettings.rebarUrl}/signup`, "_blank")
    }
    setStatus(t("ext.status.ready"))
  } catch {
    setLoggedInUi(false)
    setStatus(t("ext.status.connError"), "error")
  } finally {
    setBusy(false)
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
      { target: { tabId }, files: ["content.js"] },
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

function isBlockedPage(url) {
  if (typeof url !== "string") return false
  return ["chrome://", "chrome-extension://", "edge://", "about:"].some((p) => url.startsWith(p))
}

async function getTabWithContentScript() {
  const tab = await queryActiveTab()
  if (isBlockedPage(tab.url)) {
    throw new Error(t("ext.blockedPage"))
  }
  return tab
}

async function tryGetMessage(tab, type) {
  try {
    return await sendMessageToTab(tab.id, { type })
  } catch {
    await injectContentScript(tab.id)
    return sendMessageToTab(tab.id, { type })
  }
}

async function clipHighlight() {
  try {
    setBusy(true)
    setStatus(t("ext.status.collecting"))
    await refreshSettings()
    const tab = await getTabWithContentScript()

    const response = await tryGetMessage(tab, "GET_SELECTION")
    const payload = response?.payload
    if (!payload || !payload.content) {
      throw new Error(t("ext.noSelection"))
    }

    setStatus(t("ext.status.saving"))
    const saved = await sendCapture(payload)
    if (!saved?.ok) {
      throw new Error(saved?.error || t("ui.error"))
    }
    setStatus(t("ext.savedSuccess"), "success")
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("ui.error"), "error")
  } finally {
    setBusy(false)
  }
}

async function clipArticle() {
  try {
    setBusy(true)
    setStatus(t("ext.status.collecting"))
    await refreshSettings()
    const tab = await getTabWithContentScript()

    const response = await tryGetMessage(tab, "GET_ARTICLE")
    const payload = response?.payload
    if (!payload || !payload.content) {
      throw new Error(t("ext.noArticle"))
    }

    setStatus(t("ext.status.saving"))
    const saved = await sendCapture(payload)
    if (!saved?.ok) {
      throw new Error(saved?.error || t("ui.error"))
    }
    setStatus(t("ext.savedSuccess"), "success")
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("ui.error"), "error")
  } finally {
    setBusy(false)
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.rebarUrl || changes.defaultTags)) {
    cachedSettings = null
    refreshSettings().catch(() => {
      setLoggedInUi(false)
      setStatus(t("ext.status.connError"), "error")
    })
  }
})

if (saveHighlightButton) {
  saveHighlightButton.addEventListener("click", () => {
    clipHighlight()
  })
}

if (saveArticleButton) {
  saveArticleButton.addEventListener("click", () => {
    clipArticle()
  })
}

refreshSettings().catch(() => {
  setLoggedInUi(false)
  setStatus(t("ext.status.connError"), "error")
})
