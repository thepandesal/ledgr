-- Migration: update tag_friend_auto RPC to accept p_type param and use dynamic currency
-- This fixes the notification to:
--   - Use the actual currency instead of hardcoded 'PHP'
--   - Use type-appropriate labels ("expense" vs "dues") in the notification title
--   - Never send a "tag was cancelled" message when just tagging

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
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_debt_id uuid;
  shared jsonb;
  v_label text;
  v_currency_display text;
BEGIN
  -- Friendly label for the recording type
  v_label := CASE p_type
    WHEN 'due' THEN 'dues'
    ELSE 'expense'
  END;
  v_currency_display := COALESCE(NULLIF(p_currency, ''), 'PHP');

  -- 1. Add friend to shared_with
  SELECT shared_with INTO shared FROM recordings WHERE id = p_recording_id;
  IF NOT shared @> to_jsonb(ARRAY[p_friend_user_id]) THEN
    UPDATE recordings SET shared_with = shared || to_jsonb(p_friend_user_id) WHERE id = p_recording_id;
  END IF;

  -- 2. Remove any existing debt recording from this friend for this source (re-tag)
  DELETE FROM recordings
  WHERE source_recording_id = p_recording_id
    AND user_id = p_friend_user_id
    AND is_tagged = true;

  -- 3. Create debt recording for the friend
  INSERT INTO recordings (
    user_id, name, type, amount, currency, transaction_date,
    status, is_tagged, tagged_by_user_id, source_recording_id,
    category_id, person_name, is_due
  ) VALUES (
    p_friend_user_id,
    p_recording_name,
    'debt',
    p_amount,
    p_currency,
    COALESCE(p_transaction_date::date, CURRENT_DATE),
    'unpaid',
    true,
    p_owner_id,
    p_recording_id,
    p_category_id,
    p_owner_name,
    false
  ) RETURNING id INTO v_debt_id;

  -- 4. Send notification — correct title, never "cancelled"
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

  RETURN v_debt_id;
END;
$$;
