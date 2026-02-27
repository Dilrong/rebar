"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import AuthGate from "@/components/auth/auth-gate"
import AppNav from "@/components/layout/app-nav"
import { useI18n } from "@/components/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import { getStateLabel } from "@/lib/i18n/state-label"
import type { RecordRow, TagRow } from "@/lib/types"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"

type SearchResponse = {
  data: RecordRow[]
}

type TagsResponse = {
  data: TagRow[]
}

export default function SearchPage() {
  const { t } = useI18n()
  const [q, setQ] = useState("")
  const [state, setState] = useState("")
  const [tagId, setTagId] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagsResponse>("/api/tags")
  })

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (q.trim()) params.set("q", q.trim())
    if (state) params.set("state", state)
    if (tagId) params.set("tag_id", tagId)
    if (fromDate) params.set("from", fromDate)
    if (toDate) params.set("to", toDate)
    return params.toString()
  }, [q, state, tagId, fromDate, toDate])

  const result = useQuery({
    queryKey: ["search", queryString],
    queryFn: () => apiFetch<SearchResponse>(`/api/search?${queryString}`),
    enabled: queryString.length > 0
  })

  return (
    <div className="min-h-screen p-6 bg-background font-sans selection:bg-accent selection:text-white">
      <AuthGate>
        <main className="max-w-5xl mx-auto animate-fade-in-up pb-24">
          <AppNav />

          <header className="mb-8 border-b-4 border-foreground pb-4">
            <h1 className="font-black text-5xl uppercase text-foreground leading-none flex items-center gap-3">
              <Search className="w-10 h-10" strokeWidth={3} /> {t("search.title", "SEARCH")}
            </h1>
          </header>

          <section className="border-4 border-foreground bg-card p-4 mb-6">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5">
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={t("search.placeholder", "content / source title")}
                className="w-full bg-background border-2 border-foreground text-foreground text-lg p-3 lg:col-span-2"
              />
              <select
                value={state}
                onChange={(event) => setState(event.target.value)}
                className="w-full bg-background border-2 border-foreground text-foreground p-3 font-mono text-xs"
              >
                <option value="">{t("search.allStates", "All states")}</option>
                <option value="INBOX">{getStateLabel("INBOX", t)}</option>
                <option value="ACTIVE">{getStateLabel("ACTIVE", t)}</option>
                <option value="PINNED">{getStateLabel("PINNED", t)}</option>
                <option value="ARCHIVED">{getStateLabel("ARCHIVED", t)}</option>
                <option value="TRASHED">{getStateLabel("TRASHED", t)}</option>
              </select>
              <select
                value={tagId}
                onChange={(event) => setTagId(event.target.value)}
                className="w-full bg-background border-2 border-foreground text-foreground p-3 font-mono text-xs"
              >
                <option value="">{t("search.allTags", "All tags")}</option>
                {(tags.data?.data ?? []).map((tag) => (
                  <option key={tag.id} value={tag.id}>#{tag.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-2 lg:col-span-1">
                <div className="w-full">
                  <label htmlFor="search-from-date" className="mb-1 block font-mono text-[10px] font-bold uppercase text-muted-foreground">
                    {t("history.from", "From")}
                  </label>
                  <input
                    id="search-from-date"
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="w-full bg-background border-2 border-foreground text-foreground p-3 font-mono text-xs"
                  />
                </div>
                <div className="w-full">
                  <label htmlFor="search-to-date" className="mb-1 block font-mono text-[10px] font-bold uppercase text-muted-foreground">
                    {t("history.to", "To")}
                  </label>
                  <input
                    id="search-to-date"
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="w-full bg-background border-2 border-foreground text-foreground p-3 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </section>

          {result.isFetching ? <LoadingState label={t("search.scanning", "Scanning index...")} /> : null}

          {result.error ? <ErrorState message={result.error.message} onRetry={() => result.refetch()} /> : null}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(result.data?.data ?? []).map((record) => (
              <Link
                key={record.id}
                href={`/records/${record.id}`}
                className="group flex h-64 flex-col border-4 border-foreground bg-card p-5 shadow-brutal hover:bg-foreground hover:text-background transition-colors md:h-72"
              >
                <div className="flex gap-2 mb-3">
                  <span className="font-mono text-[10px] font-bold border-2 border-current px-1.5 py-0.5 uppercase">
                    {record.kind}
                  </span>
                  <span className="font-mono text-[10px] font-bold border-2 border-current px-1.5 py-0.5 uppercase">
                    {getStateLabel(record.state, t)}
                  </span>
                </div>
                <p className="font-bold text-lg leading-tight line-clamp-5 flex-1">{record.content}</p>
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
