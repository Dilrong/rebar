import { z } from "zod"
import { IngestPayloadSchema } from "@feature-lib/capture/ingest"
import type { ImportChannel, IngestJobRow } from "@/lib/types"

export const IngestJobStatusSchema = z.enum(["PENDING", "PROCESSING", "DONE", "FAILED"])
export const IngestJobScopeSchema = z.union([IngestJobStatusSchema, z.literal("ALL")])
export const RetryableIngestJobStatusSchema = z.enum(["PENDING", "FAILED"])
export const RetryableIngestJobScopeSchema = z.union([RetryableIngestJobStatusSchema, z.literal("ALL")])

export type IngestJobStatus = z.infer<typeof IngestJobStatusSchema>
export type IngestJobScope = z.infer<typeof IngestJobScopeSchema>
export type RetryableIngestJobScope = z.infer<typeof RetryableIngestJobScopeSchema>

export type IngestJobListItem = Pick<IngestJobRow, "id" | "status" | "attempts" | "last_error" | "created_at"> & {
  item_count: number
  import_channel: ImportChannel | "unknown"
  preview: string | null
}

export type IngestJobCounts = {
  pending: number
  processing: number
  done: number
  failed: number
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue
    }

    const trimmed = value.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }

  return null
}

function getPreviewFromPayloadItem(item: unknown) {
  if (!item || typeof item !== "object") {
    return null
  }

  const value = item as Record<string, unknown>
  const preview = firstNonEmptyString(
    value.book_title,
    value.source_title,
    value.title,
    value.content,
    value.text,
    value.highlight,
    value.note
  )

  if (!preview) {
    return null
  }

  return preview.replace(/\s+/g, " ").trim().slice(0, 80)
}

export function summarizeIngestJobPayload(payload: unknown) {
  const parsed = IngestPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      item_count: 0,
      import_channel: "unknown" as const,
      preview: null
    }
  }

  const preview = getPreviewFromPayloadItem(parsed.data.items[0])

  return {
    item_count: parsed.data.items.length,
    import_channel: (parsed.data.import_channel ?? "unknown") as ImportChannel | "unknown",
    preview
  }
}

export function toIngestJobListItem(job: Pick<IngestJobRow, "id" | "status" | "attempts" | "last_error" | "created_at" | "payload">): IngestJobListItem {
  const summary = summarizeIngestJobPayload(job.payload)

  return {
    id: job.id,
    status: job.status,
    attempts: job.attempts,
    last_error: job.last_error,
    created_at: job.created_at,
    item_count: summary.item_count,
    import_channel: summary.import_channel,
    preview: summary.preview
  }
}
