import { Filter, Search } from "lucide-react"
import type { TagRow } from "@/lib/types"
import { getStateLabel } from "@/lib/i18n/state-label"

type SearchControlsProps = {
  t: (key: string, fallback?: string) => string
  inputRef: React.RefObject<HTMLInputElement | null>
  q: string
  setQ: (value: string) => void
  showFilters: boolean
  setShowFilters: (value: boolean | ((prev: boolean) => boolean)) => void
  hasActiveFilters: boolean
  state: string
  setState: (value: string) => void
  tagId: string
  setTagId: (value: string) => void
  fromDate: string
  setFromDate: (value: string) => void
  toDate: string
  setToDate: (value: string) => void
  semantic: boolean
  setSemantic: (value: boolean | ((prev: boolean) => boolean)) => void
  semanticButtonDisabled: boolean
  controlClassName: string
  tags: TagRow[]
}

export function SearchControls(props: SearchControlsProps) {
  return (
    <>
      <header className="mb-8 border-b-4 border-foreground pb-4">
        <h1 className="flex items-start gap-3 text-3xl font-black uppercase leading-none text-foreground sm:items-center sm:text-4xl md:text-5xl">
          <Search className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={3} /> {props.t("search.title", "SEARCH")}
        </h1>
      </header>

      <section className="mb-4 flex flex-col gap-4 border-[3px] border-foreground bg-card p-3 shadow-brutal-sm md:mb-6 md:border-4 md:p-4 md:shadow-brutal">
        <div className="flex w-full gap-2">
          <label htmlFor="search-query" className="sr-only">
            {props.t("search.placeholder", "content / source title")}
          </label>
          <input
            id="search-query"
            ref={props.inputRef}
            value={props.q}
            autoFocus
            onChange={(event) => props.setQ(event.target.value)}
            placeholder={props.t("search.placeholder", "content / source title")}
            className={`${props.controlClassName} flex-1 placeholder:font-mono placeholder:text-xs placeholder:text-muted-foreground`}
          />
          <button
            type="button"
            onClick={() => props.setShowFilters((prev) => !prev)}
            className={`flex min-h-[44px] items-center justify-center gap-2 border-[3px] px-4 font-mono text-xs font-bold transition-all active:translate-x-1 active:translate-y-1 active:shadow-none md:border-4 ${props.showFilters || props.hasActiveFilters
              ? "translate-x-1 translate-y-1 border-foreground bg-foreground text-background shadow-none"
              : "border-foreground bg-accent text-accent-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-foreground hover:text-background dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)]"}`}
            aria-expanded={props.showFilters}
          >
            <Filter className="h-4 w-4" strokeWidth={3} />
            <span className="hidden sm:inline">
              {props.showFilters ? props.t("search.hideFilters", "HIDE FILTERS") : props.t("search.showFilters", "FILTERS")}
            </span>
            {props.hasActiveFilters && !props.showFilters ? (
              <span className="flex h-4 w-4 items-center justify-center border-2 border-background bg-accent text-[10px] text-accent-foreground">!</span>
            ) : null}
          </button>
        </div>

        {props.showFilters ? (
          <div className="animate-fade-in-up flex flex-col gap-4 border-t-4 border-foreground pt-4">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="search-state" className="mb-1 block font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  {props.t("search.allStates", "All states")}
                </label>
                <select id="search-state" value={props.state} onChange={(event) => props.setState(event.target.value)} className={props.controlClassName}>
                  <option value="">{props.t("search.allStates", "All states")}</option>
                  <option value="INBOX">{getStateLabel("INBOX", props.t)}</option>
                  <option value="ACTIVE">{getStateLabel("ACTIVE", props.t)}</option>
                  <option value="PINNED">{getStateLabel("PINNED", props.t)}</option>
                  <option value="ARCHIVED">{getStateLabel("ARCHIVED", props.t)}</option>
                  <option value="TRASHED">{getStateLabel("TRASHED", props.t)}</option>
                </select>
              </div>
              <div>
                <label htmlFor="search-tag" className="mb-1 block font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  {props.t("search.allTags", "All tags")}
                </label>
                <select id="search-tag" value={props.tagId} onChange={(event) => props.setTagId(event.target.value)} className={props.controlClassName}>
                  <option value="">{props.t("search.allTags", "All tags")}</option>
                  {props.tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>#{tag.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="search-from-date" className="mb-1 block font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  {props.t("history.from", "From")}
                </label>
                <input id="search-from-date" type="date" value={props.fromDate} onChange={(event) => props.setFromDate(event.target.value)} className={props.controlClassName} />
              </div>
              <div>
                <label htmlFor="search-to-date" className="mb-1 block font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  {props.t("history.to", "To")}
                </label>
                <input id="search-to-date" type="date" value={props.toDate} onChange={(event) => props.setToDate(event.target.value)} className={props.controlClassName} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t-2 border-foreground pt-3">
              <button
                type="button"
                aria-pressed={props.semantic}
                onClick={() => {
                  if (props.semanticButtonDisabled) return
                  props.setSemantic((prev) => !prev)
                }}
                disabled={props.semanticButtonDisabled}
                className={`min-h-[44px] border-4 px-3 py-2 font-mono text-xs font-bold uppercase transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-background disabled:hover:text-foreground ${props.semantic
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground bg-background text-foreground hover:bg-foreground hover:text-background"}`}
              >
                {props.semantic ? props.t("search.semanticOn", "SEMANTIC ON") : props.t("search.semanticOff", "SEMANTIC OFF")}
              </button>
              {props.semantic ? (
                <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  {props.t("search.semanticHint", "의미 기반 유사도 우선으로 결과를 정렬합니다")}
                </p>
              ) : !props.hasActiveFilters ? (
                <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  {props.t("search.semanticNeedsFilter", "검색어 또는 필터를 먼저 지정하세요")}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </>
  )
}
