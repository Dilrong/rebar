import { Skeleton } from "@shared/ui/skeleton"
import type { RecordRow } from "@/lib/types"
import { LibraryRecordCard } from "./library-record-card"

type InboxDecisionType = "ACT" | "ARCHIVE" | "DEFER"

type LibraryRecordGridProps = {
  t: (key: string, fallback?: string) => string
  isLoading: boolean
  isUpdating: boolean
  records: RecordRow[]
  selectedIds: string[]
  onToggleSelected: (id: string) => void
  onPrefetch: (id: string) => void
  toRecordHref: (recordId: string) => string
  onOpenRecord: (recordId: string) => void
  activatePendingRecordId: string | null
  inboxPending: boolean
  inboxPendingRecordId: string | null
  inboxPendingDecisionType: InboxDecisionType | null
  onActivate: (id: string) => void
  onInboxTodo: (id: string) => void
  onInboxArchive: (id: string) => void
}

export function LibraryRecordGrid({
  t,
  isLoading,
  isUpdating,
  records,
  selectedIds,
  onToggleSelected,
  onPrefetch,
  toRecordHref,
  onOpenRecord,
  activatePendingRecordId,
  inboxPending,
  inboxPendingRecordId,
  inboxPendingDecisionType,
  onActivate,
  onInboxTodo,
  onInboxArchive
}: LibraryRecordGridProps) {
  return (
    <div className={`grid grid-cols-1 gap-6 transition-opacity duration-200 md:grid-cols-2 lg:grid-cols-3 ${isUpdating ? "opacity-50" : "opacity-100"}`}>
      {isLoading ? (
        <>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="min-h-[14rem] md:min-h-[18rem] w-full" />
          ))}
        </>
      ) : null}

      {!isLoading && records.map((record) => (
        <div key={record.id} className="animate-[fade-in-up_200ms_ease-out]">
          <LibraryRecordCard
            record={record}
            selected={selectedIds.includes(record.id)}
            onToggleSelected={onToggleSelected}
            onPrefetch={onPrefetch}
            toRecordHref={toRecordHref}
            onOpenRecord={onOpenRecord}
            t={t}
            activatePending={activatePendingRecordId === record.id}
            inboxPending={inboxPending}
            onActivate={onActivate}
            onInboxTodo={onInboxTodo}
            onInboxArchive={onInboxArchive}
            inboxTodoPending={
              inboxPending &&
              inboxPendingRecordId === record.id &&
              inboxPendingDecisionType === "ACT"
            }
            inboxArchivePending={
              inboxPending &&
              inboxPendingRecordId === record.id &&
              inboxPendingDecisionType === "ARCHIVE"
            }
          />
        </div>
      ))}
    </div>
  )
}
