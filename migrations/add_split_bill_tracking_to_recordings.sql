-- Allow recordings to be linked back to the split bill that created them.
-- Used to de-duplicate manual return prompts (fix 1) and to reverse
-- return recordings when a split_bill_payment row is deleted (fix 2).

ALTER TABLE recordings ADD COLUMN IF NOT EXISTS split_bill_id uuid REFERENCES split_bills(id) ON DELETE SET NULL;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS split_bill_payment_id uuid REFERENCES split_bill_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recordings_split_bill_id_idx         ON recordings (split_bill_id);
CREATE INDEX IF NOT EXISTS recordings_split_bill_payment_id_idx ON recordings (split_bill_payment_id);
