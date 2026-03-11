"use client"

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import AuthGate from "@shared/auth/auth-gate"
import ProtectedPageShell from "@shared/layout/protected-page-shell"
import { apiFetch } from "@/lib/client-http"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { EmptyState } from "@shared/ui/empty-state"
import { ErrorState } from "@shared/ui/error-state"
import { EXPORT_FORMATS } from "@feature-lib/export/formats"
import { getStateLabel } from "@/lib/i18n/state-label"
import { LibraryHeader } from "./_components/library-header"
import { LibraryFiltersToolbar } from "./_components/library-filters-toolbar"
import { LibrarySelectionToolbar } from "./_components/library-selection-toolbar"
import { LibraryTagManager } from "./_components/library-tag-manager"
import { LibraryRecordGrid } from "./_components/library-record-grid"
import { LibraryPagination } from "./_components/library-pagination"
import { useLibraryActions } from "./_hooks/use-library-actions"
import { useLibraryFilters } from "./_hooks/use-library-filters"
import { useLibraryWorkflow } from "./_hooks/use-library-workflow"

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
  const queryClient = useQueryClient()
  const { didInitFromUrl, state, setState, kind, setKind, q, setQ, debouncedQ, tagId, setTagId, sort, setSort, order, setOrder, queryString, clearAllFilters } = useLibraryFilters()
  const [newTagName, setNewTagName] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([])
  const [exportSince, setExportSince] = useState("")
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState("")
  const { exportMenuOpen, exportMenuIndex, exportMenuWrapRef, exportTriggerRef, exportItemRefs, exportPending, exportError, setExportError, cursor, setCursor, loadMorePending, allRecords, setAllRecords, libraryBackHref, navigationStorageKey, handleExport, loadMore, handleOpenRecord, closeExportMenu, handleExportMenuKeyDown: handleExportMenuKeyDownRaw, toggleExportMenu, openExportMenuFromKeyboard, restoreLibraryScroll } = useLibraryWorkflow({
    queryString,
    exportSince,
    didInitFromUrl
  })

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
    restoreLibraryScroll(records.isSuccess)
  }, [records.isSuccess, restoreLibraryScroll, allRecords.length])

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

  const handleExportMenuKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
    handleExportMenuKeyDownRaw(event, EXPORT_FORMATS.length)
  }, [handleExportMenuKeyDownRaw])

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
