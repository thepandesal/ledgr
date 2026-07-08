import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface UseUserResult {
  user: User | null;
  userId: string;
  userName: string;
  profileCode: string;
  loading: boolean;
}

function generateProfileCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LDGR-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function registerPushToken(userId: string) {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await supabase.from('push_tokens').upsert(
    { user_id: userId, token, platform: Platform.OS },
    { onConflict: 'user_id,token' }
  );
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

  useEffect(() => {
    // Get current session synchronously if available
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user?.id) registerPushToken(session.user.id);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [profileCode, setProfileCode] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('user_settings')
      .select('profile_code')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (data?.profile_code) {
          setProfileCode(data.profile_code);
          return;
        }
        // No code yet — generate and save
        const code = generateProfileCode();
        const { error: upsertError } = await supabase.from('user_settings').upsert(
          { user_id: user.id, profile_code: code, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
        if (!upsertError) setProfileCode(code);
      });
  }, [user?.id]);

  return {
    user,
    userId: user?.id ?? '',
    userName: user?.user_metadata?.full_name ?? '',
    profileCode,
    loading,
  };
}
