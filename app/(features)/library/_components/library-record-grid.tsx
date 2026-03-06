import { Skeleton } from "@shared/ui/skeleton"
import type { RecordRow } from "@/lib/types"
import { LibraryRecordCard } from "./library-record-card"

type InboxDecisionType = "ACT" | "ARCHIVE" | "DEFER"

type LibraryRecordGridProps = {
  t: (key: string, fallback?: string) => string
  isLoading: boolean
  records: RecordRow[]
  selectedIds: string[]
  onToggleSelected: (id: string) => void
  onPrefetch: (id: string) => void
  toRecordHref: (recordId: string) => string
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
  records,
  selectedIds,
  onToggleSelected,
  onPrefetch,
  toRecordHref,
  activatePendingRecordId,
  inboxPending,
  inboxPendingRecordId,
  inboxPendingDecisionType,
  onActivate,
  onInboxTodo,
  onInboxArchive
}: LibraryRecordGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {isLoading ? (
        <>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="min-h-[14rem] md:min-h-[18rem] w-full" />
          ))}
        </>
      ) : null}

      {!isLoading && records.map((record) => (
        <LibraryRecordCard
          key={record.id}
          record={record}
          selected={selectedIds.includes(record.id)}
          onToggleSelected={onToggleSelected}
          onPrefetch={onPrefetch}
          toRecordHref={toRecordHref}
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
      ))}
    </div>
  )
}
