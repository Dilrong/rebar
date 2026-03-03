-- Performance indexes for review and library queries

-- Composite index for review today queries (user + state + due_at)
CREATE INDEX IF NOT EXISTS records_user_state_due
  ON public.records (user_id, state, due_at ASC NULLS LAST);

-- Composite index for library/records list queries (user + state + created_at)
CREATE INDEX IF NOT EXISTS records_user_state_created
  ON public.records (user_id, state, created_at DESC);

-- Composite index for record_tags tag-filter lookups
CREATE INDEX IF NOT EXISTS record_tags_tag_record
  ON public.record_tags (tag_id, record_id);
