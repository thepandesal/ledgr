-- Add status to split_bills: 'ongoing' (default) or 'closed'
ALTER TABLE split_bills ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ongoing';
