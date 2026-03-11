"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import AuthGate from "@shared/auth/auth-gate"
import ProtectedPageShell from "@shared/layout/protected-page-shell"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import type { RecordRow } from "@/lib/types"
import { EmptyState } from "@shared/ui/empty-state"
import { ErrorState } from "@shared/ui/error-state"
import { Skeleton } from "@shared/ui/skeleton"
import { SearchControls } from "./_components/search-controls"
import { SearchResultCard } from "./_components/search-result-card"
import { useSearchFilters } from "./_hooks/use-search-filters"
import { useSearchQueries } from "./_hooks/use-search-queries"

export default function SearchPage() {
  const { t } = useI18n()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { q, setQ, debouncedQ, state, setState, tagId, setTagId, fromDate, setFromDate, toDate, setToDate, semantic, setSemantic, hasActiveFilters, hasCommittedFilters, semanticButtonDisabled, queryString } = useSearchFilters()
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showFilters, setShowFilters] = useState(false)
  const controlClassName = "min-h-[44px] w-full min-w-0 rounded-none border-4 border-foreground bg-background p-3 font-mono text-xs text-foreground shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-0 dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)]"
  const queryClient = useQueryClient()
  const { tags, result, prefetchRecord } = useSearchQueries({ queryClient, queryString })

  const searchBackHref = queryString ? `/search?${queryString}` : "/search"

  const toRecordHref = useCallback(
    (recordId: string) => `/records/${recordId}?from=${encodeURIComponent(searchBackHref)}`,
    [searchBackHref]
  )

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
    if (showFilters) {
      inputRef.current?.focus()
    }
  }, [showFilters])

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

          <SearchControls
            t={t}
            inputRef={inputRef}
            q={q}
            setQ={setQ}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            hasActiveFilters={hasActiveFilters}
            state={state}
            setState={setState}
            tagId={tagId}
            setTagId={setTagId}
            fromDate={fromDate}
            setFromDate={setFromDate}
            toDate={toDate}
            setToDate={setToDate}
            semantic={semantic}
            setSemantic={setSemantic}
            semanticButtonDisabled={semanticButtonDisabled}
            controlClassName={controlClassName}
            tags={tags.data?.data ?? []}
          />

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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {(result.data?.data ?? []).map((record, index) => (
              <SearchResultCard
                key={record.id}
                t={t}
                record={record}
                index={index}
                activeIndex={activeIndex}
                semantic={semantic}
                debouncedQ={debouncedQ}
                toRecordHref={toRecordHref}
                onPrefetch={prefetchRecord}
                onFocusIndex={setActiveIndex}
              />
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
