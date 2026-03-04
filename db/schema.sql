CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('quote', 'note', 'link', 'ai')),
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  url TEXT,
  source_title TEXT,
  state TEXT NOT NULL DEFAULT 'INBOX' CHECK (state IN ('INBOX', 'ACTIVE', 'PINNED', 'ARCHIVED', 'TRASHED')),
  interval_days INTEGER NOT NULL DEFAULT 1 CHECK (interval_days > 0),
  due_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX records_user_content_hash ON records (user_id, content_hash);
CREATE INDEX records_user_state ON records (user_id, state);
CREATE INDEX records_due ON records (user_id, due_at) WHERE state IN ('ACTIVE', 'PINNED');
CREATE INDEX records_user_created_at ON records (user_id, created_at DESC);
ALTER TABLE records ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(source_title, '')), 'A') ||
    setweight(to_tsvector('simple', content), 'B')
  ) STORED;
CREATE INDEX records_fts_idx ON records USING GIN (fts);

CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('highlight', 'comment', 'correction')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY records_owner_policy ON records USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY annotations_owner_policy ON annotations USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY review_log_owner_policy ON review_log USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY tags_owner_policy ON tags USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY ingest_jobs_owner_policy ON ingest_jobs USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
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

CREATE TRIGGER ingest_jobs_set_updated_at
BEFORE UPDATE ON ingest_jobs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
