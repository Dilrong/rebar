import { useCallback, useState } from "react"
import type { TagRow } from "@/lib/types"

export function useLibraryTagEditor(renameTag: { mutate: (payload: { id: string; name: string }) => void }) {
  const [newTagName, setNewTagName] = useState("")
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState("")

  const handleRenameTag = useCallback((tag: TagRow) => {
    setEditingTagId(tag.id)
    setEditingTagName(tag.name)
  }, [])

  const submitRenameTag = useCallback((id: string) => {
    const trimmed = editingTagName.trim()
    setEditingTagId(null)
    if (!trimmed) {
      return
    }
    renameTag.mutate({ id, name: trimmed })
  }, [editingTagName, renameTag])

  const cancelRenameTag = useCallback(() => {
    setEditingTagId(null)
  }, [])

  return {
    newTagName,
    setNewTagName,
    editingTagId,
    editingTagName,
    setEditingTagName,
    handleRenameTag,
    submitRenameTag,
    cancelRenameTag
  }
}
