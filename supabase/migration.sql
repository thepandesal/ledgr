-- Ledgr Database Schema
-- Run this in Supabase SQL Editor

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Contacts
create table public.contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);

alter table public.contacts enable row level security;
create policy "Users manage own contacts" on public.contacts for all using (auth.uid() = user_id);

-- Workspaces
create table public.workspaces (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  default_currency text default 'PHP',
  owner_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

alter table public.workspaces enable row level security;

-- Workspace Members
create table public.workspace_members (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('owner', 'editor', 'viewer')) default 'viewer',
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  invited_at timestamptz default now(),
  unique(workspace_id, user_id)
);

alter table public.workspace_members enable row level security;
create policy "Members can view workspace members" on public.workspace_members for select
  using (auth.uid() in (select user_id from public.workspace_members wm where wm.workspace_id = workspace_id and wm.status = 'approved'));
create policy "Owner can manage members" on public.workspace_members for all
  using (auth.uid() in (select owner_id from public.workspaces w where w.id = workspace_id));
create policy "Users can see own membership" on public.workspace_members for select using (auth.uid() = user_id);

-- Workspace access policy
create policy "Members can view workspace" on public.workspaces for select
  using (auth.uid() = owner_id or auth.uid() in (select user_id from public.workspace_members wm where wm.workspace_id = id and wm.status = 'approved'));
create policy "Owner can manage workspace" on public.workspaces for all using (auth.uid() = owner_id);

-- Accounts (global to user)
create table public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('bank', 'credit_card', 'atm', 'savings')) not null,
  name text not null,
  bank_name text not null,
  qr_images text[] default '{}',
  due_date int, -- day of month (credit card)
  payment_due numeric(12,2), -- credit card
  balance numeric(12,2), -- ATM
  savings_type text check (savings_type in ('solo', 'shared')),
  goal_amount numeric(12,2),
  goal_start date,
  goal_end date,
  created_at timestamptz default now()
);

alter table public.accounts enable row level security;
create policy "Users manage own accounts" on public.accounts for all using (auth.uid() = user_id);

-- Account-Workspace visibility
create table public.account_workspaces (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  unique(account_id, workspace_id)
);

alter table public.account_workspaces enable row level security;
create policy "Users manage own account workspaces" on public.account_workspaces for all
  using (auth.uid() in (select user_id from public.accounts a where a.id = account_id));

-- Shareholders (for shared savings)
create table public.shareholders (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  contribution numeric(12,2) default 0
);

alter table public.shareholders enable row level security;
create policy "Account owner manages shareholders" on public.shareholders for all
  using (auth.uid() in (select user_id from public.accounts a where a.id = account_id));

-- Categories
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  is_default boolean default false
);

alter table public.categories enable row level security;
create policy "Users manage own categories" on public.categories for all using (auth.uid() = user_id);

-- Receipts
create table public.receipts (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  image_url text not null,
  pinned boolean default false,
  recording_id uuid, -- linked later
  uploaded_at timestamptz default now()
);

alter table public.receipts enable row level security;
create policy "Users manage own receipts" on public.receipts for all using (auth.uid() = user_id);

-- Recordings
create table public.recordings (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  type text check (type in ('purchase', 'savings', 'income', 'payment', 'custom')) not null,
  category text,
  amount numeric(12,2) not null,
  currency text default 'PHP',
  date date default current_date,
  account_id uuid references public.accounts(id) on delete set null,
  receipt_id uuid references public.receipts(id) on delete set null,
  split_id uuid, -- linked after split creation
  is_recurring boolean default false,
  recurring_frequency text check (recurring_frequency in ('weekly', 'monthly', 'yearly')),
  created_at timestamptz default now()
);

alter table public.recordings enable row level security;
create policy "Workspace members can view recordings" on public.recordings for select
  using (auth.uid() in (select user_id from public.workspace_members wm where wm.workspace_id = workspace_id and wm.status = 'approved')
    or auth.uid() = user_id);
create policy "Users manage own recordings" on public.recordings for all using (auth.uid() = user_id);

-- Splits
create table public.splits (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  recording_id uuid references public.recordings(id) on delete set null,
  name text not null,
  total_amount numeric(12,2) not null,
  currency text default 'PHP',
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

alter table public.splits enable row level security;
create policy "Workspace members can view splits" on public.splits for select
  using (auth.uid() in (select user_id from public.workspace_members wm where wm.workspace_id = workspace_id and wm.status = 'approved')
    or auth.uid() = created_by);
create policy "Creator manages splits" on public.splits for all using (auth.uid() = created_by);

-- Split Participants
create table public.split_participants (
  id uuid default gen_random_uuid() primary key,
  split_id uuid references public.splits(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  amount numeric(12,2) not null,
  status text check (status in ('pending', 'paid', 'confirmed')) default 'pending',
  proof_image text,
  confirmed_at timestamptz
);

alter table public.split_participants enable row level security;
create policy "Split creator manages participants" on public.split_participants for all
  using (auth.uid() in (select created_by from public.splits s where s.id = split_id));
create policy "Participants can view own" on public.split_participants for select
  using (auth.uid() = user_id);
create policy "Participants can update own" on public.split_participants for update
  using (auth.uid() = user_id);

-- Payment Requests
create table public.payment_requests (
  id uuid default gen_random_uuid() primary key,
  split_id uuid references public.splits(id) on delete cascade not null,
  account_ids uuid[] not null, -- 1-3 accounts
  image_url text,
  created_at timestamptz default now()
);

alter table public.payment_requests enable row level security;
create policy "Split creator manages payment requests" on public.payment_requests for all
  using (auth.uid() in (select created_by from public.splits s where s.id = split_id));

-- Workspace Invites (for QR)
create table public.workspace_invites (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  role text check (role in ('editor', 'viewer')) default 'viewer',
  created_by uuid references public.profiles(id) on delete cascade not null,
  code text unique not null,
  expires_at timestamptz,
  created_at timestamptz default now()
);

alter table public.workspace_invites enable row level security;
create policy "Anyone can read invites by code" on public.workspace_invites for select using (true);
create policy "Creator manages invites" on public.workspace_invites for all using (auth.uid() = created_by);

-- Insert default categories function
create or replace function public.seed_default_categories(p_user_id uuid, p_workspace_id uuid)
returns void as $$
begin
  insert into public.categories (user_id, workspace_id, name, is_default) values
    (p_user_id, p_workspace_id, 'Food', true),
    (p_user_id, p_workspace_id, 'Transport', true),
    (p_user_id, p_workspace_id, 'Utilities', true),
    (p_user_id, p_workspace_id, 'Rent', true),
    (p_user_id, p_workspace_id, 'Entertainment', true),
    (p_user_id, p_workspace_id, 'Health', true),
    (p_user_id, p_workspace_id, 'Shopping', true),
    (p_user_id, p_workspace_id, 'Subscriptions', true),
    (p_user_id, p_workspace_id, 'Fitness', true),
    (p_user_id, p_workspace_id, 'Others', true);
end;
$$ language plpgsql security definer;

-- Storage buckets (run separately or via Supabase dashboard)
-- Create buckets: 'receipts', 'qr-images', 'payment-requests', 'proof-images'
