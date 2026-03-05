import { Archive, PauseCircle, PlayCircle, RotateCcw } from "lucide-react"
import { MarkdownContent } from "@shared/ui/markdown-content"
import { LoadingDots } from "@shared/ui/loading"
import { ErrorState } from "@shared/ui/error-state"
import type { RecordRow } from "@/lib/types"

type ActionType = "EXPERIMENT" | "SHARE" | "TODO"
type DeferReason = "NEED_INFO" | "LOW_CONFIDENCE" | "NO_TIME"

type ReviewCurrentCardProps = {
  t: (key: string, fallback?: string) => string
  record: RecordRow
  mutationPending: boolean
  archivePending: boolean
  actExpanded: boolean
  deferExpanded: boolean
  errorMessage: string | null
  onArchive: () => void
  onToggleAct: () => void
  onToggleDefer: () => void
  onSelectAct: (actionType: ActionType) => void
  onSelectDefer: (reason: DeferReason) => void
  onRetry: () => void
}

const actionButtonClass =
  "min-h-[44px] border-4 border-foreground px-2 font-mono text-xs font-bold uppercase transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-0 shadow-brutal-sm"

export function ReviewCurrentCard({
  t,
  record,
  mutationPending,
  archivePending,
  actExpanded,
  deferExpanded,
  errorMessage,
  onArchive,
  onToggleAct,
  onToggleDefer,
  onSelectAct,
  onSelectDefer,
  onRetry
}: ReviewCurrentCardProps) {
  return (
    <div className="relative flex w-full flex-1 flex-col border-[3px] md:border-4 border-foreground bg-card p-4 sm:p-6 shadow-brutal-sm md:shadow-brutal md:p-10 transition-all duration-300" key={record.id}>
      <div className="absolute top-0 right-0 w-8 h-8 md:w-16 md:h-16 bg-accent opacity-20 pointer-events-none" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
      <div className="flex-1 flex flex-col py-4 md:py-6 relative z-10">
        <div className="flex flex-wrap items-center gap-2 mb-6 md:mb-8 border-b-4 border-foreground pb-4">
          <span className="bg-foreground text-background font-mono text-xs font-bold px-2 py-1 uppercase border-2 border-foreground text-glitch cursor-default transition-all shadow-brutal-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5">ID:{record.id.substring(0, 8)}</span>
          {record.source_title ? (
            <span className="font-mono text-xs font-bold text-foreground bg-accent/20 px-2 py-1 uppercase truncate border-2 border-accent shadow-brutal-sm">
              REF: {record.source_title}
            </span>
          ) : null}
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto pr-2 custom-scroll">
          <MarkdownContent
            content={record.content}
            className="text-lg md:text-3xl font-medium leading-[1.6] md:leading-[1.7] tracking-tight"
          />
        </div>
      </div>

      <div className="mt-8 border-t-4 border-foreground pt-6">
        <p className="mb-3 font-mono text-xs font-bold uppercase text-muted-foreground">
          {t("review.shortcutHint", "A: Archive · S: Act · D: Defer · U: Undo · Esc: Close panels")}
        </p>
        <p className="mb-3 font-mono text-[10px] font-bold uppercase text-muted-foreground">
          {t("review.panelHint", "ACT/DEFER 버튼으로 세부 선택 패널을 열 수 있습니다")}
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 group/actions">
          <button
            type="button"
            onClick={onArchive}
            disabled={mutationPending}
            aria-label="보관"
            className="group/btn relative min-h-[64px] border-4 border-foreground bg-accent px-4 py-3 text-left text-white transition-all duration-200 active:translate-y-[4px] active:translate-x-[4px] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-0 shadow-brutal active:shadow-none hover:bg-foreground hover:shadow-brutal-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 -translate-x-[100%] group-hover/btn:animate-[marquee_1s_ease-in-out_forwards]" />
            <span className="flex items-center gap-2 font-black text-xl uppercase relative z-10 transition-transform group-hover/btn:translate-x-1">
              {archivePending ? <LoadingDots /> : <Archive className="h-6 w-6" />}
              {t("review.triage.archive", "보관")}
            </span>
            <span className="mt-1 block font-mono text-[11px] font-bold uppercase opacity-90 relative z-10">{t("review.triage.archiveHelp", "즉시 다음 문서")}</span>
          </button>

          <button
            type="button"
            onClick={onToggleAct}
            disabled={mutationPending}
            aria-label={t("review.triage.act", "실행")}
            aria-expanded={actExpanded}
            className={`group/btn relative min-h-[64px] border-4 border-foreground px-4 py-3 text-left transition-all duration-200 active:translate-y-[4px] active:translate-x-[4px] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-0 shadow-brutal active:shadow-none overflow-hidden ${actExpanded ? "bg-foreground text-background shadow-none translate-x-[4px] translate-y-[4px]" : "bg-background text-foreground hover:bg-foreground/10"}`}
          >
            <span className="flex items-center gap-2 font-black text-xl uppercase relative z-10 transition-transform group-hover/btn:-translate-y-1">
              <PlayCircle className="h-6 w-6 group-hover/btn:text-accent transition-colors" /> {t("review.triage.act", "실행")}
            </span>
            <span className="mt-1 block font-mono text-[11px] font-bold uppercase text-muted-foreground relative z-10">{t("review.triage.actHelp", "실험·공유·할일")}</span>
          </button>

          <button
            type="button"
            onClick={onToggleDefer}
            disabled={mutationPending}
            aria-label={t("review.triage.defer", "보류")}
            aria-expanded={deferExpanded}
            className={`group/btn relative min-h-[64px] border-4 border-foreground px-4 py-3 text-left transition-all duration-200 active:translate-y-[4px] active:translate-x-[4px] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-0 shadow-brutal active:shadow-none overflow-hidden ${deferExpanded ? "bg-foreground text-background shadow-none translate-x-[4px] translate-y-[4px]" : "bg-background text-foreground hover:bg-foreground/10"}`}
          >
            <span className="flex items-center gap-2 font-black text-xl uppercase relative z-10 transition-transform group-hover/btn:-translate-y-1">
              <PauseCircle className="h-6 w-6 group-hover/btn:text-accent transition-colors" /> {t("review.triage.defer", "보류")}
            </span>
            <span className="mt-1 block font-mono text-[11px] font-bold uppercase text-muted-foreground relative z-10">{t("review.triage.deferHelp", "리뷰 큐 이동")}</span>
          </button>
        </div>

        {actExpanded ? (
          <div className="mt-3 border-4 border-foreground bg-card p-3 shadow-brutal-sm">
            <p className="font-mono text-xs font-bold uppercase text-muted-foreground">{t("review.triage.actSelect", "실행 타입 선택")}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                className={actionButtonClass}
                onClick={() => onSelectAct("EXPERIMENT")}
                disabled={mutationPending}
              >
                {t("review.actionType.experiment", "실험")}
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={() => onSelectAct("SHARE")}
                disabled={mutationPending}
              >
                {t("review.actionType.share", "공유")}
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={() => onSelectAct("TODO")}
                disabled={mutationPending}
              >
                {t("review.actionType.todo", "할일")}
              </button>
            </div>
          </div>
        ) : null}

        {deferExpanded ? (
          <div className="mt-3 border-4 border-foreground bg-card p-3 shadow-brutal-sm">
            <p className="font-mono text-xs font-bold uppercase text-muted-foreground">{t("review.triage.deferSelect", "보류 이유 선택")}</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <button
                type="button"
                className={actionButtonClass}
                onClick={() => onSelectDefer("NEED_INFO")}
                disabled={mutationPending}
              >
                {t("review.deferReason.needInfo", "정보부족")}
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={() => onSelectDefer("LOW_CONFIDENCE")}
                disabled={mutationPending}
              >
                {t("review.deferReason.lowConfidence", "중요도불명")}
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={() => onSelectDefer("NO_TIME")}
                disabled={mutationPending}
              >
                {t("review.deferReason.noTime", "시간없음")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="mt-4 space-y-2">
          <ErrorState message={errorMessage} />
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center gap-2 border-4 border-foreground px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-0 transition-transform active:translate-y-[2px] active:translate-x-[2px] shadow-brutal-sm"
            onClick={onRetry}
          >
            <RotateCcw className="h-4 w-4" /> {t("review.retry", "다시 시도")}
          </button>
        </div>
      ) : null}
    </div>
  )
}
