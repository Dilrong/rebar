import { useEffect, useState } from "react"

export type RecordPanelKey = "manage" | "tags" | "history"

export function useRecordPanels() {
  const [isDesktopViewport, setIsDesktopViewport] = useState(false)
  const [desktopPanel, setDesktopPanel] = useState<RecordPanelKey | null>(null)
  const [mobilePanel, setMobilePanel] = useState<RecordPanelKey | null>(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)")
    setIsDesktopViewport(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktopViewport(event.matches)
      if (event.matches) {
        setMobilePanel(null)
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  const togglePanel = (panel: RecordPanelKey) => {
    if (isDesktopViewport) {
      setDesktopPanel((current) => (current === panel ? null : panel))
      return
    }

    setMobilePanel(panel)
  }

  return {
    isDesktopViewport,
    desktopPanel,
    mobilePanel,
    togglePanel,
    closeMobilePanel: () => setMobilePanel(null)
  }
}
