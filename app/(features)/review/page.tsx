"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import { MarkdownContent } from "@shared/ui/markdown-content"
import { getStateLabel } from "@/lib/i18n/state-label"
import type { RecordRow } from "@/lib/types"
import { Archive, PauseCircle, PlayCircle, RotateCcw } from "lucide-react"
import { LoadingDots } from "@shared/ui/loading"
import { EmptyState } from "@shared/ui/empty-state"
import { ErrorState } from "@shared/ui/error-state"
import { LoadingState } from "@shared/ui/loading-state"
import { Toast } from "@shared/ui/toast"

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

type DecisionType = "ARCHIVE" | "ACT" | "DEFER"
type ActionType = "EXPERIMENT" | "SHARE" | "TODO"
type DeferReason = "NEED_INFO" | "LOW_CONFIDENCE" | "NO_TIME"

type DecisionPayload = {
  id: string
  decisionType: DecisionType
  actionType?: ActionType
  deferReason?: DeferReason
}

type ReviewMutationContext = {
  previousToday?: ReviewTodayResponse
  previousStats?: ReviewStatsResponse
}

type UndoBufferEntry = {
  record: RecordRow
  index: number
}

const actionButtonClass =
  "min-h-[44px] border-2 border-foreground px-2 font-mono text-xs font-bold uppercase transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"

