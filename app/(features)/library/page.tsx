"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import AuthGate from "@shared/auth/auth-gate"
import ProtectedPageShell from "@shared/layout/protected-page-shell"
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
import { useLibraryActions } from "./_hooks/use-library-actions"
import { useLibraryFilters, type StateFilter } from "./_hooks/use-library-filters"

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
  const queryClient = useQueryClient()
  const { didInitFromUrl, state, setState, kind, setKind, q, setQ, debouncedQ, tagId, setTagId, sort, setSort, order, setOrder, queryString, clearAllFilters } = useLibraryFilters()
  const [newTagName, setNewTagName] = useState("")
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
  const restoredScrollRef = useRef(false)

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

  const { activate, inboxDecision, bulkStateMutation, bulkTagMutation, createTag, renameTag, deleteTag, handleActivate, handleInboxTodo, handleInboxArchive, applyBulkState, applyBulkTags } = useLibraryActions({
    queryClient,
    tagId,
    setTagId,
    selectedIds,
    setSelectedIds,
    bulkTagIds,
    setBulkTagIds
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
    <AuthGate>
      <ProtectedPageShell rootClassName="selection:bg-accent selection:text-white md:p-6" mainClassName="max-w-5xl pb-24">

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
      </ProtectedPageShell>
    </AuthGate>
  )
}
