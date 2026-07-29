import { supabase } from './supabase';

export async function getOrCreateLoansCategory(userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Loans')
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from('categories')
    .insert({ user_id: userId, name: 'Loans', icon: 'cash-outline', color: '#4F9289' })
    .select('id')
    .single();

  return created?.id ?? null;
}
