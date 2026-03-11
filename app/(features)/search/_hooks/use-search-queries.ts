import { useCallback } from "react"
import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/client-http"
import type { RecordRow, TagRow } from "@/lib/types"

type SearchResultRow = RecordRow & {
  semantic_score?: number
  semantic_matches?: string[]
}

type SearchResponse = {
  data: SearchResultRow[]
  semantic?: boolean
}

type TagsResponse = {
  data: TagRow[]
}

export function useSearchQueries({ queryClient, queryString }: { queryClient: QueryClient; queryString: string }) {
  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagsResponse>("/api/tags"),
    staleTime: 1000 * 60 * 10
  })

  const result = useQuery({
    queryKey: ["search", queryString],
    queryFn: () => apiFetch<SearchResponse>(`/api/search?${queryString}`),
    enabled: queryString.length > 0,
    staleTime: 1000 * 30,
    placeholderData: keepPreviousData
  })

  const prefetchRecord = useCallback((id: string) => {
    queryClient.prefetchQuery({
      queryKey: ["record-detail", id],
      queryFn: () => apiFetch<{ record: RecordRow }>(`/api/records/${id}`),
      staleTime: 1000 * 60 * 5
    })
  }, [queryClient])

  return {
    tags,
    result,
    prefetchRecord
  }
}
