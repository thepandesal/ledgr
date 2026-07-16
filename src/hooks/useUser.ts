import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface UseUserResult {
  user: User | null;
  userId: string;
  userName: string;
  profileCode: string;
  defaultCurrency: string;
  setDefaultCurrency: (currency: string) => Promise<void>;
  loading: boolean;
}

function generateProfileCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LDGR-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function registerPushToken(_userId: string) {
  // expo-notifications removed for iOS 26 compatibility
}

/**
 * useUser
 * Fetches and caches the current Supabase auth user.
 * Replaces the repeated supabase.auth.getUser() pattern across screens.
 *
 * Usage:
 *   const { user, userId, userName } = useUser();
 */
export function useUser(): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user?.id) registerPushToken(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data: settings } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('profile_code, default_currency')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (!data?.profile_code) {
        const code = generateProfileCode();
        await supabase.from('user_settings').upsert(
          { user_id: user!.id, profile_code: code, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
        return { ...data, profile_code: code };
      }
      return data;
    },
    enabled: !!user?.id,
    staleTime: Infinity,
  });

  const setDefaultCurrency = async (currency: string) => {
    if (!user?.id) return;
    queryClient.setQueryData(['user-settings', user.id], (old: any) => ({ ...old, default_currency: currency }));
    await supabase.from('user_settings').upsert(
      { user_id: user.id, default_currency: currency, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  };

  return {
    user,
    userId: user?.id ?? '',
    userName: user?.user_metadata?.full_name ?? '',
    profileCode: settings?.profile_code ?? '',
    defaultCurrency: settings?.default_currency ?? 'PHP',
    setDefaultCurrency,
    loading,
  };
}
