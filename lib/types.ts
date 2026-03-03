import type { RecordKind, RecordState } from "@/lib/schemas"

export type RecordRow = {
  id: string
  user_id: string
  kind: RecordKind
  content: string
  content_hash: string
  url: string | null
  source_title: string | null
  favicon_url: string | null
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
}
