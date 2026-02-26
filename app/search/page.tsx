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
import { LoadingSpinner } from "@/components/ui/loading"

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
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-full bg-background border-2 border-foreground text-foreground p-3 font-mono text-xs"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-full bg-background border-2 border-foreground text-foreground p-3 font-mono text-xs"
                />
              </div>
            </div>
          </section>

          {result.isFetching ? (
            <div className="flex items-center gap-3 font-mono text-sm font-bold uppercase text-foreground py-4">
              <LoadingSpinner className="w-5 h-5 text-accent" />
              <span>{t("search.scanning", "Scanning index...")}</span>
            </div>
          ) : null}

          {result.error ? (
            <div className="bg-destructive text-white p-4 font-mono text-xs font-bold uppercase border-4 border-foreground">
              ERR: {result.error.message}
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(result.data?.data ?? []).map((record) => (
              <Link
                key={record.id}
                href={`/records/${record.id}`}
                className="group flex flex-col border-4 border-foreground bg-card hover:bg-foreground hover:text-background transition-colors p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] h-64 md:h-72"
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
            <div className="mt-8 border-4 border-dashed border-border p-8 text-center">
              <p className="font-black text-2xl uppercase text-muted-foreground">{t("search.noResults", "NO RESULTS")}</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQ("")
                    setState("")
                    setTagId("")
                    setFromDate("")
                    setToDate("")
                  }}
                  className="border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase text-foreground"
                >
                  {t("search.clear", "Clear search")}
                </button>
                <Link
                  href="/capture"
                  className="border-2 border-foreground bg-foreground px-3 py-2 font-mono text-xs font-bold uppercase text-background"
                >
                  {t("search.goCapture", "Go capture")}
                </Link>
              </div>
            </div>
          ) : null}
        </main>
      </AuthGate>
    </div>
  )
}
