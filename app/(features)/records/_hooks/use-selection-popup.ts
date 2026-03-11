import { useCallback, useEffect, useRef, useState } from "react"

export type SelectionPopup = {
  x: number
  y: number
  text: string
  anchor: string
} | null

type UseSelectionPopupOptions = {
  disabled?: boolean
  maxChars?: number
}

const DEFAULT_MAX_CHARS = 500

export function useSelectionPopup({ disabled = false, maxChars = DEFAULT_MAX_CHARS }: UseSelectionPopupOptions) {
  const articleRef = useRef<HTMLDivElement>(null)
  const [selectionPopup, setSelectionPopup] = useState<SelectionPopup>(null)

  const handleTextSelect = useCallback(() => {
    if (disabled) {
      return
    }

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !articleRef.current) {
      setSelectionPopup(null)
      return
    }

    const text = selection.toString().trim()
    if (text.length < 3 || text.length > maxChars) {
      setSelectionPopup(null)
      return
    }

    let range: Range
    try {
      range = selection.getRangeAt(0)
    } catch {
      setSelectionPopup(null)
      return
    }

    if (!articleRef.current.contains(range.commonAncestorContainer)) {
      setSelectionPopup(null)
      return
    }

    const rect = range.getBoundingClientRect()
    setSelectionPopup({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      text,
      anchor: text
    })
  }, [articleRef, disabled, maxChars])

  useEffect(() => {
    document.addEventListener("mouseup", handleTextSelect)
    document.addEventListener("touchend", handleTextSelect)
    return () => {
      document.removeEventListener("mouseup", handleTextSelect)
      document.removeEventListener("touchend", handleTextSelect)
    }
  }, [handleTextSelect])

  return {
    articleRef,
    selectionPopup,
    setSelectionPopup,
    clearSelectionPopup: () => setSelectionPopup(null)
  }
}
