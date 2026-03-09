import { useEffect, useRef } from "react"

type LibraryPaginationProps = {
  t: (key: string, fallback?: string) => string
  hasNext: boolean
  isLoadingMore?: boolean
  isFetching?: boolean
  onLoadMore: () => void
}

export function LibraryPagination({ t, hasNext, isLoadingMore, isFetching, onLoadMore }: LibraryPaginationProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loading = isLoadingMore ?? isFetching ?? false

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNext || loading || typeof IntersectionObserver === "undefined") {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: "240px 0px" }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNext, loading, onLoadMore])

  if (!hasNext) {
    return null
  }

  return (
    <div className="mt-8 flex flex-col items-center justify-center">
      <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        className="min-h-[44px] w-full border-4 border-foreground bg-background px-8 py-3 font-mono text-sm font-bold uppercase shadow-brutal transition-all duration-200 hover:translate-y-1 hover:translate-x-1 hover:bg-foreground hover:text-background hover:shadow-none active:translate-y-1 active:translate-x-1 disabled:opacity-60 disabled:shadow-brutal disabled:translate-x-0 disabled:translate-y-0 disabled:hover:bg-background disabled:hover:text-foreground sm:w-auto"
      >
        {loading ? t("library.loadingMore", "LOADING...") : `${t("library.loadMore", "더 불러오기")} ↓`}
      </button>
    </div>
  )
}
