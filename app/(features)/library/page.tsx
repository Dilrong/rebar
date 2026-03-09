"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { apiFetch } from "@/lib/client-http"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { EmptyState } from "@shared/ui/empty-state"
import { ErrorState } from "@shared/ui/error-state"
import { useDebouncedValue } from "@shared/hooks/use-debounced-value"
import { EXPORT_FORMATS, buildExportFilename, type ExportFormat } from "@feature-lib/export/formats"
import { getStateLabel } from "@/lib/i18n/state-label"
import { LibraryHeader } from "./_components/library-header"
import { LibraryFiltersToolbar } from "./_components/library-filters-toolbar"
import { LibrarySelectionToolbar } from "./_components/library-selection-toolbar"
import { LibraryTagManager } from "./_components/library-tag-manager"
import { LibraryRecordGrid } from "./_components/library-record-grid"
import { LibraryPagination } from "./_components/library-pagination"

import type { RecordRow, TagRow } from "@/lib/types"
import type { RecordKind } from "@/lib/schemas"

type RecordsResponse = {
  data: RecordRow[]
  total: number
  next_cursor?: string | null
}

type RecordCountsResponse = {
  inbox: number
  active: number
  pinned: number
  archived: number
}

type TagsResponse = {
  data: TagRow[]
}

type InboxDecisionPayload = {
  id: string
  decisionType: "ARCHIVE" | "ACT" | "DEFER"
  actionType?: "EXPERIMENT" | "SHARE" | "TODO"
  deferReason?: "NEED_INFO" | "LOW_CONFIDENCE" | "NO_TIME"
}

const STATE_TABS = ["INBOX", "ACTIVE", "PINNED", "ARCHIVED"] as const
type StateFilter = "ALL" | (typeof STATE_TABS)[number]

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

function toDateInputValue(date: Date) {
  const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return normalized.toISOString().slice(0, 10)
}

function getExportKindLabel(kind: RecordKind, t: (key: string, fallback?: string) => string) {
  if (kind === "quote") {
    return t("capture.kind.quote", "Quote / Highlight")
  }

  if (kind === "note") {
    return t("capture.kind.note", "Note")
  }

  if (kind === "link") {
    return t("capture.kind.link", "Web Link")
  }

  return t("capture.kind.ai", "AI Content")
}

