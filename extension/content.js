/**
 * content.js — Injected into every page.
 * Handles:
 *   1. Article/selection extraction (GET_ARTICLE, GET_SELECTION)
 *   2. In-page status banner (SHOW_BANNER, HIDE_BANNER) with cancel support
 */

// ─────────────────────────────────────────────
// Markdown DOM extractor
// ─────────────────────────────────────────────

function domToMarkdown(node, depth) {
  depth = depth || 0
  if (!node) return ""
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || ""
  if (node.nodeType !== Node.ELEMENT_NODE) return ""

  const tag = node.tagName.toLowerCase()
  const children = Array.from(node.childNodes)
  const inline = () => children.map((c) => domToMarkdown(c, depth)).join("")

  switch (tag) {
    case "h1": return `\n\n# ${inline().trim()}\n\n`
    case "h2": return `\n\n## ${inline().trim()}\n\n`
    case "h3": return `\n\n### ${inline().trim()}\n\n`
    case "h4": return `\n\n#### ${inline().trim()}\n\n`
    case "h5": return `\n\n##### ${inline().trim()}\n\n`
    case "h6": return `\n\n###### ${inline().trim()}\n\n`
    case "p":
    case "div":
    case "section":
    case "article": { const inner = inline().trim(); return inner ? `\n\n${inner}\n\n` : "" }
    case "strong": case "b": return `**${inline()}**`
    case "em": case "i": return `_${inline()}_`
    case "a": {
      const href = node.getAttribute("href") || ""
      const text = inline().trim()
      if (!text) return ""
      if (!href || href.startsWith("#") || href.startsWith("javascript")) return text
      try { return `[${text}](${new URL(href, window.location.href).href})` } catch { return text }
    }
    case "ul": {
      const items = children.filter((c) => c.nodeType === Node.ELEMENT_NODE && c.tagName.toLowerCase() === "li")
        .map((li) => `- ${domToMarkdown(li, depth + 1).trim()}`).join("\n")
      return items ? `\n\n${items}\n\n` : ""
    }
    case "ol": {
      let idx = 1
      const items = children.filter((c) => c.nodeType === Node.ELEMENT_NODE && c.tagName.toLowerCase() === "li")
        .map((li) => `${idx++}. ${domToMarkdown(li, depth + 1).trim()}`).join("\n")
      return items ? `\n\n${items}\n\n` : ""
    }
    case "li": return inline()
    case "blockquote": {
      const inner = inline().trim()
      return `\n\n${inner.split("\n").map((l) => `> ${l}`).join("\n")}\n\n`
    }
    case "pre": {
      const codeEl = node.querySelector("code")
      return `\n\n\`\`\`\n${((codeEl ? codeEl.textContent : node.textContent) || "").trim()}\n\`\`\`\n\n`
    }
    case "code":
      if (node.parentElement && node.parentElement.tagName.toLowerCase() === "pre") return inline()
      return `\`${inline()}\``
    case "hr": return "\n\n---\n\n"
    case "br": return "  \n"
    case "img": {
      const alt = (node.getAttribute("alt") || "image").trim()
      const src = node.getAttribute("src") || ""
      return src ? `![${alt}](${src})` : ""
    }
    case "script": case "style": case "noscript": case "iframe":
    case "nav": case "header": case "footer": case "aside":
    case "form": case "button":
      return ""
    default: return inline()
  }
}

function cloneWithoutNoise(node) {
  const cloned = node.cloneNode(true)
  cloned.querySelectorAll([
    "script", "style", "noscript", "svg",
    "nav", "header", "footer", "aside",
    "form", "button", "iframe",
    "[aria-hidden='true']",
    ".ad", ".ads", ".advertisement", ".sidebar",
    ".cookie-banner", ".popup", ".modal", ".overlay"
  ].join(",")).forEach((el) => el.remove())
  return cloned
}

function normalizeMarkdown(text) {
  return text.replace(/\n{3,}/g, "\n\n").trim()
}

function getSelectionPayload() {
  const selection = window.getSelection()
  const text = (selection ? selection.toString() : "").replace(/\s+/g, " ").trim()
  if (!text) return null
  return { content: text, title: document.title || "", url: window.location.href, kind: "quote", tags: ["highlight"] }
}

function getArticleText() {
  const candidates = [
    document.querySelector("article"),
    document.querySelector("[role='main']"),
    document.querySelector("main"),
    document.querySelector("[class*='content']"),
    document.querySelector("[class*='article']"),
    document.querySelector("[class*='post']"),
    document.body
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    const cleaned = cloneWithoutNoise(candidate)
    const md = normalizeMarkdown(domToMarkdown(cleaned))
    if (md.length >= 180) return md.slice(0, 12000)
  }
  return ""
}

