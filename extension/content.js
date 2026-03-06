;(() => {
  if (window.__rebar_content_loaded__) return
  window.__rebar_content_loaded__ = true

  const CONTENT_LIMIT = 12000
  const MIN_ARTICLE_LENGTH = 300

  const NOISE_SELECTOR = [
    "script", "style", "noscript", "svg",
    "nav", "header", "footer", "aside",
    "form", "button", "iframe",
    "[aria-hidden='true']",
    ".ad", ".ads", ".advertisement", ".sidebar",
    ".cookie-banner", ".popup", ".modal", ".overlay"
  ].join(",")

  const SKIP_TAGS = new Set([
    "script", "style", "noscript", "iframe",
    "nav", "header", "footer", "aside",
    "form", "button"
  ])

  const BLOCK_TAGS = new Set(["p", "div", "section", "article"])

  function domToMarkdown(node, depth = 0) {
    if (!node) return ""
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || ""
    if (node.nodeType !== Node.ELEMENT_NODE) return ""

    const tag = node.tagName.toLowerCase()
    if (SKIP_TAGS.has(tag)) return ""

    const children = Array.from(node.childNodes)
    const inline = () => children.map((c) => domToMarkdown(c, depth)).join("")
    const indent = "  ".repeat(depth)

    const headingLevel = tag.length === 2 && tag[0] === "h" && +tag[1] >= 1 && +tag[1] <= 6 ? +tag[1] : 0
    if (headingLevel) return `\n\n${"#".repeat(headingLevel)} ${inline().trim()}\n\n`

    if (BLOCK_TAGS.has(tag)) {
      const inner = inline().trim()
      return inner ? `\n\n${inner}\n\n` : ""
    }

    switch (tag) {
      case "strong": case "b": return `**${inline()}**`
      case "em": case "i": return `_${inline()}_`
      case "a": {
        const href = node.getAttribute("href") || ""
        const text = inline().trim()
        if (!text) return ""
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) return text
        try { return `[${text}](${new URL(href, window.location.href).href})` } catch { return text }
      }
      case "ul": {
        const items = children
          .filter((c) => c.nodeType === Node.ELEMENT_NODE && c.tagName.toLowerCase() === "li")
          .map((li) => `${indent}- ${domToMarkdown(li, depth + 1).trim()}`)
        return items.length ? `\n\n${items.join("\n")}\n\n` : ""
      }
      case "ol": {
        let idx = 1
        const items = children
          .filter((c) => c.nodeType === Node.ELEMENT_NODE && c.tagName.toLowerCase() === "li")
          .map((li) => `${indent}${idx++}. ${domToMarkdown(li, depth + 1).trim()}`)
        return items.length ? `\n\n${items.join("\n")}\n\n` : ""
      }
      case "li": return inline()
      case "blockquote": {
        const inner = inline().trim()
        return `\n\n${inner.split("\n").map((l) => `> ${l}`).join("\n")}\n\n`
      }
      case "pre": {
        const codeEl = node.querySelector("code")
        return `\n\n\`\`\`\n${((codeEl || node).textContent || "").trim()}\n\`\`\`\n\n`
      }
      case "code":
        if (node.parentElement?.tagName.toLowerCase() === "pre") return inline()
        return `\`${inline()}\``
      case "hr": return "\n\n---\n\n"
      case "br": return "  \n"
      case "img": {
        const alt = (node.getAttribute("alt") || "image").trim()
        const src = node.getAttribute("src") || ""
        return src ? `![${alt}](${src})` : ""
      }
      default: return inline()
    }
  }

  function cloneWithoutNoise(node) {
    const cloned = node.cloneNode(true)
    cloned.querySelectorAll(NOISE_SELECTOR).forEach((el) => el.remove())
    return cloned
  }

  const normalizeMarkdown = (text) => text.replace(/\n{3,}/g, "\n\n").trim()

  const ARTICLE_SELECTORS = [
    "article", "[role='main']", "main",
    ".post-content", ".entry-content",
    ".article-body", ".article-content"
  ]

  function getArticleText() {
    const candidates = [...ARTICLE_SELECTORS.map((s) => document.querySelector(s)), document.body]
    for (const el of candidates) {
      if (!el) continue
      const md = normalizeMarkdown(domToMarkdown(cloneWithoutNoise(el)))
      if (md.length >= MIN_ARTICLE_LENGTH) return md.slice(0, CONTENT_LIMIT)
    }
    return ""
  }

  function pageContext() {
    return { title: document.title || "", url: window.location.href }
  }

  function getSelectionPayload() {
    const text = (window.getSelection()?.toString() || "").replace(/\s+/g, " ").trim()
    if (!text) return null
    return { content: text, ...pageContext(), kind: "quote", tags: ["highlight"] }
  }

  function getArticlePayload() {
    const content = getArticleText()
    if (!content) return null
    return { content, ...pageContext(), kind: "link", tags: ["web"] }
  }

  const BANNER_ID = "__rebar_banner__"
  const STYLES_ID = "__rebar_styles__"
  let autoDismissTimer = null

  const BANNER_COLORS = {
    loading: { bg: "#111", fg: "#fff" },
    success: { bg: "#166534", fg: "#fff" },
    error: { bg: "#b91c1c", fg: "#fff" }
  }

  function removeBanner() {
    if (autoDismissTimer) { clearTimeout(autoDismissTimer); autoDismissTimer = null }
    document.getElementById(BANNER_ID)?.remove()
  }

  function ensureKeyframes() {
    if (document.getElementById(STYLES_ID)) return
    const style = document.createElement("style")
    style.id = STYLES_ID
    style.textContent = `
      @keyframes __rebar_spin__ { to { transform: rotate(360deg); } }
      @keyframes __rebar_slide_in__ { from { transform: translateX(120%); } to { transform: translateX(0); } }
      #${BANNER_ID} button:hover { background: #fff !important; color: #111 !important; transform: translate(2px, 2px); box-shadow: 2px 2px 0 currentColor !important; }
      #${BANNER_ID} button:active { transform: translate(4px, 4px); box-shadow: 0 0 0 currentColor !important; }
    `
    document.head.appendChild(style)
  }

  function showBanner({ state, message, cancelLabel, onCancel }) {
    removeBanner()
    ensureKeyframes()

    const colors = BANNER_COLORS[state] || BANNER_COLORS.error
    const banner = document.createElement("div")
    banner.id = BANNER_ID
    banner.setAttribute("role", "status")
    banner.setAttribute("aria-live", "polite")

    Object.assign(banner.style, {
      position: "fixed", top: "24px", right: "24px", zIndex: "2147483647",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: "16px", padding: "12px 20px", minWidth: "300px", maxWidth: "450px",
      fontFamily: "'SFMono-Regular', 'Cascadia Mono', 'IBM Plex Mono', 'Consolas', monospace",
      fontSize: "14px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.03em",
      border: "4px solid #111", boxShadow: "8px 8px 0 #111",
      background: colors.bg, color: colors.fg,
      backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
      backgroundBlendMode: "overlay",
      pointerEvents: "auto",
      animation: "__rebar_slide_in__ 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
    })

    const left = document.createElement("div")
    left.style.cssText = "display:flex;align-items:center;gap:10px;flex:1;min-width:0;"

    if (state === "loading") {
      const spinner = document.createElement("div")
      spinner.style.cssText = "width:16px;height:16px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;flex-shrink:0;animation:__rebar_spin__ 0.7s linear infinite;"
      left.appendChild(spinner)
    } else {
      const icon = document.createElement("span")
      icon.style.cssText = "font-size:18px;line-height:1;flex-shrink:0;"
      icon.textContent = state === "success" ? "\u2713" : "\u2715"
      left.appendChild(icon)
    }

    const label = document.createElement("span")
    label.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
    label.textContent = message
    left.appendChild(label)
    banner.appendChild(left)

    const btn = document.createElement("button")
    btn.type = "button"
    btn.textContent = state === "loading" ? (cancelLabel || "Cancel") : "\u2715"
    Object.assign(btn.style, {
      flexShrink: "0", background: "transparent",
      border: "3px solid currentColor", boxShadow: "4px 4px 0 currentColor",
      color: "inherit", padding: "6px 12px", fontFamily: "inherit",
      fontSize: "12px", fontWeight: "900", textTransform: "uppercase",
      cursor: "pointer", letterSpacing: "0.05em", transition: "all 0.1s"
    })
    btn.addEventListener("click", () => {
      if (state === "loading" && onCancel) onCancel()
      removeBanner()
    })
    banner.appendChild(btn)
    document.documentElement.appendChild(banner)

    if (state !== "loading") {
      autoDismissTimer = setTimeout(removeBanner, 4000)
    }
  }

  const handlers = {
    GET_SELECTION: () => ({ ok: true, payload: getSelectionPayload() }),
    GET_ARTICLE: () => ({ ok: true, payload: getArticlePayload() }),
    HIDE_BANNER: () => { removeBanner(); return { ok: true } },
    SHOW_BANNER: (msg) => {
      showBanner({
        state: msg.state,
        message: msg.message,
        cancelLabel: msg.cancelLabel,
        onCancel: () => chrome.runtime.sendMessage({ type: "CANCEL_SAVE" })
      })
      return { ok: true }
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const handler = handlers[message?.type]
    if (!handler) return false
    sendResponse(handler(message))
    return true
  })
})()