export default function LibraryPage() {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [state, setState] = useState<StateFilter>("ALL")
  const [kind, setKind] = useState("")
  const [q, setQ] = useState("")
  const debouncedQ = useDebouncedValue(q, 220)
  const [tagId, setTagId] = useState("")
  const [newTagName, setNewTagName] = useState("")
  const [sort, setSort] = useState<"created_at" | "review_count" | "due_at">("created_at")
  const [order, setOrder] = useState<"asc" | "desc">("desc")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([])
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
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState("")
  const [didInitFromUrl, setDidInitFromUrl] = useState(false)
  const restoredScrollRef = useRef(false)

  useEffect(() => {
    const queryState = searchParams.get("state")
    const queryKind = searchParams.get("kind")
    const queryText = searchParams.get("q")
    const queryTag = searchParams.get("tag_id")
    const querySort = searchParams.get("sort")
    const queryOrder = searchParams.get("order")

    setState(
      queryState === "ALL" || queryState === "INBOX" || queryState === "ACTIVE" || queryState === "PINNED" || queryState === "ARCHIVED"
        ? queryState
        : "ALL"
    )

    setKind(queryKind === "quote" || queryKind === "note" || queryKind === "link" || queryKind === "ai" ? queryKind : "")
    setQ(queryText ?? "")
    setTagId(queryTag ?? "")
    setSort(querySort === "created_at" || querySort === "review_count" || querySort === "due_at" ? querySort : "created_at")
    setOrder(queryOrder === "asc" || queryOrder === "desc" ? queryOrder : "desc")
    setDidInitFromUrl(true)
  }, [searchParams])

  const currentParams = searchParams.toString()

  useEffect(() => {
    if (!didInitFromUrl) {
      return
    }

    const params = new URLSearchParams()
    if (state !== "ALL") {
      params.set("state", state)
    }
    if (kind) {
      params.set("kind", kind)
    }
    if (debouncedQ) {
      params.set("q", debouncedQ)
    }
    if (tagId) {
      params.set("tag_id", tagId)
    }
    params.set("sort", sort)
    params.set("order", order)

    const nextParams = params.toString()
    if (nextParams === currentParams) {
      return
    }

    const nextHref = nextParams ? `${pathname}?${nextParams}` : pathname
    router.replace(nextHref, { scroll: false })
  }, [currentParams, debouncedQ, didInitFromUrl, kind, order, pathname, router, sort, state, tagId])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (state !== "ALL") {
      params.set("state", state)
    }
    if (kind) {
      params.set("kind", kind)
    }
    if (debouncedQ) {
      params.set("q", debouncedQ)
    }
    if (tagId) {
      params.set("tag_id", tagId)
    }
    params.set("sort", sort)
    params.set("order", order)
    return params.toString()
  }, [debouncedQ, kind, order, sort, state, tagId])

  const prefetchRecord = useCallback((id: string) => {
    queryClient.prefetchQuery({
      queryKey: ["record-detail", id],
      queryFn: () => apiFetch<{ record: RecordRow }>(`/api/records/${id}`),
      staleTime: 1000 * 60 * 5
    })
  }, [queryClient])

  const records = useQuery({
    queryKey: ["records", queryString, sort, order],
    queryFn: async () => {
      const data = await apiFetch<RecordsResponse>(`/api/records?${queryString}`)
      setAllRecords(data.data)
      setCursor(data.next_cursor ?? null)
      return data
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: keepPreviousData
  })

  const libraryBackHref = queryString ? `/library?${queryString}` : "/library"
  const scrollStorageKey = useMemo(() => `library:scroll:${libraryBackHref}`, [libraryBackHref])
  const navigationStorageKey = useMemo(() => `library:navigation:${libraryBackHref}`, [libraryBackHref])
  const isTransitioning = records.isFetching && !records.isLoading && !loadMorePending

  const toRecordHref = useCallback((recordId: string) =>
    `/records/${recordId}?from=${encodeURIComponent(libraryBackHref)}`, [libraryBackHref])

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagsResponse>("/api/tags"),
    staleTime: 1000 * 60 * 10 // 10 minutes
  })

  const recordCounts = useQuery({
    queryKey: ["record-counts"],
    queryFn: () => apiFetch<RecordCountsResponse>("/api/records/counts"),
    staleTime: 1000 * 60 * 2
  })

  const selectedTagName = (tags.data?.data ?? []).find((tag) => tag.id === tagId)?.name ?? null
  const exportSincePresets = useMemo(() => {
    const now = new Date()
    const last7 = new Date(now)
    last7.setDate(last7.getDate() - 7)
    const last30 = new Date(now)
    last30.setDate(last30.getDate() - 30)

    return [
      { key: "library.exportPresetToday", fallback: "TODAY", value: toDateInputValue(now) },
      { key: "library.exportPreset7d", fallback: "LAST 7D", value: toDateInputValue(last7) },
      { key: "library.exportPreset30d", fallback: "LAST 30D", value: toDateInputValue(last30) }
    ]
  }, [])

  const exportScopeLabel = useMemo(() => {
    const parts: string[] = []

    if (state !== "ALL") {
      parts.push(getStateLabel(state, t))
    }

    if (kind) {
      parts.push(getExportKindLabel(kind as RecordKind, t))
    }

    if (selectedTagName) {
      parts.push(`#${selectedTagName}`)
    }

    if (exportSince) {
      parts.push(exportSince)
    }

    return parts.length > 0 ? parts.join(" · ") : t("library.exportScopeAll", "FULL LIBRARY (EXCLUDING TRASH)")
  }, [exportSince, kind, selectedTagName, state, t])

  const activate = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ record: RecordRow }>(`/api/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "ACTIVE" })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["record-counts"] })
    }
  })

  const inboxDecision = useMutation({
    mutationFn: ({ id, ...payload }: InboxDecisionPayload) =>
      apiFetch<{ record: RecordRow }>(`/api/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["record-counts"] })
      queryClient.invalidateQueries({ queryKey: ["review-stats"] })
      queryClient.invalidateQueries({ queryKey: ["review-today"] })
    }
  })

  const bulkStateMutation = useMutation({
    mutationFn: (payload: { ids: string[]; state: "ACTIVE" | "PINNED" | "ARCHIVED" | "TRASHED" }) =>
      apiFetch<{ updated: number; failed: number }>("/api/records/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["record-counts"] })
    }
  })

  const bulkTagMutation = useMutation({
    mutationFn: (payload: { ids: string[]; tag_ids: string[]; mode: "add" | "replace" }) =>
      apiFetch<{ processed: number }>("/api/records/bulk/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      setSelectedIds([])
      setBulkTagIds([])
      queryClient.invalidateQueries({ queryKey: ["records"] })
    }
  })

  const createTag = useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ tag: TagRow }>("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      }),
    onSuccess: () => {
      setNewTagName("")
      queryClient.invalidateQueries({ queryKey: ["tags"] })
    }
  })

  const renameTag = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch<{ tag: TagRow }>(`/api/tags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] })
  })

  const deleteTag = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: true }>(`/api/tags/${id}`, {
        method: "DELETE"
      }),
    onSuccess: (_data, id) => {
      if (tagId === id) {
        setTagId("")
      }
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      queryClient.invalidateQueries({ queryKey: ["records"] })
    }
  })

  const buildExportHref = (format: ExportFormat) => {
    const params = new URLSearchParams()
    params.set("format", format)
    if (state !== "ALL") {
      params.set("state", state)
    }
    if (kind) {
      params.set("kind", kind)
    }
    if (tagId) {
      params.set("tag_id", tagId)
    }
    if (exportSince) {
      params.set("since", exportSince)
    }
    return `/api/export?${params.toString()}`
  }

  const handleExport = async (format: ExportFormat) => {
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
        } catch { }
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
  }

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
    } catch { }
    finally {
      setLoadMorePending(false)
    }
  }, [cursor, loadMorePending, queryString])

  const handleRenameTag = (tag: TagRow) => {
    setEditingTagId(tag.id)
    setEditingTagName(tag.name)
  }

  const submitRenameTag = (id: string) => {
    const trimmed = editingTagName.trim()
    setEditingTagId(null)
    if (!trimmed) return
    renameTag.mutate({ id, name: trimmed })
  }

  const clearAllFilters = () => {
    setQ("")
    setKind("")
    setTagId("")
    setState("ALL")
  }

  const handleActivate = useCallback((id: string) => activate.mutate(id), [activate])
  const handleInboxTodo = useCallback((id: string) => inboxDecision.mutate({ id, decisionType: "ACT", actionType: "TODO" }), [inboxDecision])
  const handleInboxArchive = useCallback((id: string) => inboxDecision.mutate({ id, decisionType: "ARCHIVE" }), [inboxDecision])
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

  const visibleIds = (records.data?.data ?? []).map((record) => record.id)
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }, [])

  const selectVisible = () => {
    setSelectedIds(visibleIds)
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const applyBulkState = (nextState: "ACTIVE" | "PINNED" | "ARCHIVED" | "TRASHED") => {
    if (selectedIds.length === 0) {
      return
    }
    bulkStateMutation.mutate({ ids: selectedIds, state: nextState })
  }

  const applyBulkTags = (mode: "add" | "replace") => {
    if (selectedIds.length === 0 || bulkTagIds.length === 0) {
      return
    }
    bulkTagMutation.mutate({ ids: selectedIds, tag_ids: bulkTagIds, mode })
  }

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
        setExportMenuOpen(false)
        exportTriggerRef.current?.focus()
      }
    }

    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [exportMenuOpen])

  useEffect(() => {
    if (!exportMenuOpen) {
      return
    }

    exportItemRefs.current[exportMenuIndex]?.focus()
  }, [exportMenuIndex, exportMenuOpen])

  const closeExportMenu = () => {
    setExportMenuOpen(false)
    setExportMenuIndex(0)
    exportTriggerRef.current?.focus()
  }

  const handleExportMenuKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!exportMenuOpen) {
      return
    }

    const exportMenuLength = EXPORT_FORMATS.length

    if (event.key === "Escape") {
      event.preventDefault()
      closeExportMenu()
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setExportMenuIndex((idx) => (idx + 1) % exportMenuLength)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setExportMenuIndex((idx) => (idx <= 0 ? exportMenuLength - 1 : idx - 1))
      return
    }

    if (event.key === "Tab") {
      event.preventDefault()
      setExportMenuIndex((idx) => (event.shiftKey ? (idx <= 0 ? exportMenuLength - 1 : idx - 1) : (idx + 1) % exportMenuLength))
    }
  }

  const toggleExportMenu = () => {
    setExportMenuOpen((value) => !value)
    setExportMenuIndex(0)
  }

  const openExportMenuFromKeyboard = () => {
    setExportMenuOpen(true)
    setExportMenuIndex(0)
  }

  useEffect(() => {
    restoredScrollRef.current = false
  }, [scrollStorageKey])

  useEffect(() => {
    if (!didInitFromUrl || !records.isSuccess || restoredScrollRef.current) {
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
  }, [allRecords.length, didInitFromUrl, records.isSuccess, scrollStorageKey])

  const emptyState = useMemo(() => {
    if (q.trim()) {
      return {
        title: t("library.emptySearch", "NO SEARCH RESULTS"),
        description: `'${q.trim()}'에 대한 결과가 없습니다`,
        actionLabel: t("library.clearAll", "Clear all"),
        actionHref: "/library"
      }
    }

    if (state === "INBOX" && !kind && !tagId) {
      return {
        title: t("library.emptyInbox", "INBOX IS EMPTY"),
        description: "수집함이 비었습니다 → 캡처로 새 항목 추가",
        actionLabel: t("library.goCapture", "Go capture"),
        actionHref: "/capture"
      }
    }

    if (state === "ACTIVE" && !kind && !tagId) {
      return {
        title: t("library.emptyActive", "NO ACTIVE ITEMS"),
        description: "활성 항목이 없습니다 → 리뷰에서 항목을 활성화하세요",
        actionLabel: t("nav.review", "Review"),
        actionHref: "/review"
      }
    }

    return {
      title: t("library.noResults", "0 RESULTS FOUND."),
      actionLabel: t("library.goCapture", "Go capture"),
      actionHref: "/capture"
    }
  }, [kind, q, state, t, tagId])

  return (
    <div className="min-h-screen bg-background p-4 font-sans selection:bg-accent selection:text-white md:p-6">
      <AuthGate>
        <main className="mx-auto w-full max-w-5xl animate-fade-in-up pb-24">
          <AppNav />

          <LibraryHeader
            t={t}
            totalRows={records.data?.total || 0}
            exportSince={exportSince}
            exportScopeLabel={exportScopeLabel}
            exportSincePresets={exportSincePresets}
            exportMenuOpen={exportMenuOpen}
            exportPending={exportPending}
            exportMenuWrapRef={exportMenuWrapRef}
            exportTriggerRef={exportTriggerRef}
            exportItemRefs={exportItemRefs}
            onExportSinceChange={(value) => {
              setExportSince(value)
              setExportError(null)
            }}
            onClearExportSince={() => {
              setExportSince("")
              setExportError(null)
            }}
            onToggleMenu={toggleExportMenu}
            onOpenMenuFromKeyboard={openExportMenuFromKeyboard}
            onCloseMenu={closeExportMenu}
            onExport={handleExport}
            onMenuItemKeyDown={handleExportMenuKeyDown}
          />

          <LibraryFiltersToolbar
            t={t}
            state={state}
            stateCounts={{
              INBOX: recordCounts.data?.inbox ?? 0,
              ACTIVE: recordCounts.data?.active ?? 0,
              PINNED: recordCounts.data?.pinned ?? 0,
              ARCHIVED: recordCounts.data?.archived ?? 0
            }}
            kind={kind}
            q={q}
            tagId={tagId}
            sort={sort}
            order={order}
            selectedTagName={selectedTagName}
            tags={tags.data?.data ?? []}
            onStateChange={setState}
            onKindChange={setKind}
            onQueryChange={setQ}
            onTagChange={setTagId}
            onSortOrderChange={(nextSort, nextOrder) => {
              setSort(nextSort)
              setOrder(nextOrder)
            }}
            onClearAllFilters={clearAllFilters}
          />

          {state === "INBOX" ? (
            <section className="mb-6 border-4 border-foreground bg-card p-4">
              <p className="font-mono text-xs font-bold uppercase text-foreground">{t("library.inboxFlow", "INBOX QUICK LOOP")}</p>
              <p className="mt-2 font-mono text-[10px] font-bold uppercase text-muted-foreground">
                {t("library.inboxFlowHint", "카드에서 바로 활성화/할일/보관 처리")}
              </p>
            </section>
          ) : null}

          <LibrarySelectionToolbar
            t={t}
            selectedCount={selectedIds.length}
            tags={tags.data?.data ?? []}
            bulkTagId={bulkTagIds[0] ?? ""}
            onSelectVisible={selectVisible}
            onClearSelection={clearSelection}
            onApplyBulkState={applyBulkState}
            onBulkTagIdChange={(tagIdValue) => setBulkTagIds(tagIdValue ? [tagIdValue] : [])}
            onApplyBulkTags={applyBulkTags}
          />

          <LibraryTagManager
            t={t}
            tags={tags.data?.data ?? []}
            newTagName={newTagName}
            editingTagId={editingTagId}
            editingTagName={editingTagName}
            createPending={createTag.isPending}
            createError={createTag.error?.message ?? null}
            renameError={renameTag.error?.message ?? null}
            deleteError={deleteTag.error?.message ?? null}
            onNewTagNameChange={setNewTagName}
            onCreateTag={() => createTag.mutate(newTagName.trim())}
            onStartRenameTag={handleRenameTag}
            onEditingTagNameChange={setEditingTagName}
            onSubmitRenameTag={submitRenameTag}
            onCancelRenameTag={() => setEditingTagId(null)}
            onDeleteTag={(id) => deleteTag.mutate(id)}
          />

          {records.isFetching ? (
            <p className="mb-4 font-mono text-[10px] font-bold uppercase text-muted-foreground">
              {t("library.searching", "UPDATING RESULTS...")}
            </p>
          ) : null}

          <LibraryRecordGrid
            t={t}
            isLoading={records.isLoading}
            isUpdating={isTransitioning}
            records={allRecords}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelect}
            onPrefetch={prefetchRecord}
            toRecordHref={toRecordHref}
            onOpenRecord={handleOpenRecord}
            activatePendingRecordId={activate.isPending ? activate.variables ?? null : null}
            inboxPending={inboxDecision.isPending}
            inboxPendingRecordId={inboxDecision.variables?.id ?? null}
            inboxPendingDecisionType={inboxDecision.variables?.decisionType ?? null}
            onActivate={handleActivate}
            onInboxTodo={handleInboxTodo}
            onInboxArchive={handleInboxArchive}
          />

          <LibraryPagination
            t={t}
            hasNext={Boolean(cursor)}
            isLoadingMore={loadMorePending}
            onLoadMore={loadMore}
          />

          {records.isSuccess && !records.isLoading && allRecords.length === 0 ? (
            <EmptyState
              title={emptyState.title}
              description={emptyState.description}
              actionLabel={emptyState.actionLabel}
              actionHref={emptyState.actionHref}
            />
          ) : null}

          {records.error ? <ErrorState message={records.error.message} onRetry={() => records.refetch()} /> : null}
          {inboxDecision.error ? <ErrorState message={inboxDecision.error.message} onRetry={() => inboxDecision.reset()} /> : null}
          {exportError ? (
            <ErrorState message={`${t("library.exportError", "EXPORT ERR")}: ${exportError}`} />
          ) : null}
        </main>
      </AuthGate>
    </div>
  )
}
