type LibraryPaginationProps = {
  t: (key: string, fallback?: string) => string
  hasNext: boolean
  isFetching: boolean
  onLoadMore: () => void
}

export function LibraryPagination({ t, hasNext, isFetching, onLoadMore }: LibraryPaginationProps) {
  if (!hasNext) {
    return null
  }

  return (
    <div className="mt-8 flex justify-center">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={isFetching}
        className="min-h-[44px] border-4 border-foreground bg-background px-8 py-3 font-mono text-sm font-bold uppercase hover:bg-foreground hover:text-background shadow-brutal hover:shadow-none hover:translate-y-1 hover:translate-x-1 active:translate-y-1 active:translate-x-1 transition-all duration-200 disabled:opacity-60 disabled:shadow-brutal disabled:translate-x-0 disabled:translate-y-0 disabled:hover:bg-background disabled:hover:text-foreground"
      >
        {isFetching ? t("library.loadingMore", "LOADING...") : `${t("library.loadMore", "더 불러오기")} ↓`}
      </button>
    </div>
  )
}
