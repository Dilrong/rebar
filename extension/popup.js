const statusEl = document.getElementById("status")
const saveHighlightButton = document.getElementById("saveHighlight")
const saveArticleButton = document.getElementById("saveArticle")

function setStatus(message, isError = false) {
  statusEl.textContent = message
  statusEl.style.color = isError ? "#b91c1c" : "#111"
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

function sendCapture(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SAVE_CAPTURE", payload }, (response) => {
      resolve(response)
    })
  })
}

async function runCapture(mode) {
  try {
    setStatus("Collecting content...")
    const tab = await queryActiveTab()
    const response = await sendMessageToTab(tab.id, mode === "highlight" ? { type: "GET_SELECTION" } : { type: "GET_ARTICLE" })
    const payload = response?.payload

    if (!payload || !payload.content) {
      throw new Error(mode === "highlight" ? "Select text before saving" : "Could not extract article text")
    }

    setStatus("Opening REBAR Share...")
    const saved = await sendCapture(payload)
    if (!saved?.ok) {
      throw new Error(saved?.error || "Save failed")
    }

    setStatus("Opened. Finish on REBAR Share page.")
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Unknown error", true)
  }
}

saveHighlightButton.addEventListener("click", () => {
  runCapture("highlight")
})

saveArticleButton.addEventListener("click", () => {
  runCapture("article")
})
