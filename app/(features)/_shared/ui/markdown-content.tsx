"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef } from "react"

const ReactMarkdown = dynamic(() => import("react-markdown"), {
    loading: () => <span className="text-muted-foreground text-xs">…</span>
})

type Highlight = {
    id: string
    anchor: string
}

type Props = {
    content: string
    className?: string
    highlights?: Highlight[]
    onHighlightClick?: (id: string) => void
}

/**
 * Renders content as Markdown if it contains Markdown syntax,
 * otherwise falls back to plain text display.
 * Uses the @tailwindcss/typography `prose` class for readable formatting.
 *
 * When `highlights` are provided, wraps matching text in <mark> elements.
 */
export function MarkdownContent({ content, className = "", highlights, onHighlightClick }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const onHighlightClickRef = useRef<Props["onHighlightClick"]>(onHighlightClick)

    // Heuristic: if content has Markdown syntax, render it; else plain text
    const hasMarkdown = /^#{1,6}\s|^\*\s|\*\*|`|^\-\s|\[.+\]\(.+\)|^>\s|^---/m.test(content)

    useEffect(() => {
        onHighlightClickRef.current = onHighlightClick
    }, [onHighlightClick])

    // Apply highlight marks after render
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        // Clear previous marks
        clearHighlightMarks(container)

        if (!highlights || highlights.length === 0) return

        // Apply highlights by walking text nodes
        for (const hl of highlights) {
            const anchor = hl.anchor.trim()
            if (anchor.length < 2 || anchor.length > 500) continue
            applyHighlightToContainer(container, { ...hl, anchor })
        }
    }, [highlights, content])

    // Click handler delegation
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        function handleClick(e: Event) {
            const target = e.target
            if (!(target instanceof HTMLElement)) return

            const mark = target.closest("mark[data-rebar-hl]") as HTMLElement | null
            if (!mark) return

            const highlightId = mark.getAttribute("data-rebar-hl")
            if (highlightId) {
                onHighlightClickRef.current?.(highlightId)
            }
        }

        container.addEventListener("click", handleClick)
        return () => container.removeEventListener("click", handleClick)
    }, [content])

    if (!hasMarkdown) {
        return (
            <div ref={containerRef} className={`whitespace-pre-wrap ${className}`}>
                {content}
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className={`
        prose prose-neutral dark:prose-invert max-w-none
        prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight
        prose-headings:border-b-2 prose-headings:border-foreground/20 prose-headings:pb-1
        prose-a:text-accent prose-a:font-bold prose-a:no-underline hover:prose-a:underline
        prose-strong:text-foreground prose-strong:font-black
        prose-code:font-mono prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:border prose-code:border-border prose-code:rounded-none
        prose-pre:bg-muted prose-pre:border-4 prose-pre:border-foreground prose-pre:rounded-none prose-pre:shadow-brutal-sm
        prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:bg-muted/30 prose-blockquote:not-italic
        prose-blockquote:text-foreground prose-blockquote:font-medium
        prose-img:border-4 prose-img:border-foreground prose-img:shadow-brutal-sm
        prose-hr:border-foreground prose-hr:border-2
        ${className}
      `}
        >
            <ReactMarkdown>{content}</ReactMarkdown>
        </div>
    )
}

// ─── Highlight text matching ───────────────────────────────────

function clearHighlightMarks(container: HTMLElement) {
    container.querySelectorAll("mark[data-rebar-hl]").forEach((el) => {
        const parent = el.parentNode
        if (!parent) return

        while (el.firstChild) {
            parent.insertBefore(el.firstChild, el)
        }

        parent.removeChild(el)
    })
}

function applyHighlightToContainer(container: HTMLElement, hl: Highlight) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
    const textNodes: Text[] = []

    let node: Node | null
    while ((node = walker.nextNode())) {
        textNodes.push(node as Text)
    }

    // Build a concatenated string of all text and find the anchor in it
    let fullText = ""
    const nodeRanges: { node: Text; start: number; end: number }[] = []
    for (const tn of textNodes) {
        const s = fullText.length
        fullText += tn.textContent || ""
        nodeRanges.push({ node: tn, start: s, end: fullText.length })
    }

    const anchorLower = hl.anchor.toLowerCase()
    const matchIdx = fullText.toLowerCase().indexOf(anchorLower)
    if (matchIdx < 0) return

    const matchEnd = matchIdx + hl.anchor.length

    // Find which text nodes overlap the match range
    for (const nr of nodeRanges) {
        if (nr.end <= matchIdx || nr.start >= matchEnd) continue

        const nodeText = nr.node.textContent
        if (!nodeText) continue

        const localStart = Math.max(0, matchIdx - nr.start)
        const localEnd = Math.min(nodeText.length, matchEnd - nr.start)
        if (localStart >= localEnd) continue

        const range = document.createRange()
        try {
            range.setStart(nr.node, localStart)
            range.setEnd(nr.node, localEnd)
        } catch {
            continue
        }

        const mark = document.createElement("mark")
        mark.setAttribute("data-rebar-hl", hl.id)
        mark.style.cssText = `
            background: rgba(250, 204, 21, 0.4);
            border-bottom: 3px solid #facc15;
            padding: 1px 0;
            cursor: pointer;
            transition: background 0.15s;
        `

        try {
            range.surroundContents(mark)
        } catch {
            continue
        }
    }
}
