"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import AuthGate from "@shared/auth/auth-gate"
import ProtectedPageShell from "@shared/layout/protected-page-shell"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import type { RecordRow } from "@/lib/types"
import { LoadingState } from "@shared/ui/loading-state"
import { ReviewStatsPanel } from "./_components/review-stats-panel"
import { ReviewUpNext } from "./_components/review-up-next"
import { ReviewHeader } from "./_components/review-header"
import { ReviewCurrentCard } from "./_components/review-current-card"
import { ReviewCompleteScreen } from "./_components/review-complete-screen"
import { ReviewUndoBar } from "./_components/review-undo-bar"

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

type CardTransitionPhase = "idle" | "stamping" | "exiting" | "entering"

type CardTransitionState = {
  phase: CardTransitionPhase
  stampLabel: string | null
  recordId: string | null
}

export default function ReviewPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [undoTargetId, setUndoTargetId] = useState<string | null>(null)
  const [undoSequence, setUndoSequence] = useState(0)
  const [actExpanded, setActExpanded] = useState(false)
  const [deferExpanded, setDeferExpanded] = useState(false)
  const [cardTransition, setCardTransition] = useState<CardTransitionState>({
    phase: "idle",
    stampLabel: null,
    recordId: null
  })
  const undoTimerRef = useRef<number | null>(null)
  const transitionTimerRef = useRef<number | null>(null)
  const mutationTimerRef = useRef<number | null>(null)
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
      setUndoSequence((current) => current + 1)
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
      setCardTransition({ phase: "idle", stampLabel: null, recordId: null })

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

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current)
      }
      if (mutationTimerRef.current) {
        window.clearTimeout(mutationTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const nextId = first?.id ?? null
    setCardTransition((current) => {
      if (!nextId) {
        return { phase: "idle", stampLabel: null, recordId: null }
      }

      if (current.recordId && current.recordId !== nextId) {
        return { phase: "entering", stampLabel: null, recordId: nextId }
      }

      if (current.phase === "exiting" && current.recordId === nextId) {
        return { phase: "idle", stampLabel: null, recordId: nextId }
      }

      return current.recordId ? current : { phase: "idle", stampLabel: null, recordId: nextId }
    })
  }, [first?.id])

  useEffect(() => {
    if (cardTransition.phase !== "entering") {
      return
    }

    const timer = window.setTimeout(() => {
      setCardTransition((current) =>
        current.phase === "entering"
          ? { phase: "idle", stampLabel: null, recordId: current.recordId }
          : current
      )
    }, 200)

    return () => window.clearTimeout(timer)
  }, [cardTransition.phase])

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
        triggerDecision({ id: currentId, decisionType: "ARCHIVE" }, "ARCHIVED")
      } else if (key === "s") {
        event.preventDefault()
        triggerDecision({ id: currentId, decisionType: "ACT", actionType: "TODO" }, "PINNED")
      } else if (key === "d") {
        event.preventDefault()
        triggerDecision({ id: currentId, decisionType: "DEFER", deferReason: "NO_TIME" }, "DEFERRED")
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
  }, [cardTransition.phase, first, mutation.isPending, undoMutation, undoTargetId])

  function triggerDecision(payload: DecisionPayload, stampLabel: string) {
    if (mutation.isPending || undoMutation.isPending || cardTransition.phase !== "idle") {
      return
    }

    setActExpanded(false)
    setDeferExpanded(false)
    setCardTransition({
      phase: "stamping",
      stampLabel,
      recordId: payload.id
    })

    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current)
    }
    if (mutationTimerRef.current) {
      window.clearTimeout(mutationTimerRef.current)
    }

    transitionTimerRef.current = window.setTimeout(() => {
      setCardTransition((current) =>
        current.recordId === payload.id
          ? { ...current, phase: "exiting" }
          : current
      )

      mutationTimerRef.current = window.setTimeout(() => {
        mutation.mutate(payload)
      }, 200)
    }, 300)
  }

  return (
    <>
      <AuthGate>
        <ProtectedPageShell rootClassName="md:p-6" mainClassName="flex max-w-5xl flex-1 flex-col">

          <ReviewHeader
            t={t}
            reviewed={stats.data?.today_reviewed ?? 0}
            remaining={stats.data?.today_remaining ?? 0}
          />

          <ReviewStatsPanel
            reviewed={stats.data?.today_reviewed ?? 0}
            remaining={stats.data?.today_remaining ?? 0}
            streakDays={stats.data?.streak_days ?? 0}
            totalRecords={stats.data?.total_records ?? 0}
          />

          {today.isLoading ? <LoadingState label={t("review.fetching", "Fetching blocks...")} /> : null}

          {today.isSuccess && !first ? (
            <ReviewCompleteScreen
              t={t}
              reviewed={stats.data?.today_reviewed ?? 0}
              streakDays={stats.data?.streak_days ?? 0}
              totalActive={stats.data?.total_active ?? 0}
            />
          ) : null}

          {first ? (
            <ReviewCurrentCard
              t={t}
              record={first}
              mutationPending={mutation.isPending || cardTransition.phase !== "idle"}
              archivePending={mutation.isPending && mutation.variables?.decisionType === "ARCHIVE"}
              transitionPhase={cardTransition.recordId === first.id ? cardTransition.phase : "idle"}
              stampLabel={cardTransition.recordId === first.id ? cardTransition.stampLabel : null}
              actExpanded={actExpanded}
              deferExpanded={deferExpanded}
              errorMessage={mutation.error?.message ?? null}
              onArchive={() => triggerDecision({ id: first.id, decisionType: "ARCHIVE" }, "ARCHIVED")}
              onToggleAct={toggleActPanel}
              onToggleDefer={toggleDeferPanel}
              onSelectAct={(actionType) => triggerDecision({ id: first.id, decisionType: "ACT", actionType }, actionType === "TODO" ? "TODO" : actionType === "SHARE" ? "SHARED" : "EXPERIMENT")}
              onSelectDefer={(deferReason) => triggerDecision({ id: first.id, decisionType: "DEFER", deferReason }, "DEFERRED")}
              onRetry={() => {
                mutation.reset()
                setCardTransition({ phase: "idle", stampLabel: null, recordId: first.id })
                today.refetch()
              }}
            />
          ) : null}

          <ReviewUpNext queue={nextQueue} reviewBackHref="/review" t={t} />
        </ProtectedPageShell>
      </AuthGate>
      <ReviewUndoBar
        t={t}
        open={Boolean(undoTargetId)}
        sequence={undoSequence}
        onUndo={() => {
          if (undoTargetId) {
            undoMutation.mutate(undoTargetId)
          }
        }}
        onClose={() => setUndoTargetId(null)}
      />
    </>
  )
}
