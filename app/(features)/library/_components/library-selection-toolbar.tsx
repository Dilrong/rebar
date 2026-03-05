import type { TagRow } from "@/lib/types"

type BulkState = "ACTIVE" | "PINNED" | "ARCHIVED" | "TRASHED"
type BulkTagMode = "add" | "replace"

type LibrarySelectionToolbarProps = {
  t: (key: string, fallback?: string) => string
  selectedCount: number
  tags: TagRow[]
  bulkTagId: string
  onSelectVisible: () => void
  onClearSelection: () => void
  onApplyBulkState: (nextState: BulkState) => void
  onBulkTagIdChange: (tagId: string) => void
  onApplyBulkTags: (mode: BulkTagMode) => void
}

export function LibrarySelectionToolbar({
  t,
  selectedCount,
  tags,
  bulkTagId,
  onSelectVisible,
  onClearSelection,
  onApplyBulkState,
  onBulkTagIdChange,
  onApplyBulkTags
}: LibrarySelectionToolbarProps) {
  if (selectedCount <= 0) {
    return null
  }

  return (
    <section className="mb-8 border-4 border-foreground bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs font-bold uppercase">{selectedCount} {t("library.selected", "선택됨")}</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onSelectVisible} className="min-h-[44px] border-4 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm">
            {t("library.selectVisible", "보이는 항목 선택")}
          </button>
          <button type="button" onClick={onClearSelection} className="min-h-[44px] border-4 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm">
            {t("library.clearSelection", "선택 해제")}
          </button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onApplyBulkState("ACTIVE")} className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm">
          {t("library.bulk.activate", "활성화")}
        </button>
        <button type="button" onClick={() => onApplyBulkState("PINNED")} className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm">
          {t("library.bulk.pin", "핀 고정")}
        </button>
        <button type="button" onClick={() => onApplyBulkState("ARCHIVED")} className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm">
          {t("library.bulk.archive", "보관")}
        </button>
        <button type="button" onClick={() => onApplyBulkState("TRASHED")} className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm text-destructive hover:bg-destructive">
          {t("library.bulk.trash", "휴지통")}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="library-bulk-tag" className="sr-only">
          {t("library.bulk.tagPlaceholder", "태그 선택")}
        </label>
        <select
          id="library-bulk-tag"
          value={bulkTagId}
          onChange={(event) => onBulkTagIdChange(event.target.value)}
          className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-0 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)] rounded-none"
        >
          <option value="">{t("library.bulk.tagPlaceholder", "태그 선택")}</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>#{tag.name}</option>
          ))}
        </select>
        <button type="button" onClick={() => onApplyBulkTags("add")} className="min-h-[44px] border-4 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm">
          {t("library.bulk.addTag", "태그 추가")}
        </button>
        <button type="button" onClick={() => onApplyBulkTags("replace")} className="min-h-[44px] border-4 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm">
          {t("library.bulk.replaceTags", "태그 교체")}
        </button>
      </div>
    </section>
  )
}
