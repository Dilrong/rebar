import { DEFAULT_SETTINGS } from "./shared.js"
import { initI18n, t } from "./i18n.js"

const form = {
  rebarUrl: document.getElementById("rebarUrl"),
  defaultTags: document.getElementById("defaultTags")
}

const saveButton = document.getElementById("save")
const testConnButton = document.getElementById("testConn")
const statusEl = document.getElementById("status")

function setStatus(message, tone = "normal") {
  statusEl.textContent = message
  statusEl.className = ""
  if (tone === "error") statusEl.classList.add("is-error")
  else if (tone === "success") statusEl.classList.add("is-success")
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
    setStatus(t("ext.opt.invalidUrl"), "error")
    return
  }

  const payload = {
    rebarUrl: urlStr,
    defaultTags: form.defaultTags.value.trim() || DEFAULT_SETTINGS.defaultTags
  }

  await chrome.storage.sync.set(payload)
  setStatus(t("ext.opt.saved"), "success")
}

async function testConnection() {
  let urlStr = form.rebarUrl.value.trim() || DEFAULT_SETTINGS.rebarUrl
  urlStr = urlStr.replace(/\/+$/, "")

  if (!isValidUrl(urlStr)) {
    setStatus(t("ext.opt.invalidUrl"), "error")
    return
  }

  testConnButton.disabled = true
  setStatus(t("ext.status.checking"))

  try {
    const res = await fetch(`${urlStr}/api/auth/check`, { credentials: "include" })

    if (res.ok) {
      setStatus(t("ext.opt.connOk"), "success")
    } else if (res.status === 401) {
      setStatus(t("ext.opt.connNoAuth"), "error")
    } else {
      setStatus(t("ext.opt.connFail"), "error")
    }
  } catch {
    setStatus(t("ext.opt.connFail"), "error")
  } finally {
    testConnButton.disabled = false
  }
}

saveButton.addEventListener("click", () => {
  save().catch((error) => {
    setStatus(error instanceof Error ? error.message : t("ui.error"), "error")
  })
})

testConnButton.addEventListener("click", () => {
  testConnection().catch((error) => {
    setStatus(error instanceof Error ? error.message : t("ui.error"), "error")
  })
})

load().catch((error) => {
  setStatus(error instanceof Error ? error.message : t("ui.error"), "error")
})

initI18n()
