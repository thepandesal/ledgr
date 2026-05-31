import { getSupabaseClient } from './auth';

// ─── Workspaces ───────────────────────────────────────────────────────────────

export const fetchWorkspaces = async (userId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, workspaces(id, name, default_currency, created_at)')
    .eq('user_id', userId)
    .eq('status', 'approved');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ 
    id: row.workspaces.id,
    name: row.workspaces.name,
    currency: row.workspaces.default_currency,
    role: row.role.charAt(0).toUpperCase() + row.role.slice(1)
  }));
};

export const createWorkspace = async (userId: string, name: string, currency: string) => {
  const supabase = getSupabaseClient();
  
  // First ensure profile exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();
  
  if (profileError || !profile) {
    // Create profile if it doesn't exist
    await supabase.from('profiles').insert({ id: userId }).select().single();
  }
  
  // Now create workspace
  const { data: ws, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name, default_currency: currency, owner_id: userId })
    .select()
    .single();
  
  if (wsError) throw wsError;
  
  // Add user as owner member
  const { error: memError } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: ws.id, user_id: userId, role: 'owner', status: 'approved' });
  
  if (memError) throw memError;
  return ws;
};

export const updateWorkspace = async (id: string, updates: { name?: string; currency?: string }) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('workspaces').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const deleteWorkspace = async (id: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('workspaces').delete().eq('id', id);
  if (error) throw error;
};

// ─── Members ─────────────────────────────────────────────────────────────────

export const fetchMembers = async (workspaceId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, role, status, user_id, profiles(display_name, email, avatar_url)')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  return data ?? [];
};

export const updateMemberRole = async (memberId: string, role: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('workspace_members').update({ role }).eq('id', memberId);
  if (error) throw error;
};

export const removeMember = async (memberId: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('workspace_members').delete().eq('id', memberId);
  if (error) throw error;
};

export const approveMember = async (memberId: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('workspace_members').update({ status: 'approved' }).eq('id', memberId);
  if (error) throw error;
};

export const rejectMember = async (memberId: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('workspace_members').delete().eq('id', memberId);
  if (error) throw error;
};

// ─── Recordings ──────────────────────────────────────────────────────────────

export const fetchRecordings = async (workspaceId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const createRecording = async (userId: string, recording: {
  workspace_id: string;
  name: string;
  type: string;
  category: string;
  amount: number;
  currency: string;
  date: string;
  is_recurring: boolean;
  recurring_frequency?: string;
}) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('recordings').insert({
    ...recording,
    user_id: userId,
  }).select().single();
  if (error) throw error;
  return data;
};

export const deleteRecording = async (id: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('recordings').delete().eq('id', id);
  if (error) throw error;
};

// ─── Bank Accounts ────────────────────────────────────────────────────────────

export const fetchAccounts = async (userId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const createAccount = async (account: {
  user_id: string;
  type: string;
  bank_name: string;
  name: string;
  due_date?: number;
  balance?: number;
  goal_amount?: number;
  goal_start?: string;
  goal_end?: string;
  savings_type?: string;
}) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('accounts').insert(account).select().single();
  if (error) throw error;
  return data;
};

export const deleteAccount = async (id: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) throw error;
};

// ─── Receipts ─────────────────────────────────────────────────────────────────

export const fetchReceipts = async (workspaceId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const togglePinReceipt = async (id: string, pinned: boolean) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('receipts').update({ pinned }).eq('id', id);
  if (error) throw error;
};

export const deleteReceipt = async (id: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('receipts').delete().eq('id', id);
  if (error) throw error;
};

// ─── Splits ───────────────────────────────────────────────────────────────────

export const fetchSplits = async (workspaceId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('splits')
    .select('*, split_participants(*)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const createSplit = async (split: {
  workspace_id: string;
  name: string;
  total_amount: number;
  currency: string;
  recording_id?: string;
}, participants: { name: string; amount: number }[]) => {
  const supabase = getSupabaseClient();
  const { data: splitData, error: splitError } = await supabase.from('splits').insert(split).select().single();
  if (splitError) throw splitError;
  const rows = participants.map((p) => ({ split_id: splitData.id, name: p.name, amount: p.amount, status: 'unpaid' }));
  const { error: partError } = await supabase.from('split_participants').insert(rows);
  if (partError) throw partError;
  return splitData;
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const fetchNotifications = async (userId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const markNotificationRead = async (id: string) => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) throw error;
};
