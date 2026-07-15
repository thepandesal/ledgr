import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import LottieHero from '../components/LottieHero';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useState } from 'react';
import { Colors } from '../components/ui/theme';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');
const heroSize = (height || 800) * 0.9 * 0.48;

export default function LoginScreen() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const router = useRouter();

  const signIn = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    // Web: direct redirect
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      setLoading(null);
      return;
    }
    // Native: use WebBrowser in-app flow
    const redirectTo = Linking.createURL('spaces');
    const { data } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        const params = new URL(result.url);
        const code = params.searchParams.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
          router.replace('/(app)/(tabs)');
        }
      }
    }
    setLoading(null);
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom', 'top']}>
      <View style={s.wrapper}>

        {/* Hero */}
        <LottieHero size={heroSize} />

        {/* Content */}
        <View style={s.content}>
          <Text style={s.brand}>LEDGR</Text>
          <Text style={s.tagline}>track your numbers.</Text>
          <View style={s.buttons}>
            <TouchableOpacity style={s.button} activeOpacity={0.8} onPress={() => signIn('google')} disabled={loading !== null}>
              {loading === 'google'
                ? <ActivityIndicator color="#545454" />
                : <Text style={s.buttonText}>Continue with Google</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.button} activeOpacity={0.8} onPress={() => signIn('apple')} disabled={loading !== null}>
              {loading === 'apple'
                ? <ActivityIndicator color="#545454" />
                : <Text style={s.buttonText}>Continue with Apple</Text>}
            </TouchableOpacity>
          </View>
          <Text style={s.legal}>
            by continuing, you agree to our{' '}
            <Text style={s.legalLink} onPress={() => router.push({ pathname: '/legal', params: { tab: 'terms' } } as any)}>terms of service</Text>
            {' '}and{' '}
            <Text style={s.legalLink} onPress={() => router.push({ pathname: '/legal', params: { tab: 'privacy' } } as any)}>privacy policy</Text>
          </Text>
        </View>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  wrapper: {
    height: height * 0.9,
    marginVertical: height * 0.05,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 48,
    marginTop: 8,
  },
  brand:     { fontFamily: 'CalSans', fontSize: 72, color: Colors.cyan, letterSpacing: -1, marginBottom: 4 },
  tagline:   { fontFamily: 'DMSans_400Regular', fontSize: 14, color: Colors.text, marginBottom: 32 },
  buttons:   { width: '100%', gap: 12 },
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#929090',
    backgroundColor: '#ffffff',
  },
  buttonText: { fontFamily: 'CalSans', fontSize: 15, color: Colors.text, letterSpacing: 1.5 },
  legal:      { textAlign: 'center', fontFamily: 'DMSans_400Regular', fontSize: 11, color: Colors.muted, marginTop: 16, lineHeight: 18 },
  legalLink:  { color: Colors.cyan, fontFamily: 'DMSans_600SemiBold' },
});
