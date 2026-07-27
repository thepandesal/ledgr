-- 1. Check all 5 RPCs exist
SELECT proname, proargnames::text, prolang::regproc, prosecdef
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('get_user_by_profile_code','get_user_display_name','send_friend_request','respond_to_friend_request','get_profile_codes')
ORDER BY proname;

-- 2. Check the friendship row that's being responded to (run this from Profile B's perspective)
SELECT id, requester_id, receiver_id, status, created_at
FROM friendships
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check notifications table for friend_request types
SELECT id, user_id, type, title, status, created_at
FROM notifications
WHERE type LIKE 'friend_request%'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Test the RPC manually (replace the UUID with an actual friendship_id from query 2)
-- SELECT respond_to_friend_request('REPLACE_WITH_UUID', false, 'TestUser', '00000000-0000-0000-0000-000000000000');
