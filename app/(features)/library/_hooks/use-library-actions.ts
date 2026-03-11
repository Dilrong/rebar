import { useCallback } from "react"
import { useMutation, type QueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/client-http"
import type { RecordRow, TagRow } from "@/lib/types"

type InboxDecisionPayload = {
  id: string
  decisionType: "ARCHIVE" | "ACT" | "DEFER"
  actionType?: "EXPERIMENT" | "SHARE" | "TODO"
  deferReason?: "NEED_INFO" | "LOW_CONFIDENCE" | "NO_TIME"
}

type UseLibraryActionsOptions = {
  queryClient: QueryClient
  tagId: string
  setTagId: (value: string) => void
  selectedIds: string[]
  setSelectedIds: (value: string[]) => void
  bulkTagIds: string[]
  setBulkTagIds: (value: string[]) => void
}

export function useLibraryActions({ queryClient, tagId, setTagId, selectedIds, setSelectedIds, bulkTagIds, setBulkTagIds }: UseLibraryActionsOptions) {
  const activate = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ record: RecordRow }>(`/api/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "ACTIVE" })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["record-counts"] })
    }
  })

  const inboxDecision = useMutation({
    mutationFn: ({ id, ...payload }: InboxDecisionPayload) =>
      apiFetch<{ record: RecordRow }>(`/api/review/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["record-counts"] })
      queryClient.invalidateQueries({ queryKey: ["review-stats"] })
      queryClient.invalidateQueries({ queryKey: ["review-today"] })
    }
  })

  const bulkStateMutation = useMutation({
    mutationFn: (payload: { ids: string[]; state: "ACTIVE" | "PINNED" | "ARCHIVED" | "TRASHED" }) =>
      apiFetch<{ updated: number; failed: number }>("/api/records/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      setSelectedIds([])
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["record-counts"] })
    }
  })

  const bulkTagMutation = useMutation({
    mutationFn: (payload: { ids: string[]; tag_ids: string[]; mode: "add" | "replace" }) =>
      apiFetch<{ processed: number }>("/api/records/bulk/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      setSelectedIds([])
      setBulkTagIds([])
      queryClient.invalidateQueries({ queryKey: ["records"] })
    }
  })

  const createTag = useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ tag: TagRow }>("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] })
    }
  })

  const renameTag = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch<{ tag: TagRow }>(`/api/tags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] })
  })

  const deleteTag = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: true }>(`/api/tags/${id}`, {
        method: "DELETE"
      }),
    onSuccess: (_data, id) => {
      if (tagId === id) {
        setTagId("")
      }
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      queryClient.invalidateQueries({ queryKey: ["records"] })
    }
  })

  const handleActivate = useCallback((id: string) => activate.mutate(id), [activate])
  const handleInboxTodo = useCallback((id: string) => inboxDecision.mutate({ id, decisionType: "ACT", actionType: "TODO" }), [inboxDecision])
  const handleInboxArchive = useCallback((id: string) => inboxDecision.mutate({ id, decisionType: "ARCHIVE" }), [inboxDecision])

  const applyBulkState = (nextState: "ACTIVE" | "PINNED" | "ARCHIVED" | "TRASHED") => {
    if (selectedIds.length === 0) {
      return
    }
    bulkStateMutation.mutate({ ids: selectedIds, state: nextState })
  }

  const applyBulkTags = (mode: "add" | "replace") => {
    if (selectedIds.length === 0 || bulkTagIds.length === 0) {
      return
    }
    bulkTagMutation.mutate({ ids: selectedIds, tag_ids: bulkTagIds, mode })
  }

  return {
    activate,
    inboxDecision,
    bulkStateMutation,
    bulkTagMutation,
    createTag,
    renameTag,
    deleteTag,
    handleActivate,
    handleInboxTodo,
    handleInboxArchive,
    applyBulkState,
    applyBulkTags
  }
}
