CREATE TABLE records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('quote', 'note', 'link', 'ai')),
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  url TEXT,
  source_title TEXT,
  state TEXT NOT NULL DEFAULT 'INBOX' CHECK (state IN ('INBOX', 'ACTIVE', 'PINNED', 'ARCHIVED', 'TRASHED')),
  interval_days INTEGER NOT NULL DEFAULT 1,
  due_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX records_user_content_hash ON records (user_id, content_hash);
CREATE INDEX records_user_state ON records (user_id, state);
CREATE INDEX records_due ON records (user_id, due_at) WHERE state IN ('ACTIVE', 'PINNED');

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
  action TEXT NOT NULL CHECK (action IN ('reviewed', 'resurface'))
);

CREATE INDEX review_log_record ON review_log (record_id, reviewed_at DESC);

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

ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY records_owner_policy ON records USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY annotations_owner_policy ON annotations USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY review_log_owner_policy ON review_log USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY tags_owner_policy ON tags USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
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
