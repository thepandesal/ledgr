import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface UseUserResult {
  user: User | null;
  userId: string;
  userName: string;
  loading: boolean;
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
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    user,
    userId: user?.id ?? '',
    userName: user?.user_metadata?.full_name ?? '',
    loading,
  };
}
