import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface Memo {
  id: string;
  user_id: string;
  space_id: string;
  content: string;
  due_date: string | null;
  is_done: boolean;
  created_at: string;
}

export function useMemos(spaceId: string, userId: string) {
  const queryClient = useQueryClient();

  const { data: memos = [], isLoading } = useQuery<Memo[]>({
    queryKey: ['memos', spaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('memos')
        .select('*')
        .eq('space_id', spaceId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      return (data ?? []) as Memo[];
    },
    enabled: !!spaceId && !!userId,
  });

  const addMemo = async (content: string, due_date?: string) => {
    await supabase.from('memos').insert({ user_id: userId, space_id: spaceId, content, due_date: due_date ?? null });
    queryClient.invalidateQueries({ queryKey: ['memos', spaceId] });
  };

  const toggleMemo = async (id: string, is_done: boolean) => {
    await supabase.from('memos').update({ is_done }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['memos', spaceId] });
  };

  const deleteMemo = async (id: string) => {
    await supabase.from('memos').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['memos', spaceId] });
  };

  return { memos, isLoading, addMemo, toggleMemo, deleteMemo };
}
