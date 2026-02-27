import { DEFAULT_SETTINGS } from "./shared.js"
import { t } from "./i18n.js"

const statusEl = document.getElementById("status")
const saveArticleButton = document.getElementById("saveArticle")
const loginMessageEl = document.getElementById("loginMessage")
const goToLoginButton = document.getElementById("goToLogin")
const actionsEl = document.getElementById("actions")

let cachedSettings = null

function setStatus(message, isError = false) {
  statusEl.textContent = message
  statusEl.style.color = isError ? "#b91c1c" : "#111"
}

function setBusy(busy) {
  if (saveArticleButton) {
    saveArticleButton.disabled = busy
  }
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
    setStatus(t("ext.status.connError"), true)
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
    setStatus(t("ext.status.connError"), true)
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

    setStatus(t("ext.savedSuccess"))
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("ui.error"), true)
  } finally {
    setBusy(false)
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.rebarUrl || changes.defaultTags)) {
    cachedSettings = null
    refreshSettings().catch(() => {
      setLoggedInUi(false)
      setStatus(t("ext.status.connError"), true)
    })
  }
})

if (saveArticleButton) {
  saveArticleButton.addEventListener("click", () => {
    clipArticleInstantly()
  })
}

refreshSettings().catch(() => {
  setLoggedInUi(false)
  setStatus(t("ext.status.connError"), true)
})
