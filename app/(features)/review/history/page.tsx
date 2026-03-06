"use client"

import Link from "next/link"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Clock3, Loader2 } from "lucide-react"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"

type ReviewHistoryItem = {
  id: string
  record_id: string
  reviewed_at: string
  action: "reviewed" | "resurface" | "undo"
  decision_type: "ARCHIVE" | "ACT" | "DEFER" | null
  action_type: "EXPERIMENT" | "SHARE" | "TODO" | null
  defer_reason: "NEED_INFO" | "LOW_CONFIDENCE" | "NO_TIME" | null
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

function formatActionLabel(action: ReviewHistoryItem["action"], t: (key: string, fallback: string) => string): string {
  if (action === "reviewed") return t("history.action.reviewed", "REVIEWED")
  if (action === "resurface") return t("history.action.resurface", "RESURFACE")
  return t("history.action.undo", "UNDO")
}

function formatDecisionLabel(
  decisionType: ReviewHistoryItem["decision_type"],
  t: (key: string, fallback: string) => string
): string {
  if (decisionType === "ARCHIVE") return t("review.triage.archive", "보관")
  if (decisionType === "ACT") return t("review.triage.act", "실행")
  return t("review.triage.defer", "보류")
}

function formatActionTypeLabel(
  actionType: ReviewHistoryItem["action_type"],
  t: (key: string, fallback: string) => string
): string {
  if (actionType === "EXPERIMENT") return t("review.actionType.experiment", "실험")
  if (actionType === "SHARE") return t("review.actionType.share", "공유")
  return t("review.actionType.todo", "할일")
}

function formatDeferReasonLabel(
  deferReason: ReviewHistoryItem["defer_reason"],
  t: (key: string, fallback: string) => string
): string {
  if (deferReason === "NEED_INFO") return t("review.deferReason.needInfo", "정보부족")
  if (deferReason === "LOW_CONFIDENCE") return t("review.deferReason.lowConfidence", "중요도불명")
  return t("review.deferReason.noTime", "시간없음")
}

const PAGE_SIZE = 20

export default function ReviewHistoryPage() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [action, setAction] = useState("")
  const [decisionType, setDecisionType] = useState("")
  const [actionType, setActionType] = useState("")
  const [deferReason, setDeferReason] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE)
  })

  if (action) {
    queryParams.set("action", action)
  }
  if (decisionType) {
    queryParams.set("decision_type", decisionType)
  }
  if (actionType) {
    queryParams.set("action_type", actionType)
  }
  if (deferReason) {
    queryParams.set("defer_reason", deferReason)
  }
  if (from) {
    queryParams.set("from", from)
  }
  if (to) {
    queryParams.set("to", to)
  }

  const history = useQuery({
    queryKey: ["review-history", page, action, decisionType, actionType, deferReason, from, to],
    queryFn: () =>
      apiFetch<ReviewHistoryResponse>(`/api/review/history?${queryParams.toString()}`),
    staleTime: 1000 * 60 * 2 // 2 minutes
  })

  const total = history.data?.total ?? 0
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-background p-4 font-sans selection:bg-accent selection:text-white md:p-6">
      <AuthGate>
        <main className="mx-auto w-full max-w-5xl animate-fade-in-up pb-24">
          <AppNav />

          <header className="mb-8 flex flex-col gap-3 border-b-4 border-foreground pb-4 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="flex items-center gap-3 text-3xl font-black uppercase leading-none text-foreground md:text-5xl">
              <Clock3 className="w-10 h-10" strokeWidth={3} /> {t("history.title", "REVIEW HISTORY")}
            </h1>
            <Link
              href="/review"
              className="inline-flex min-h-[44px] items-center justify-center border-2 border-foreground bg-background px-3 py-1 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background"
            >
              {t("history.back", "BACK TO REVIEW")}
            </Link>
          </header>

          <section className="mb-6 border-4 border-foreground bg-card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label htmlFor="history-action" className="font-mono text-xs font-bold uppercase">
                {t("history.action", "Action")}
                <select
                  id="history-action"
                  aria-label={t("history.action", "Action")}
                  value={action}
                  onChange={(event) => {
                    setAction(event.target.value)
                    setPage(1)
                  }}
                  className="block mt-1 min-h-[44px] bg-background border-2 border-foreground text-foreground px-2 py-2 font-mono text-xs w-full"
                >
                  <option value="">ALL</option>
                  <option value="reviewed">REVIEWED</option>
                  <option value="resurface">RESURFACE</option>
                  <option value="undo">UNDO</option>
                </select>
              </label>
              <label htmlFor="history-decision-type" className="font-mono text-xs font-bold uppercase">
                {t("history.decision", "결정")}
                <select
                  id="history-decision-type"
                  aria-label={t("history.decision", "결정")}
                  value={decisionType}
                  onChange={(event) => {
                    setDecisionType(event.target.value)
                    setPage(1)
                  }}
                  className="block mt-1 min-h-[44px] bg-background border-2 border-foreground text-foreground px-2 py-2 font-mono text-xs w-full"
                >
                  <option value="">ALL</option>
                  <option value="ARCHIVE">ARCHIVE</option>
                  <option value="ACT">ACT</option>
                  <option value="DEFER">DEFER</option>
                </select>
              </label>
              <label htmlFor="history-action-type" className="font-mono text-xs font-bold uppercase">
                {t("history.actionType", "실행 타입")}
                <select
                  id="history-action-type"
                  aria-label={t("history.actionType", "실행 타입")}
                  value={actionType}
                  onChange={(event) => {
                    setActionType(event.target.value)
                    setPage(1)
                  }}
                  className="block mt-1 min-h-[44px] bg-background border-2 border-foreground text-foreground px-2 py-2 font-mono text-xs w-full"
                >
                  <option value="">ALL</option>
                  <option value="EXPERIMENT">EXPERIMENT</option>
                  <option value="SHARE">SHARE</option>
                  <option value="TODO">TODO</option>
                </select>
              </label>
              <label htmlFor="history-defer-reason" className="font-mono text-xs font-bold uppercase">
                {t("history.deferReason", "보류 사유")}
                <select
                  id="history-defer-reason"
                  aria-label={t("history.deferReason", "보류 사유")}
                  value={deferReason}
                  onChange={(event) => {
                    setDeferReason(event.target.value)
                    setPage(1)
                  }}
                  className="block mt-1 min-h-[44px] bg-background border-2 border-foreground text-foreground px-2 py-2 font-mono text-xs w-full"
                >
                  <option value="">ALL</option>
                  <option value="NEED_INFO">NEED_INFO</option>
                  <option value="LOW_CONFIDENCE">LOW_CONFIDENCE</option>
                  <option value="NO_TIME">NO_TIME</option>
                </select>
              </label>
              <label htmlFor="history-from" className="font-mono text-xs font-bold uppercase">
                {t("history.from", "From")}
                <input
                  id="history-from"
                  aria-label={t("history.from", "From")}
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value)
                    setPage(1)
                  }}
                  className="block mt-1 min-h-[44px] bg-background border-2 border-foreground text-foreground px-2 py-2 font-mono text-xs w-full"
                />
              </label>
              <label htmlFor="history-to" className="font-mono text-xs font-bold uppercase">
                {t("history.to", "To")}
                <input
                  id="history-to"
                  aria-label={t("history.to", "To")}
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value)
                    setPage(1)
                  }}
                  className="block mt-1 min-h-[44px] bg-background border-2 border-foreground text-foreground px-2 py-2 font-mono text-xs w-full"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setAction("")
                  setDecisionType("")
                  setActionType("")
                  setDeferReason("")
                  setFrom("")
                  setTo("")
                  setPage(1)
                }}
                className="min-h-[44px] px-3 py-2 border-2 border-foreground bg-background font-mono text-xs font-bold uppercase text-foreground sm:col-span-2 xl:col-span-4"
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
            <div className="space-y-2">
              <div className="bg-destructive text-destructive-foreground p-4 font-mono text-xs font-bold uppercase border-4 border-foreground">
                ERR: {history.error.message}
              </div>
              <button
                type="button"
                className="min-h-[44px] border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background"
                onClick={() => history.refetch()}
              >
                {t("review.retry", "다시 시도")}
              </button>
            </div>
          ) : null}

          <div className="space-y-3">
            {(history.data?.data ?? []).map((item) => (
              <article key={item.id} className="border-4 border-foreground bg-card p-4">
                <div className="flex flex-wrap gap-2 items-center mb-2">
                  <span className="font-mono text-[10px] font-bold border-2 border-current px-1.5 py-0.5 uppercase">
                    {formatActionLabel(item.action, t)}
                  </span>
                  {item.decision_type ? (
                    <span className="font-mono text-[10px] font-bold border-2 border-current bg-accent/10 px-1.5 py-0.5 uppercase">
                      {formatDecisionLabel(item.decision_type, t)}
                    </span>
                  ) : null}
                  {item.action_type ? (
                    <span className="font-mono text-[10px] font-bold border-2 border-current bg-background px-1.5 py-0.5 uppercase">
                      {formatActionTypeLabel(item.action_type, t)}
                    </span>
                  ) : null}
                  {item.defer_reason ? (
                    <span className="font-mono text-[10px] font-bold border-2 border-current bg-background px-1.5 py-0.5 uppercase">
                      {formatDeferReasonLabel(item.defer_reason, t)}
                    </span>
                  ) : null}
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

          <div className="mt-8 flex flex-col gap-3 border-2 border-foreground p-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="min-h-[44px] px-4 font-mono text-xs font-bold uppercase border-2 border-foreground px-3 py-1 disabled:opacity-50 hover:bg-foreground hover:text-background transition-colors"
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
              className="min-h-[44px] px-4 font-mono text-xs font-bold uppercase border-2 border-foreground px-3 py-1 disabled:opacity-50 hover:bg-foreground hover:text-background transition-colors"
            >
              {t("history.next", "Next")}
            </button>
          </div>
        </main>
      </AuthGate>
    </div>
  )
}
