import { View, Text, Pressable, Image, StyleSheet, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../src/lib/supabase';
import { Colors, Fonts, Spacing, BorderRadius } from '../src/constants/theme';

WebBrowser.maybeCompleteAuthSession();

function getRedirectUri() {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.location.origin : 'https://ledgr.thepandesal.com';
  }
  return 'ledgr://';
}

export default function LoginScreen() {
  const handleGoogleSignIn = async () => {
    const redirectTo = getRedirectUri();

    if (Platform.OS === 'web') {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      return;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data?.url) return;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const params = new URLSearchParams(url.hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    }
  };

  const handleAppleSignIn = async () => {
    const redirectTo = getRedirectUri();

    if (Platform.OS === 'web') {
      await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo },
      });
      return;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data?.url) return;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const params = new URLSearchParams(url.hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoSection}>
        <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.appName}>Ledgr</Text>
        <Text style={styles.tagline}>Your finances, together.</Text>
      </View>

      <View style={styles.authSection}>
        <Pressable style={styles.googleButton} onPress={handleGoogleSignIn}>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </Pressable>

        <Pressable style={styles.appleButton} onPress={handleAppleSignIn}>
          <Text style={styles.appleButtonText}>Continue with Apple</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  logoSection: { alignItems: 'center', marginBottom: Spacing.xxl },
  logo: { width: 100, height: 100, marginBottom: Spacing.md },
  appName: { fontFamily: Fonts.header, fontSize: 36, color: Colors.primary },
  tagline: { fontFamily: Fonts.body, fontSize: 15, color: Colors.textMuted, marginTop: Spacing.xs },
  authSection: { gap: Spacing.sm },
  googleButton: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  googleButtonText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.text },
  appleButton: {
    backgroundColor: Colors.black,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  appleButtonText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.white },
});
