-- Migration: single-entry tagging — no more mirror debt recording
-- The tagged recording itself is the single source of truth.
-- The friend sees it via shared_with + tagged_friend_user_id.

CREATE OR REPLACE FUNCTION tag_friend_auto(
  p_recording_id uuid,
  p_owner_id uuid,
  p_owner_name text,
  p_friend_user_id uuid,
  p_recording_name text,
  p_amount numeric,
  p_currency text DEFAULT 'PHP',
  p_transaction_date text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_type text DEFAULT 'expense'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  shared jsonb;
  v_label text;
  v_currency_display text;
BEGIN
  v_label := CASE p_type
    WHEN 'due' THEN 'dues'
    ELSE 'expense'
  END;
  v_currency_display := COALESCE(NULLIF(p_currency, ''), 'PHP');

  -- 1. Add friend to shared_with so they can see the recording
  SELECT shared_with INTO shared FROM recordings WHERE id = p_recording_id;
  IF NOT shared @> to_jsonb(ARRAY[p_friend_user_id]) THEN
    UPDATE recordings SET shared_with = shared || to_jsonb(p_friend_user_id) WHERE id = p_recording_id;
  END IF;

  -- 2. Clean up any old mirror debt recordings for this source (backward compat)
  DELETE FROM recordings
  WHERE source_recording_id = p_recording_id
    AND user_id = p_friend_user_id
    AND is_tagged = true;

  -- 3. Send notification
  INSERT INTO notifications (user_id, type, title, body, message, data, is_read, status)
  VALUES (
    p_friend_user_id,
    'expense_tag',
    p_owner_name || ' tagged you in an ' || v_label,
    p_recording_name || ' — ' || v_currency_display || ' ' || p_amount::text,
    p_recording_name || ' — ' || v_currency_display || ' ' || p_amount::text,
    jsonb_build_object(
      'recordingId', p_recording_id,
      'sourceRecordingId', p_recording_id,
      'recordingName', p_recording_name,
      'amount', p_amount,
      'taggerName', p_owner_name,
      'taggerUserId', p_owner_id
    ),
    false,
    'new'
  );
END;
$$;
