import { useMutation, type QueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { apiFetch } from "@/lib/client-http"
import type { AnnotationRow, RecordNoteVersionRow, RecordRow, TagRow } from "@/lib/types"

type DetailResponse = {
  record: RecordRow
  annotations: AnnotationRow[]
  note_versions: RecordNoteVersionRow[]
  tags: Pick<TagRow, "id" | "name">[]
}

type TagsResponse = {
  data: TagRow[]
}

type UseRecordDetailMutationsOptions = {
  id: string
  queryClient: QueryClient
  router: { replace: (href: string) => void }
  setSelectionPopup: (value: null) => void
  selectedTagIds: Set<string>
  setShowUpdateToast: (value: boolean) => void
  setShowDeleteToast: (value: boolean) => void
  setRedirectTimer: (value: number | null) => void
}

export function useRecordDetailMutations({ id, queryClient, router, setSelectionPopup, selectedTagIds, setShowUpdateToast, setShowDeleteToast, setRedirectTimer }: UseRecordDetailMutationsOptions) {
  const [newTagName, setNewTagName] = useState("")
  const addHighlight = useMutation({
    mutationFn: ({ body, anchor }: { body: string; anchor: string }) =>
      apiFetch(`/api/records/${id}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "highlight", body, anchor })
      }),
    onSuccess: () => {
      setSelectionPopup(null)
      window.getSelection()?.removeAllRanges()
      queryClient.invalidateQueries({ queryKey: ["record-detail", id] })
    }
  })

  const deleteAnnotation = useMutation({
    mutationFn: (annotationId: string) => apiFetch(`/api/records/${id}/annotations/${annotationId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-detail", id] })
    }
  })

  const updateTags = useMutation({
    mutationFn: (tagIds: string[]) =>
      apiFetch<{ record: RecordRow }>(`/api/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_ids: tagIds })
      }),
    onMutate: async (tagIds) => {
      await queryClient.cancelQueries({ queryKey: ["record-detail", id] })

      const previousDetail = queryClient.getQueryData<DetailResponse>(["record-detail", id])
      const allTags = queryClient.getQueryData<TagsResponse>(["tags"])?.data ?? []
      const nextTags = allTags.filter((tag) => tagIds.includes(tag.id)).map((tag) => ({ id: tag.id, name: tag.name }))

      queryClient.setQueryData<DetailResponse>(["record-detail", id], (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          tags: nextTags
        }
      })

      return { previousDetail }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(["record-detail", id], context.previousDetail)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-detail", id] })
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["search"] })
    }
  })

  const createTag = useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ tag: TagRow }>("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      }),
    onSuccess: (res) => {
      setNewTagName("")
      queryClient.invalidateQueries({ queryKey: ["tags"] })
      updateTags.mutate([...Array.from(selectedTagIds), res.tag.id])
    }
  })

  const updateRecord = useMutation({
    mutationFn: (payload: { url: string; source_title: string; state: RecordRow["state"] }) =>
      apiFetch<{ record: RecordRow }>(`/api/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["record-detail", id] })
      const previousDetail = queryClient.getQueryData<DetailResponse>(["record-detail", id])

      queryClient.setQueryData<DetailResponse>(["record-detail", id], (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          record: {
            ...current.record,
            url: payload.url || null,
            source_title: payload.source_title || null,
            state: payload.state,
            updated_at: new Date().toISOString()
          }
        }
      })

      return { previousDetail }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(["record-detail", id], context.previousDetail)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-detail", id] })
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["search"] })
      queryClient.invalidateQueries({ queryKey: ["record-counts"] })
      queryClient.invalidateQueries({ queryKey: ["review-today"] })
      setShowUpdateToast(true)
      window.setTimeout(() => setShowUpdateToast(false), 5000)
    }
  })

  const updateNote = useMutation<{ record: RecordRow }, Error, string | null, { previousDetail?: DetailResponse }>({
    mutationFn: (currentNote) =>
      apiFetch<{ record: RecordRow }>(`/api/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_note: currentNote })
      }),
    onMutate: async (currentNote) => {
      await queryClient.cancelQueries({ queryKey: ["record-detail", id] })
      const previousDetail = queryClient.getQueryData<DetailResponse>(["record-detail", id])

      queryClient.setQueryData<DetailResponse>(["record-detail", id], (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          record: {
            ...current.record,
            current_note: currentNote,
            note_updated_at: currentNote ? new Date().toISOString() : null
          }
        }
      })

      return { previousDetail }
    },
    onError: (_error, _currentNote, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(["record-detail", id], context.previousDetail)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["record-detail", id] })
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["search"] })
    }
  })

  const deleteRecord = useMutation({
    mutationFn: () => apiFetch<{ record: RecordRow }>(`/api/records/${id}`, { method: "DELETE" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["record-detail", id] })
      const previousDetail = queryClient.getQueryData<DetailResponse>(["record-detail", id])

      queryClient.setQueryData<DetailResponse>(["record-detail", id], (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          record: {
            ...current.record,
            state: "TRASHED",
            updated_at: new Date().toISOString()
          }
        }
      })

      return { previousDetail }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(["record-detail", id], context.previousDetail)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["records"] })
      queryClient.invalidateQueries({ queryKey: ["search"] })
      queryClient.invalidateQueries({ queryKey: ["record-counts"] })
      queryClient.invalidateQueries({ queryKey: ["review-today"] })
      setShowDeleteToast(true)
      const timer = window.setTimeout(() => {
        router.replace("/library")
      }, 4000)
      setRedirectTimer(timer)
    }
  })

  return {
    newTagName,
    setNewTagName,
    addHighlight,
    deleteAnnotation,
    updateTags,
    createTag,
    updateRecord,
    updateNote,
    deleteRecord
  }
}
