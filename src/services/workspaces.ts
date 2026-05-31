import { supabase } from '../lib/supabase';
import { Workspace } from '../types';

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: owned }, { data: memberships }] = await Promise.all([
    supabase.from('workspaces').select('*').eq('owner_id', user.id),
    supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).eq('status', 'approved'),
  ]);

  let memberSpaces: Workspace[] = [];
  if (memberships && memberships.length > 0) {
    const ids = memberships.map((m) => m.workspace_id);
    const { data } = await supabase.from('workspaces').select('*').in('id', ids);
    memberSpaces = (data || []) as Workspace[];
  }

  const all = [...(owned || []), ...memberSpaces] as Workspace[];
  return all.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);
}

export async function createWorkspace(name: string, currency: string): Promise<Workspace | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('workspaces')
    .insert({ name, owner_id: user.id, default_currency: currency })
    .select()
    .single();

  if (error || !data) return null;

  await supabase.from('workspace_members').insert({
    workspace_id: data.id,
    user_id: user.id,
    role: 'owner',
    status: 'approved',
  });

  await supabase.rpc('seed_default_categories', { p_user_id: user.id, p_workspace_id: data.id });

  return data as Workspace;
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  const { error } = await supabase.from('workspaces').delete().eq('id', id);
  return !error;
}
