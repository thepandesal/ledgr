import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = () => {
  if (supabaseClient) return supabaseClient;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
};

const redirectUrl = Platform.OS === 'web'
  ? `${typeof window !== 'undefined' ? window.location.origin : 'https://ledgr.thepandesal.com'}/auth`
  : 'ledgr://auth';

export const signInWithGoogle = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

export const signInWithApple = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Apple sign-in error:', error);
    throw error;
  }
};

export const signInWithGitHub = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('GitHub sign-in error:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Sign-out error:', error);
    throw error;
  }
};

export const getSession = async () => {
  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return session;
  } catch (error) {
    console.error('Get session error:', error);
    return null;
  }
};
