;(() => {
  if (window.__rebar_content_loaded__) return
  window.__rebar_content_loaded__ = true

  const CONTENT_LIMIT = 12000
  const CONTEXT_LIMIT = 4000
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
  const CONTEXT_TAGS = new Set(["p", "div", "section", "article", "li", "blockquote", "pre", "main"])
  const normalizeTagList = (tags) => Array.from(new Set((tags || []).map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean)))

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
  const normalizeInlineText = (text) => (text || "").replace(/\s+/g, " ").trim()

  function getContextText(element) {
    if (!element) return ""
    const text = normalizeInlineText(element.innerText || element.textContent || "")
    if (text.length < 30) return ""
    return text.slice(0, 600)
  }

  function findContextBlock(node) {
    let current = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement
    while (current && current !== document.body) {
      if (CONTEXT_TAGS.has(current.tagName.toLowerCase())) {
        const text = getContextText(current)
        if (text) return current
      }
      current = current.parentElement
    }
    return document.body
  }

  function collectSiblingContext(element, direction) {
    const results = []
    let current = element

    while (current && results.length < 2) {
      current = direction === "previous" ? current.previousElementSibling : current.nextElementSibling
      if (!current) break

      const text = getContextText(current)
      if (text && !results.includes(text)) {
        if (direction === "previous") results.unshift(text)
        else results.push(text)
      }
    }

    return results
  }

  function buildSelectionContext(selectionText) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return ""

    const range = selection.getRangeAt(0)
    const startBlock = findContextBlock(range.startContainer)
    const endBlock = findContextBlock(range.endContainer)
    const before = collectSiblingContext(startBlock, "previous")
    const after = collectSiblingContext(endBlock, "next")
    const sections = []

    if (before.length > 0) {
      sections.push(`Before\n${before.join("\n\n")}`)
    }

    const currentBlockText = getContextText(startBlock)
    if (currentBlockText && normalizeInlineText(currentBlockText) !== normalizeInlineText(selectionText)) {
      sections.push(`Current block\n${currentBlockText}`)
    }

    if (endBlock !== startBlock) {
      const endBlockText = getContextText(endBlock)
      if (endBlockText && normalizeInlineText(endBlockText) !== normalizeInlineText(selectionText)) {
        sections.push(`Continuation\n${endBlockText}`)
      }
    }

    if (after.length > 0) {
      sections.push(`After\n${after.join("\n\n")}`)
    }

    return sections.join("\n\n").slice(0, CONTEXT_LIMIT)
  }

  const ARTICLE_SELECTORS = [
    "article", "[role='main']", "main",
    ".post-content", ".entry-content",
    ".article-body", ".article-content"
  ]

  const HOST_ARTICLE_SELECTORS = {
    kindle: [
      "#kindleReader_content",
      ".kg-full-page-text",
      ".kp-notebook-highlight",
      ".kp-notebook-annotation-highlight",
      ".a-row.kp-notebook-row"
    ],
    ridi: [
      ".epub-viewer",
      ".viewer_page",
      ".page-contents",
      ".ridi-highlight",
      ".annotation-highlight"
    ],
    millie: [
      ".viewer-page",
      ".epub-container",
      ".content-container",
      ".highlight-item",
      ".my-highlight"
    ]
  }

  function getHostSpecificSelectors() {
    const host = window.location.hostname.toLowerCase()
    if (host.includes("read.amazon")) return HOST_ARTICLE_SELECTORS.kindle
    if (host.includes("ridibooks")) return HOST_ARTICLE_SELECTORS.ridi
    if (host.includes("millie")) return HOST_ARTICLE_SELECTORS.millie
    return []
  }

  function getArticleText() {
    const hostSelectors = getHostSpecificSelectors()
    const candidates = [...hostSelectors.map((s) => document.querySelector(s)), ...ARTICLE_SELECTORS.map((s) => document.querySelector(s)), document.body]
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
    const contextNote = buildSelectionContext(text)
    return { content: text, note: contextNote || undefined, ...pageContext(), kind: "quote", tags: ["highlight"] }
  }

  function getArticlePayload() {
    const content = getArticleText()
    if (!content) return null
    return { content, ...pageContext(), kind: "link", tags: ["web"] }
  }

  const BANNER_ID = "__rebar_banner__"
  const TAG_PICKER_ID = "__rebar_tag_picker__"
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

  function removeTagPicker() {
    document.getElementById(TAG_PICKER_ID)?.remove()
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
      #${TAG_PICKER_ID} input[type="text"]::placeholder { color: rgba(17, 17, 17, 0.55); }
      #${TAG_PICKER_ID} label:hover { transform: translate(2px, 2px); box-shadow: 2px 2px 0 #111 !important; }
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

  function showTagPicker({ tags = [], selectedTags = [], tagLoadFailed = false }) {
    removeTagPicker()
    ensureKeyframes()

    return new Promise((resolve) => {
      const normalizedTags = normalizeTagList(tags)
      const normalizedSelectedTags = normalizeTagList(selectedTags)
      const initialSelected = new Set(normalizedSelectedTags.filter((tag) => normalizedTags.includes(tag)))
      const seededCustomTags = normalizedSelectedTags.filter((tag) => !normalizedTags.includes(tag))
      const overlay = document.createElement("div")
      overlay.id = TAG_PICKER_ID
      overlay.setAttribute("role", "dialog")
      overlay.setAttribute("aria-modal", "true")

      Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483647",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "rgba(0,0,0,0.45)"
      })

      const panel = document.createElement("form")
      Object.assign(panel.style, {
        width: "min(560px, 100%)",
        maxHeight: "min(80vh, 720px)",
        overflow: "auto",
        border: "4px solid #111",
        boxShadow: "10px 10px 0 #111",
        background: "#f4f1e8",
        color: "#111",
        padding: "20px",
        fontFamily: "'SFMono-Regular', 'Cascadia Mono', 'IBM Plex Mono', 'Consolas', monospace"
      })

      const title = document.createElement("h2")
      title.textContent = t("ext.tagPicker.title")
      Object.assign(title.style, {
        margin: "0 0 8px",
        fontSize: "22px",
        fontWeight: "900",
        textTransform: "uppercase",
        letterSpacing: "0.05em"
      })
      panel.appendChild(title)

      const desc = document.createElement("p")
      desc.textContent = t("ext.tagPicker.desc")
      Object.assign(desc.style, {
        margin: "0 0 16px",
        fontSize: "12px",
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: "0.04em"
      })
      panel.appendChild(desc)

      const selectionStatus = document.createElement("p")
      Object.assign(selectionStatus.style, {
        margin: "0 0 12px",
        fontSize: "11px",
        fontWeight: "900",
        textTransform: "uppercase",
        letterSpacing: "0.05em"
      })
      panel.appendChild(selectionStatus)

      const tagGrid = document.createElement("div")
      Object.assign(tagGrid.style, {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "10px",
        marginBottom: "16px"
      })

      if (tagLoadFailed) {
        const warning = document.createElement("p")
        warning.textContent = t("ext.tagPicker.loadFailed")
        Object.assign(warning.style, {
          margin: "0 0 12px",
          padding: "8px 12px",
          fontSize: "11px",
          fontWeight: "900",
          textTransform: "uppercase",
          border: "3px solid #b91c1c",
          background: "#fef2f2",
          color: "#b91c1c"
        })
        panel.appendChild(warning)
      }

      if (normalizedTags.length === 0 && !tagLoadFailed) {
        const empty = document.createElement("p")
        empty.textContent = t("ext.tagPicker.empty")
        Object.assign(empty.style, {
          margin: "0 0 16px",
          fontSize: "12px",
          fontWeight: "700",
          textTransform: "uppercase"
        })
        panel.appendChild(empty)
      } else {
        normalizedTags.forEach((tag) => {
          const label = document.createElement("label")
          Object.assign(label.style, {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 12px",
            border: "3px solid #111",
            boxShadow: "4px 4px 0 #111",
            background: initialSelected.has(tag) ? "#111" : "#fff",
            color: initialSelected.has(tag) ? "#fff" : "#111",
            cursor: "pointer",
            transition: "all 0.1s"
          })

          const input = document.createElement("input")
          input.type = "checkbox"
          input.value = tag
          input.checked = initialSelected.has(tag)
          input.addEventListener("change", () => {
            label.style.background = input.checked ? "#111" : "#fff"
            label.style.color = input.checked ? "#fff" : "#111"
            updateSelectionStatus()
          })

          const name = document.createElement("span")
          name.textContent = tag
          Object.assign(name.style, {
            fontSize: "12px",
            fontWeight: "900",
            textTransform: "uppercase",
            wordBreak: "break-word"
          })

          label.append(input, name)
          tagGrid.appendChild(label)
        })

        panel.appendChild(tagGrid)
      }

      const customLabel = document.createElement("label")
      Object.assign(customLabel.style, {
        display: "block",
        marginBottom: "16px"
      })

      const customText = document.createElement("div")
      customText.textContent = t("ext.tagPicker.custom")
      Object.assign(customText.style, {
        marginBottom: "6px",
        fontSize: "11px",
        fontWeight: "900",
        textTransform: "uppercase",
        letterSpacing: "0.05em"
      })
      customLabel.appendChild(customText)

      const customInput = document.createElement("input")
      customInput.type = "text"
      customInput.placeholder = "research, longform"
      customInput.value = seededCustomTags.join(", ")
      Object.assign(customInput.style, {
        width: "100%",
        minHeight: "44px",
        border: "3px solid #111",
        background: "#fff",
        color: "#111",
        padding: "10px 12px",
        fontSize: "13px",
        fontWeight: "700",
        boxSizing: "border-box"
      })
      customLabel.appendChild(customInput)
      panel.appendChild(customLabel)

      const getCurrentSelection = () => {
        const checkedTags = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value)
        const customTags = customInput.value.split(",").map((tag) => tag.trim())
        return normalizeTagList([...checkedTags, ...customTags])
      }

      const updateSelectionStatus = () => {
        selectionStatus.textContent = `${t("ext.tagPicker.selectedCount")}: ${getCurrentSelection().length}`
      }

      customInput.addEventListener("input", updateSelectionStatus)
      updateSelectionStatus()

      const actions = document.createElement("div")
      Object.assign(actions.style, {
        display: "flex",
        justifyContent: "flex-end",
        gap: "10px"
      })

      const cancelButton = document.createElement("button")
      cancelButton.type = "button"
      cancelButton.textContent = t("ext.tagPicker.cancel")
      Object.assign(cancelButton.style, {
        minHeight: "44px",
        border: "3px solid #111",
        boxShadow: "4px 4px 0 #111",
        background: "#fff",
        color: "#111",
        padding: "10px 14px",
        fontSize: "12px",
        fontWeight: "900",
        textTransform: "uppercase",
        cursor: "pointer"
      })

      const submitButton = document.createElement("button")
      submitButton.type = "submit"
      submitButton.textContent = t("ext.tagPicker.confirm")
      Object.assign(submitButton.style, {
        minHeight: "44px",
        border: "3px solid #111",
        boxShadow: "4px 4px 0 #111",
        background: "#111",
        color: "#fff",
        padding: "10px 14px",
        fontSize: "12px",
        fontWeight: "900",
        textTransform: "uppercase",
        cursor: "pointer"
      })

      actions.append(cancelButton, submitButton)
      panel.appendChild(actions)
      overlay.appendChild(panel)

      const finish = (result) => {
        removeTagPicker()
        resolve(result)
      }

      cancelButton.addEventListener("click", () => finish({ ok: true, cancelled: true, tags: selectedTags }))
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) finish({ ok: true, cancelled: true, tags: selectedTags })
      })
      overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") finish({ ok: true, cancelled: true, tags: selectedTags })
      })

      panel.addEventListener("submit", (event) => {
        event.preventDefault()
        const nextTags = getCurrentSelection()
        finish({ ok: true, cancelled: false, tags: nextTags })
      })

      document.documentElement.appendChild(overlay)
      const firstCheckbox = panel.querySelector('input[type="checkbox"]')
      if (firstCheckbox instanceof HTMLElement) {
        firstCheckbox.focus()
      } else {
        customInput.focus()
      }
    })
  }

  const handlers = {
    GET_SELECTION: () => ({ ok: true, payload: getSelectionPayload() }),
    GET_ARTICLE: () => ({ ok: true, payload: getArticlePayload() }),
    HIDE_BANNER: () => { removeBanner(); return { ok: true } },
    PICK_TAGS: (msg) => showTagPicker({
      tags: Array.isArray(msg.tags) ? msg.tags : [],
      selectedTags: Array.isArray(msg.selectedTags) ? msg.selectedTags : [],
      tagLoadFailed: Boolean(msg.tagLoadFailed)
    }),
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
    const result = handler(message)
    if (result instanceof Promise) {
      result.then((payload) => sendResponse(payload)).catch(() => sendResponse({ ok: false, cancelled: true, tags: [] }))
      return true
    }
    sendResponse(result)
    return true
  })
})()
