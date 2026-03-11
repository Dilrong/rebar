import { useQuery } from "@tanstack/react-query"
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

export function useRecordDetailQueries(id: string) {
  const detail = useQuery({
    queryKey: ["record-detail", id],
    queryFn: () => apiFetch<DetailResponse>(`/api/records/${id}`),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5
  })

  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagsResponse>("/api/tags"),
    staleTime: 1000 * 60 * 10
  })

  return {
    detail,
    tags
  }
}
