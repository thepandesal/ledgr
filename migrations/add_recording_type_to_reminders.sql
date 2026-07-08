alter table recording_reminders
  add column if not exists recording_type text not null default 'expense'
  check (recording_type in ('expense','income','debt','due'));
