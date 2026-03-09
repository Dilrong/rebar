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
  p_update_current_note BOOLEAN,
  p_current_note TEXT,
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

  IF p_update_current_note AND v_record.current_note IS DISTINCT FROM p_current_note THEN
    IF v_record.current_note IS NOT NULL THEN
      INSERT INTO public.record_note_versions (record_id, user_id, body, import_channel)
      VALUES (p_record_id, p_user_id, v_record.current_note, NULL);
    END IF;
  END IF;

  UPDATE public.records
  SET state = CASE WHEN p_update_state THEN p_state ELSE state END,
      url = CASE WHEN p_update_url THEN p_url ELSE url END,
      source_title = CASE WHEN p_update_source_title THEN p_source_title ELSE source_title END,
      current_note = CASE WHEN p_update_current_note THEN p_current_note ELSE current_note END,
      note_updated_at = CASE
        WHEN p_update_current_note AND v_record.current_note IS DISTINCT FROM p_current_note
          THEN CASE WHEN p_current_note IS NULL THEN NULL ELSE now() END
        ELSE note_updated_at
      END
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
