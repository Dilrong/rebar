const form = {
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  defaultTags: document.getElementById("defaultTags")
}

const saveButton = document.getElementById("save")
const statusEl = document.getElementById("status")

const DEFAULTS = {
  apiBaseUrl: "http://localhost:3000",
  defaultTags: "web,clipper"
}

function setStatus(message, isError = false) {
  statusEl.textContent = message
  statusEl.style.color = isError ? "#b91c1c" : "#111"
}

async function load() {
  const data = await chrome.storage.sync.get(DEFAULTS)
  form.apiBaseUrl.value = data.apiBaseUrl || DEFAULTS.apiBaseUrl
  form.defaultTags.value = data.defaultTags || DEFAULTS.defaultTags
}

async function save() {
  const payload = {
    apiBaseUrl: form.apiBaseUrl.value.trim() || DEFAULTS.apiBaseUrl,
    defaultTags: form.defaultTags.value.trim() || DEFAULTS.defaultTags
  }

  if (!payload.apiBaseUrl) {
    setStatus("API base URL is required", true)
    return
  }

  await chrome.storage.sync.set(payload)
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
