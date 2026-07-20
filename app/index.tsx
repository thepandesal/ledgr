import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useState } from 'react';
import { Colors } from '../components/ui/theme';
import { AppFont } from '../src/lib/fonts';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const router = useRouter();

  const signIn = async (provider: 'google' | 'apple') => {
    setLoading(provider);
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
        if (code) await supabase.auth.exchangeCodeForSession(code);
      }
    }
    setLoading(null);
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <View style={s.wrapper}>

        {/* Hero */}
        <Image
          source={require('../assets/login-image.png')}
          style={s.heroImage}
          resizeMode="contain"
        />

        {/* Content */}
        <View style={s.content}>
          <Text style={s.brand}>LEDGR</Text>
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
  container: { flex: 1, backgroundColor: '#ffffff', paddingTop: 0 },
  heroImage: {
    width: width,
    height: height * 0.55,
    alignSelf: 'center',
    marginTop: -80,
  },
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -20,
  },
  brand:     { fontFamily: 'MuseoModerno_Black', fontSize: 64, color: '#111111', letterSpacing: -1, marginBottom: 8 },
  buttons:   { width: '100%', gap: 12 },
  button: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#111111',
  },
  buttonText: { fontFamily: AppFont.semiBold, fontSize: 15, color: '#ffffff', letterSpacing: 1.5 },
  legal:      { textAlign: 'center', fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginTop: 24, lineHeight: 18 },
  legalLink:  { color: Colors.cyan, fontFamily: AppFont.semiBold },
});
