CREATE TABLE sources (
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

CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source_id UUID REFERENCES sources ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('quote', 'note', 'link', 'ai')),
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  url TEXT,
  source_title TEXT,
  favicon_url TEXT,
  current_note TEXT,
  note_updated_at TIMESTAMPTZ,
  adopted_from_ai BOOLEAN NOT NULL DEFAULT FALSE,
  state TEXT NOT NULL DEFAULT 'INBOX' CHECK (state IN ('INBOX', 'ACTIVE', 'PINNED', 'ARCHIVED', 'TRASHED')),
  interval_days INTEGER NOT NULL DEFAULT 1 CHECK (interval_days > 0),
  due_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX records_user_source_content_hash ON records (user_id, source_id, content_hash);
CREATE INDEX records_user_state ON records (user_id, state);
CREATE INDEX records_due ON records (user_id, due_at) WHERE state IN ('ACTIVE', 'PINNED');
CREATE INDEX records_user_created_at ON records (user_id, created_at DESC);
CREATE INDEX records_user_source ON records (user_id, source_id);
ALTER TABLE records ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(source_title, '')), 'A') ||
    setweight(to_tsvector('simple', content), 'B') ||
    setweight(to_tsvector('simple', coalesce(current_note, '')), 'C')
  ) STORED;
CREATE INDEX records_fts_idx ON records USING GIN (fts);

CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('highlight', 'comment', 'correction')),
  body TEXT NOT NULL,
  anchor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE record_note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  body TEXT NOT NULL,
  import_channel TEXT CHECK (import_channel IN ('manual', 'csv', 'json', 'api', 'share', 'extension', 'url', 'ocr')),
  replaced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX record_note_versions_record_replaced_at ON record_note_versions (record_id, replaced_at DESC);

CREATE TABLE record_ingest_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES sources ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  import_channel TEXT NOT NULL CHECK (import_channel IN ('manual', 'csv', 'json', 'api', 'share', 'extension', 'url', 'ocr')),
  source_snapshot JSONB NOT NULL,
  note_snapshot TEXT,
  external_item_id TEXT,
  external_anchor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX record_ingest_events_record_created_at ON record_ingest_events (record_id, created_at DESC);
CREATE INDEX record_ingest_events_user_channel_created_at ON record_ingest_events (user_id, import_channel, created_at DESC);

CREATE TABLE review_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL CHECK (action IN ('reviewed', 'resurface', 'undo')),
  decision_type TEXT CHECK (decision_type IN ('ARCHIVE', 'ACT', 'DEFER')),
  action_type TEXT CHECK (action_type IN ('EXPERIMENT', 'SHARE', 'TODO')),
  defer_reason TEXT CHECK (defer_reason IN ('NEED_INFO', 'LOW_CONFIDENCE', 'NO_TIME')),
  prev_state TEXT,
  prev_interval_days INTEGER,
  prev_due_at TIMESTAMPTZ,
  prev_review_count INTEGER,
  prev_last_reviewed_at TIMESTAMPTZ
);

CREATE INDEX review_log_record ON review_log (record_id, reviewed_at DESC);
CREATE INDEX review_log_user_reviewed_at ON review_log (user_id, reviewed_at DESC);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (user_id, name)
);

CREATE UNIQUE INDEX tags_user_id_lower_name_unique ON tags (user_id, lower(name));

CREATE TABLE record_tags (
  record_id UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags ON DELETE CASCADE,
  PRIMARY KEY (record_id, tag_id)
);

CREATE INDEX record_tags_tag_record ON record_tags (tag_id, record_id);

CREATE TABLE ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DONE', 'FAILED')),
  payload JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ingest_jobs_user_status_created ON ingest_jobs (user_id, status, created_at DESC);

CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  start_page TEXT NOT NULL DEFAULT '/library' CHECK (start_page IN ('/review', '/capture', '/library', '/search')),
  font_family TEXT NOT NULL DEFAULT 'sans' CHECK (font_family IN ('sans', 'mono')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_note_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_ingest_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY sources_owner_policy ON sources USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY records_owner_policy ON records USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY annotations_owner_policy ON annotations USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY record_note_versions_owner_policy ON record_note_versions USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY record_ingest_events_owner_policy ON record_ingest_events USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY review_log_owner_policy ON review_log USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY tags_owner_policy ON tags USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY ingest_jobs_owner_policy ON ingest_jobs USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY user_preferences_owner_policy ON user_preferences USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY record_tags_owner_policy ON record_tags
USING (
  EXISTS (
    SELECT 1
    FROM records r
    WHERE r.id = record_tags.record_id
      AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM records r
    WHERE r.id = record_tags.record_id
      AND r.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER records_set_updated_at
BEFORE UPDATE ON records
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER sources_set_updated_at
BEFORE UPDATE ON sources
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER ingest_jobs_set_updated_at
BEFORE UPDATE ON ingest_jobs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER user_preferences_set_updated_at
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION public.create_record_with_tags(
  p_user_id UUID,
  p_kind TEXT,
  p_content TEXT,
  p_content_hash TEXT,
  p_url TEXT,
  p_source_title TEXT,
  p_tag_ids UUID[]
)
RETURNS public.records
LANGUAGE plpgsql
AS $$
DECLARE
  v_record public.records;
  v_requested_tag_ids UUID[] := '{}'::UUID[];
  v_owned_tag_ids UUID[] := '{}'::UUID[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT tag_id), '{}'::UUID[])
  INTO v_requested_tag_ids
  FROM unnest(COALESCE(p_tag_ids, '{}'::UUID[])) AS tag_id;

  IF cardinality(v_requested_tag_ids) > 0 THEN
    SELECT COALESCE(array_agg(t.id), '{}'::UUID[])
    INTO v_owned_tag_ids
    FROM public.tags t
    WHERE t.user_id = p_user_id
      AND t.id = ANY(v_requested_tag_ids);

    IF cardinality(v_owned_tag_ids) <> cardinality(v_requested_tag_ids) THEN
      RAISE EXCEPTION 'Invalid tag_ids' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.records (
    user_id,
    kind,
    content,
    content_hash,
    url,
    source_title,
    state,
    interval_days,
    due_at,
    last_reviewed_at,
    review_count
  )
  VALUES (
    p_user_id,
    p_kind,
    p_content,
    p_content_hash,
    p_url,
    p_source_title,
    'INBOX',
    1,
    NULL,
    NULL,
    0
  )
  RETURNING * INTO v_record;

  IF cardinality(v_owned_tag_ids) > 0 THEN
    INSERT INTO public.record_tags (record_id, tag_id)
    SELECT v_record.id, tag_id
    FROM unnest(v_owned_tag_ids) AS tag_id
    ON CONFLICT (record_id, tag_id) DO NOTHING;
  END IF;

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_record_with_tags(
  p_user_id UUID,
  p_content_hash TEXT,
  p_url TEXT,
  p_source_title TEXT,
  p_tag_ids UUID[]
)
RETURNS public.records
LANGUAGE plpgsql
AS $$
DECLARE
  v_record public.records;
  v_requested_tag_ids UUID[] := '{}'::UUID[];
  v_owned_tag_ids UUID[] := '{}'::UUID[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT tag_id), '{}'::UUID[])
  INTO v_requested_tag_ids
  FROM unnest(COALESCE(p_tag_ids, '{}'::UUID[])) AS tag_id;

  IF cardinality(v_requested_tag_ids) > 0 THEN
    SELECT COALESCE(array_agg(t.id), '{}'::UUID[])
    INTO v_owned_tag_ids
    FROM public.tags t
    WHERE t.user_id = p_user_id
      AND t.id = ANY(v_requested_tag_ids);

    IF cardinality(v_owned_tag_ids) <> cardinality(v_requested_tag_ids) THEN
      RAISE EXCEPTION 'Invalid tag_ids' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT *
  INTO v_record
  FROM public.records
  WHERE user_id = p_user_id
    AND content_hash = p_content_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Record not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.records
  SET url = COALESCE(p_url, url),
      source_title = COALESCE(p_source_title, source_title)
  WHERE id = v_record.id
  RETURNING * INTO v_record;

  IF cardinality(v_owned_tag_ids) > 0 THEN
    INSERT INTO public.record_tags (record_id, tag_id)
    SELECT v_record.id, tag_id
    FROM unnest(v_owned_tag_ids) AS tag_id
    ON CONFLICT (record_id, tag_id) DO NOTHING;
  END IF;

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_record_with_tags(
  p_user_id UUID,
  p_record_id UUID,
  p_update_state BOOLEAN,
  p_state TEXT,
  p_update_url BOOLEAN,
  p_url TEXT,
  p_update_source_title BOOLEAN,
  p_source_title TEXT,
  p_update_tags BOOLEAN,
  p_tag_ids UUID[]
)
RETURNS public.records
LANGUAGE plpgsql
AS $$
DECLARE
  v_record public.records;
  v_requested_tag_ids UUID[] := '{}'::UUID[];
  v_owned_tag_ids UUID[] := '{}'::UUID[];
BEGIN
  SELECT *
  INTO v_record
  FROM public.records
  WHERE id = p_record_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Record not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_update_tags THEN
    SELECT COALESCE(array_agg(DISTINCT tag_id), '{}'::UUID[])
    INTO v_requested_tag_ids
    FROM unnest(COALESCE(p_tag_ids, '{}'::UUID[])) AS tag_id;

    IF cardinality(v_requested_tag_ids) > 0 THEN
      SELECT COALESCE(array_agg(t.id), '{}'::UUID[])
      INTO v_owned_tag_ids
      FROM public.tags t
      WHERE t.user_id = p_user_id
        AND t.id = ANY(v_requested_tag_ids);

      IF cardinality(v_owned_tag_ids) <> cardinality(v_requested_tag_ids) THEN
        RAISE EXCEPTION 'Invalid tag_ids' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  UPDATE public.records
  SET state = CASE WHEN p_update_state THEN p_state ELSE state END,
      url = CASE WHEN p_update_url THEN p_url ELSE url END,
      source_title = CASE WHEN p_update_source_title THEN p_source_title ELSE source_title END
  WHERE id = p_record_id
  RETURNING * INTO v_record;

  IF p_update_tags THEN
    IF cardinality(v_requested_tag_ids) = 0 THEN
      DELETE FROM public.record_tags
      WHERE record_id = p_record_id;
    ELSE
      DELETE FROM public.record_tags
      WHERE record_id = p_record_id
        AND NOT (tag_id = ANY(v_owned_tag_ids));

      INSERT INTO public.record_tags (record_id, tag_id)
      SELECT p_record_id, tag_id
      FROM unnest(v_owned_tag_ids) AS tag_id
      ON CONFLICT (record_id, tag_id) DO NOTHING;
    END IF;
  END IF;

  RETURN v_record;
END;
$$;
