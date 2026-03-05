import Link from "next/link"
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react"
import { cn } from "@/lib/utils"

export type QuickSearchResult = {
  id: string
  kind: string
  content: string
}

type QuickSearchDialogProps = {
  t: (key: string, fallback?: string) => string
  open: boolean
  dialogRef: RefObject<HTMLDivElement | null>
  inputRef: RefObject<HTMLInputElement | null>
  query: string
  results: QuickSearchResult[]
  activeIndex: number
  loading: boolean
  onClose: () => void
  onQueryChange: (value: string) => void
  onInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
  onActiveIndexChange: (index: number) => void
  buildRecordHref: (recordId: string) => string
}

export function QuickSearchDialog({
  t,
  open,
  dialogRef,
  inputRef,
  query,
  results,
  activeIndex,
  loading,
  onClose,
  onQueryChange,
  onInputKeyDown,
  onActiveIndexChange,
  buildRecordHref
}: QuickSearchDialogProps) {
  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 transition-all"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-search-title"
        aria-describedby="quick-search-description"
        className="mt-16 w-full max-w-2xl border-4 border-foreground bg-card bg-noise p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]"
      >
        <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-foreground pb-2 gap-2">
          <p id="quick-search-title" className="font-mono text-xs font-bold uppercase">QUICK SEARCH (⌘K / Ctrl+K)</p>
          <button type="button" onClick={onClose} className="min-h-[44px] flex items-center justify-center border-2 border-foreground px-4 py-2 font-mono text-xs font-bold uppercase w-full sm:w-auto hover:bg-foreground hover:text-background active:translate-y-1 active:translate-x-1 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all duration-200">
            CLOSE
          </button>
        </div>
        <p id="quick-search-description" className="mb-2 font-mono text-[10px] font-bold uppercase text-muted-foreground">
          키보드: ↑↓ 이동, Enter 열기, Esc 닫기
        </p>
        <label htmlFor="quick-search-input" className="sr-only">
          Quick search
        </label>
        <input
          id="quick-search-input"
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="검색어 입력..."
          className="mb-3 w-full border-2 border-foreground bg-background p-3 font-mono text-sm min-h-[44px] focus:outline-none focus:ring-0 shadow-brutal-sm focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="quick-search-results"
          aria-activedescendant={activeIndex >= 0 ? `quick-option-${activeIndex}` : undefined}
          autoFocus
        />
        <div id="quick-search-results" role="listbox" className="space-y-2">
          {results.map((item, index) => (
            <Link
              key={item.id}
              id={`quick-option-${index}`}
              role="option"
              aria-selected={activeIndex === index}
              href={buildRecordHref(item.id)}
              onClick={onClose}
              onMouseEnter={() => onActiveIndexChange(index)}
              className={cn(
                "block border-2 min-h-[44px] border-foreground px-3 py-2 hover:bg-foreground hover:text-background active:translate-y-1 active:translate-x-1 transition-all duration-200",
                activeIndex === index && "bg-foreground text-background"
              )}
            >
              <p className="font-mono text-[10px] font-bold uppercase">{item.kind}</p>
              <p className="line-clamp-2 text-sm font-semibold">{item.content}</p>
            </Link>
          ))}

          {loading ? (
            <p className="border-2 border-foreground p-3 font-mono text-[10px] font-bold uppercase text-muted-foreground">
              {t("nav.quickSearching", "SEARCHING...")}
            </p>
          ) : null}

          {!loading && query.trim() && results.length === 0 ? (
            <p className="border-2 border-foreground p-3 font-mono text-[10px] font-bold uppercase text-muted-foreground">
              {t("nav.quickEmpty", "NO MATCHES")}
            </p>
          ) : null}

          {!loading && !query.trim() ? (
            <p className="border-2 border-dashed border-foreground p-3 font-mono text-[10px] font-bold uppercase text-muted-foreground">
              {t("nav.quickHint", "TYPE TO SEARCH")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
