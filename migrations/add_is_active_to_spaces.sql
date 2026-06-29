-- Migration: add is_active to spaces
-- All existing spaces default to active

ALTER TABLE spaces ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
UPDATE spaces SET is_active = true WHERE is_active IS NULL;
