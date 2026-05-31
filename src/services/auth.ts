import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

function getRedirectUri() {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.location.origin : 'https://ledgr.thepandesal.com';
  }
  return 'ledgr://';
}

type OAuthProvider = 'google' | 'apple';

async function signInWithOAuth(provider: OAuthProvider) {
  const redirectTo = getRedirectUri();

  if (Platform.OS === 'web') {
    return supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data?.url) return { error };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success' && result.url) {
    const params = new URLSearchParams(new URL(result.url).hash.substring(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      return supabase.auth.setSession({ access_token, refresh_token });
    }
  }
  return { error: null };
}

export const signInWithGoogle = () => signInWithOAuth('google');
export const signInWithApple = () => signInWithOAuth('apple');

export async function signOut() {
  return supabase.auth.signOut();
}