function getArticlePayload() {
  const content = getArticleText()
  if (!content) return null
  return { content, title: document.title || "", url: window.location.href, kind: "link", tags: ["web"] }
}

// ─────────────────────────────────────────────
// In-page banner UI
// ─────────────────────────────────────────────

const BANNER_ID = "__rebar_banner__"
let cancelRequested = false

function removeBanner() {
  const existing = document.getElementById(BANNER_ID)
  if (existing) existing.remove()
}

function showBanner({ state, message, onCancel }) {
  removeBanner()
  cancelRequested = false

  const banner = document.createElement("div")
  banner.id = BANNER_ID
  banner.setAttribute("role", "status")
  banner.setAttribute("aria-live", "polite")

  // styles — floating brutalist toast
  Object.assign(banner.style, {
    position: "fixed",
    top: "24px",
    right: "24px",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "12px 20px",
    minWidth: "300px",
    maxWidth: "450px",
    fontFamily: "'Inter', 'Noto Sans KR', ui-sans-serif, system-ui, sans-serif",
    fontSize: "14px",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    border: "4px solid #111",
    boxShadow: "6px 6px 0 #111",
    transition: "background 0.2s, color 0.2s",
    pointerEvents: "auto",
    animation: "__rebar_slide_in__ 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
  })

  if (state === "loading") {
    banner.style.background = "#111"
    banner.style.color = "#fff"
  } else if (state === "success") {
    banner.style.background = "#166534"
    banner.style.color = "#fff"
  } else if (state === "error") {
    banner.style.background = "#b91c1c"
    banner.style.color = "#fff"
  }

  // Spinner (only on loading)
  const left = document.createElement("div")
  left.style.cssText = "display:flex;align-items:center;gap:10px;flex:1;min-width:0;"

  if (state === "loading") {
    const spinner = document.createElement("div")
    spinner.style.cssText = `
      width:16px;height:16px;
      border:3px solid rgba(255,255,255,0.3);
      border-top-color:#fff;
      border-radius:50%;
      flex-shrink:0;
      animation:__rebar_spin__ 0.7s linear infinite;
    `
    // inject keyframes once
    if (!document.getElementById("__rebar_styles__")) {
      const style = document.createElement("style")
      style.id = "__rebar_styles__"
      style.textContent = `
        @keyframes __rebar_spin__ { to { transform: rotate(360deg); } }
        @keyframes __rebar_slide_in__ { from { transform: translateX(120%); } to { transform: translateX(0); } }
        #__rebar_banner__ button:hover { background: #fff !important; color: #111 !important; }
        #__rebar_banner__ button:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 currentColor !important; }
      `
      document.head.appendChild(style)
    }
    left.appendChild(spinner)
  } else {
    // Icon
    const icon = document.createElement("span")
    icon.style.cssText = "font-size:18px;line-height:1;flex-shrink:0;"
    icon.textContent = state === "success" ? "✓" : "✕"
    left.appendChild(icon)
  }

  const label = document.createElement("span")
  label.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
  label.textContent = message
  left.appendChild(label)
  banner.appendChild(left)

  // Cancel / close button
  const closeBtn = document.createElement("button")
  closeBtn.type = "button"
  closeBtn.textContent = state === "loading" ? "Cancel" : "✕"
  Object.assign(closeBtn.style, {
    flexShrink: "0",
    background: "transparent",
    border: "2px solid currentColor",
    boxShadow: "3px 3px 0 currentColor",
    color: "inherit",
    padding: "6px 12px",
    fontFamily: "inherit",
    fontSize: "12px",
    fontWeight: "900",
    textTransform: "uppercase",
    cursor: "pointer",
    letterSpacing: "0.05em",
    transition: "all 0.1s"
  })
  closeBtn.addEventListener("click", () => {
    if (state === "loading") {
      cancelRequested = true
      if (onCancel) onCancel()
    }
    removeBanner()
  })
  banner.appendChild(closeBtn)

  document.documentElement.appendChild(banner)

  // Auto-dismiss on success/error
  if (state === "success" || state === "error") {
    setTimeout(removeBanner, 4000)
  }
}

// ─────────────────────────────────────────────
// Message listener
// ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SELECTION") {
    sendResponse({ ok: true, payload: getSelectionPayload() })
    return true
  }

  if (message?.type === "GET_ARTICLE") {
    sendResponse({ ok: true, payload: getArticlePayload() })
    return true
  }

  if (message?.type === "SHOW_BANNER") {
    showBanner({
      state: message.state,
      message: message.message,
      onCancel: () => {
        chrome.runtime.sendMessage({ type: "CANCEL_SAVE" })
      }
    })
    sendResponse({ ok: true })
    return true
  }

  if (message?.type === "HIDE_BANNER") {
    removeBanner()
    sendResponse({ ok: true })
    return true
  }

  return false
})
