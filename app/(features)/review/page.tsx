"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import type { RecordRow } from "@/lib/types"
import { EmptyState } from "@shared/ui/empty-state"
import { LoadingState } from "@shared/ui/loading-state"
import { Toast } from "@shared/ui/toast"
import { ReviewStatsPanel } from "./_components/review-stats-panel"
import { ReviewUpNext } from "./_components/review-up-next"
import { ReviewHeader } from "./_components/review-header"
import { ReviewCurrentCard } from "./_components/review-current-card"

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
    staleTime: 1000 * 60 * 2 // 2 minutes — data changes only after user actions
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
        <main className="max-w-5xl w-full mx-auto flex-1 flex flex-col animate-fade-in-up">
          <AppNav />

          <ReviewHeader t={t} remaining={today.data?.total || 0} />

          <ReviewStatsPanel
            reviewed={stats.data?.today_reviewed ?? 0}
            remaining={stats.data?.today_remaining ?? 0}
            streakDays={stats.data?.streak_days ?? 0}
            totalRecords={stats.data?.total_records ?? 0}
          />

          {today.isLoading ? <LoadingState label={t("review.fetching", "Fetching blocks...")} /> : null}

          {today.isSuccess && !first && (
            <EmptyState
              title={t("review.empty", "ALL CAUGHT UP")}
              description={t("review.noPending", "No pending operations.")}
              actionLabel={t("review.goCapture", "Add new item")}
              actionHref="/capture"
            />
          )}

          {first ? (
            <ReviewCurrentCard
              t={t}
              record={first}
              mutationPending={mutation.isPending}
              archivePending={mutation.isPending && mutation.variables?.decisionType === "ARCHIVE"}
              actExpanded={actExpanded}
              deferExpanded={deferExpanded}
              errorMessage={mutation.error?.message ?? null}
              onArchive={() => mutation.mutate({ id: first.id, decisionType: "ARCHIVE" })}
              onToggleAct={toggleActPanel}
              onToggleDefer={toggleDeferPanel}
              onSelectAct={(actionType) => mutation.mutate({ id: first.id, decisionType: "ACT", actionType })}
              onSelectDefer={(deferReason) => mutation.mutate({ id: first.id, decisionType: "DEFER", deferReason })}
              onRetry={() => {
                mutation.reset()
                today.refetch()
              }}
            />
          ) : null}

          <ReviewUpNext queue={nextQueue} reviewBackHref={reviewBackHref} t={t} />
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
