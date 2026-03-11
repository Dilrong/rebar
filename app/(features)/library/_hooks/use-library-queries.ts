import { useCallback } from "react"
import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/client-http"
import type { RecordRow, TagRow } from "@/lib/types"

type RecordsResponse = {
  data: RecordRow[]
  total: number
  next_cursor?: string | null
}

type RecordCountsResponse = {
  inbox: number
  active: number
  pinned: number
  archived: number
}

type TagsResponse = {
  data: TagRow[]
}

type UseLibraryQueriesOptions = {
  queryClient: QueryClient
  queryString: string
  sort: "created_at" | "review_count" | "due_at"
  order: "asc" | "desc"
  setAllRecords: (records: RecordRow[]) => void
  setCursor: (cursor: string | null) => void
}

export function useLibraryQueries({ queryClient, queryString, sort, order, setAllRecords, setCursor }: UseLibraryQueriesOptions) {
  const prefetchRecord = useCallback((id: string) => {
    queryClient.prefetchQuery({
      queryKey: ["record-detail", id],
      queryFn: () => apiFetch<{ record: RecordRow }>(`/api/records/${id}`),
      staleTime: 1000 * 60 * 5
    })
  }, [queryClient])

  const records = useQuery({
    queryKey: ["records", queryString, sort, order],
    queryFn: async () => {
      const data = await apiFetch<RecordsResponse>(`/api/records?${queryString}`)
      setAllRecords(data.data)
      setCursor(data.next_cursor ?? null)
      return data
    },
    staleTime: 1000 * 60 * 5,
    placeholderData: keepPreviousData
  })

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagsResponse>("/api/tags"),
    staleTime: 1000 * 60 * 10
  })

  const recordCounts = useQuery({
    queryKey: ["record-counts"],
    queryFn: () => apiFetch<RecordCountsResponse>("/api/records/counts"),
    staleTime: 1000 * 60 * 2
  })

  return {
    prefetchRecord,
    records,
    tags,
    recordCounts
  }
}
