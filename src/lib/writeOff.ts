import { supabase } from './supabase';

/**
 * Ensures a "Write-offs" category exists for the user and returns its id.
 * Creates it on first use.
 */
async function getOrCreateWriteOffCategory(userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Write-offs')
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created } = await supabase
    .from('categories')
    .insert({ user_id: userId, name: 'Write-offs', icon: 'close-circle-outline', color: '#929090' })
    .select('id')
    .single();

  return created?.id ?? null;
}

/**
 * Writes off the remaining unpaid amount on a recording.
 *
 * - Creates a new expense recording with is_write_off: true linked to the parent
 * - Marks the parent recording as paid (keeps existing paid_amount)
 */
export async function writeOff(params: {
  parentRecordingId: string;
  parentName: string;
  amount: number;          // the amount being written off
  spaceId: string | null;
  userId: string;
  reason?: string;
}): Promise<void> {
  const { parentRecordingId, parentName, amount, spaceId, userId, reason } = params;
  if (amount <= 0) return;

  const categoryId = await getOrCreateWriteOffCategory(userId);
  const today = new Date().toISOString().split('T')[0];

  // 1. Insert write-off expense recording
  await supabase.from('recordings').insert({
    user_id: userId,
    space_id: spaceId,
    name: `${parentName} · write-off`,
    type: 'expense',
    amount,
    transaction_date: today,
    status: 'paid',
    is_write_off: true,
    write_off_reason: reason?.trim() || null,
    linked_recording_id: parentRecordingId,
    category_id: categoryId,
  });

  // 2. Mark parent as paid (preserve existing paid_amount)
  await supabase.from('recordings').update({
    status: 'paid',
  }).eq('id', parentRecordingId);
}
