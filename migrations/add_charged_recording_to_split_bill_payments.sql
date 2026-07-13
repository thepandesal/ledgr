alter table split_bill_payments
  add column if not exists charged_recording_id uuid references recordings(id) on delete set null;
