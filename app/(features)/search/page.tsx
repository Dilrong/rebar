"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import AuthGate from "@shared/auth/auth-gate"
import ProtectedPageShell from "@shared/layout/protected-page-shell"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import type { RecordRow } from "@/lib/types"
import { SearchControls } from "./_components/search-controls"
import { SearchResultsState } from "./_components/search-results-state"
import { useSearchFilters } from "./_hooks/use-search-filters"
import { useSearchKeyboardNavigation } from "./_hooks/use-search-keyboard-navigation"
import { useSearchQueries } from "./_hooks/use-search-queries"

export default function SearchPage() {
  const { t } = useI18n()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { q, setQ, debouncedQ, state, setState, tagId, setTagId, fromDate, setFromDate, toDate, setToDate, semantic, setSemantic, hasActiveFilters, hasCommittedFilters, semanticButtonDisabled, queryString } = useSearchFilters()
  const [showFilters, setShowFilters] = useState(false)
  const controlClassName = "min-h-[44px] w-full min-w-0 rounded-none border-4 border-foreground bg-background p-3 font-mono text-xs text-foreground shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:ring-0 dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)]"
  const queryClient = useQueryClient()
  const { tags, result, prefetchRecord } = useSearchQueries({ queryClient, queryString })

  const searchBackHref = queryString ? `/search?${queryString}` : "/search"

  const toRecordHref = useCallback(
    (recordId: string) => `/records/${recordId}?from=${encodeURIComponent(searchBackHref)}`,
    [searchBackHref]
  )
  const { activeIndex, setActiveIndex } = useSearchKeyboardNavigation({
    rows: result.data?.data ?? [],
    inputRef,
    showFilters,
    router,
    toRecordHref
  })

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

          <SearchResultsState
            t={t}
            queryString={queryString}
            isFetching={result.isFetching && queryString.length > 0}
            isLoading={result.isLoading}
            hasData={Boolean(result.data)}
            errorMessage={result.error?.message ?? null}
            onRetry={() => result.refetch()}
            results={result.data?.data ?? []}
            activeIndex={activeIndex}
            semantic={semantic}
            debouncedQ={debouncedQ}
            toRecordHref={toRecordHref}
            onPrefetch={prefetchRecord}
            onFocusIndex={setActiveIndex}
          />
      </ProtectedPageShell>
    </AuthGate>
  )
}
