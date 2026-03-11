import { useCallback, useEffect, useState } from "react"
import type { RecordRow } from "@/lib/types"

type RecordEditorSource = {
  record: Pick<RecordRow, "url" | "source_title" | "state" | "current_note">
}

type UseRecordEditorStateOptions = {
  detail: RecordEditorSource | undefined
  updateRecord: { mutate: (payload: { url: string; source_title: string; state: RecordRow["state"] }) => void }
  updateNote: { mutate: (note: string | null) => void; isPending: boolean }
  redirectTimer: number | null
  setRedirectTimer: (value: number | null) => void
  setShowDeleteToast: (value: boolean) => void
}

export function useRecordEditorState({ detail, updateRecord, updateNote, redirectTimer, setRedirectTimer, setShowDeleteToast }: UseRecordEditorStateOptions) {
  const [editUrl, setEditUrl] = useState("")
  const [editSourceTitle, setEditSourceTitle] = useState("")
  const [editState, setEditState] = useState<RecordRow["state"]>("INBOX")
  const [editNote, setEditNote] = useState("")

  useEffect(() => {
    if (!detail) {
      return
    }

    setEditUrl(detail.record.url ?? "")
    setEditSourceTitle(detail.record.source_title ?? "")
    setEditState(detail.record.state)
    setEditNote(detail.record.current_note ?? "")
  }, [detail])

  useEffect(() => {
    return () => {
      if (redirectTimer) {
        window.clearTimeout(redirectTimer)
      }
    }
  }, [redirectTimer])

  const requestSaveRecord = useCallback((onTrashRequest: () => void) => {
    if (editState === "TRASHED" && detail?.record.state !== "TRASHED") {
      onTrashRequest()
      return
    }

    updateRecord.mutate({
      source_title: editSourceTitle,
      url: editUrl,
      state: editState
    })
  }, [detail?.record.state, editSourceTitle, editState, editUrl, updateRecord])

  const quickArchive = useCallback(() => {
    updateRecord.mutate({
      source_title: detail?.record.source_title ?? "",
      url: detail?.record.url ?? "",
      state: "ARCHIVED"
    })
  }, [detail?.record.source_title, detail?.record.url, updateRecord])

  const requestSaveNote = useCallback(() => {
    if (!detail || updateNote.isPending) {
      return
    }

    const nextNote = editNote.trim().length > 0 ? editNote : null
    const currentNote = detail.record.current_note ?? null
    if (nextNote === currentNote) {
      return
    }

    updateNote.mutate(nextNote)
  }, [detail, editNote, updateNote])

  const undoDelete = useCallback((lastStateBeforeDelete: RecordRow["state"]) => {
    if (redirectTimer) {
      window.clearTimeout(redirectTimer)
      setRedirectTimer(null)
    }

    setShowDeleteToast(false)
    updateRecord.mutate({
      source_title: editSourceTitle,
      url: editUrl,
      state: lastStateBeforeDelete
    })
  }, [editSourceTitle, editUrl, redirectTimer, setRedirectTimer, setShowDeleteToast, updateRecord])

  return {
    editUrl,
    setEditUrl,
    editSourceTitle,
    setEditSourceTitle,
    editState,
    setEditState,
    editNote,
    setEditNote,
    requestSaveRecord,
    quickArchive,
    requestSaveNote,
    undoDelete
  }
}
