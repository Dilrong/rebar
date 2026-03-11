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
import { LibraryHeader } from "./_components/library-header"
import { LibraryFiltersToolbar } from "./_components/library-filters-toolbar"
import { LibrarySelectionToolbar } from "./_components/library-selection-toolbar"
import { LibraryTagManager } from "./_components/library-tag-manager"
import { LibraryRecordGrid } from "./_components/library-record-grid"
import { LibraryPagination } from "./_components/library-pagination"
import { useLibraryActions } from "./_hooks/use-library-actions"
import { useLibraryDerivedState } from "./_hooks/use-library-derived-state"
import { useLibraryFilters } from "./_hooks/use-library-filters"
import { useLibrarySelection } from "./_hooks/use-library-selection"
import { useLibraryTagEditor } from "./_hooks/use-library-tag-editor"
import { useLibraryWorkflow } from "./_hooks/use-library-workflow"

import type { RecordRow, TagRow } from "@/lib/types"
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

export default function LibraryPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const { didInitFromUrl, state, setState, kind, setKind, q, setQ, debouncedQ, tagId, setTagId, sort, setSort, order, setOrder, queryString, clearAllFilters } = useLibraryFilters()
  const { exportSince, setExportSince, exportMenuOpen, exportMenuIndex, exportMenuWrapRef, exportTriggerRef, exportItemRefs, exportPending, exportError, setExportError, cursor, setCursor, loadMorePending, allRecords, setAllRecords, libraryBackHref, navigationStorageKey, handleExport, loadMore, handleOpenRecord, closeExportMenu, handleExportMenuKeyDown: handleExportMenuKeyDownRaw, toggleExportMenu, openExportMenuFromKeyboard, restoreLibraryScroll } = useLibraryWorkflow({ queryString, didInitFromUrl })

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

  const { selectedIds, setSelectedIds, bulkTagIds, setBulkTagIds, visibleIds, toggleSelect, selectVisible, clearSelection } = useLibrarySelection(records.data?.data ?? [])
  const { selectedTagName, exportSincePresets, exportScopeLabel, emptyState } = useLibraryDerivedState({
    tags: tags.data?.data ?? [],
    tagId,
    state,
    kind,
    exportSince,
    q,
    t
  })

  const { activate, inboxDecision, bulkStateMutation, bulkTagMutation, createTag, renameTag, deleteTag, handleActivate, handleInboxTodo, handleInboxArchive, applyBulkState, applyBulkTags } = useLibraryActions({
    queryClient,
    tagId,
    setTagId,
    selectedIds,
    setSelectedIds,
    bulkTagIds,
    setBulkTagIds
  })
  const { newTagName, setNewTagName, editingTagId, editingTagName, setEditingTagName, handleRenameTag, submitRenameTag, cancelRenameTag } = useLibraryTagEditor(renameTag)

  useEffect(() => {
    restoreLibraryScroll(records.isSuccess)
  }, [records.isSuccess, restoreLibraryScroll, allRecords.length])

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
            onCancelRenameTag={cancelRenameTag}
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
