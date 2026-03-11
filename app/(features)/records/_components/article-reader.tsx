"use client"

import type { ReactNode } from "react"
import { useMemo } from "react"

type ArticleHighlightAnchor = {
  v: 1
  text: string
  paragraphIndex: number
  startOffset: number
  endOffset: number
}

type ArticleReaderSelection = {
  text: string
  anchor: string
  x: number
  y: number
}

type Highlight = {
  id: string
  anchor: string
}

type ArticleReaderProps = {
  content: string
  highlights: Highlight[]
  onHighlightClick?: (id: string) => void
  onSelectionChange?: (selection: ArticleReaderSelection | null) => void
}

type HighlightSegment = {
  id: string
  startOffset: number
  endOffset: number
}

function splitParagraphs(content: string) {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}

function parseArticleHighlightAnchor(anchor: string): ArticleHighlightAnchor | null {
  try {
    const parsed = JSON.parse(anchor) as Partial<ArticleHighlightAnchor>
    if (
      parsed.v !== 1 ||
      typeof parsed.text !== "string" ||
      typeof parsed.paragraphIndex !== "number" ||
      typeof parsed.startOffset !== "number" ||
      typeof parsed.endOffset !== "number"
    ) {
      return null
    }

    if (parsed.startOffset < 0 || parsed.endOffset <= parsed.startOffset) {
      return null
    }

    return parsed as ArticleHighlightAnchor
  } catch {
    return null
  }
}

function buildHighlightSegments(paragraphs: string[], highlights: Highlight[]) {
  const segmentsByParagraph = new Map<number, HighlightSegment[]>()

  for (const highlight of highlights) {
    const parsed = parseArticleHighlightAnchor(highlight.anchor)
    if (!parsed) {
      continue
    }

    const paragraph = paragraphs[parsed.paragraphIndex]
    if (!paragraph) {
      continue
    }

    if (parsed.endOffset > paragraph.length) {
      continue
    }

    if (paragraph.slice(parsed.startOffset, parsed.endOffset) !== parsed.text) {
      continue
    }

    const current = segmentsByParagraph.get(parsed.paragraphIndex) ?? []
    current.push({ id: highlight.id, startOffset: parsed.startOffset, endOffset: parsed.endOffset })
    segmentsByParagraph.set(parsed.paragraphIndex, current)
  }

  for (const [paragraphIndex, segments] of segmentsByParagraph) {
    segments.sort((left, right) => left.startOffset - right.startOffset)
    const nonOverlapping: HighlightSegment[] = []
    let currentEnd = -1

    for (const segment of segments) {
      if (segment.startOffset < currentEnd) {
        continue
      }

      nonOverlapping.push(segment)
      currentEnd = segment.endOffset
    }

    segmentsByParagraph.set(paragraphIndex, nonOverlapping)
  }

  return segmentsByParagraph
}

function renderParagraph(paragraph: string, segments: HighlightSegment[], onHighlightClick?: (id: string) => void) {
  if (segments.length === 0) {
    return paragraph
  }

  const parts: ReactNode[] = []
  let cursor = 0

  for (const segment of segments) {
    if (cursor < segment.startOffset) {
      parts.push(paragraph.slice(cursor, segment.startOffset))
    }

    parts.push(
      <mark
        key={`${segment.id}:${segment.startOffset}:${segment.endOffset}`}
        data-rebar-hl={segment.id}
        onClick={() => onHighlightClick?.(segment.id)}
        className="cursor-pointer bg-yellow-300/60 px-[1px] text-inherit shadow-[inset_0_-2px_0_0_#facc15] transition-colors hover:bg-yellow-300/80"
      >
        {paragraph.slice(segment.startOffset, segment.endOffset)}
      </mark>
    )

    cursor = segment.endOffset
  }

  if (cursor < paragraph.length) {
    parts.push(paragraph.slice(cursor))
  }

  return parts
}

export function ArticleReader({ content, highlights, onHighlightClick, onSelectionChange }: ArticleReaderProps) {
  const paragraphs = useMemo(() => splitParagraphs(content), [content])
  const segmentsByParagraph = useMemo(() => buildHighlightSegments(paragraphs, highlights), [paragraphs, highlights])

  const handlePointerUp = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      onSelectionChange?.(null)
      return
    }

    const text = selection.toString().trim()
    if (text.length < 3) {
      onSelectionChange?.(null)
      return
    }

    let range: Range
    try {
      range = selection.getRangeAt(0)
    } catch {
      onSelectionChange?.(null)
      return
    }

    const startElement = range.startContainer.parentElement?.closest("[data-paragraph-index]")
    const endElement = range.endContainer.parentElement?.closest("[data-paragraph-index]")
    if (!(startElement instanceof HTMLElement) || startElement !== endElement) {
      onSelectionChange?.(null)
      return
    }

    const paragraphIndex = Number(startElement.dataset.paragraphIndex)
    const paragraph = paragraphs[paragraphIndex]
    if (!paragraph || Number.isNaN(paragraphIndex)) {
      onSelectionChange?.(null)
      return
    }

    const paragraphText = startElement.textContent ?? ""
    const startPrefix = document.createRange()
    startPrefix.selectNodeContents(startElement)
    startPrefix.setEnd(range.startContainer, range.startOffset)

    const endPrefix = document.createRange()
    endPrefix.selectNodeContents(startElement)
    endPrefix.setEnd(range.endContainer, range.endOffset)

    const startOffset = startPrefix.toString().length
    const endOffset = endPrefix.toString().length
    if (startOffset < 0 || endOffset <= startOffset || endOffset > paragraphText.length) {
      onSelectionChange?.(null)
      return
    }

    const selectedText = paragraphText.slice(startOffset, endOffset)
    if (selectedText !== text) {
      onSelectionChange?.(null)
      return
    }

    const rect = range.getBoundingClientRect()
    onSelectionChange?.({
      text,
      anchor: JSON.stringify({ v: 1, text, paragraphIndex, startOffset, endOffset } satisfies ArticleHighlightAnchor),
      x: rect.left + rect.width / 2,
      y: rect.top - 8
    })
  }

  return (
    <div className="space-y-5 text-[clamp(1.05rem,1rem+0.45vw,1.35rem)] leading-[1.75] text-foreground" onMouseUp={handlePointerUp} onTouchEnd={handlePointerUp}>
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p
          key={`${paragraphIndex}:${paragraph.slice(0, 24)}`}
          data-paragraph-index={paragraphIndex}
          className="mx-auto max-w-[72ch] text-balance whitespace-pre-wrap font-serif"
        >
          {renderParagraph(paragraph, segmentsByParagraph.get(paragraphIndex) ?? [], onHighlightClick)}
        </p>
      ))}
    </div>
  )
}
