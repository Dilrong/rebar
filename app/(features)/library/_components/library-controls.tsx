import type { MutableRefObject, RefObject, KeyboardEvent as ReactKeyboardEvent } from "react"
import { LibraryHeader } from "./library-header"
import { LibraryFiltersToolbar } from "./library-filters-toolbar"
import { LibrarySelectionToolbar } from "./library-selection-toolbar"
import { LibraryTagManager } from "./library-tag-manager"
import type { TagRow } from "@/lib/types"
import type { ExportFormat } from "@feature-lib/export/formats"

type LibraryControlsProps = {
  t: (key: string, fallback?: string) => string
  totalRows: number
  exportSince: string
  exportScopeLabel: string
  exportSincePresets: Array<{ key: string; fallback: string; value: string }>
  exportMenuOpen: boolean
  exportPending: boolean
  exportMenuWrapRef: RefObject<HTMLDivElement | null>
  exportTriggerRef: RefObject<HTMLButtonElement | null>
  exportItemRefs: MutableRefObject<Array<HTMLButtonElement | null>>
  onExportSinceChange: (value: string) => void
  onClearExportSince: () => void
  onToggleMenu: () => void
  onOpenMenuFromKeyboard: () => void
  onCloseMenu: () => void
  onExport: (format: ExportFormat) => void
  onMenuItemKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
  state: "ALL" | "INBOX" | "ACTIVE" | "PINNED" | "ARCHIVED"
  stateCounts: { INBOX: number; ACTIVE: number; PINNED: number; ARCHIVED: number }
  kind: "" | "quote" | "note" | "link" | "ai"
  q: string
  tagId: string
  sort: "created_at" | "review_count" | "due_at"
  order: "asc" | "desc"
  selectedTagName: string | null
  tags: TagRow[]
  onStateChange: (value: "ALL" | "INBOX" | "ACTIVE" | "PINNED" | "ARCHIVED") => void
  onKindChange: (value: string) => void
  onQueryChange: (value: string) => void
  onTagChange: (value: string) => void
  onSortOrderChange: (sort: "created_at" | "review_count" | "due_at", order: "asc" | "desc") => void
  onClearAllFilters: () => void
  selectedCount: number
  bulkTagId: string
  onSelectVisible: () => void
  onClearSelection: () => void
  onApplyBulkState: (state: "ACTIVE" | "PINNED" | "ARCHIVED" | "TRASHED") => void
  onBulkTagIdChange: (value: string) => void
  onApplyBulkTags: (mode: "add" | "replace") => void
  newTagName: string
  editingTagId: string | null
  editingTagName: string
  createPending: boolean
  createError: string | null
  renameError: string | null
  deleteError: string | null
  onNewTagNameChange: (value: string) => void
  onCreateTag: () => void
  onStartRenameTag: (tag: TagRow) => void
  onEditingTagNameChange: (value: string) => void
  onSubmitRenameTag: (id: string) => void
  onCancelRenameTag: () => void
  onDeleteTag: (id: string) => void
}

export function LibraryControls(props: LibraryControlsProps) {
  return (
    <>
      <LibraryHeader
        t={props.t}
        totalRows={props.totalRows}
        exportSince={props.exportSince}
        exportScopeLabel={props.exportScopeLabel}
        exportSincePresets={props.exportSincePresets}
        exportMenuOpen={props.exportMenuOpen}
        exportPending={props.exportPending}
        exportMenuWrapRef={props.exportMenuWrapRef}
        exportTriggerRef={props.exportTriggerRef}
        exportItemRefs={props.exportItemRefs}
        onExportSinceChange={props.onExportSinceChange}
        onClearExportSince={props.onClearExportSince}
        onToggleMenu={props.onToggleMenu}
        onOpenMenuFromKeyboard={props.onOpenMenuFromKeyboard}
        onCloseMenu={props.onCloseMenu}
        onExport={props.onExport}
        onMenuItemKeyDown={props.onMenuItemKeyDown}
      />

      <LibraryFiltersToolbar
        t={props.t}
        state={props.state}
        stateCounts={props.stateCounts}
        kind={props.kind}
        q={props.q}
        tagId={props.tagId}
        sort={props.sort}
        order={props.order}
        selectedTagName={props.selectedTagName}
        tags={props.tags}
        onStateChange={props.onStateChange}
        onKindChange={props.onKindChange}
        onQueryChange={props.onQueryChange}
        onTagChange={props.onTagChange}
        onSortOrderChange={props.onSortOrderChange}
        onClearAllFilters={props.onClearAllFilters}
      />

      <LibrarySelectionToolbar
        t={props.t}
        selectedCount={props.selectedCount}
        tags={props.tags}
        bulkTagId={props.bulkTagId}
        onSelectVisible={props.onSelectVisible}
        onClearSelection={props.onClearSelection}
        onApplyBulkState={props.onApplyBulkState}
        onBulkTagIdChange={props.onBulkTagIdChange}
        onApplyBulkTags={props.onApplyBulkTags}
      />

      <LibraryTagManager
        t={props.t}
        tags={props.tags}
        newTagName={props.newTagName}
        editingTagId={props.editingTagId}
        editingTagName={props.editingTagName}
        createPending={props.createPending}
        createError={props.createError}
        renameError={props.renameError}
        deleteError={props.deleteError}
        onNewTagNameChange={props.onNewTagNameChange}
        onCreateTag={props.onCreateTag}
        onStartRenameTag={props.onStartRenameTag}
        onEditingTagNameChange={props.onEditingTagNameChange}
        onSubmitRenameTag={props.onSubmitRenameTag}
        onCancelRenameTag={props.onCancelRenameTag}
        onDeleteTag={props.onDeleteTag}
      />
    </>
  )
}
