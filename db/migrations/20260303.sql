-- Migration: 2026-03-03
-- 1. Add favicon_url column to records
-- 2. Performance indexes for review and library queries
-- 3. Add anchor column to annotations for inline highlight support

-- ─── Schema Changes ─────────────────────────────────────────

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS favicon_url TEXT;

ALTER TABLE public.annotations
  ADD COLUMN IF NOT EXISTS anchor TEXT;

-- ─── Performance Indexes ────────────────────────────────────

-- Composite index for review today queries (user + state + due_at)
CREATE INDEX IF NOT EXISTS records_user_state_due
  ON public.records (user_id, state, due_at ASC NULLS LAST);

-- Composite index for library/records list queries (user + state + created_at)
CREATE INDEX IF NOT EXISTS records_user_state_created
  ON public.records (user_id, state, created_at DESC);

-- Composite index for record_tags tag-filter lookups
CREATE INDEX IF NOT EXISTS record_tags_tag_record
  ON public.record_tags (tag_id, record_id);
