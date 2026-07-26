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
CREATE OR REPLACE FUNCTION send_friend_request(requester_id uuid, receiver_id uuid, requester_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO friendships (requester_id, receiver_id, status)
    VALUES (requester_id, receiver_id, 'pending')
    ON CONFLICT (requester_id, receiver_id) DO UPDATE SET status = 'pending', updated_at = now();
  INSERT INTO notifications (user_id, type, title, body, message, data, is_read, status)
    VALUES (receiver_id, 'friend_request', requester_name || ' sent you a friend request', 'tap to accept or decline', 'tap to accept or decline', jsonb_build_object('requesterId', requester_id), false, 'new');
END;
$$;

-- Respond to friend request: update friendship status + send notification (bypasses RLS)
CREATE OR REPLACE FUNCTION respond_to_friend_request(friendship_id uuid, accepted boolean, responder_name text, responder_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  requester_id uuid;
BEGIN
  UPDATE friendships f SET status = CASE WHEN accepted THEN 'accepted' ELSE 'declined' END WHERE f.id = friendship_id RETURNING f.requester_id INTO requester_id;
  IF accepted THEN
    INSERT INTO notifications (user_id, type, title, body, message, data, is_read, status)
      VALUES (requester_id, 'friend_request_accepted', responder_name || ' accepted your friend request', 'you are now friends on Ledgr', 'you are now friends on Ledgr', jsonb_build_object('friendId', responder_id), false, 'new');
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
