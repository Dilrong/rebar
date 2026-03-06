import type {
  AnnotationRow,
  IngestJobRow,
  RecordIngestEventRow,
  RecordNoteVersionRow,
  RecordRow,
  RecordTagRow,
  ReviewLogRow,
  SourceRow,
  TagRow,
  UserPreferencesRow,
  JsonValue
} from "@/lib/types"
export type Json = JsonValue

type TableDefinition<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type FunctionDefinition<Args, Returns> = {
  Args: Args
  Returns: Returns
}

type RecordRowWithGenerated = RecordRow & {
  fts?: unknown
}

type IngestJobRowWithJson = Omit<IngestJobRow, "payload"> & {
  payload: Json
}

export type Database = {
  public: {
    Tables: {
      annotations: TableDefinition<AnnotationRow>
      ingest_jobs: TableDefinition<IngestJobRowWithJson>
      record_ingest_events: TableDefinition<RecordIngestEventRow>
      record_note_versions: TableDefinition<RecordNoteVersionRow>
      record_tags: TableDefinition<RecordTagRow>
      records: TableDefinition<RecordRowWithGenerated>
      review_log: TableDefinition<ReviewLogRow>
      sources: TableDefinition<SourceRow>
      tags: TableDefinition<TagRow>
      user_preferences: TableDefinition<UserPreferencesRow>
    }
    Views: Record<string, never>
    Functions: {
      create_record_with_tags: FunctionDefinition<{
        p_user_id: string
        p_kind: RecordRow["kind"]
        p_content: string
        p_content_hash: string
        p_url: string | null
        p_source_title: string | null
        p_tag_ids: string[]
      }, RecordRowWithGenerated[]>
      merge_record_with_tags: FunctionDefinition<{
        p_user_id: string
        p_content_hash: string
        p_url: string | null
        p_source_title: string | null
        p_tag_ids: string[]
      }, RecordRowWithGenerated[]>
      update_record_with_tags: FunctionDefinition<{
        p_user_id: string
        p_record_id: string
        p_update_state: boolean
        p_state: RecordRow["state"] | null
        p_update_url: boolean
        p_url: string | null
        p_update_source_title: boolean
        p_source_title: string | null
        p_update_tags: boolean
        p_tag_ids: string[]
      }, RecordRowWithGenerated[]>
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
