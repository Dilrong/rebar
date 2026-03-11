import { useCallback, useEffect, useState } from "react"

type UseRecordNavigationOptions = {
  id: string
  backHref: string | null
  router: {
    push: (href: string) => void
    back: () => void
  }
}

export function useRecordNavigation({ id, backHref, router }: UseRecordNavigationOptions) {
  const [libraryContextIds, setLibraryContextIds] = useState<string[]>([])

  useEffect(() => {
    if (typeof window === "undefined" || !backHref?.startsWith("/library")) {
      setLibraryContextIds([])
      return
    }

    const raw = window.sessionStorage.getItem(`library:navigation:${backHref}`)
    if (!raw) {
      setLibraryContextIds([])
      return
    }

    try {
      const parsed = JSON.parse(raw) as { ids?: string[] }
      setLibraryContextIds(Array.isArray(parsed.ids) ? parsed.ids : [])
    } catch {
      setLibraryContextIds([])
    }
  }, [backHref])

  const goBack = useCallback(() => {
    if (backHref) {
      router.push(backHref)
      return
    }

    router.back()
  }, [backHref, router])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === "escape") {
        event.preventDefault()
        goBack()
        return
      }

      if (!backHref?.startsWith("/library")) {
        return
      }

      const currentIndex = libraryContextIds.indexOf(id)
      if (currentIndex < 0) {
        return
      }

      if (key === "j" && currentIndex < libraryContextIds.length - 1) {
        event.preventDefault()
        router.push(`/records/${libraryContextIds[currentIndex + 1]}?from=${encodeURIComponent(backHref)}`)
      }

      if (key === "k" && currentIndex > 0) {
        event.preventDefault()
        router.push(`/records/${libraryContextIds[currentIndex - 1]}?from=${encodeURIComponent(backHref)}`)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [backHref, goBack, id, libraryContextIds, router])

  return {
    libraryContextIds,
    goBack
  }
}
