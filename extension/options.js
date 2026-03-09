import { DEFAULT_SETTINGS, isValidUrl, normalizeUrl, errorMessage } from "./shared.js"
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
  statusEl.className = tone !== "normal" ? `is-${tone}` : ""
}

function getFormUrl() {
  const url = normalizeUrl(form.rebarUrl.value) || DEFAULT_SETTINGS.rebarUrl
  if (!isValidUrl(url)) {
    setStatus(t("ext.opt.invalidUrl"), "error")
    return null
  }
  return url
}

async function load() {
  const data = await chrome.storage.sync.get(DEFAULT_SETTINGS)
  form.rebarUrl.value = data.rebarUrl || DEFAULT_SETTINGS.rebarUrl
  form.defaultTags.value = data.defaultTags || DEFAULT_SETTINGS.defaultTags
}

async function requestHostPermission(urlStr) {
  try {
    const origin = new URL(urlStr).origin + "/*"
    const granted = await chrome.permissions.request({ origins: [origin] })
    return granted
  } catch {
    return false
  }
}

async function save() {
  const urlStr = getFormUrl()
  if (!urlStr) return

  saveButton.disabled = true
  try {
    const granted = await requestHostPermission(urlStr)
    if (!granted) {
      setStatus(t("ext.opt.permDenied"), "error")
      return
    }
    await chrome.storage.sync.set({
      rebarUrl: urlStr,
      defaultTags: form.defaultTags.value.trim() || DEFAULT_SETTINGS.defaultTags
    })
    setStatus(t("ext.opt.saved"), "success")
  } finally {
    saveButton.disabled = false
  }
}

async function testConnection() {
  const urlStr = getFormUrl()
  if (!urlStr) return

  testConnButton.disabled = true
  setStatus(t("ext.status.checking"))

  try {
    const res = await fetch(`${urlStr}/api/auth/check`, { credentials: "include" })
    if (res.ok) setStatus(t("ext.opt.connOk"), "success")
    else if (res.status === 401) setStatus(t("ext.opt.connNoAuth"), "error")
    else setStatus(t("ext.opt.connFail"), "error")
  } catch {
    setStatus(t("ext.opt.connFail"), "error")
  } finally {
    testConnButton.disabled = false
  }
}

const handle = (fn) => () => fn().catch((e) => setStatus(errorMessage(e), "error"))

saveButton.addEventListener("click", handle(save))
testConnButton.addEventListener("click", handle(testConnection))

load().catch((e) => setStatus(errorMessage(e), "error"))
initI18n()
