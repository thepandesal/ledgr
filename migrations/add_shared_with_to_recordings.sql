ALTER TABLE recordings ADD COLUMN IF NOT EXISTS shared_with jsonb DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_recordings_shared_with ON recordings USING gin (shared_with);
