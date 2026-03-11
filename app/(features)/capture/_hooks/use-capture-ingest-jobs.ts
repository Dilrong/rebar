import { useMutation } from "@tanstack/react-query"
import { apiFetch } from "@/lib/client-http"
import type { IngestItemInput } from "../_lib/external-import"

type IngestJobsRefetchable = {
  refetch: () => void
}

export function useCaptureIngestJobs({ ingestJobs, onRetryMessage, onRetryToast }: { ingestJobs: IngestJobsRefetchable; onRetryMessage: (message: string) => void; onRetryToast: () => void }) {
  const enqueueRetryMutation = useMutation({
    mutationFn: (payload: { items: IngestItemInput[]; import_channel: "csv" | "json"; error?: string }) =>
      apiFetch<{ id: string }>("/api/ingest-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: { items: payload.items, import_channel: payload.import_channel }, error: payload.error })
      }),
    onSuccess: () => {
      ingestJobs.refetch()
    }
  })

  const clearRetryMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ cleared: boolean }>("/api/ingest-jobs?status=PENDING", {
        method: "DELETE"
      }),
    onSuccess: () => {
      ingestJobs.refetch()
    }
  })

  const clearFailedRetryMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ cleared: boolean }>("/api/ingest-jobs?status=FAILED", {
        method: "DELETE"
      }),
    onSuccess: () => {
      ingestJobs.refetch()
    }
  })

  const retryAllMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ done: number; failed: number; pending: number }>("/api/ingest-jobs/retry?status=ALL", {
        method: "POST"
      }),
    onSuccess: (data) => {
      ingestJobs.refetch()
      onRetryMessage(data.failed > 0 ? "partial" : "done")

      if (data.done > 0) {
        onRetryToast()
      }
    }
  })

  return {
    enqueueRetryMutation,
    clearRetryMutation,
    clearFailedRetryMutation,
    retryAllMutation
  }
}
