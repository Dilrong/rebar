import { getStateLabel } from "@/lib/i18n/state-label"
import type { TagRow } from "@/lib/types"

type StateFilter = "ALL" | "INBOX" | "ACTIVE" | "PINNED" | "ARCHIVED"
type SortField = "created_at" | "review_count" | "due_at"
type SortOrder = "asc" | "desc"

const STATE_TABS: Array<Exclude<StateFilter, "ALL">> = ["INBOX", "ACTIVE", "PINNED", "ARCHIVED"]

type LibraryFiltersToolbarProps = {
  t: (key: string, fallback?: string) => string
  state: StateFilter
  kind: string
  q: string
  tagId: string
  sort: SortField
  order: SortOrder
  selectedTagName: string | null
  tags: TagRow[]
  onStateChange: (next: StateFilter) => void
  onKindChange: (next: string) => void
  onQueryChange: (next: string) => void
  onTagChange: (next: string) => void
  onSortOrderChange: (nextSort: SortField, nextOrder: SortOrder) => void
  onClearAllFilters: () => void
}

export function LibraryFiltersToolbar({
  t,
  state,
  kind,
  q,
  tagId,
  sort,
  order,
  selectedTagName,
  tags,
  onStateChange,
  onKindChange,
  onQueryChange,
  onTagChange,
  onSortOrderChange,
  onClearAllFilters
}: LibraryFiltersToolbarProps) {
  return (
    <section className="mb-8 border-4 border-foreground bg-card p-4">
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          key="ALL"
          type="button"
          onClick={() => onStateChange("ALL")}
          className={`min-h-[44px] px-4 py-2 border-4 border-foreground font-mono text-xs font-bold uppercase flex items-center justify-center transition-transform active:translate-y-[2px] active:translate-x-[2px] ${state === "ALL" ? "bg-foreground text-background shadow-brutal" : "bg-background text-foreground hover:bg-foreground/10"}`}
        >
          {t("library.allView", "전체보기")}
        </button>
        {STATE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onStateChange(tab)}
            className={`min-h-[44px] px-4 py-2 border-4 border-foreground font-mono text-xs font-bold uppercase flex items-center justify-center transition-transform active:translate-y-[2px] active:translate-x-[2px] ${state === tab ? "bg-foreground text-background shadow-brutal" : "bg-background text-foreground hover:bg-foreground/10"}`}
          >
            {getStateLabel(tab, t)}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <label htmlFor="library-query" className="sr-only">
          {t("library.searchPlaceholder", "Search content/title")}
        </label>
        <input
          id="library-query"
          type="text"
          value={q}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("library.searchPlaceholder", "Search content/title")}
          className="min-h-[44px] bg-background border-4 border-foreground text-foreground px-4 py-3 font-mono text-sm w-full md:w-auto focus:outline-none focus:ring-0 flex-1 rounded-none shadow-brutal-sm focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200"
        />
        <div className="grid grid-cols-2 lg:flex lg:flex-row gap-3">
          <label htmlFor="library-kind" className="sr-only">
            {t("library.allKinds", "All kinds")}
          </label>
          <select
            id="library-kind"
            value={kind}
            onChange={(event) => onKindChange(event.target.value)}
            className="min-h-[44px] bg-background border-4 border-foreground text-foreground px-4 py-2 font-mono text-sm w-full md:w-auto focus:outline-none focus:ring-0 rounded-none shadow-brutal-sm focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22currentColor%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:0.65em_0.65em] bg-[right_1rem_center] bg-no-repeat pr-10"
          >
            <option value="">{t("library.allKinds", "All kinds")}</option>
            <option value="quote">quote</option>
            <option value="note">note</option>
            <option value="link">link</option>
            <option value="ai">ai</option>
          </select>
          <label htmlFor="library-tag-filter" className="sr-only">
            {t("library.allTags", "All tags")}
          </label>
          <select
            id="library-tag-filter"
            value={tagId}
            onChange={(event) => onTagChange(event.target.value)}
            className="min-h-[44px] bg-background border-4 border-foreground text-foreground px-4 py-2 font-mono text-sm w-full md:w-auto shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-0 rounded-none transition-none"
          >
            <option value="">{t("library.allTags", "All tags")}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                #{tag.name}
              </option>
            ))}
          </select>
          <label htmlFor="library-sort" className="sr-only">
            Sort order
          </label>
          <select
            id="library-sort"
            value={`${sort}:${order}`}
            onChange={(event) => {
              const [nextSort, nextOrder] = event.target.value.split(":") as [SortField, SortOrder]
              onSortOrderChange(nextSort, nextOrder)
            }}
            className="min-h-[44px] bg-background border-4 border-foreground px-4 py-2 font-mono text-sm text-foreground w-full md:w-auto col-span-2 lg:col-span-1 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-0 rounded-none transition-none"
          >
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
            <option value="review_count:desc">Most reviewed</option>
            <option value="due_at:asc">Due soonest</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground mr-2">{t("library.activeFilters", "Active filters")}</span>
        <button
          type="button"
          onClick={() => onStateChange("ALL")}
          className="min-h-[44px] flex items-center justify-center border-2 border-foreground px-3 py-2 font-mono text-[10px] font-bold uppercase transition-transform hover:bg-foreground/10 active:translate-y-[2px] active:translate-x-[2px]"
        >
          {t("library.state", "State")}: {state === "ALL" ? t("library.allView", "전체보기") : getStateLabel(state, t)}
        </button>
        {q ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="min-h-[44px] flex items-center justify-center border-2 border-foreground px-3 py-2 font-mono text-[10px] font-bold uppercase transition-transform hover:bg-foreground/10 active:translate-y-[2px] active:translate-x-[2px]"
          >
            {t("library.query", "Search")}: {q} x
          </button>
        ) : null}
        {kind ? (
          <button
            type="button"
            onClick={() => onKindChange("")}
            className="min-h-[44px] flex items-center justify-center border-2 border-foreground px-3 py-2 font-mono text-[10px] font-bold uppercase transition-transform hover:bg-foreground/10 active:translate-y-[2px] active:translate-x-[2px]"
          >
            {t("library.kind", "Kind")}: {kind} x
          </button>
        ) : null}
        {tagId ? (
          <button
            type="button"
            onClick={() => onTagChange("")}
            className="min-h-[44px] flex items-center justify-center border-2 border-foreground px-3 py-2 font-mono text-[10px] font-bold uppercase transition-transform hover:bg-foreground/10 active:translate-y-[2px] active:translate-x-[2px]"
          >
            {t("library.tag", "Tag")}: {selectedTagName ? `#${selectedTagName}` : tagId.slice(0, 6)} x
          </button>
        ) : null}
        {(q || kind || tagId || state !== "ALL") ? (
          <button
            type="button"
            onClick={onClearAllFilters}
            className="min-h-[44px] flex items-center justify-center border-4 border-foreground bg-foreground px-3 py-2 font-mono text-[10px] font-bold uppercase text-background hover:bg-background hover:text-foreground transition-transform hover:shadow-brutal-sm active:translate-y-[2px] active:translate-x-[2px]"
          >
            {t("library.clearAll", "Clear all")}
          </button>
        ) : null}
      </div>
    </section>
  )
}
