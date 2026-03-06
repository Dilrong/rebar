CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('book', 'article', 'service', 'manual', 'ai', 'unknown')),
  identity_key TEXT NOT NULL,
  title TEXT,
  author TEXT,
  url TEXT,
  service TEXT,
  external_source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_type, identity_key)
);

ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES public.sources ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS current_note TEXT,
  ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adopted_from_ai BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.annotations
  ADD COLUMN IF NOT EXISTS anchor TEXT;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS font_family TEXT NOT NULL DEFAULT 'sans' CHECK (font_family IN ('sans', 'mono'));

CREATE TABLE IF NOT EXISTS public.record_note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.records ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  body TEXT NOT NULL,
  import_channel TEXT CHECK (import_channel IN ('manual', 'csv', 'json', 'api', 'share', 'extension', 'url', 'ocr')),
  replaced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS record_note_versions_record_replaced_at
  ON public.record_note_versions (record_id, replaced_at DESC);

CREATE TABLE IF NOT EXISTS public.record_ingest_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.records ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.sources ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  import_channel TEXT NOT NULL CHECK (import_channel IN ('manual', 'csv', 'json', 'api', 'share', 'extension', 'url', 'ocr')),
  source_snapshot JSONB NOT NULL,
  note_snapshot TEXT,
  external_item_id TEXT,
  external_anchor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS record_ingest_events_record_created_at
  ON public.record_ingest_events (record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS record_ingest_events_user_channel_created_at
  ON public.record_ingest_events (user_id, import_channel, created_at DESC);

WITH derived_sources AS (
  SELECT
    r.user_id,
    CASE
      WHEN NULLIF(BTRIM(r.url), '') IS NOT NULL THEN 'article'
      WHEN NULLIF(BTRIM(r.source_title), '') IS NOT NULL THEN 'manual'
      ELSE 'manual'
    END AS source_type,
    CASE
      WHEN NULLIF(BTRIM(r.url), '') IS NOT NULL THEN LOWER(BTRIM(r.url))
      WHEN NULLIF(BTRIM(r.source_title), '') IS NOT NULL THEN 'legacy:title:' || LOWER(BTRIM(r.source_title))
      ELSE 'legacy:record:' || r.id::TEXT
    END AS identity_key,
    NULLIF(BTRIM(r.source_title), '') AS title,
    NULLIF(BTRIM(r.url), '') AS url,
    MIN(r.created_at) AS created_at,
    MAX(r.updated_at) AS updated_at
  FROM public.records r
  GROUP BY
    r.user_id,
    CASE
      WHEN NULLIF(BTRIM(r.url), '') IS NOT NULL THEN 'article'
      WHEN NULLIF(BTRIM(r.source_title), '') IS NOT NULL THEN 'manual'
      ELSE 'manual'
    END,
    CASE
      WHEN NULLIF(BTRIM(r.url), '') IS NOT NULL THEN LOWER(BTRIM(r.url))
      WHEN NULLIF(BTRIM(r.source_title), '') IS NOT NULL THEN 'legacy:title:' || LOWER(BTRIM(r.source_title))
      ELSE 'legacy:record:' || r.id::TEXT
    END,
    NULLIF(BTRIM(r.source_title), ''),
    NULLIF(BTRIM(r.url), '')
)
INSERT INTO public.sources (user_id, source_type, identity_key, title, url, created_at, updated_at)
SELECT user_id, source_type, identity_key, title, url, created_at, updated_at
FROM derived_sources
ON CONFLICT (user_id, source_type, identity_key)
DO UPDATE
SET title = COALESCE(EXCLUDED.title, public.sources.title),
    url = COALESCE(EXCLUDED.url, public.sources.url),
    updated_at = GREATEST(public.sources.updated_at, EXCLUDED.updated_at);

UPDATE public.records r
SET source_id = s.id
FROM public.sources s
WHERE r.source_id IS NULL
  AND s.user_id = r.user_id
  AND s.source_type = CASE
    WHEN NULLIF(BTRIM(r.url), '') IS NOT NULL THEN 'article'
    WHEN NULLIF(BTRIM(r.source_title), '') IS NOT NULL THEN 'manual'
    ELSE 'manual'
  END
  AND s.identity_key = CASE
    WHEN NULLIF(BTRIM(r.url), '') IS NOT NULL THEN LOWER(BTRIM(r.url))
    WHEN NULLIF(BTRIM(r.source_title), '') IS NOT NULL THEN 'legacy:title:' || LOWER(BTRIM(r.source_title))
    ELSE 'legacy:record:' || r.id::TEXT
  END;

DROP INDEX IF EXISTS records_user_content_hash;
CREATE UNIQUE INDEX IF NOT EXISTS records_user_source_content_hash
  ON public.records (user_id, source_id, content_hash);
CREATE INDEX IF NOT EXISTS records_user_source
  ON public.records (user_id, source_id);

DROP INDEX IF EXISTS records_fts_idx;
ALTER TABLE public.records DROP COLUMN IF EXISTS fts;
ALTER TABLE public.records
  ADD COLUMN fts tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', COALESCE(source_title, '')), 'A') ||
    setweight(to_tsvector('simple', content), 'B') ||
    setweight(to_tsvector('simple', COALESCE(current_note, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS records_fts_idx ON public.records USING GIN (fts);

ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_ingest_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sources' AND policyname = 'sources_owner_policy'
  ) THEN
    CREATE POLICY sources_owner_policy
      ON public.sources
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'record_note_versions' AND policyname = 'record_note_versions_owner_policy'
  ) THEN
    CREATE POLICY record_note_versions_owner_policy
      ON public.record_note_versions
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'record_ingest_events' AND policyname = 'record_ingest_events_owner_policy'
  ) THEN
    CREATE POLICY record_ingest_events_owner_policy
      ON public.record_ingest_events
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'sources_set_updated_at'
  ) THEN
    CREATE TRIGGER sources_set_updated_at
    BEFORE UPDATE ON public.sources
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;
