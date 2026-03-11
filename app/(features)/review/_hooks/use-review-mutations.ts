import { useMutation, type QueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { apiFetch } from "@/lib/client-http"
import type { RecordRow } from "@/lib/types"
import type { DecisionPayload } from "./use-review-card-flow"

export type ReviewTodayResponse = {
  data: RecordRow[]
  total: number
}

export type ReviewStatsResponse = {
  today_reviewed: number
  today_remaining: number
  streak_days: number
  total_active: number
  total_records: number
}

type ReviewMutationContext = {
  previousToday?: ReviewTodayResponse
  previousStats?: ReviewStatsResponse
}

type UndoBufferEntry = {
  record: RecordRow
  index: number
}

export function useReviewMutations(queryClient: QueryClient) {
  const [undoTargetId, setUndoTargetId] = useState<string | null>(null)
  const [undoSequence, setUndoSequence] = useState(0)
  const undoTimerRef = useRef<number | null>(null)
  const undoBufferRef = useRef<Map<string, UndoBufferEntry>>(new Map())

  const clearUndoTimer = () => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
  }

  const mutation = useMutation<{ record: RecordRow }, Error, DecisionPayload, ReviewMutationContext>({
    mutationFn: async ({ id, decisionType, actionType, deferReason }) =>
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
        if (!current) return current
        const nextData = current.data.filter((record) => record.id !== variables.id)
        return { ...current, data: nextData, total: Math.max(0, current.total - (removedRecord ? 1 : 0)) }
      })

      queryClient.setQueryData<ReviewStatsResponse>(["review-stats"], (current) => {
        if (!current) return current
        return {
          ...current,
          today_reviewed: current.today_reviewed + 1,
          today_remaining: Math.max(0, current.today_remaining - (removedRecord ? 1 : 0))
        }
      })

      setUndoTargetId(variables.id)
      setUndoSequence((current) => current + 1)
      clearUndoTimer()
      undoTimerRef.current = window.setTimeout(() => {
        setUndoTargetId(null)
        undoTimerRef.current = null
      }, 4000)

      return { previousToday, previousStats }
    },
    onError: (_error, variables, context) => {
      if (context?.previousToday) queryClient.setQueryData(["review-today"], context.previousToday)
      if (context?.previousStats) queryClient.setQueryData(["review-stats"], context.previousStats)
      undoBufferRef.current.delete(variables.id)
      setUndoTargetId((current) => (current === variables.id ? null : current))
      clearUndoTimer()
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["review-today"] })
      queryClient.invalidateQueries({ queryKey: ["review-stats"] })
    }
  })

  const undoMutation = useMutation<{ record: RecordRow }, Error, string, ReviewMutationContext>({
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
          if (!current) return current
          if (current.data.some((record) => record.id === id)) return current
          const insertAt = Math.max(0, Math.min(undoBuffer.index, current.data.length))
          const nextData = [...current.data]
          nextData.splice(insertAt, 0, undoBuffer.record)
          return { ...current, data: nextData, total: current.total + 1 }
        })

        queryClient.setQueryData<ReviewStatsResponse>(["review-stats"], (current) => {
          if (!current) return current
          return {
            ...current,
            today_reviewed: Math.max(0, current.today_reviewed - 1),
            today_remaining: current.today_remaining + 1
          }
        })
      }

      return { previousToday, previousStats }
    },
    onError: (_error, _id, context) => {
      if (context?.previousToday) queryClient.setQueryData(["review-today"], context.previousToday)
      if (context?.previousStats) queryClient.setQueryData(["review-stats"], context.previousStats)
    },
    onSuccess: (_data, id) => {
      setUndoTargetId(null)
      undoBufferRef.current.delete(id)
      clearUndoTimer()
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["review-today"] })
      queryClient.invalidateQueries({ queryKey: ["review-stats"] })
    }
  })

  return {
    mutation,
    undoMutation,
    undoTargetId,
    setUndoTargetId,
    undoSequence
  }
}
