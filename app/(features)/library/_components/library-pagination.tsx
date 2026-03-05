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
        className="min-h-[44px] border-4 border-foreground bg-background px-8 py-3 font-mono text-sm font-bold uppercase hover:bg-foreground hover:text-background shadow-brutal-sm transition-colors disabled:opacity-60"
      >
        {isFetching ? t("library.loadingMore", "LOADING...") : `${t("library.loadMore", "더 불러오기")} ↓`}
      </button>
    </div>
  )
}