export default function ReviewPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [undoTargetId, setUndoTargetId] = useState<string | null>(null)
  const [actExpanded, setActExpanded] = useState(false)
  const [deferExpanded, setDeferExpanded] = useState(false)
  const undoTimerRef = useRef<number | null>(null)
  const undoBufferRef = useRef<Map<string, UndoBufferEntry>>(new Map())

  const stats = useQuery({
    queryKey: ["review-stats"],
    queryFn: () => apiFetch<ReviewStatsResponse>("/api/review/stats"),
    staleTime: 1000 * 60 * 2 // 2 minutes
  })

  const today = useQuery({
    queryKey: ["review-today"],
    queryFn: () => apiFetch<ReviewTodayResponse>("/api/review/today?n=20"),
    staleTime: 1000 * 30 // 30 seconds
  })

  const mutation = useMutation<
    { record: RecordRow },
    Error,
    DecisionPayload,
    ReviewMutationContext
  >({
    mutationFn: async ({ id, decisionType, actionType, deferReason }: DecisionPayload) =>
      apiFetch<{ record: RecordRow }>(`/api/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionType, actionType, deferReason })
      }),
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["review-today"] }),
        queryClient.cancelQueries({ queryKey: ["review-stats"] })
      ])

      const previousToday = queryClient.getQueryData<ReviewTodayResponse>(["review-today"])
      const previousStats = queryClient.getQueryData<ReviewStatsResponse>(["review-stats"])

      const currentQueue = previousToday?.data ?? []
      const removedIndex = currentQueue.findIndex((record) => record.id === variables.id)
      const removedRecord = removedIndex >= 0 ? currentQueue[removedIndex] : null

      if (removedRecord) {
        undoBufferRef.current.set(variables.id, { record: removedRecord, index: removedIndex })
      }

      queryClient.setQueryData<ReviewTodayResponse>(["review-today"], (current) => {
        if (!current) {
          return current
        }

        const nextData = current.data.filter((record) => record.id !== variables.id)
        return {
          ...current,
          data: nextData,
          total: Math.max(0, current.total - (removedRecord ? 1 : 0))
        }
      })

      queryClient.setQueryData<ReviewStatsResponse>(["review-stats"], (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          today_reviewed: current.today_reviewed + 1,
          today_remaining: Math.max(0, current.today_remaining - (removedRecord ? 1 : 0))
        }
      })

      setUndoTargetId(variables.id)
      setActExpanded(false)
      setDeferExpanded(false)
      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current)
      }
      undoTimerRef.current = window.setTimeout(() => {
        setUndoTargetId(null)
        undoTimerRef.current = null
      }, 4000)

      return {
        previousToday,
        previousStats
      }
    },
    onError: (_error, variables, context) => {
      if (context?.previousToday) {
        queryClient.setQueryData(["review-today"], context.previousToday)
      }

      if (context?.previousStats) {
        queryClient.setQueryData(["review-stats"], context.previousStats)
      }

      undoBufferRef.current.delete(variables.id)
      setUndoTargetId((current) => (current === variables.id ? null : current))

      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current)
        undoTimerRef.current = null
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["review-today"] })
      queryClient.invalidateQueries({ queryKey: ["review-stats"] })
    }
  })

  const undoMutation = useMutation<
    { record: RecordRow },
    Error,
    string,
    ReviewMutationContext
  >({
    mutationFn: (id: string) => apiFetch<{ record: RecordRow }>(`/api/review/${id}/undo`, { method: "POST" }),
    onMutate: async (id) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["review-today"] }),
        queryClient.cancelQueries({ queryKey: ["review-stats"] })
      ])

      const previousToday = queryClient.getQueryData<ReviewTodayResponse>(["review-today"])
      const previousStats = queryClient.getQueryData<ReviewStatsResponse>(["review-stats"])
      const undoBuffer = undoBufferRef.current.get(id)

      if (undoBuffer) {
        queryClient.setQueryData<ReviewTodayResponse>(["review-today"], (current) => {
          if (!current) {
            return current
          }

          const alreadyExists = current.data.some((record) => record.id === id)
          if (alreadyExists) {
            return current
          }

          const insertAt = Math.max(0, Math.min(undoBuffer.index, current.data.length))
          const nextData = [...current.data]
          nextData.splice(insertAt, 0, undoBuffer.record)

          return {
            ...current,
            data: nextData,
            total: current.total + 1
          }
        })

        queryClient.setQueryData<ReviewStatsResponse>(["review-stats"], (current) => {
          if (!current) {
            return current
          }

          return {
            ...current,
            today_reviewed: Math.max(0, current.today_reviewed - 1),
            today_remaining: current.today_remaining + 1
          }
        })
      }

      return {
        previousToday,
        previousStats
      }
    },
    onError: (_error, _id, context) => {
      if (context?.previousToday) {
        queryClient.setQueryData(["review-today"], context.previousToday)
      }

      if (context?.previousStats) {
        queryClient.setQueryData(["review-stats"], context.previousStats)
      }
    },
    onSuccess: (_data, id) => {
      setUndoTargetId(null)
      undoBufferRef.current.delete(id)

      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current)
        undoTimerRef.current = null
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["review-today"] })
      queryClient.invalidateQueries({ queryKey: ["review-stats"] })
    }
  })

  const first = today.data?.data[0]
  const nextQueue = today.data?.data.slice(1, 6) ?? []
  const reviewBackHref = "/review"

  function toggleActPanel(): void {
    setActExpanded((prev) => {
      const next = !prev
      if (next) {
        setDeferExpanded(false)
      }
      return next
    })
  }

  function toggleDeferPanel(): void {
    setDeferExpanded((prev) => {
      const next = !prev
      if (next) {
        setActExpanded(false)
      }
      return next
    })
  }

  useEffect(() => {
    if (!first) {
      return
    }
    const currentId = first.id

    function onKeyDown(event: KeyboardEvent): void {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || mutation.isPending || undoMutation.isPending) {
        return
      }

      const target = event.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }

      const key = event.key.toLowerCase()
      if (key === "a") {
        event.preventDefault()
        mutation.mutate({ id: currentId, decisionType: "ARCHIVE" })
      } else if (key === "s") {
        event.preventDefault()
        mutation.mutate({ id: currentId, decisionType: "ACT", actionType: "TODO" })
      } else if (key === "d") {
        event.preventDefault()
        mutation.mutate({ id: currentId, decisionType: "DEFER", deferReason: "NO_TIME" })
      } else if (key === "u" && undoTargetId) {
        event.preventDefault()
        undoMutation.mutate(undoTargetId)
      } else if (key === "escape") {
        setActExpanded(false)
        setDeferExpanded(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [first, mutation, undoMutation, undoTargetId])

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

          <div className="mb-6 grid grid-cols-2 gap-2 border-[3px] md:border-4 border-foreground bg-card p-4 md:p-6 md:grid-cols-4 shadow-brutal-sm md:shadow-brutal">
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
            <div className="relative flex w-full flex-1 flex-col border-[3px] md:border-4 border-foreground bg-card p-4 sm:p-6 shadow-brutal-sm md:shadow-brutal md:p-10" key={first.id}>
              <div className="flex-1 flex flex-col py-4 md:py-6">
                <div className="flex flex-wrap items-center gap-2 mb-6 md:mb-8 border-b-2 border-foreground pb-4">
                  <span className="bg-muted text-muted-foreground font-mono text-xs font-bold px-2 py-1 uppercase border-2 border-muted-foreground">ID: {first.id.substring(0, 8)}</span>
                  {first.source_title && (
                    <span className="font-mono text-xs font-bold text-foreground bg-accent/20 px-2 py-1 uppercase truncate border-2 border-accent">
                      REF: {first.source_title}
                    </span>
                  )}
                </div>

                <div className="flex-1 flex flex-col overflow-y-auto">
                  <MarkdownContent
                    content={first.content}
                    className="text-lg md:text-2xl leading-[1.6]"
                  />
                </div>
              </div>

              <div className="mt-8 border-t-4 border-foreground pt-6">
                <p className="mb-3 font-mono text-xs font-bold uppercase text-muted-foreground">
                  {t("review.shortcutHint", "A: Archive · S: Act · D: Defer · U: Undo · Esc: Close panels")}
                </p>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => mutation.mutate({ id: first.id, decisionType: "ARCHIVE" })}
                    disabled={mutation.isPending}
                    aria-label="보관"
                    className="min-h-[64px] border-4 border-foreground bg-accent px-4 py-3 text-left text-white transition-colors hover:bg-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="flex items-center gap-2 font-black text-base uppercase">
                      {mutation.isPending && mutation.variables?.decisionType === "ARCHIVE" ? <LoadingDots /> : <Archive className="h-5 w-5" />}
                      {t("review.triage.archive", "보관")}
                    </span>
                    <span className="mt-1 block font-mono text-[11px] uppercase opacity-90">{t("review.triage.archiveHelp", "즉시 다음 문서")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleActPanel}
                    disabled={mutation.isPending}
                    aria-label={t("review.triage.act", "실행")}
                    aria-expanded={actExpanded}
                    className="min-h-[64px] border-4 border-foreground bg-background px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="flex items-center gap-2 font-black text-base uppercase">
                      <PlayCircle className="h-5 w-5" /> {t("review.triage.act", "실행")}
                    </span>
                    <span className="mt-1 block font-mono text-[11px] uppercase text-muted-foreground">{t("review.triage.actHelp", "실험·공유·할일")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleDeferPanel}
                    disabled={mutation.isPending}
                    aria-label={t("review.triage.defer", "보류")}
                    aria-expanded={deferExpanded}
                    className="min-h-[64px] border-4 border-foreground bg-background px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="flex items-center gap-2 font-black text-base uppercase">
                      <PauseCircle className="h-5 w-5" /> {t("review.triage.defer", "보류")}
                    </span>
                    <span className="mt-1 block font-mono text-[11px] uppercase text-muted-foreground">{t("review.triage.deferHelp", "리뷰 큐 이동")}</span>
                  </button>
                </div>

                {actExpanded ? (
                  <div className="mt-3 border-2 border-foreground bg-card p-3">
                    <p className="font-mono text-xs font-bold uppercase text-muted-foreground">{t("review.triage.actSelect", "실행 타입 선택")}</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        className={actionButtonClass}
                        onClick={() => mutation.mutate({ id: first.id, decisionType: "ACT", actionType: "EXPERIMENT" })}
                        disabled={mutation.isPending}
                      >
                        {t("review.actionType.experiment", "실험")}
                      </button>
                      <button
                        type="button"
                        className={actionButtonClass}
                        onClick={() => mutation.mutate({ id: first.id, decisionType: "ACT", actionType: "SHARE" })}
                        disabled={mutation.isPending}
                      >
                        {t("review.actionType.share", "공유")}
                      </button>
                      <button
                        type="button"
                        className={actionButtonClass}
                        onClick={() => mutation.mutate({ id: first.id, decisionType: "ACT", actionType: "TODO" })}
                        disabled={mutation.isPending}
                      >
                        {t("review.actionType.todo", "할일")}
                      </button>
                    </div>
                  </div>
                ) : null}

                {deferExpanded ? (
                  <div className="mt-3 border-2 border-foreground bg-card p-3">
                    <p className="font-mono text-xs font-bold uppercase text-muted-foreground">{t("review.triage.deferSelect", "보류 이유 선택")}</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                      <button
                        type="button"
                        className={actionButtonClass}
                        onClick={() => mutation.mutate({ id: first.id, decisionType: "DEFER", deferReason: "NEED_INFO" })}
                        disabled={mutation.isPending}
                      >
                        {t("review.deferReason.needInfo", "정보부족")}
                      </button>
                      <button
                        type="button"
                        className={actionButtonClass}
                        onClick={() => mutation.mutate({ id: first.id, decisionType: "DEFER", deferReason: "LOW_CONFIDENCE" })}
                        disabled={mutation.isPending}
                      >
                        {t("review.deferReason.lowConfidence", "중요도불명")}
                      </button>
                      <button
                        type="button"
                        className={actionButtonClass}
                        onClick={() => mutation.mutate({ id: first.id, decisionType: "DEFER", deferReason: "NO_TIME" })}
                        disabled={mutation.isPending}
                      >
                        {t("review.deferReason.noTime", "시간없음")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {mutation.error ? (
                <div className="mt-4 space-y-2">
                  <ErrorState message={mutation.error.message} />
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] items-center gap-2 border-2 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    onClick={() => {
                      mutation.reset()
                      today.refetch()
                    }}
                  >
                    <RotateCcw className="h-4 w-4" /> {t("review.retry", "다시 시도")}
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {nextQueue.length > 0 ? (
            <section className="mt-8 border-4 border-foreground bg-card shadow-brutal">
              <details open className="group">
                <summary className="flex cursor-pointer items-center justify-between border-b-4 border-foreground p-4 md:p-6 font-black text-xl uppercase select-none list-none">
                  <span className="flex items-center gap-3">
                    <span className="border-l-4 border-accent pl-4">{t("review.upNext", "UP NEXT")}</span>
                    <span className="font-mono text-sm text-muted-foreground">({nextQueue.length})</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground group-open:hidden">▼ SHOW</span>
                  <span className="font-mono text-xs text-muted-foreground hidden group-open:inline">▲ HIDE</span>
                </summary>
                <div className="space-y-0 p-4 md:p-6 pt-0 md:pt-0">
                  {nextQueue.map((record) => (
                    <Link
                      key={record.id}
                      href={`/records/${record.id}?from=${encodeURIComponent(reviewBackHref)}`}
                      className="block min-h-[44px] border-2 border-foreground px-4 py-3 mt-3 hover:bg-foreground hover:text-background transition-colors"
                    >
                      <p className="font-mono text-xs font-bold uppercase mb-2">{record.kind} · {getStateLabel(record.state, t)}</p>
                      <p className="font-semibold text-sm line-clamp-2">{record.content}</p>
                    </Link>
                  ))}
                </div>
              </details>
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
