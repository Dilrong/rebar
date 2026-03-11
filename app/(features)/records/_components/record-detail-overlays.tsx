import { BottomSheet } from "@shared/ui/bottom-sheet"
import { Toast } from "@shared/ui/toast"
import { ConfirmDialog } from "./confirm-dialog"
import { RecordHighlightPopup } from "./record-highlight-popup"
import type { ReactNode } from "react"

type RecordDetailOverlaysProps = {
  t: (key: string, fallback?: string) => string
  pendingDeleteConfirm: boolean
  onCancelDelete: () => void
  onConfirmDelete: () => void
  pendingTrashConfirm: boolean
  onCancelTrash: () => void
  onConfirmTrash: () => void
  showUpdateToast: boolean
  onCloseUpdateToast: () => void
  showDeleteToast: boolean
  onUndoDelete: () => void
  onCloseDeleteToast: () => void
  highlightOpen: boolean
  highlightX: number
  highlightY: number
  highlightPending: boolean
  onConfirmHighlight: () => void
  mobilePanel: "manage" | "tags" | "history" | null
  onCloseMobilePanel: () => void
  panelContent: ReactNode
}

export function RecordDetailOverlays(props: RecordDetailOverlaysProps) {
  return (
    <>
      <ConfirmDialog
        open={props.pendingDeleteConfirm}
        title={props.t("confirm.deleteTitle", "Delete record?")}
        description={props.t("confirm.deleteDesc", "The item will move to trash. You can undo for a short time.")}
        confirmLabel={props.t("confirm.delete", "Delete")}
        cancelLabel={props.t("confirm.cancel", "Cancel")}
        onCancel={props.onCancelDelete}
        onConfirm={props.onConfirmDelete}
      />
      <ConfirmDialog
        open={props.pendingTrashConfirm}
        title={props.t("confirm.trashTitle", "Move to trash?")}
        description={props.t("confirm.trashDesc", "This item will be hidden from normal lists.")}
        confirmLabel={props.t("confirm.move", "Move")}
        cancelLabel={props.t("confirm.cancel", "Cancel")}
        onCancel={props.onCancelTrash}
        onConfirm={props.onConfirmTrash}
      />
      {props.showUpdateToast ? <Toast message={props.t("toast.updated", "Updated")} tone="success" onClose={props.onCloseUpdateToast} /> : null}
      {props.showDeleteToast ? (
        <Toast
          message={props.t("toast.deleted", "Moved to trash")}
          actionLabel={props.t("toast.undo", "Undo")}
          onAction={props.onUndoDelete}
          onClose={props.onCloseDeleteToast}
        />
      ) : null}
      <RecordHighlightPopup
        open={props.highlightOpen}
        x={props.highlightX}
        y={props.highlightY}
        pending={props.highlightPending}
        label={props.t("record.highlight", "HIGHLIGHT")}
        onConfirm={props.onConfirmHighlight}
      />
      <BottomSheet
        open={Boolean(props.mobilePanel)}
        title={props.mobilePanel === "manage" ? "MANAGE" : props.mobilePanel === "tags" ? "TAGS" : "LOG HISTORY"}
        onClose={props.onCloseMobilePanel}
      >
        {props.panelContent}
      </BottomSheet>
    </>
  )
}
