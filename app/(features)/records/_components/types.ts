import type { AnnotationRow, RecordNoteVersionRow, RecordRow, TagRow } from "@/lib/types"

export type Translate = (key: string, fallback?: string) => string

export type RecordManageState = RecordRow["state"]

export type RecordAnnotation = AnnotationRow
export type RecordNoteVersion = RecordNoteVersionRow
export type RecordTag = TagRow
