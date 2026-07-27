-- Migration: add RPCs for profile code lookup and display name lookup
-- These are SECURITY DEFINER to bypass RLS on user_settings

CREATE OR REPLACE FUNCTION get_user_by_profile_code(code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT user_id FROM user_settings WHERE profile_code = code;
$$;

CREATE OR REPLACE FUNCTION get_user_display_name(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = user_id;
$$;

-- Friend request: insert friendship + notification (bypasses RLS on both tables)
CREATE OR REPLACE FUNCTION send_friend_request(p_requester_id uuid, p_receiver_id uuid, p_requester_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO friendships (requester_id, receiver_id, status)
    VALUES (p_requester_id, p_receiver_id, 'pending')
    ON CONFLICT (requester_id, receiver_id) DO UPDATE SET status = 'pending';
  INSERT INTO notifications (user_id, type, title, body, message, data, is_read, status)
    VALUES (p_receiver_id, 'friend_request', p_requester_name || ' sent you a friend request', 'tap to accept or decline', 'tap to accept or decline', jsonb_build_object('requesterId', p_requester_id), false, 'new');
END;
$$;

-- Respond to friend request: update friendship status + send notification (bypasses RLS)
CREATE OR REPLACE FUNCTION respond_to_friend_request(p_friendship_id uuid, p_accepted boolean, p_responder_name text, p_responder_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  requester_id uuid;
BEGIN
  UPDATE friendships f SET status = CASE WHEN p_accepted THEN 'accepted' ELSE 'declined' END WHERE f.id = p_friendship_id RETURNING f.requester_id INTO requester_id;
  IF p_accepted THEN
    INSERT INTO notifications (user_id, type, title, body, message, data, is_read, status)
      VALUES (requester_id, 'friend_request_accepted', p_responder_name || ' accepted your friend request', 'you are now friends on Ledgr', 'you are now friends on Ledgr', jsonb_build_object('friendId', p_responder_id), false, 'new');
  END IF;
END;
$$;

-- Get profile codes for a list of user IDs (bypasses RLS)
CREATE OR REPLACE FUNCTION get_profile_codes(user_ids uuid[])
RETURNS TABLE(user_id uuid, profile_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT user_id, profile_code FROM user_settings WHERE user_id = ANY(user_ids);
$$;

-- Share recording with a user: append to shared_with + send notification (bypasses RLS)
CREATE OR REPLACE FUNCTION share_recording(p_recording_id uuid, p_shared_with_user_id uuid, p_owner_name text, p_recording_name text, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  shared jsonb;
BEGIN
  SELECT shared_with INTO shared FROM recordings WHERE id = p_recording_id;
  IF NOT shared @> to_jsonb(ARRAY[p_shared_with_user_id]) THEN
    UPDATE recordings SET shared_with = shared || to_jsonb(p_shared_with_user_id) WHERE id = p_recording_id;
  END IF;
  INSERT INTO notifications (user_id, type, title, body, message, data, is_read, status)
    VALUES (p_shared_with_user_id, 'expense_tag', p_owner_name || ' shared an expense with you', p_recording_name || ' — PHP ' || p_amount::text, p_recording_name || ' — PHP ' || p_amount::text, jsonb_build_object('recordingId', p_recording_id, 'recordingName', p_recording_name, 'amount', p_amount), false, 'new');
END;
$$;

-- Auto-tag a friend: share + create debt recording + notify (no accept/decline)
CREATE OR REPLACE FUNCTION tag_friend_auto(
  p_recording_id uuid,
  p_owner_id uuid,
  p_owner_name text,
  p_friend_user_id uuid,
  p_recording_name text,
  p_amount numeric,
  p_currency text DEFAULT 'PHP',
  p_transaction_date text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_debt_id uuid;
  shared jsonb;
BEGIN
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
    COALESCE(p_transaction_date, CURRENT_DATE::text),
    'unpaid',
    true,
    p_owner_id,
    p_recording_id,
    p_category_id,
    p_owner_name,
    false
  ) RETURNING id INTO v_debt_id;

  -- 4. Send informational notification
  INSERT INTO notifications (user_id, type, title, body, message, data, is_read, status)
  VALUES (
    p_friend_user_id,
    'expense_tag',
    p_owner_name || ' tagged you in an expense',
    p_recording_name || ' — PHP ' || p_amount::text,
    p_recording_name || ' — PHP ' || p_amount::text,
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

-- Untag a friend: remove from shared_with + delete debt recording + send notification
CREATE OR REPLACE FUNCTION untag_friend(
  p_recording_id uuid,
  p_friend_user_id uuid,
  p_recording_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  shared jsonb;
BEGIN
  -- 1. Remove friend from shared_with
  SELECT shared_with INTO shared FROM recordings WHERE id = p_recording_id;
  IF shared @> to_jsonb(ARRAY[p_friend_user_id]) THEN
    UPDATE recordings SET shared_with = shared - p_friend_user_id WHERE id = p_recording_id;
  END IF;

  -- 2. Delete friend's debt recording linked to this source
  DELETE FROM recordings
  WHERE source_recording_id = p_recording_id
    AND user_id = p_friend_user_id
    AND is_tagged = true;

  -- 3. Mark pending expense_tag notifications as opened
  UPDATE notifications
  SET status = 'opened'
  WHERE type = 'expense_tag'
    AND (data->>'sourceRecordingId')::uuid = p_recording_id
    AND user_id = p_friend_user_id
    AND status IN ('new', 'saw');

  -- 4. Notify the friend
  INSERT INTO notifications (user_id, type, title, body, message, data, is_read, status)
  VALUES (
    p_friend_user_id,
    'tag_declined',
    'expense tag was cancelled',
    '"' || p_recording_name || '" — the tag was removed by the sender.',
    '"' || p_recording_name || '" — the tag was removed by the sender.',
    jsonb_build_object('sourceRecordingId', p_recording_id),
    false,
    'new'
  );
END;
$$;
