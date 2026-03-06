BEGIN;

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  start_page TEXT NOT NULL DEFAULT '/library' CHECK (start_page IN ('/review', '/capture', '/library', '/search')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_owner_policy ON public.user_preferences;

CREATE POLICY user_preferences_owner_policy ON public.user_preferences
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'user_preferences_set_updated_at'
      AND tgrelid = 'public.user_preferences'::regclass
  ) THEN
    CREATE TRIGGER user_preferences_set_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

WITH duplicate_groups AS (
  SELECT
    user_id,
    lower(name) AS lowered_name,
    min(id) AS keep_id,
    array_agg(id) AS all_ids
  FROM public.tags
  GROUP BY user_id, lower(name)
  HAVING count(*) > 1
), duplicate_map AS (
  SELECT
    keep_id,
    unnest(all_ids) AS duplicate_id
  FROM duplicate_groups
)
INSERT INTO public.record_tags (record_id, tag_id)
SELECT rt.record_id, dm.keep_id
FROM public.record_tags rt
JOIN duplicate_map dm
  ON dm.duplicate_id = rt.tag_id
WHERE dm.duplicate_id <> dm.keep_id
ON CONFLICT (record_id, tag_id) DO NOTHING;

WITH duplicate_groups AS (
  SELECT
    user_id,
    lower(name) AS lowered_name,
    min(id) AS keep_id,
    array_agg(id) AS all_ids
  FROM public.tags
  GROUP BY user_id, lower(name)
  HAVING count(*) > 1
), duplicate_map AS (
  SELECT
    keep_id,
    unnest(all_ids) AS duplicate_id
  FROM duplicate_groups
)
DELETE FROM public.record_tags rt
USING duplicate_map dm
WHERE rt.tag_id = dm.duplicate_id
  AND dm.duplicate_id <> dm.keep_id;

WITH duplicate_groups AS (
  SELECT
    user_id,
    lower(name) AS lowered_name,
    min(id) AS keep_id,
    array_agg(id) AS all_ids
  FROM public.tags
  GROUP BY user_id, lower(name)
  HAVING count(*) > 1
), duplicate_map AS (
  SELECT
    keep_id,
    unnest(all_ids) AS duplicate_id
  FROM duplicate_groups
)
DELETE FROM public.tags t
USING duplicate_map dm
WHERE t.id = dm.duplicate_id
  AND dm.duplicate_id <> dm.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS tags_user_id_lower_name_unique
  ON public.tags (user_id, lower(name));

COMMIT;
