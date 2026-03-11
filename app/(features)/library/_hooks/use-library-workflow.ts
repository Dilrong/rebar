import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { apiFetch } from "@/lib/client-http"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { buildExportFilename, type ExportFormat } from "@feature-lib/export/formats"
import type { RecordRow } from "@/lib/types"

type RecordsResponse = {
  data: RecordRow[]
  total: number
  next_cursor?: string | null
}

type UseLibraryWorkflowOptions = {
  queryString: string
  didInitFromUrl: boolean
}

function getFilenameFromDisposition(disposition: string | null) {
  if (!disposition) {
    return null
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const quotedMatch = disposition.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) {
    return quotedMatch[1]
  }

  const bareMatch = disposition.match(/filename=([^;]+)/i)
  return bareMatch?.[1]?.trim() ?? null
}

export function useLibraryWorkflow({ queryString, didInitFromUrl }: UseLibraryWorkflowOptions) {
  const [exportSince, setExportSince] = useState("")
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportMenuIndex, setExportMenuIndex] = useState(0)
  const exportMenuWrapRef = useRef<HTMLDivElement | null>(null)
  const exportTriggerRef = useRef<HTMLButtonElement | null>(null)
  const exportItemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [exportPending, setExportPending] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadMorePending, setLoadMorePending] = useState(false)
  const [allRecords, setAllRecords] = useState<RecordRow[]>([])
  const restoredScrollRef = useRef(false)

  const libraryBackHref = queryString ? `/library?${queryString}` : "/library"
  const scrollStorageKey = useMemo(() => `library:scroll:${libraryBackHref}`, [libraryBackHref])
  const navigationStorageKey = useMemo(() => `library:navigation:${libraryBackHref}`, [libraryBackHref])

  const buildExportHref = useCallback((format: ExportFormat) => {
    const params = new URLSearchParams(queryString)
    params.set("format", format)
    if (exportSince) {
      params.set("since", exportSince)
    }
    return `/api/export?${params.toString()}`
  }, [exportSince, queryString])

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportPending(true)
    setExportError(null)

    try {
      const headers = new Headers()
      const supabase = getSupabaseBrowser()
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (session?.access_token) {
        headers.set("Authorization", `Bearer ${session.access_token}`)
      }

      const devUserId = process.env.NEXT_PUBLIC_DEV_USER_ID
      if (devUserId && !headers.has("Authorization")) {
        headers.set("x-user-id", devUserId)
      }

      const response = await fetch(buildExportHref(format), { headers })
      if (!response.ok) {
        let message = "Export failed"
        try {
          const data = (await response.json()) as { error?: string }
          if (data.error) {
            message = data.error
          }
        } catch {}
        throw new Error(message)
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      const today = new Date().toISOString().slice(0, 10)
      const filename =
        getFilenameFromDisposition(response.headers.get("Content-Disposition")) ??
        buildExportFilename(format, today, exportSince || null)
      anchor.href = downloadUrl
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed")
    } finally {
      setExportPending(false)
    }
  }, [buildExportHref, exportSince])

  const loadMore = useCallback(async () => {
    if (!cursor || loadMorePending) {
      return
    }

    const params = new URLSearchParams(queryString)
    params.set("cursor", cursor)
    setLoadMorePending(true)
    try {
      const data = await apiFetch<RecordsResponse>(`/api/records?${params.toString()}`)
      setAllRecords((prev) => {
        const seen = new Set(prev.map((record) => record.id))
        const nextRows = data.data.filter((record) => !seen.has(record.id))
        return [...prev, ...nextRows]
      })
      setCursor(data.next_cursor ?? null)
    } finally {
      setLoadMorePending(false)
    }
  }, [cursor, loadMorePending, queryString])

  const handleOpenRecord = useCallback((recordId: string) => {
    if (typeof window === "undefined") {
      return
    }

    window.sessionStorage.setItem(scrollStorageKey, String(window.scrollY))
    window.sessionStorage.setItem(
      navigationStorageKey,
      JSON.stringify({ ids: allRecords.map((record) => record.id), currentId: recordId })
    )
  }, [allRecords, navigationStorageKey, scrollStorageKey])

  const closeExportMenu = useCallback(() => {
    setExportMenuOpen(false)
    setExportMenuIndex(0)
    exportTriggerRef.current?.focus()
  }, [])

  const handleExportMenuKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>, optionCount: number) => {
    if (!exportMenuOpen) {
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      closeExportMenu()
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setExportMenuIndex((idx) => (idx + 1) % optionCount)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setExportMenuIndex((idx) => (idx <= 0 ? optionCount - 1 : idx - 1))
      return
    }

    if (event.key === "Tab") {
      event.preventDefault()
      setExportMenuIndex((idx) => (event.shiftKey ? (idx <= 0 ? optionCount - 1 : idx - 1) : (idx + 1) % optionCount))
    }
  }, [closeExportMenu, exportMenuOpen])

  const toggleExportMenu = useCallback(() => {
    setExportMenuOpen((value) => !value)
    setExportMenuIndex(0)
  }, [])

  const openExportMenuFromKeyboard = useCallback(() => {
    setExportMenuOpen(true)
    setExportMenuIndex(0)
  }, [])

  useEffect(() => {
    if (!exportMenuOpen) {
      return
    }

    const handleOutside = (event: MouseEvent) => {
      const wrap = exportMenuWrapRef.current
      if (!wrap) {
        return
      }

      if (!wrap.contains(event.target as Node)) {
        closeExportMenu()
      }
    }

    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [closeExportMenu, exportMenuOpen])

  useEffect(() => {
    if (!exportMenuOpen) {
      return
    }

    exportItemRefs.current[exportMenuIndex]?.focus()
  }, [exportMenuIndex, exportMenuOpen])

  useEffect(() => {
    restoredScrollRef.current = false
  }, [scrollStorageKey])

  const restoreLibraryScroll = useCallback((ready: boolean) => {
    if (!didInitFromUrl || !ready || restoredScrollRef.current) {
      return
    }

    if (typeof window === "undefined") {
      return
    }

    const raw = window.sessionStorage.getItem(scrollStorageKey)
    restoredScrollRef.current = true
    if (raw === null) {
      return
    }

    const top = Number(raw)
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: Number.isFinite(top) ? top : 0 })
      window.sessionStorage.removeItem(scrollStorageKey)
    })
  }, [didInitFromUrl, scrollStorageKey])

  return {
    exportSince,
    setExportSince,
    exportMenuOpen,
    exportMenuIndex,
    exportMenuWrapRef,
    exportTriggerRef,
    exportItemRefs,
    exportPending,
    exportError,
    setExportError,
    cursor,
    setCursor,
    loadMorePending,
    allRecords,
    setAllRecords,
    libraryBackHref,
    navigationStorageKey,
    scrollStorageKey,
    handleExport,
    loadMore,
    handleOpenRecord,
    closeExportMenu,
    handleExportMenuKeyDown,
    toggleExportMenu,
    openExportMenuFromKeyboard,
    restoreLibraryScroll
  }
}
