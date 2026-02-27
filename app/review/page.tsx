"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRef, useState } from "react"
import AuthGate from "@/components/auth/auth-gate"
import AppNav from "@/components/layout/app-nav"
import { useI18n } from "@/components/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import { getStateLabel } from "@/lib/i18n/state-label"
import type { RecordRow } from "@/lib/types"
import { Check, RefreshCcw } from "lucide-react"
import { LoadingSpinner, LoadingDots } from "@/components/ui/loading"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { Toast } from "@/components/ui/toast"

type ReviewTodayResponse = {
  data: RecordRow[]
  total: number
}

type ReviewStatsResponse = {
  today_reviewed: number
  today_remaining: number
  streak_days: number
  total_active: number
  total_records: number
}

export default function ReviewPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [undoTargetId, setUndoTargetId] = useState<string | null>(null)
  const undoTimerRef = useRef<number | null>(null)

  const stats = useQuery({
    queryKey: ["review-stats"],
    queryFn: () => apiFetch<ReviewStatsResponse>("/api/review/stats")
  })

  const today = useQuery({
    queryKey: ["review-today"],
    queryFn: () => apiFetch<ReviewTodayResponse>("/api/review/today?n=20")
  })

  const mutation = useMutation({
    mutationFn: async ({ id, action, snooze_days }: { id: string; action: "reviewed" | "resurface"; snooze_days?: number }) =>
      apiFetch<{ record: RecordRow }>(`/api/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, snooze_days })
      }),
    onSuccess: (_data, variables) => {
      setUndoTargetId(variables.id)
      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current)
      }
      undoTimerRef.current = window.setTimeout(() => {
        setUndoTargetId(null)
        undoTimerRef.current = null
      }, 4000)

      queryClient.invalidateQueries({ queryKey: ["review-today"] })
      queryClient.invalidateQueries({ queryKey: ["review-stats"] })
    }
  })

  const undoMutation = useMutation({
    mutationFn: (id: string) => apiFetch<{ record: RecordRow }>(`/api/review/${id}/undo`, { method: "POST" }),
    onSuccess: () => {
      setUndoTargetId(null)
      queryClient.invalidateQueries({ queryKey: ["review-today"] })
      queryClient.invalidateQueries({ queryKey: ["review-stats"] })
    }
  })

  const first = today.data?.data[0]
  const nextQueue = today.data?.data.slice(1, 6) ?? []

  return (
    <div className="min-h-screen p-6 bg-background flex flex-col font-sans">
      <AuthGate>
        <main className="max-w-3xl w-full mx-auto flex-1 flex flex-col animate-fade-in-up">
          <AppNav />

          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between border-4 border-foreground bg-card p-4 shadow-brutal gap-4">
            <span className="font-mono text-sm font-bold tracking-widest uppercase text-foreground">
              {t("review.workload", "TODAY'S REVIEW")}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/review/history"
                className="min-h-[44px] flex items-center justify-center font-mono text-xs font-bold uppercase border-2 border-foreground px-4 py-3 bg-background hover:bg-foreground hover:text-background shadow-brutal-sm transition-colors"
              >
                {t("review.history", "HISTORY")}
              </Link>
              <div className="min-h-[44px] flex items-center justify-center font-mono text-sm font-bold bg-foreground text-background px-4 py-3 shadow-brutal-sm">
                {t("review.remaining", "REMAINING")}: {today.data?.total || 0}
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 border-4 border-foreground bg-card p-6 md:grid-cols-4 shadow-brutal">
            <p className="font-mono text-xs font-bold uppercase">REVIEWED: {stats.data?.today_reviewed ?? 0}</p>
            <p className="font-mono text-xs font-bold uppercase">REMAINING: {stats.data?.today_remaining ?? 0}</p>
            <p className="font-mono text-xs font-bold uppercase">STREAK: {stats.data?.streak_days ?? 0}d</p>
            <p className="font-mono text-xs font-bold uppercase">TOTAL: {stats.data?.total_records ?? 0}</p>
          </div>

          {today.isLoading ? <LoadingState label={t("review.fetching", "Fetching blocks...")} /> : null}

          {today.isSuccess && !first && (
            <EmptyState
              title={t("review.empty", "ALL CAUGHT UP")}
              description={t("review.noPending", "No pending operations.")}
              actionLabel={t("review.goCapture", "Add new item")}
              actionHref="/capture"
            />
          )}

          {first && (
            <div className="relative flex w-full flex-1 flex-col border-4 border-foreground bg-card p-6 shadow-brutal md:p-10" key={first.id}>
              <div className="flex-1 flex flex-col py-6">
                <div className="flex items-center gap-2 mb-8 border-b-2 border-foreground pb-4">
                  <span className="bg-muted text-muted-foreground font-mono text-xs font-bold px-2 py-1 uppercase border-2 border-muted-foreground">ID: {first.id.substring(0, 8)}</span>
                  {first.source_title && (
                    <span className="font-mono text-xs font-bold text-foreground bg-accent/20 px-2 py-1 uppercase truncate border-2 border-accent">
                      REF: {first.source_title}
                    </span>
                  )}
                </div>

                <blockquote className="font-semibold text-2xl md:text-3xl text-foreground leading-[1.5] whitespace-pre-wrap">
                  {first.content}
                </blockquote>
              </div>

              {/* Desktop grid layout / Mobile sticky bottom wrapper */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-8 md:border-t-4 md:border-foreground max-md:fixed max-md:bottom-[80px] max-md:left-0 max-md:right-0 max-md:z-30 max-md:p-4 max-md:bg-background max-md:border-t-4 max-md:border-foreground max-md:shadow-[0_-4px_0_0_rgba(0,0,0,1)] dark:max-md:shadow-[0_-4px_0_0_rgba(255,255,255,0.1)]">
                <button
                  type="button"
                  onClick={() => mutation.mutate({ id: first.id, action: "reviewed" })}
                  disabled={mutation.isPending}
                  aria-label={t("review.ack", "ACKNOWLEDGE")}
                  className="group flex flex-col items-center justify-center p-4 md:p-6 bg-accent text-white border-4 border-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 space-y-2 md:space-y-4 cursor-pointer rounded-none active:translate-y-1 min-h-[80px] md:min-h-[140px]"
                >
                  {mutation.isPending && mutation.variables?.action === "reviewed" ? (
                    <LoadingDots />
                  ) : (
                    <Check className="w-6 h-6 md:w-8 md:h-8" strokeWidth={4} />
                  )}
                  <span className="font-black text-sm md:text-xl uppercase tracking-wider text-center">
                    {mutation.isPending && mutation.variables?.action === "reviewed"
                      ? t("review.processing", "Processing...")
                      : t("review.ack", "ACKNOWLEDGE")}
                  </span>
                </button>

                <div className="border-4 border-foreground p-3 bg-card max-md:hidden">
                  <button
                    type="button"
                    onClick={() => mutation.mutate({ id: first.id, action: "resurface" })}
                    disabled={mutation.isPending}
                    aria-label={t("review.resurface", "RESURFACE")}
                    className="group flex w-full flex-col items-center justify-center p-4 bg-background text-foreground border-2 border-foreground hover:bg-muted transition-colors disabled:opacity-50 space-y-3 cursor-pointer rounded-none active:translate-y-1"
                  >
                    {mutation.isPending && mutation.variables?.action === "resurface" ? (
                      <LoadingDots />
                    ) : (
                      <RefreshCcw className="w-6 h-6" strokeWidth={3} />
                    )}
                    <span className="font-black text-base uppercase tracking-wider text-center">
                      {mutation.isPending && mutation.variables?.action === "resurface"
                        ? t("review.relocating", "Relocating...")
                        : t("review.resurface", "RESURFACE")}
                    </span>
                  </button>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => mutation.mutate({ id: first.id, action: "resurface", snooze_days: 1 })}
                      aria-label={t("review.snooze1", "Tomorrow")}
                      className="min-h-[44px] min-w-[44px] border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-colors"
                      disabled={mutation.isPending}
                    >
                      {t("review.snooze1", "내일")}
                    </button>
                    <button
                      type="button"
                      onClick={() => mutation.mutate({ id: first.id, action: "resurface", snooze_days: 3 })}
                      aria-label={t("review.snooze3", "3 days")}
                      className="min-h-[44px] min-w-[44px] border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-colors"
                      disabled={mutation.isPending}
                    >
                      {t("review.snooze3", "3일")}
                    </button>
                    <button
                      type="button"
                      onClick={() => mutation.mutate({ id: first.id, action: "resurface", snooze_days: 7 })}
                      aria-label={t("review.snooze7", "1 week")}
                      className="min-h-[44px] min-w-[44px] border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background transition-colors"
                      disabled={mutation.isPending}
                    >
                      {t("review.snooze7", "1주")}
                    </button>
                  </div>
                </div>

                {/* Mobile simplified resurface row (visible only on small screens) */}
                <div className="md:hidden flex gap-2 w-full mt-2">
                  <button
                    type="button"
                    onClick={() => mutation.mutate({ id: first.id, action: "resurface" })}
                    disabled={mutation.isPending}
                    aria-label={t("review.resurface", "RESURFACE")}
                    className="flex-1 min-h-[44px] flex items-center justify-center bg-background text-foreground border-4 border-foreground hover:bg-muted active:translate-y-1"
                  >
                    {mutation.isPending && mutation.variables?.action === "resurface" ? (
                      <LoadingDots />
                    ) : (
                      <div className="flex items-center gap-2">
                        <RefreshCcw className="w-4 h-4" strokeWidth={3} />
                        <span className="font-black text-xs uppercase text-center">
                          {t("review.resurface", "RESURFACE")}
                        </span>
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => mutation.mutate({ id: first.id, action: "resurface", snooze_days: 1 })}
                    aria-label={t("review.snooze1", "Tomorrow")}
                    className="min-h-[44px] w-[60px] border-4 border-foreground font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background bg-card"
                    disabled={mutation.isPending}
                  >
                    +1d
                  </button>
                </div>
              </div>

              {mutation.error ? <ErrorState message={mutation.error.message} /> : null}
            </div>
          )}

          {nextQueue.length > 0 ? (
            <section className="mt-8 border-4 border-foreground bg-card p-6 shadow-brutal">
              <h2 className="font-black text-2xl uppercase mb-4 border-l-4 border-accent pl-4">{t("review.upNext", "UP NEXT")}</h2>
              <div className="space-y-3">
                {nextQueue.map((record) => (
                  <Link
                    key={record.id}
                    href={`/records/${record.id}`}
                    className="block min-h-[44px] border-2 border-foreground px-4 py-3 hover:bg-foreground hover:text-background transition-colors"
                  >
                    <p className="font-mono text-xs font-bold uppercase mb-2">{record.kind} · {getStateLabel(record.state, t)}</p>
                    <p className="font-semibold text-sm line-clamp-2">{record.content}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </main>
      </AuthGate>
      {undoTargetId ? (
        <Toast
          message={t("review.undoReady", "ACKNOWLEDGED. [UNDO] available")}
          actionLabel={t("toast.undo", "Undo")}
          onAction={() => undoMutation.mutate(undoTargetId)}
          onClose={() => setUndoTargetId(null)}
          tone="success"
        />
      ) : null}
    </div>
  )
}
