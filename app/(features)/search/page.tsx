"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { Search } from "lucide-react"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import { getStateLabel } from "@/lib/i18n/state-label"
import type { RecordRow, TagRow } from "@/lib/types"
import { EmptyState } from "@shared/ui/empty-state"
import { ErrorState } from "@shared/ui/error-state"
import { Skeleton } from "@shared/ui/skeleton"
import { stripMarkdown } from "@feature-lib/content/strip-markdown"
import { useDebouncedValue } from "@shared/hooks/use-debounced-value"

type SearchResultRow = RecordRow & {
  semantic_score?: number
  semantic_matches?: string[]
}

type SearchResponse = {
  data: SearchResultRow[]
  semantic?: boolean
}

type TagsResponse = {
  data: TagRow[]
}

export default function SearchPage() {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [q, setQ] = useState("")
  const debouncedQ = useDebouncedValue(q, 220)
  const [state, setState] = useState("")
  const [tagId, setTagId] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [semantic, setSemantic] = useState(false)
  const [didInitFromUrl, setDidInitFromUrl] = useState(false)
  const controlClassName = "min-h-[44px] w-full min-w-0 rounded-none border-4 border-foreground bg-background p-3 font-mono text-xs text-foreground shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-0 dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)]"

  useEffect(() => {
    const queryQ = searchParams.get("q") ?? ""
    const queryState = searchParams.get("state") ?? ""
    const queryTag = searchParams.get("tag_id") ?? ""
    const queryFrom = searchParams.get("from") ?? ""
    const queryTo = searchParams.get("to") ?? ""
    const querySemantic = searchParams.get("semantic")

    setQ(queryQ)
    setState(queryState)
    setTagId(queryTag)
    setFromDate(queryFrom)
    setToDate(queryTo)
    setSemantic(querySemantic === "1" || querySemantic?.toLowerCase() === "true")
    setDidInitFromUrl(true)
  }, [searchParams])

  const hasActiveFilters = Boolean(q.trim() || state || tagId || fromDate || toDate)
  const hasCommittedFilters = Boolean(debouncedQ.trim() || state || tagId || fromDate || toDate)
  const semanticButtonDisabled = !hasActiveFilters && !semantic

  useEffect(() => {
    if (!hasActiveFilters && semantic) {
      setSemantic(false)
    }
  }, [hasActiveFilters, semantic])

  const currentParams = searchParams.toString()

  useEffect(() => {
    if (!didInitFromUrl) {
      return
    }

    const params = new URLSearchParams()
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim())
    if (state) params.set("state", state)
    if (tagId) params.set("tag_id", tagId)
    if (fromDate) params.set("from", fromDate)
    if (toDate) params.set("to", toDate)
    if (semantic && hasCommittedFilters) params.set("semantic", "1")

    const nextParams = params.toString()
    if (nextParams === currentParams) {
      return
    }

    const nextHref = nextParams ? `${pathname}?${nextParams}` : pathname
    router.replace(nextHref, { scroll: false })
  }, [currentParams, debouncedQ, didInitFromUrl, fromDate, hasCommittedFilters, pathname, router, semantic, state, tagId, toDate])

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagsResponse>("/api/tags"),
    staleTime: 1000 * 60 * 10 // 10 minutes
  })

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim())
    if (state) params.set("state", state)
    if (tagId) params.set("tag_id", tagId)
    if (fromDate) params.set("from", fromDate)
    if (toDate) params.set("to", toDate)
    if (semantic && hasCommittedFilters) params.set("semantic", "1")
    return params.toString()
  }, [debouncedQ, fromDate, hasCommittedFilters, semantic, state, tagId, toDate])

  const result = useQuery({
    queryKey: ["search", queryString],
    queryFn: () => apiFetch<SearchResponse>(`/api/search?${queryString}`),
    enabled: queryString.length > 0,
    staleTime: 1000 * 30, // 30 seconds
    placeholderData: keepPreviousData
  })

  const searchBackHref = queryString ? `/search?${queryString}` : "/search"

  const toRecordHref = (recordId: string) =>
    `/records/${recordId}?from=${encodeURIComponent(searchBackHref)}`

  const qc = useQueryClient()
  function prefetchRecord(id: string) {
    qc.prefetchQuery({
      queryKey: ["record-detail", id],
      queryFn: () => apiFetch<{ record: RecordRow }>(`/api/records/${id}`),
      staleTime: 1000 * 60 * 5
    })
  }

  return (
    <div className="min-h-screen bg-background p-4 font-sans selection:bg-accent selection:text-white md:p-6">
      <AuthGate>
        <main className="mx-auto w-full max-w-5xl animate-fade-in-up pb-24">
          <AppNav />

          <header className="mb-8 border-b-4 border-foreground pb-4">
            <h1 className="flex items-start gap-3 text-3xl font-black uppercase leading-none text-foreground sm:items-center sm:text-4xl md:text-5xl">
              <Search className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={3} /> {t("search.title", "SEARCH")}
            </h1>
          </header>

          <section className="border-[3px] md:border-4 border-foreground bg-card p-3 md:p-4 mb-4 md:mb-6 shadow-brutal-sm md:shadow-brutal">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5">
              <label htmlFor="search-query" className="sr-only">
                {t("search.placeholder", "content / source title")}
              </label>
              <input
                id="search-query"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={t("search.placeholder", "content / source title")}
                className={`${controlClassName} placeholder:font-mono placeholder:text-xs placeholder:text-muted-foreground lg:col-span-2`}
              />
              <label htmlFor="search-state" className="sr-only">
                {t("search.allStates", "All states")}
              </label>
              <select
                id="search-state"
                value={state}
                onChange={(event) => setState(event.target.value)}
                className={controlClassName}
              >
                <option value="">{t("search.allStates", "All states")}</option>
                <option value="INBOX">{getStateLabel("INBOX", t)}</option>
                <option value="ACTIVE">{getStateLabel("ACTIVE", t)}</option>
                <option value="PINNED">{getStateLabel("PINNED", t)}</option>
                <option value="ARCHIVED">{getStateLabel("ARCHIVED", t)}</option>
                <option value="TRASHED">{getStateLabel("TRASHED", t)}</option>
              </select>
              <label htmlFor="search-tag" className="sr-only">
                {t("search.allTags", "All tags")}
              </label>
              <select
                id="search-tag"
                value={tagId}
                onChange={(event) => setTagId(event.target.value)}
                className={controlClassName}
              >
                <option value="">{t("search.allTags", "All tags")}</option>
                {(tags.data?.data ?? []).map((tag) => (
                  <option key={tag.id} value={tag.id}>#{tag.name}</option>
                ))}
              </select>
              <div className="grid min-w-0 grid-cols-1 gap-2 lg:col-span-1">
                <div className="w-full min-w-0">
                  <label htmlFor="search-from-date" className="mb-1 block font-mono text-[10px] font-bold uppercase text-muted-foreground">
                    {t("history.from", "From")}
                  </label>
                  <input
                    id="search-from-date"
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className={controlClassName}
                  />
                </div>
                <div className="w-full min-w-0">
                  <label htmlFor="search-to-date" className="mb-1 block font-mono text-[10px] font-bold uppercase text-muted-foreground">
                    {t("history.to", "To")}
                  </label>
                  <input
                    id="search-to-date"
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className={controlClassName}
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t-2 border-foreground pt-3">
              <button
                type="button"
                aria-pressed={semantic}
                onClick={() => {
                  if (semanticButtonDisabled) {
                    return
                  }

                  setSemantic((prev) => !prev)
                }}
                disabled={semanticButtonDisabled}
                className={`min-h-[44px] border-4 px-3 py-2 font-mono text-xs font-bold uppercase transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-background disabled:hover:text-foreground ${semantic
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground bg-background text-foreground hover:bg-foreground hover:text-background"
                  }`}
              >
                {semantic ? t("search.semanticOn", "SEMANTIC ON") : t("search.semanticOff", "SEMANTIC OFF")}
              </button>
              {semantic ? (
                <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  {t("search.semanticHint", "의미 기반 유사도 우선으로 결과를 정렬합니다")}
                </p>
              ) : !hasActiveFilters ? (
                <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  {t("search.semanticNeedsFilter", "검색어 또는 필터를 먼저 지정하세요")}
                </p>
              ) : null}
            </div>
          </section>

          {queryString.length === 0 ? (
            <EmptyState
              title={t("search.setFilterPrompt", "SET A QUERY OR FILTER")}
              description={t("search.setFilterPromptDesc", "검색어, 상태, 태그, 날짜 중 하나를 선택하면 결과를 표시합니다")}
            />
          ) : null}

          {result.isFetching && queryString.length > 0 ? (
            <p className="mb-4 font-mono text-[10px] font-bold uppercase text-muted-foreground">
              {t("search.searching", "SEARCHING...")}
            </p>
          ) : null}

          {result.isLoading && !result.data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-48 md:h-72 w-full" />
              ))}
            </div>
          ) : null}

          {result.error ? <ErrorState message={result.error.message} onRetry={() => result.refetch()} /> : null}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {(result.data?.data ?? []).map((record) => (
              <Link
                key={record.id}
                href={toRecordHref(record.id)}
                onMouseEnter={() => prefetchRecord(record.id)}
                onFocus={() => prefetchRecord(record.id)}
                className="group flex h-48 flex-col border-[3px] md:border-4 border-foreground bg-card p-4 md:p-5 shadow-brutal-sm md:shadow-brutal hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none transition-all md:h-72"
              >
                <div className="flex gap-2 mb-3">
                  {record.favicon_url && (
                    <img
                      src={record.favicon_url}
                      alt=""
                      width={16}
                      height={16}
                      className="w-4 h-4 mt-0.5 flex-shrink-0 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                    />
                  )}
                  <span className="font-mono text-[10px] font-bold border-2 border-current px-1.5 py-0.5 uppercase group-hover:border-background">
                    {record.kind}
                  </span>
                  <span className="font-mono text-[10px] font-bold border-2 border-current px-1.5 py-0.5 uppercase group-hover:border-background">
                    {getStateLabel(record.state, t)}
                  </span>
                </div>
                {semantic && typeof record.semantic_score === "number" ? (
                  <p className="mb-2 font-mono text-[10px] font-bold uppercase text-accent group-hover:text-background/80">
                    {t("search.semanticScore", "SEMANTIC SCORE")}: {record.semantic_score.toFixed(2)}
                  </p>
                ) : null}
                <p className="font-bold text-lg leading-tight line-clamp-5 flex-1">
                  {stripMarkdown(record.content)}
                </p>
                {semantic && record.semantic_matches && record.semantic_matches.length > 0 ? (
                  <p className="mt-2 font-mono text-[10px] font-bold uppercase text-muted-foreground line-clamp-1 group-hover:text-background/70">
                    {t("search.semanticMatches", "MATCHES")}: {record.semantic_matches.join(", ")}
                  </p>
                ) : null}
                {record.source_title ? (
                  <p className="mt-3 font-mono text-[10px] uppercase font-bold text-muted-foreground group-hover:text-background/70 truncate">
                    REF: {record.source_title}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>

          {queryString.length > 0 && result.isSuccess && result.data.data.length === 0 ? (
            <EmptyState
              title={t("search.noResults", "NO RESULTS")}
              actionLabel={t("search.goCapture", "Go capture")}
              actionHref="/capture"
            />
          ) : null}
        </main>
      </AuthGate>
    </div>
  )
}
