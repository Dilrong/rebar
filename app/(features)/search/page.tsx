"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { Filter, Search } from "lucide-react"
import AuthGate from "@shared/auth/auth-gate"
import ProtectedPageShell from "@shared/layout/protected-page-shell"
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function highlightText(text: string, query: string) {
  const tokens = Array.from(
    new Set(
      query
        .trim()
        .split(/\s+/)
        .filter((token) => token.length > 0)
    )
  )

  if (tokens.length === 0) {
    return text
  }

  const matcher = new RegExp(`(${tokens.map((token) => escapeRegExp(token)).join("|")})`, "gi")

  return text.split(matcher).map((part, index) => {
    if (tokens.some((token) => token.toLowerCase() === part.toLowerCase())) {
      return (
        <mark key={`${part}-${index}`} className="bg-accent text-accent-foreground border-2 border-foreground px-1 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)]">
          {part}
        </mark>
      )
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>
  })
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
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showFilters, setShowFilters] = useState(false)
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

  const toRecordHref = useCallback(
    (recordId: string) => `/records/${recordId}?from=${encodeURIComponent(searchBackHref)}`,
    [searchBackHref]
  )

  const queryClient = useQueryClient()
  const prefetchRecord = useCallback((id: string) => {
    queryClient.prefetchQuery({
      queryKey: ["record-detail", id],
      queryFn: () => apiFetch<{ record: RecordRow }>(`/api/records/${id}`),
      staleTime: 1000 * 60 * 5
    })
  }, [queryClient])

  useEffect(() => {
    const resultLength = result.data?.data.length ?? 0
    if (resultLength === 0) {
      setActiveIndex(-1)
      return
    }

    setActiveIndex((current) => {
      if (current < 0) {
        return 0
      }

      return Math.min(current, resultLength - 1)
    })
  }, [result.data?.data.length])

  useEffect(() => {
    const rows = result.data?.data ?? []
    if (rows.length === 0) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && target.tagName === "SELECT") {
        return
      }

      if (target && target.tagName === "INPUT" && target.id !== "search-query") {
        return
      }

      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActiveIndex((current) => (current + 1) % rows.length)
        return
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        setActiveIndex((current) => (current <= 0 ? rows.length - 1 : current - 1))
        return
      }

      if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault()
        router.push(toRecordHref(rows[activeIndex]!.id))
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeIndex, result.data?.data, router, toRecordHref])

  return (
    <AuthGate>
      <ProtectedPageShell rootClassName="selection:bg-accent selection:text-white md:p-6" mainClassName="max-w-5xl pb-24">

          <header className="mb-8 border-b-4 border-foreground pb-4">
            <h1 className="flex items-start gap-3 text-3xl font-black uppercase leading-none text-foreground sm:items-center sm:text-4xl md:text-5xl">
              <Search className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={3} /> {t("search.title", "SEARCH")}
            </h1>
          </header>

          <section className="border-[3px] md:border-4 border-foreground bg-card p-3 md:p-4 mb-4 md:mb-6 shadow-brutal-sm md:shadow-brutal flex flex-col gap-4">
            <div className="flex gap-2 w-full">
              <label htmlFor="search-query" className="sr-only">
                {t("search.placeholder", "content / source title")}
              </label>
              <input
                id="search-query"
                value={q}
                autoFocus
                onChange={(event) => setQ(event.target.value)}
                placeholder={t("search.placeholder", "content / source title")}
                className={`${controlClassName} flex-1 placeholder:font-mono placeholder:text-xs placeholder:text-muted-foreground`}
              />
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={`flex min-h-[44px] items-center justify-center gap-2 border-[3px] px-4 font-mono text-xs font-bold transition-all active:translate-x-1 active:translate-y-1 active:shadow-none md:border-4 ${showFilters || hasActiveFilters
                    ? "border-foreground bg-foreground text-background shadow-none translate-x-1 translate-y-1"
                    : "border-foreground bg-accent text-accent-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-foreground hover:text-background dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.1)]"
                  }`}
                aria-expanded={showFilters}
              >
                <Filter className="h-4 w-4" strokeWidth={3} />
                <span className="hidden sm:inline">
                  {showFilters ? t("search.hideFilters", "HIDE FILTERS") : t("search.showFilters", "FILTERS")}
                </span>
                {hasActiveFilters && !showFilters ? (
                  <span className="flex h-4 w-4 items-center justify-center border-2 border-background bg-accent text-[10px] text-accent-foreground">
                    !
                  </span>
                ) : null}
              </button>
            </div>

            {showFilters ? (
              <div className="animate-fade-in-up flex flex-col gap-4 border-t-4 border-foreground pt-4">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label htmlFor="search-state" className="mb-1 block font-mono text-[10px] font-bold uppercase text-muted-foreground">
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
                  </div>
                  <div>
                    <label htmlFor="search-tag" className="mb-1 block font-mono text-[10px] font-bold uppercase text-muted-foreground">
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
                  </div>
                  <div>
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
                  <div>
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

                <div className="flex flex-wrap items-center gap-2 border-t-2 border-foreground pt-3">
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
              </div>
            ) : null}
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
            {(result.data?.data ?? []).map((record, index) => (
              <Link
                key={record.id}
                href={toRecordHref(record.id)}
                onMouseEnter={() => prefetchRecord(record.id)}
                onFocus={() => {
                  prefetchRecord(record.id)
                  setActiveIndex(index)
                }}
                className={`group flex h-48 flex-col border-[3px] md:border-4 border-foreground bg-card p-4 md:p-5 shadow-brutal-sm md:shadow-brutal hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none transition-all md:h-72 ${activeIndex === index ? "bg-foreground text-background translate-x-1 translate-y-1 shadow-none" : ""}`}
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
                  {highlightText(stripMarkdown(record.content), debouncedQ)}
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
      </ProtectedPageShell>
    </AuthGate>
  )
}
