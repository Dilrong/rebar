import type { AnnotationRow, RecordRow, TagRow } from "@/lib/types"

export type Translate = (key: string, fallback?: string) => string

export type AssistData = {
  summary: string[]
  questions: string[]
  todos: string[]
  signals: {
    topKeywords: string[]
  }
}

export type RecordManageState = RecordRow["state"]

export type RecordAnnotation = AnnotationRow
export type RecordTag = TagRow
