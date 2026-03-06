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
    return (
      <section className="mb-4 border-2 border-dashed border-foreground bg-background px-3 py-2">
        <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
          {t("library.bulkTip", "카드를 선택하면 일괄 작업을 사용할 수 있습니다")}
        </p>
      </section>
    )
  }

  return (
    <section className="mb-8 border-4 border-foreground bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs font-bold uppercase">{selectedCount} {t("library.selected", "선택됨")}</p>
        <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
          <button type="button" onClick={onSelectVisible} className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-y-1 active:translate-x-1 transition-all duration-200">
            {t("library.selectVisible", "보이는 항목 선택")}
          </button>
          <button type="button" onClick={onClearSelection} className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-y-1 active:translate-x-1 transition-all duration-200">
            {t("library.clearSelection", "선택 해제")}
          </button>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => onApplyBulkState("ACTIVE")} className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-y-1 active:translate-x-1 transition-all duration-200">
          {t("library.bulk.activate", "활성화")}
        </button>
        <button type="button" onClick={() => onApplyBulkState("PINNED")} className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-y-1 active:translate-x-1 transition-all duration-200">
          {t("library.bulk.pin", "핀 고정")}
        </button>
        <button type="button" onClick={() => onApplyBulkState("ARCHIVED")} className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-y-1 active:translate-x-1 transition-all duration-200">
          {t("library.bulk.archive", "보관")}
        </button>
        <button type="button" onClick={() => onApplyBulkState("TRASHED")} className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-destructive hover:text-foreground hover:border-destructive shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-y-1 active:translate-x-1 transition-all duration-200 text-destructive">
          {t("library.bulk.trash", "휴지통")}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label htmlFor="library-bulk-tag" className="sr-only">
          {t("library.bulk.tagPlaceholder", "태그 선택")}
        </label>
        <select
          id="library-bulk-tag"
          value={bulkTagId}
          onChange={(event) => onBulkTagIdChange(event.target.value)}
          className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-0 shadow-brutal-sm focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200 rounded-none cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22currentColor%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:0.65em_0.65em] bg-[right_1rem_center] bg-no-repeat pr-10 sm:col-span-2 xl:col-span-1"
        >
          <option value="">{t("library.bulk.tagPlaceholder", "태그 선택")}</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>#{tag.name}</option>
          ))}
        </select>
        <button type="button" onClick={() => onApplyBulkTags("add")} className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-y-1 active:translate-x-1 transition-all duration-200">
          {t("library.bulk.addTag", "태그 추가")}
        </button>
        <button type="button" onClick={() => onApplyBulkTags("replace")} className="min-h-[44px] border-4 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 active:translate-y-1 active:translate-x-1 transition-all duration-200">
          {t("library.bulk.replaceTags", "태그 교체")}
        </button>
      </div>
    </section>
  )
}
