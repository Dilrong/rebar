import type { RecordKind, RecordState } from "@/lib/schemas"

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[]

export type SourceType = "book" | "article" | "service" | "manual" | "ai" | "unknown"
export type ImportChannel = "manual" | "csv" | "json" | "api" | "share" | "extension" | "url" | "ocr"

export type SourceRow = {
  id: string
  user_id: string
  source_type: SourceType
  identity_key: string
  title: string | null
  author: string | null
  url: string | null
  service: string | null
  external_source_id: string | null
  created_at: string
  updated_at: string
}

export type RecordRow = {
  id: string
  user_id: string
  source_id: string | null
  kind: RecordKind
  content: string
  content_hash: string
  url: string | null
  source_title: string | null
  favicon_url: string | null
  current_note: string | null
  note_updated_at: string | null
  adopted_from_ai: boolean
  state: RecordState
  interval_days: number
  due_at: string | null
  last_reviewed_at: string | null
  review_count: number
  created_at: string
  updated_at: string
}

export type AnnotationRow = {
  id: string
  record_id: string
  user_id: string
  kind: "highlight" | "comment" | "correction"
  body: string
  anchor: string | null
  created_at: string
}

export type RecordNoteVersionRow = {
  id: string
  record_id: string
  user_id: string
  body: string
  import_channel: ImportChannel | null
  replaced_at: string
}

export type RecordIngestEventRow = {
  id: string
  record_id: string
  source_id: string
  user_id: string
  import_channel: ImportChannel
  source_snapshot: JsonValue
  note_snapshot: string | null
  external_item_id: string | null
  external_anchor: string | null
  created_at: string
}

export type TagRow = {
  id: string
  user_id: string
  name: string
}

export type RecordTagRow = {
  record_id: string
  tag_id: string
}

export type ReviewLogRow = {
  id: string
  user_id: string
  record_id: string
  reviewed_at: string
  action: "reviewed" | "resurface" | "undo"
  prev_state: RecordState | null
  prev_interval_days: number | null
  prev_due_at: string | null
  prev_review_count: number | null
  prev_last_reviewed_at: string | null
  decision_type: "ARCHIVE" | "ACT" | "DEFER" | null
  action_type: "EXPERIMENT" | "SHARE" | "TODO" | null
  defer_reason: "NEED_INFO" | "LOW_CONFIDENCE" | "NO_TIME" | null
}

export type IngestJobRow = {
  id: string
  user_id: string
  status: "PENDING" | "DONE" | "FAILED"
  payload: unknown
  attempts: number
  last_error: string | null
  created_at: string
  updated_at: string
}

export type UserPreferencesRow = {
  user_id: string
  start_page: "/review" | "/capture" | "/library" | "/search"
  font_family: "sans" | "mono"
  created_at: string
  updated_at: string
}
