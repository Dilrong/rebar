"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import AuthGate from "@shared/auth/auth-gate"
import ProtectedPageShell from "@shared/layout/protected-page-shell"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import type { RecordRow } from "@/lib/types"
import { ReviewMainContent } from "./_components/review-main-content"
import { ReviewUndoBar } from "./_components/review-undo-bar"
import { useReviewCardFlow, type DecisionPayload } from "./_hooks/use-review-card-flow"
import { useReviewMutations, type ReviewStatsResponse, type ReviewTodayResponse } from "./_hooks/use-review-mutations"

export default function ReviewPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()

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

  const { mutation, undoMutation, undoTargetId, setUndoTargetId, undoSequence } = useReviewMutations(queryClient)

  const first = today.data?.data[0]
  const nextQueue = today.data?.data.slice(1, 6) ?? []

  const { actExpanded, deferExpanded, cardTransition, toggleActPanel, toggleDeferPanel, triggerDecision, resetCardTransition } = useReviewCardFlow({
    firstId: first?.id ?? null,
    mutationPending: mutation.isPending,
    undoPending: undoMutation.isPending,
    undoTargetId,
    onCommitDecision: (payload) => mutation.mutate(payload),
    onUndo: (id) => undoMutation.mutate(id)
  })

  return (
    <>
      <AuthGate>
        <ProtectedPageShell rootClassName="md:p-6" mainClassName="flex max-w-5xl flex-1 flex-col">

          <ReviewMainContent
            t={t}
            reviewed={stats.data?.today_reviewed ?? 0}
            remaining={stats.data?.today_remaining ?? 0}
            streakDays={stats.data?.streak_days ?? 0}
            totalRecords={stats.data?.total_records ?? 0}
            totalActive={stats.data?.total_active ?? 0}
            isLoading={today.isLoading}
            first={first}
            nextQueue={nextQueue}
            mutationPending={mutation.isPending || cardTransition.phase !== "idle"}
            archivePending={mutation.isPending && mutation.variables?.decisionType === "ARCHIVE"}
            transitionPhase={cardTransition.recordId === first?.id ? cardTransition.phase : "idle"}
            stampLabel={cardTransition.recordId === first?.id ? cardTransition.stampLabel : null}
            actExpanded={actExpanded}
            deferExpanded={deferExpanded}
            errorMessage={mutation.error?.message ?? null}
            onArchive={() => first ? triggerDecision({ id: first.id, decisionType: "ARCHIVE" }, "ARCHIVED") : undefined}
            onToggleAct={toggleActPanel}
            onToggleDefer={toggleDeferPanel}
            onSelectAct={(actionType) => first ? triggerDecision({ id: first.id, decisionType: "ACT", actionType }, actionType === "TODO" ? "TODO" : actionType === "SHARE" ? "SHARED" : "EXPERIMENT") : undefined}
            onSelectDefer={(deferReason) => first ? triggerDecision({ id: first.id, decisionType: "DEFER", deferReason }, "DEFERRED") : undefined}
            onRetry={() => {
              if (!first) {
                return
              }
              mutation.reset()
              resetCardTransition(first.id)
              today.refetch()
            }}
          />
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
