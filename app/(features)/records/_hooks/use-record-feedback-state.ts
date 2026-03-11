import { useCallback, useState } from "react"
import type { RecordRow } from "@/lib/types"

export function useRecordFeedbackState() {
  const [showUpdateToast, setShowUpdateToast] = useState(false)
  const [showDeleteToast, setShowDeleteToast] = useState(false)
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState(false)
  const [pendingTrashConfirm, setPendingTrashConfirm] = useState(false)
  const [lastStateBeforeDelete, setLastStateBeforeDelete] = useState<RecordRow["state"]>("INBOX")

  const requestDeleteRecord = useCallback(() => {
    setPendingDeleteConfirm(true)
  }, [])

  const requestTrashConfirm = useCallback(() => {
    setPendingTrashConfirm(true)
  }, [])

  return {
    showUpdateToast,
    setShowUpdateToast,
    showDeleteToast,
    setShowDeleteToast,
    pendingDeleteConfirm,
    setPendingDeleteConfirm,
    pendingTrashConfirm,
    setPendingTrashConfirm,
    lastStateBeforeDelete,
    setLastStateBeforeDelete,
    requestDeleteRecord,
    requestTrashConfirm
  }
}
