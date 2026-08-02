-- Add wallet_type to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS wallet_type TEXT DEFAULT 'bank' CHECK (wallet_type IN ('bank', 'credit_card', 'cash', 'e_wallet'));

-- Create banks table for reusable bank definitions
CREATE TABLE IF NOT EXISTS banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#373737',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banks: user owns" ON banks FOR ALL USING (auth.uid() = user_id);

-- Seed default banks per user (optional — users can add their own)
