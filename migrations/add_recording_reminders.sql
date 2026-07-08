-- Step 1: Create recording_reminders table
create table if not exists recording_reminders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  workspace_id    uuid references spaces(id) on delete set null,
  name            text not null,
  category_id     uuid references categories(id) on delete set null,
  account_id      uuid references accounts(id) on delete set null,
  frequency       text not null check (frequency in ('daily','weekly','monthly','interval')),
  day_of_week     int,        -- 0=Sun … 6=Sat, used when frequency='weekly'
  day_of_month    int,        -- 1–31, used when frequency='monthly'
  interval_days   int,        -- used when frequency='interval'
  start_date      date not null,
  end_date        date,
  status          text not null default 'active' check (status in ('active','paused','completed')),
  created_at      timestamptz not null default now()
);

-- Step 2: Add reminder_id FK to recordings
alter table recordings
  add column if not exists reminder_id uuid references recording_reminders(id) on delete set null;

-- Indexes
create index if not exists idx_recording_reminders_user_id on recording_reminders(user_id);
create index if not exists idx_recording_reminders_workspace_id on recording_reminders(workspace_id);
create index if not exists idx_recordings_reminder_id on recordings(reminder_id);
