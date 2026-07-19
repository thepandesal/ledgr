-- RPC to reset sort_order back to created_at order for a user's spaces
CREATE OR REPLACE FUNCTION reset_space_sort_order(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE spaces
  SET sort_order = sub.rn
  FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
    FROM spaces
    WHERE user_id = p_user_id
  ) sub
  WHERE spaces.id = sub.id
    AND spaces.user_id = p_user_id;
END;
$$;
