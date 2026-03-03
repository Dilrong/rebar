/**
 * Minimal DOM → Markdown converter.
 * Preserves: h1-h6, p, a, strong/b, em/i, ul/ol/li, blockquote, pre/code, hr, br
 */
function domToMarkdown(node, depth) {
  depth = depth || 0
  if (!node) return ""

  // Text node – return its value (trim leading/trailing whitespace only on block boundaries)
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ""
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return ""

  const tag = node.tagName.toLowerCase()
  const children = Array.from(node.childNodes)

  // ── Inline → recurse children
  const inline = () => children.map((c) => domToMarkdown(c, depth)).join("")

  switch (tag) {
    // Headings
    case "h1": return `\n\n# ${inline().trim()}\n\n`
    case "h2": return `\n\n## ${inline().trim()}\n\n`
    case "h3": return `\n\n### ${inline().trim()}\n\n`
    case "h4": return `\n\n#### ${inline().trim()}\n\n`
    case "h5": return `\n\n##### ${inline().trim()}\n\n`
    case "h6": return `\n\n###### ${inline().trim()}\n\n`

    // Paragraph / generic block
    case "p":
    case "div":
    case "section":
    case "article": {
      const inner = inline().trim()
      return inner ? `\n\n${inner}\n\n` : ""
    }

    // Bold
    case "strong":
    case "b": return `**${inline()}**`

    // Italic
    case "em":
    case "i": return `_${inline()}_`

    // Link
    case "a": {
      const href = node.getAttribute("href") || ""
      const text = inline().trim()
      if (!text) return ""
      if (!href || href.startsWith("#") || href.startsWith("javascript")) return text
      // Make absolute if relative
      let absHref = href
      try {
        absHref = new URL(href, window.location.href).href
      } catch { }
      return `[${text}](${absHref})`
    }

    // Unordered list
    case "ul": {
      const items = children
        .filter((c) => c.nodeType === Node.ELEMENT_NODE && c.tagName.toLowerCase() === "li")
        .map((li) => `- ${domToMarkdown(li, depth + 1).trim()}`)
        .join("\n")
      return items ? `\n\n${items}\n\n` : ""
    }

    // Ordered list
    case "ol": {
      let idx = 1
      const items = children
        .filter((c) => c.nodeType === Node.ELEMENT_NODE && c.tagName.toLowerCase() === "li")
        .map((li) => `${idx++}. ${domToMarkdown(li, depth + 1).trim()}`)
        .join("\n")
      return items ? `\n\n${items}\n\n` : ""
    }

    // List item – just recurse (parent handles prefix)
    case "li": return inline()

    // Blockquote
    case "blockquote": {
      const inner = inline().trim()
      const quoted = inner.split("\n").map((l) => `> ${l}`).join("\n")
      return `\n\n${quoted}\n\n`
    }

    // Code block
    case "pre": {
      const codeEl = node.querySelector("code")
      const codeText = (codeEl ? codeEl.textContent : node.textContent) || ""
      return `\n\n\`\`\`\n${codeText.trim()}\n\`\`\`\n\n`
    }

    // Inline code
    case "code": {
      // only inline if not inside pre
      if (node.parentElement && node.parentElement.tagName.toLowerCase() === "pre") return inline()
      return `\`${inline()}\``
    }

    // Horizontal rule
    case "hr": return "\n\n---\n\n"

    // Line break
    case "br": return "  \n"

    // Image – show alt text with image reference
    case "img": {
      const alt = (node.getAttribute("alt") || "image").trim()
      const src = node.getAttribute("src") || ""
      return src ? `![${alt}](${src})` : ""
    }

    // Noise elements already stripped by cloneWithoutNoise, but just in case
    case "script":
    case "style":
    case "noscript":
    case "iframe":
    case "nav":
    case "header":
    case "footer":
    case "aside":
    case "form":
    case "button":
      return ""

    // Default: recurse
    default:
      return inline()
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
  // Collapse 3+ consecutive blank lines to 2
  return text
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function getSelectionPayload() {
  const selection = window.getSelection()
  const text = (selection ? selection.toString() : "").replace(/\s+/g, " ").trim()
  if (!text) return null

  return {
    content: text,
    title: document.title || "",
    url: window.location.href,
    kind: "quote",
    tags: ["highlight"]
  }
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

    if (md.length >= 180) {
      // Cap at ~12000 chars of Markdown (more than before since Markdown adds syntax)
      return md.slice(0, 12000)
    }
  }

  return ""
}

function getArticlePayload() {
  const content = getArticleText()
  if (!content) return null

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
