BEGIN;

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(source_title, '')), 'A') ||
    setweight(to_tsvector('simple', content), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS records_fts_idx
  ON public.records USING GIN (fts);

CREATE INDEX IF NOT EXISTS records_user_created_at
  ON public.records (user_id, created_at DESC);

ALTER TABLE public.review_log
  ADD COLUMN IF NOT EXISTS prev_state TEXT,
  ADD COLUMN IF NOT EXISTS prev_interval_days INTEGER,
  ADD COLUMN IF NOT EXISTS prev_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prev_review_count INTEGER,
  ADD COLUMN IF NOT EXISTS prev_last_reviewed_at TIMESTAMPTZ;

DO $$
DECLARE
  c_name text;
  c_def text;
BEGIN
  SELECT con.conname, pg_get_constraintdef(con.oid)
    INTO c_name, c_def
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'review_log'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%action%';

  IF c_name IS NOT NULL AND c_def NOT ILIKE '%undo%' THEN
    EXECUTE format('ALTER TABLE public.review_log DROP CONSTRAINT %I', c_name);
    ALTER TABLE public.review_log
      ADD CONSTRAINT review_log_action_check
      CHECK (action IN ('reviewed', 'resurface', 'undo'));
  ELSIF c_name IS NULL THEN
    ALTER TABLE public.review_log
      ADD CONSTRAINT review_log_action_check
      CHECK (action IN ('reviewed', 'resurface', 'undo'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS review_log_record
  ON public.review_log (record_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS review_log_user_reviewed_at
  ON public.review_log (user_id, reviewed_at DESC);

CREATE TABLE IF NOT EXISTS public.ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DONE', 'FAILED')),
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingest_jobs_user_status_created
  ON public.ingest_jobs (user_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'records_set_updated_at'
      AND tgrelid = 'public.records'::regclass
  ) THEN
    CREATE TRIGGER records_set_updated_at
    BEFORE UPDATE ON public.records
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'ingest_jobs_set_updated_at'
      AND tgrelid = 'public.ingest_jobs'::regclass
  ) THEN
    CREATE TRIGGER ingest_jobs_set_updated_at
    BEFORE UPDATE ON public.ingest_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

COMMIT;
