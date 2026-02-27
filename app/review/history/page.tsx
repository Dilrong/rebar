"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Clock3, Loader2 } from "lucide-react"
import AuthGate from "@/components/auth/auth-gate"
import AppNav from "@/components/layout/app-nav"
import { useI18n } from "@/components/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"

type ReviewHistoryItem = {
  id: string
  record_id: string
  reviewed_at: string
  action: "reviewed" | "resurface" | "undo"
  record: {
    id: string
    kind: string
    source_title: string | null
    content_preview: string
  } | null
}

type ReviewHistoryResponse = {
  data: ReviewHistoryItem[]
  total: number
}

const PAGE_SIZE = 20

export default function ReviewHistoryPage() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [action, setAction] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE)
  })

  if (action) {
    queryParams.set("action", action)
  }
  if (from) {
    queryParams.set("from", from)
  }
  if (to) {
    queryParams.set("to", to)
  }

  const history = useQuery({
    queryKey: ["review-history", page, action, from, to],
    queryFn: () =>
      apiFetch<ReviewHistoryResponse>(`/api/review/history?${queryParams.toString()}`)
  })

  const total = history.data?.total ?? 0
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen p-6 bg-background font-sans selection:bg-accent selection:text-white">
      <AuthGate>
      <main className="max-w-5xl mx-auto animate-fade-in-up pb-24">
          <AppNav />

        <header className="mb-8 border-b-4 border-foreground pb-4 flex items-end justify-between">
          <h1 className="font-black text-5xl uppercase text-foreground leading-none flex items-center gap-3">
            <Clock3 className="w-10 h-10" strokeWidth={3} /> {t("history.title", "REVIEW HISTORY")}
          </h1>
          <Link
            href="/review"
            className="font-mono text-xs font-bold uppercase border-2 border-foreground px-3 py-1 bg-background hover:bg-foreground hover:text-background"
          >
            {t("history.back", "BACK TO REVIEW")}
          </Link>
        </header>

        <section className="mb-6 border-4 border-foreground bg-card p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="font-mono text-xs font-bold uppercase">
              {t("history.action", "Action")}
              <select
                value={action}
                onChange={(event) => {
                  setAction(event.target.value)
                  setPage(1)
                }}
                className="block mt-1 bg-background border-2 border-foreground text-foreground px-2 py-2 font-mono text-xs"
              >
                <option value="">ALL</option>
                <option value="reviewed">REVIEWED</option>
                <option value="resurface">RESURFACE</option>
                <option value="undo">UNDO</option>
              </select>
            </label>
            <label className="font-mono text-xs font-bold uppercase">
              {t("history.from", "From")}
              <input
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value)
                  setPage(1)
                }}
                className="block mt-1 bg-background border-2 border-foreground text-foreground px-2 py-2 font-mono text-xs"
              />
            </label>
            <label className="font-mono text-xs font-bold uppercase">
              {t("history.to", "To")}
              <input
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value)
                  setPage(1)
                }}
                className="block mt-1 bg-background border-2 border-foreground text-foreground px-2 py-2 font-mono text-xs"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setAction("")
                setFrom("")
                setTo("")
                setPage(1)
              }}
              className="px-3 py-2 border-2 border-foreground font-mono text-xs font-bold uppercase bg-background text-foreground"
            >
              {t("history.reset", "RESET")}
            </button>
          </div>
        </section>

        {history.isLoading ? (
          <div className="flex items-center gap-2 font-mono text-sm font-bold uppercase text-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> {t("history.loading", "Loading history...")}
          </div>
        ) : null}

        {history.error ? (
          <div className="bg-destructive text-white p-4 font-mono text-xs font-bold uppercase border-4 border-foreground">
            ERR: {history.error.message}
          </div>
        ) : null}

        <div className="space-y-3">
          {(history.data?.data ?? []).map((item) => (
            <article key={item.id} className="border-4 border-foreground bg-card p-4">
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <span className="font-mono text-[10px] font-bold border-2 border-current px-1.5 py-0.5 uppercase">
                  {item.action}
                </span>
                <span className="font-mono text-[10px] font-bold border-2 border-current px-1.5 py-0.5 uppercase">
                  {new Date(item.reviewed_at).toLocaleString()}
                </span>
              </div>
              {item.record ? (
                <Link href={`/records/${item.record.id}`} className="block hover:opacity-80">
                  <p className="font-mono text-xs font-bold uppercase mb-1">
                    {item.record.kind}
                    {item.record.source_title ? ` · ${item.record.source_title}` : ""}
                  </p>
                  <p className="font-semibold text-sm line-clamp-3">{item.record.content_preview}</p>
                </Link>
              ) : (
                <p className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  {t("history.notFound", "RECORD NOT FOUND")}
                </p>
              )}
            </article>
          ))}
        </div>

        {history.isSuccess && history.data.data.length === 0 ? (
          <div className="mt-8 border-4 border-dashed border-border p-8 text-center">
            <p className="font-black text-2xl uppercase text-muted-foreground">{t("history.empty", "NO HISTORY")}</p>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between border-2 border-foreground p-3">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="font-mono text-xs font-bold uppercase border-2 border-foreground px-3 py-1 disabled:opacity-50"
          >
            {t("history.prev", "Prev")}
          </button>
          <span className="font-mono text-xs font-bold uppercase">
            {t("history.page", "Page")} {page} / {maxPage}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(maxPage, prev + 1))}
            disabled={page >= maxPage}
            className="font-mono text-xs font-bold uppercase border-2 border-foreground px-3 py-1 disabled:opacity-50"
          >
            {t("history.next", "Next")}
          </button>
        </div>
      </main>
      </AuthGate>
    </div>
  )
}
