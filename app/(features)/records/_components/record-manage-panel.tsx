import { ArrowLeftSquare } from "lucide-react"
import { getStateLabel } from "@/lib/i18n/state-label"
import { LoadingDots } from "@shared/ui/loading"
import type { RecordManageState, Translate } from "./types"

type RecordManagePanelProps = {
  t: Translate
  editSourceTitle: string
  editUrl: string
  editState: RecordManageState
  isRecordMutating: boolean
  updatePending: boolean
  deletePending: boolean
  onEditSourceTitleChange: (value: string) => void
  onEditUrlChange: (value: string) => void
  onEditStateChange: (state: RecordManageState) => void
  onRequestSave: () => void
  onRequestDelete: () => void
}

export function RecordManagePanel({
  t,
  editSourceTitle,
  editUrl,
  editState,
  isRecordMutating,
  updatePending,
  deletePending,
  onEditSourceTitleChange,
  onEditUrlChange,
  onEditStateChange,
  onRequestSave,
  onRequestDelete
}: RecordManagePanelProps) {
  return (
    <div className="border-4 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
      <h3 className="font-black text-xl uppercase text-foreground mb-4 flex items-center justify-between border-b-4 border-foreground pb-2">
        <span className="flex items-center gap-2"><ArrowLeftSquare className="w-6 h-6 rotate-180" strokeWidth={3} /> {t("record.manageRecord", "MANAGE")}</span>
      </h3>
      <div className="space-y-3">
        {isRecordMutating ? (
          <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
            {t("record.pending", "SAVING...")}
          </p>
        ) : null}
        <label htmlFor="record-edit-source-title" className="sr-only">
          SOURCE TITLE
        </label>
        <input
          id="record-edit-source-title"
          value={editSourceTitle}
          onChange={(event) => onEditSourceTitleChange(event.target.value)}
          placeholder="SOURCE TITLE"
          disabled={isRecordMutating}
          className="min-h-[44px] w-full border-2 border-foreground bg-background p-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <label htmlFor="record-edit-url" className="sr-only">
          URL
        </label>
        <input
          id="record-edit-url"
          value={editUrl}
          onChange={(event) => onEditUrlChange(event.target.value)}
          placeholder="https://..."
          disabled={isRecordMutating}
          className="min-h-[44px] w-full border-2 border-foreground bg-background p-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <label htmlFor="record-edit-state" className="sr-only">
          State
        </label>
        <select
          id="record-edit-state"
          value={editState}
          onChange={(event) => onEditStateChange(event.target.value as RecordManageState)}
          disabled={isRecordMutating}
          className="min-h-[44px] w-full border-2 border-foreground bg-background p-2 font-mono text-xs font-bold uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-accent appearance-none cursor-pointer rounded-none"
        >
          <option value="INBOX">{getStateLabel("INBOX", t)}</option>
          <option value="ACTIVE">{getStateLabel("ACTIVE", t)}</option>
          <option value="PINNED">{getStateLabel("PINNED", t)}</option>
          <option value="ARCHIVED">{getStateLabel("ARCHIVED", t)}</option>
          <option value="TRASHED">{getStateLabel("TRASHED", t)}</option>
        </select>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={onRequestSave}
            disabled={isRecordMutating}
            className="min-h-[44px] flex-1 bg-foreground text-background font-black text-xs uppercase py-2 hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
          >
            {updatePending ? <LoadingDots /> : t("record.update", "UPDATE")}
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={isRecordMutating}
            className="min-h-[44px] flex-1 bg-destructive text-destructive-foreground font-black text-xs uppercase py-2 hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {deletePending ? <LoadingDots /> : t("record.delete", "DELETE")}
          </button>
        </div>
      </div>
    </div>
  )
}
