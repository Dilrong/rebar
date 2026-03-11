import { useEffect, useState, type RefObject } from "react"

type SearchRow = {
  id: string
}

type UseSearchKeyboardNavigationOptions = {
  rows: SearchRow[]
  inputRef: RefObject<HTMLInputElement | null>
  showFilters: boolean
  router: { push: (href: string) => void }
  toRecordHref: (id: string) => string
}

export function useSearchKeyboardNavigation({ rows, inputRef, showFilters, router, toRecordHref }: UseSearchKeyboardNavigationOptions) {
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    if (rows.length === 0) {
      setActiveIndex(-1)
      return
    }

    setActiveIndex((current) => {
      if (current < 0) {
        return 0
      }

      return Math.min(current, rows.length - 1)
    })
  }, [rows.length])

  useEffect(() => {
    if (showFilters) {
      inputRef.current?.focus()
    }
  }, [inputRef, showFilters])

  useEffect(() => {
    if (rows.length === 0) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && target.tagName === "SELECT") {
        return
      }

      if (target && target.tagName === "INPUT" && target.id !== "search-query") {
        return
      }

      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActiveIndex((current) => (current + 1) % rows.length)
        return
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        setActiveIndex((current) => (current <= 0 ? rows.length - 1 : current - 1))
        return
      }

      if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault()
        router.push(toRecordHref(rows[activeIndex]!.id))
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeIndex, router, rows, toRecordHref])

  return {
    activeIndex,
    setActiveIndex
  }
}
