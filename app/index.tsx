import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LEDGR_LOGO_SVG_DATA_URI } from '../src/lib/ledgrLogoBase64';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useEffect, useRef, useState } from 'react';
import { Colors } from '../components/ui/theme';
import { AppFont } from '../src/lib/fonts';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, Easing,
} from 'react-native-reanimated';

WebBrowser.maybeCompleteAuthSession();

const { height } = Dimensions.get('window');

const ANIM_DONE_MS = 2000;
const SLIDE_DURATION = 600;
const FADE_DURATION = 500;
const FADE_DELAY = SLIDE_DURATION + 100;

export default function LoginScreen() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [phase, setPhase] = useState<'intro' | 'transition' | 'done'>('intro');
  const router = useRouter();

  // Reanimated values
  const logoTranslateY = useSharedValue(height * 0.15);
  const contentOpacity = useSharedValue(0);
  const legalOpacity = useSharedValue(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setPhase('transition');
      logoTranslateY.value = withTiming(height * 0.02, {
        duration: SLIDE_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      contentOpacity.value = withDelay(
        FADE_DELAY,
        withTiming(1, { duration: FADE_DURATION }),
      );
      legalOpacity.value = withDelay(
        FADE_DELAY + 200,
        withTiming(1, { duration: FADE_DURATION }),
      );
    }, ANIM_DONE_MS);
    return () => clearTimeout(t);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoTranslateY.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const legalStyle = useAnimatedStyle(() => ({
    opacity: legalOpacity.value,
  }));

  const signIn = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    if (Platform.OS === 'web') {
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      setLoading(null);
      return;
    }
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

        {/* Wordmark */}
        <Animated.View style={[s.logoWrap, logoStyle]}>
          <Text style={s.wordmark}>LEDGR</Text>
          <Text style={s.tagline}>Tracking money made easy.</Text>

          {/* Logo */}
          {Platform.OS === 'web' ? (
            <img
              src={LEDGR_LOGO_SVG_DATA_URI}
              alt="LEDGR logo"
              style={{ width: '100%', maxWidth: 500, aspectRatio: 1, display: 'block', marginTop: 8 }}
            />
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{
                html: `<!DOCTYPE html><html><body style="margin:0;background:transparent"><img src="${LEDGR_LOGO_SVG_DATA_URI}" style="width:100%;height:100%;object-fit:contain" /></body></html>`,
              }}
              style={s.logoImg}
              pointerEvents="none"
              setSupportMultipleWindows={false}
              scrollEnabled={false}
            />
          )}
        </Animated.View>

        {/* Buttons */}
        <Animated.View style={[s.content, contentStyle]}>
          <View style={s.buttons}>
            <TouchableOpacity
              style={s.button}
              activeOpacity={0.8}
              onPress={() => signIn('google')}
              disabled={loading !== null}
            >
              {loading === 'google'
                ? <ActivityIndicator color="#ffffff" />
                : <Text style={s.buttonText}>Continue with Google</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={s.button}
              activeOpacity={0.8}
              onPress={() => signIn('apple')}
              disabled={loading !== null}
            >
              {loading === 'apple'
                ? <ActivityIndicator color="#ffffff" />
                : <Text style={s.buttonText}>Continue with Apple</Text>}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Legal */}
        <Animated.View style={legalStyle}>
          <Text style={s.legal}>
            by continuing, you agree to our{' '}
            <Text
              style={s.legalLink}
              onPress={() => router.push({ pathname: '/legal', params: { tab: 'terms' } } as any)}
            >
              terms of service
            </Text>
            {' '}and{' '}
            <Text
              style={s.legalLink}
              onPress={() => router.push({ pathname: '/legal', params: { tab: 'privacy' } } as any)}
            >
              privacy policy
            </Text>
          </Text>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fdfdfd' },
  wrapper:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  logoWrap:   { alignItems: 'center', justifyContent: 'center', width: '100%' },
  wordmark:   { fontFamily: AppFont.brand, fontSize: 28, color: '#8c52ff', letterSpacing: 0 },
  tagline:    { fontFamily: AppFont.medium, fontSize: 15, color: '#373737', marginTop: 4 },
  logoImg:    { width: '100%', maxWidth: 500, aspectRatio: 1, marginTop: 8 },
  content:    { width: '100%', paddingHorizontal: 32, marginTop: 20 },
  buttons:    { gap: 12 },
  button: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#373737',
  },
  buttonText: { fontFamily: AppFont.regular, fontSize: 15, color: '#ffffff', letterSpacing: 1.5 },
  legal:      { textAlign: 'center', fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginTop: 24, lineHeight: 18, paddingHorizontal: 32 },
  legalLink:  { color: '#8c52ff', fontFamily: AppFont.semiBold },
});
