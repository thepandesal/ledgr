import { useEffect, useState, useRef } from 'react';
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
  requireTagApproval: boolean;
  setRequireTagApproval: (value: boolean) => Promise<void>;
  loading: boolean;
}

function generateProfileCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LDGR-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function registerPushToken(_userId: string) {
  // expo-notifications not installed locally
}

// ── Singleton session cache — shared across all useUser() callers ──
let _user: User | null = null;
let _loading = true;
let _listeners: Array<() => void> = [];
let _initialized = false;

function notifyListeners() { _listeners.forEach(fn => fn()); }

function initSession() {
  if (_initialized) return;
  _initialized = true;
  supabase.auth.getSession().then(({ data: { session } }) => {
    _user = session?.user ?? null;
    _loading = false;
    if (session?.user?.id) registerPushToken(session.user.id);
    notifyListeners();
  });
  supabase.auth.onAuthStateChange((_, session) => {
    _user = session?.user ?? null;
    notifyListeners();
  });
}

export function useUser(): UseUserResult {
  const [, rerender] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    initSession();
    const fn = () => rerender(n => n + 1);
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  }, []);

  const user = _user;

  const { data: settings } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('profile_code, default_currency, require_tag_approval')
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
    staleTime: 5 * 60 * 1000,
  });

  const setDefaultCurrency = async (currency: string) => {
    if (!user?.id) return;
    queryClient.setQueryData(['user-settings', user.id], (old: any) => ({ ...old, default_currency: currency }));
    await supabase.from('user_settings').upsert(
      { user_id: user.id, default_currency: currency, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  };

  const setRequireTagApproval = async (value: boolean) => {
    if (!user?.id) return;
    queryClient.setQueryData(['user-settings', user.id], (old: any) => ({ ...old, require_tag_approval: value }));
    await supabase.from('user_settings').upsert(
      { user_id: user.id, require_tag_approval: value, updated_at: new Date().toISOString() },
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
    requireTagApproval: settings?.require_tag_approval ?? false,
    setRequireTagApproval,
    loading: _loading,
  };
}
