import Link from "next/link"
import { memo, useCallback } from "react"
import type { RecordRow } from "@/lib/types"
import { LoadingDots } from "@shared/ui/loading"
import { stripMarkdown } from "@feature-lib/content/strip-markdown"
import { getStateLabel } from "@/lib/i18n/state-label"

type LibraryRecordCardProps = {
  record: RecordRow
  selected: boolean
  onToggleSelected: (id: string) => void
  onPrefetch: (id: string) => void
  toRecordHref: (recordId: string) => string
  t: (key: string, fallback?: string) => string
  activatePending: boolean
  inboxPending: boolean
  onActivate: (id: string) => void
  onInboxTodo: (id: string) => void
  onInboxArchive: (id: string) => void
  inboxTodoPending: boolean
  inboxArchivePending: boolean
}

export const LibraryRecordCard = memo(function LibraryRecordCard({
  record,
  selected,
  onToggleSelected,
  onPrefetch,
  toRecordHref,
  t,
  activatePending,
  inboxPending,
  onActivate,
  onInboxTodo,
  onInboxArchive,
  inboxTodoPending,
  inboxArchivePending
}: LibraryRecordCardProps) {
  const id = record.id

  const handlePrefetch = useCallback(() => onPrefetch(id), [onPrefetch, id])
  const handleToggle = useCallback(() => onToggleSelected(id), [onToggleSelected, id])
  const handleActivate = useCallback((e: React.MouseEvent) => { e.preventDefault(); onActivate(id) }, [onActivate, id])
  const handleTodo = useCallback((e: React.MouseEvent) => { e.preventDefault(); onInboxTodo(id) }, [onInboxTodo, id])
  const handleArchive = useCallback((e: React.MouseEvent) => { e.preventDefault(); onInboxArchive(id) }, [onInboxArchive, id])

  return (
    <div
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      className="group flex h-48 flex-col border-[3px] md:border-4 border-foreground bg-card p-4 md:p-6 shadow-brutal hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-200 md:h-72 bg-noise relative overflow-hidden text-foreground hover:bg-foreground hover:text-background"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-background opacity-5 md:opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
      <div className="flex justify-between items-start mb-3 md:mb-4 relative z-10">
        <div className="flex gap-2">
          <input
            id={`library-select-${id}`}
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation()
              handleToggle()
            }}
            className="min-h-[32px] min-w-[32px] md:min-h-[44px] md:min-w-[44px] border-4 border-foreground focus:ring-0 checked:bg-foreground checked:text-background appearance-none"
          />
          <label htmlFor={`library-select-${id}`} className="sr-only">
            Select record {id}
          </label>
          <span className="font-mono text-[10px] font-bold border-2 border-current px-1.5 py-0.5 uppercase h-fit mt-1 hidden md:block group-hover:border-background shadow-[2px_2px_0px_0px_currentColor] group-hover:shadow-[2px_2px_0px_0px_var(--background)] transition-all">
            {record.kind}
          </span>
          <span
            className={`font-mono text-[10px] font-bold border-2 px-1.5 py-0.5 uppercase h-fit mt-1 hidden md:block transition-all ${record.state === "INBOX"
              ? "border-accent text-accent shadow-[2px_2px_0px_0px_theme(colors.accent.DEFAULT)] group-hover:border-background group-hover:text-background group-hover:shadow-[2px_2px_0px_0px_var(--background)]"
              : "border-current shadow-[2px_2px_0px_0px_currentColor] group-hover:border-background group-hover:shadow-[2px_2px_0px_0px_var(--background)]"
              }`}
          >
            {getStateLabel(record.state, t)}
          </span>
        </div>

        {record.state === "INBOX" ? (
          <div className="flex flex-wrap items-center justify-end gap-1">
            <button
              onClick={handleActivate}
              className="min-h-[44px] border-2 border-accent px-2 py-1 font-mono text-[10px] font-bold uppercase text-accent transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-accent hover:text-white group-hover:border-background group-hover:text-foreground group-hover:bg-background group-hover:hover:bg-accent group-hover:hover:text-white"
              title={t("library.inboxAction.activate", "ACTIVATE")}
              type="button"
              disabled={activatePending || inboxPending}
            >
              {activatePending ? <LoadingDots /> : t("library.inboxAction.activate", "ACTIVATE")}
            </button>
            <button
              onClick={handleTodo}
              className="min-h-[44px] border-2 border-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-foreground hover:text-background group-hover:border-background group-hover:text-foreground group-hover:bg-background"
              title={t("library.inboxAction.todo", "TODO")}
              type="button"
              disabled={activatePending || inboxPending}
            >
              {inboxTodoPending ? <LoadingDots /> : t("library.inboxAction.todo", "TODO")}
            </button>
            <button
              onClick={handleArchive}
              className="min-h-[44px] border-2 border-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-foreground hover:text-background group-hover:border-background group-hover:text-foreground group-hover:bg-background"
              title={t("library.inboxAction.archive", "ARCHIVE")}
              type="button"
              disabled={activatePending || inboxPending}
            >
              {inboxArchivePending ? <LoadingDots /> : t("library.inboxAction.archive", "ARCHIVE")}
            </button>
          </div>
        ) : null}
      </div>

      <Link href={toRecordHref(id)} className="flex-1 overflow-hidden flex flex-col relative z-10">
        <p className="font-bold text-base md:text-lg leading-tight line-clamp-5 flex-1 mb-4 group-hover:text-glitch transition-all">
          {stripMarkdown(record.content)}
        </p>

        {record.source_title ? (
          <div className="mt-auto flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold text-muted-foreground group-hover:text-background/70 truncate border-t-2 border-border/50 group-hover:border-background/30 pt-2">
            {record.favicon_url && (
              <img
                src={record.favicon_url}
                alt=""
                width={12}
                height={12}
                className="w-3 h-3 flex-shrink-0 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            )}
            {record.source_title}
          </div>
        ) : null}
      </Link>
    </div>
  )
})
