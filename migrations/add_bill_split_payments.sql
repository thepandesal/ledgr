-- Allow bill_splits (new schema) to be closed and track payments
ALTER TABLE bill_splits ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ongoing';

-- Allow split_bill_payments to reference bill_splits (new schema) instead of split_bills
ALTER TABLE split_bill_payments ADD COLUMN IF NOT EXISTS bill_split_id uuid REFERENCES bill_splits(id) ON DELETE CASCADE;
