import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/client-http"
import type { TagRow } from "@/lib/types"

type TagsResponse = {
  data: TagRow[]
}

type IngestJobRow = {
  id: string
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED"
  attempts: number
  last_error: string | null
  created_at: string
  item_count: number
  import_channel: "manual" | "csv" | "json" | "api" | "share" | "extension" | "url" | "ocr" | "unknown"
  preview: string | null
}

type IngestJobsResponse = {
  data: IngestJobRow[]
  total: number
  counts: {
    pending: number
    processing: number
    done: number
    failed: number
  }
}

export function useCaptureQueries() {
  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagsResponse>("/api/tags"),
    staleTime: 1000 * 60 * 10
  })

  const ingestJobs = useQuery({
    queryKey: ["ingest-jobs", "all"],
    queryFn: () => apiFetch<IngestJobsResponse>("/api/ingest-jobs?status=ALL"),
    staleTime: 1000 * 30
  })

  return {
    tags,
    ingestJobs
  }
}
