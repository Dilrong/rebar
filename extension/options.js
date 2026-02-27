import { DEFAULT_SETTINGS, normalizeBaseUrl } from "./shared.js"

const form = {
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  apiKey: document.getElementById("apiKey"),
  defaultTags: document.getElementById("defaultTags"),
  enableDomainTags: document.getElementById("enableDomainTags")
}

const saveButton = document.getElementById("save")
const statusEl = document.getElementById("status")

function setStatus(message, isError = false) {
  statusEl.textContent = message
  statusEl.style.color = isError ? "#b91c1c" : "#111"
}

async function load() {
  const data = await chrome.storage.sync.get(DEFAULT_SETTINGS)
  form.apiBaseUrl.value = data.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl
  form.apiKey.value = data.apiKey || ""
  form.defaultTags.value = data.defaultTags || DEFAULT_SETTINGS.defaultTags
  form.enableDomainTags.checked = data.enableDomainTags ?? DEFAULT_SETTINGS.enableDomainTags
}

async function save() {
  const payload = {
    apiBaseUrl: form.apiBaseUrl.value.trim() || DEFAULT_SETTINGS.apiBaseUrl,
    apiKey: form.apiKey.value.trim(),
    defaultTags: form.defaultTags.value.trim() || DEFAULT_SETTINGS.defaultTags,
    enableDomainTags: form.enableDomainTags.checked
  }

  if (!payload.apiBaseUrl) {
    setStatus("API base URL is required", true)
    return
  }

  try {
    payload.apiBaseUrl = normalizeBaseUrl(payload.apiBaseUrl)
    const url = new URL(payload.apiBaseUrl)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("URL must start with http:// or https://")
    }
  } catch {
    setStatus("Enter a valid API base URL", true)
    return
  }

  await chrome.storage.sync.set(payload)
  form.apiBaseUrl.value = payload.apiBaseUrl
  setStatus("Saved")
}

saveButton.addEventListener("click", () => {
  save().catch((error) => {
    setStatus(error instanceof Error ? error.message : "Save failed", true)
  })
})

load().catch((error) => {
  setStatus(error instanceof Error ? error.message : "Load failed", true)
})
