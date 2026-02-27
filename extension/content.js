function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim()
}

function getSelectionPayload() {
  const selection = window.getSelection()
  const text = normalizeWhitespace(selection ? selection.toString() : "")

  if (!text) {
    return null
  }

  return {
    content: text,
    title: document.title || "",
    url: window.location.href,
    kind: "quote",
    tags: ["highlight"]
  }
}

function cloneWithoutNoise(node) {
  const cloned = node.cloneNode(true)
  cloned.querySelectorAll("script,style,noscript,svg,nav,header,footer,aside,form,button").forEach((element) => {
    element.remove()
  })
  return cloned
}

function getArticleText() {
  const candidates = [
    document.querySelector("article"),
    document.querySelector("main"),
    document.querySelector("[class*='content']"),
    document.querySelector("[class*='article']"),
    document.body
  ]

  for (const candidate of candidates) {
    if (!candidate) continue

    const cleaned = cloneWithoutNoise(candidate)
    const text = normalizeWhitespace(cleaned.textContent || "")

    if (text.length >= 180) {
      return text.slice(0, 7000)
    }
  }

  return ""
}

function getArticlePayload() {
  const content = getArticleText()
  if (!content) {
    return null
  }

  return {
    content,
    title: document.title || "",
    url: window.location.href,
    kind: "link",
    tags: ["web"]
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SELECTION") {
    sendResponse({ ok: true, payload: getSelectionPayload() })
    return true
  }

  if (message?.type === "GET_ARTICLE") {
    sendResponse({ ok: true, payload: getArticlePayload() })
    return true
  }

  return false
})
