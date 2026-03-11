import { useCallback, useMemo, useState } from "react"
import type { RecordRow } from "@/lib/types"

export function useLibrarySelection(records: RecordRow[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([])

  const visibleIds = useMemo(() => records.map((record) => record.id), [records])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }, [])

  const selectVisible = useCallback(() => {
    setSelectedIds(visibleIds)
  }, [visibleIds])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

  return {
    selectedIds,
    setSelectedIds,
    bulkTagIds,
    setBulkTagIds,
    visibleIds,
    toggleSelect,
    selectVisible,
    clearSelection
  }
}
