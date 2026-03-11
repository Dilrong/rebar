import { EmptyState } from "@shared/ui/empty-state"
import { ErrorState } from "@shared/ui/error-state"
import { Skeleton } from "@shared/ui/skeleton"
import { SearchResultCard, type SearchResultRow } from "./search-result-card"

type SearchResultsStateProps = {
  t: (key: string, fallback?: string) => string
  queryString: string
  isFetching: boolean
  isLoading: boolean
  hasData: boolean
  errorMessage: string | null
  onRetry: () => void
  results: SearchResultRow[]
  activeIndex: number
  semantic: boolean
  debouncedQ: string
  toRecordHref: (id: string) => string
  onPrefetch: (id: string) => void
  onFocusIndex: (index: number) => void
}

export function SearchResultsState(props: SearchResultsStateProps) {
  if (props.queryString.length === 0) {
    return (
      <EmptyState
        title={props.t("search.setFilterPrompt", "SET A QUERY OR FILTER")}
        description={props.t("search.setFilterPromptDesc", "검색어, 상태, 태그, 날짜 중 하나를 선택하면 결과를 표시합니다")}
      />
    )
  }

  return (
    <>
      {props.isFetching ? (
        <p className="mb-4 font-mono text-[10px] font-bold uppercase text-muted-foreground">{props.t("search.searching", "SEARCHING...")}</p>
      ) : null}

      {props.isLoading && !props.hasData ? (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 w-full md:h-72" />
          ))}
        </div>
      ) : null}

      {props.errorMessage ? <ErrorState message={props.errorMessage} onRetry={props.onRetry} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {props.results.map((record, index) => (
          <SearchResultCard
            key={record.id}
            t={props.t}
            record={record}
            index={index}
            activeIndex={props.activeIndex}
            semantic={props.semantic}
            debouncedQ={props.debouncedQ}
            toRecordHref={props.toRecordHref}
            onPrefetch={props.onPrefetch}
            onFocusIndex={props.onFocusIndex}
          />
        ))}
      </div>

      {props.queryString.length > 0 && props.results.length === 0 && !props.errorMessage && !props.isLoading ? (
        <EmptyState title={props.t("search.noResults", "NO RESULTS")} actionLabel={props.t("search.goCapture", "Go capture")} actionHref="/capture" />
      ) : null}
    </>
  )
}
