ALTER TABLE recordings ADD COLUMN IF NOT EXISTS receipt_entry_id uuid REFERENCES receipt_entries(id) ON DELETE SET NULL;
