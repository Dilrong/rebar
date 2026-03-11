import { LoadingState } from "@shared/ui/loading-state"
import type { RecordRow } from "@/lib/types"
import { ReviewCompleteScreen } from "./review-complete-screen"
import { ReviewCurrentCard } from "./review-current-card"
import { ReviewHeader } from "./review-header"
import { ReviewStatsPanel } from "./review-stats-panel"
import { ReviewUpNext } from "./review-up-next"

type ReviewMainContentProps = {
  t: (key: string, fallback?: string) => string
  reviewed: number
  remaining: number
  streakDays: number
  totalRecords: number
  totalActive: number
  isLoading: boolean
  first: RecordRow | undefined
  nextQueue: RecordRow[]
  mutationPending: boolean
  archivePending: boolean
  transitionPhase: "idle" | "stamping" | "exiting" | "entering"
  stampLabel: string | null
  actExpanded: boolean
  deferExpanded: boolean
  errorMessage: string | null
  onArchive: () => void
  onToggleAct: () => void
  onToggleDefer: () => void
  onSelectAct: (actionType: "EXPERIMENT" | "SHARE" | "TODO") => void
  onSelectDefer: (deferReason: "NEED_INFO" | "LOW_CONFIDENCE" | "NO_TIME") => void
  onRetry: () => void
}

export function ReviewMainContent(props: ReviewMainContentProps) {
  return (
    <>
      <ReviewHeader t={props.t} reviewed={props.reviewed} remaining={props.remaining} />
      <ReviewStatsPanel
        reviewed={props.reviewed}
        remaining={props.remaining}
        streakDays={props.streakDays}
        totalRecords={props.totalRecords}
      />
      {props.isLoading ? <LoadingState label={props.t("review.fetching", "Fetching blocks...")} /> : null}
      {!props.first ? (
        <ReviewCompleteScreen
          t={props.t}
          reviewed={props.reviewed}
          streakDays={props.streakDays}
          totalActive={props.totalActive}
        />
      ) : null}
      {props.first ? (
        <ReviewCurrentCard
          t={props.t}
          record={props.first}
          mutationPending={props.mutationPending}
          archivePending={props.archivePending}
          transitionPhase={props.transitionPhase}
          stampLabel={props.stampLabel}
          actExpanded={props.actExpanded}
          deferExpanded={props.deferExpanded}
          errorMessage={props.errorMessage}
          onArchive={props.onArchive}
          onToggleAct={props.onToggleAct}
          onToggleDefer={props.onToggleDefer}
          onSelectAct={props.onSelectAct}
          onSelectDefer={props.onSelectDefer}
          onRetry={props.onRetry}
        />
      ) : null}
      <ReviewUpNext queue={props.nextQueue} reviewBackHref="/review" t={props.t} />
    </>
  )
}
