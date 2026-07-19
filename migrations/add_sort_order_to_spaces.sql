-- Add sort_order to spaces for drag-to-reorder
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS sort_order integer;

-- Initialize sort_order based on created_at for existing rows
UPDATE spaces
SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM spaces
) sub
WHERE spaces.id = sub.id;
