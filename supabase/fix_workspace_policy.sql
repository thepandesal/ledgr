-- Fix: Allow users to insert workspaces where they are the owner
-- Run this in Supabase SQL Editor

-- Drop the existing "all" policy and create separate ones
drop policy if exists "Owner can manage workspace" on public.workspaces;

create policy "Owner can insert workspace" on public.workspaces for insert
  with check (auth.uid() = owner_id);

create policy "Owner can update workspace" on public.workspaces for update
  using (auth.uid() = owner_id);

create policy "Owner can delete workspace" on public.workspaces for delete
  using (auth.uid() = owner_id);
