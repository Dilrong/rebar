import { DEFAULT_SETTINGS } from "./shared.js"
import { initI18n, t } from "./i18n.js"

const form = {
  rebarUrl: document.getElementById("rebarUrl"),
  defaultTags: document.getElementById("defaultTags")
}

const saveButton = document.getElementById("save")
const testConnButton = document.getElementById("testConn")
const statusEl = document.getElementById("status")

function setStatus(message, isError = false) {
  statusEl.textContent = message
  statusEl.style.color = isError ? "#b91c1c" : "#111"
}

function isValidUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

async function load() {
  const data = await chrome.storage.sync.get(DEFAULT_SETTINGS)
  form.rebarUrl.value = data.rebarUrl || DEFAULT_SETTINGS.rebarUrl
  form.defaultTags.value = data.defaultTags || DEFAULT_SETTINGS.defaultTags
}

async function save() {
  let urlStr = form.rebarUrl.value.trim() || DEFAULT_SETTINGS.rebarUrl
  // clean up URL, remove trailing slash
  urlStr = urlStr.replace(/\/+$/, "")

  if (!isValidUrl(urlStr)) {
    setStatus(t("ext.opt.invalidUrl"), true)
    return
  }

  const payload = {
    rebarUrl: urlStr,
    defaultTags: form.defaultTags.value.trim() || DEFAULT_SETTINGS.defaultTags
  }

  await chrome.storage.sync.set(payload)
  setStatus(t("ext.opt.saved"))
}

async function testConnection() {
  let urlStr = form.rebarUrl.value.trim() || DEFAULT_SETTINGS.rebarUrl
  urlStr = urlStr.replace(/\/+$/, "")

  if (!isValidUrl(urlStr)) {
    setStatus(t("ext.opt.invalidUrl"), true)
    return
  }

  testConnButton.disabled = true
  setStatus(t("ext.status.checking"))

  try {
    const res = await fetch(`${urlStr}/api/auth/check`, { credentials: "include" })

    if (res.ok) {
      setStatus(t("ext.opt.connOk"))
    } else if (res.status === 401) {
      setStatus(t("ext.opt.connNoAuth"), true)
    } else {
      setStatus(t("ext.opt.connFail"), true)
    }
  } catch {
    setStatus(t("ext.opt.connFail"), true)
  } finally {
    testConnButton.disabled = false
  }
}

saveButton.addEventListener("click", () => {
  save().catch((error) => {
    setStatus(error instanceof Error ? error.message : t("ui.error"), true)
  })
})

testConnButton.addEventListener("click", () => {
  testConnection().catch((error) => {
    setStatus(error instanceof Error ? error.message : t("ui.error"), true)
  })
})

load().catch((error) => {
  setStatus(error instanceof Error ? error.message : t("ui.error"), true)
})

initI18n()
