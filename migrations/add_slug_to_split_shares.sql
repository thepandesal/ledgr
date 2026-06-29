-- Add slug column to split_shares
ALTER TABLE split_shares ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE split_shares ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Unique constraint: one slug per user
CREATE UNIQUE INDEX IF NOT EXISTS split_shares_user_slug_idx ON split_shares (user_id, slug);
