import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LOGIN_HERO_SVG_DATA_URI } from '../src/lib/loginHeroBase64';
import { LOADING_SPINNER_SVG_DATA_URI } from '../src/lib/loadingSpinnerBase64';
import { SUCCESS_SVG_DATA_URI } from '../src/lib/successBase64';
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
const SUCCESS_DURATION = 2200; // matches SVG dur="2.167s"

type OverlayPhase = 'spinner' | 'success' | 'hidden';

export default function LoginScreen() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [phase, setPhase] = useState<'intro' | 'transition' | 'done'>('intro');
  const [overlayPhase, setOverlayPhase] = useState<OverlayPhase>('hidden');
  const authDone = useRef(false);
  const router = useRouter();

  const logoTranslateY = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const legalOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const spinnerOpacity = useSharedValue(0);
  const successOpacity = useSharedValue(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setPhase('transition');
      logoTranslateY.value = withTiming(-height * 0.12, {
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
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));
  const legalStyle = useAnimatedStyle(() => ({ opacity: legalOpacity.value }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const spinnerStyle = useAnimatedStyle(() => ({ opacity: spinnerOpacity.value }));
  const successStyle = useAnimatedStyle(() => ({ opacity: successOpacity.value }));

  const showSuccess = () => {
    // crossfade spinner → success
    spinnerOpacity.value = withTiming(0, { duration: 300 });
    successOpacity.value = withTiming(1, { duration: 300 });
    setOverlayPhase('success');

    // after success animation plays once, fade out entire overlay
    setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: 400 });
      setTimeout(() => {
        setOverlayPhase('hidden');
        setLoading(null);
      }, 400);
    }, SUCCESS_DURATION);
  };

  const signIn = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    authDone.current = false;

    // Phase 1: fade in overlay + spinner
    setOverlayPhase('spinner');
    overlayOpacity.value = withTiming(1, { duration: 200 });
    spinnerOpacity.value = withTiming(1, { duration: 200 });
    successOpacity.value = 0;

    // After 2s intro, if auth is already done show success, else keep spinning
    const introTimer = setTimeout(() => {
      if (authDone.current) {
        showSuccess();
      }
      // else: auth will call showSuccess when it finishes
    }, 2000);

    if (Platform.OS === 'web') {
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account' },
        },
      });
      // signInWithOAuth redirects the page — code below won't run
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

    authDone.current = true;
    clearTimeout(introTimer);
    showSuccess();
  };

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <View style={s.wrapper}>

        <Animated.View style={[s.logoWrap, logoStyle]}>
          <Animated.Text style={[s.wordmark, contentStyle]}>LEDGR</Animated.Text>

          {Platform.OS === 'web' ? (
            <img
              src={LOGIN_HERO_SVG_DATA_URI}
              alt="LEDGR hero"
              style={{ width: '100%', maxWidth: 340, aspectRatio: 1, display: 'block', marginTop: 60, marginBottom: -60 }}
            />
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{
                html: `<!DOCTYPE html><html><body style="margin:0;background:transparent"><img src="${LOGIN_HERO_SVG_DATA_URI}" style="width:100%;height:100%;object-fit:contain" /></body></html>`,
              }}
              style={s.logoImg}
              pointerEvents="none"
              setSupportMultipleWindows={false}
              scrollEnabled={false}
            />
          )}
        </Animated.View>

        <Animated.View style={[s.content, contentStyle]}>
          <View style={s.buttons}>
            <TouchableOpacity
              style={s.button}
              activeOpacity={0.8}
              onPress={() => signIn('google')}
              disabled={loading !== null}
            >
              <Text style={s.buttonText}>Continue with Google</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.button}
              activeOpacity={0.8}
              onPress={() => signIn('apple')}
              disabled={loading !== null}
            >
              <Text style={s.buttonText}>Continue with Apple</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

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

      {/* Loading overlay */}
      {overlayPhase !== 'hidden' && (
        <Animated.View style={[s.overlay, overlayStyle]} pointerEvents="none">
          {/* Spinner */}
          <Animated.View style={[s.svgWrap, spinnerStyle]}>
            {Platform.OS === 'web' ? (
              <img src={LOADING_SPINNER_SVG_DATA_URI} alt="loading" style={{ width: 48, height: 48 }} />
            ) : (
              <WebView
                originWhitelist={['*']}
                source={{ html: `<!DOCTYPE html><html><body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;width:100%;height:100%"><img src="${LOADING_SPINNER_SVG_DATA_URI}" style="width:48px;height:48px" /></body></html>` }}
                style={s.spinnerWeb}
                pointerEvents="none"
                setSupportMultipleWindows={false}
                scrollEnabled={false}
              />
            )}
          </Animated.View>

          {/* Success */}
          <Animated.View style={[s.svgWrap, successStyle]}>
            {Platform.OS === 'web' ? (
              <img src={SUCCESS_SVG_DATA_URI} alt="success" style={{ width: 48, height: 48 }} />
            ) : (
              <WebView
                originWhitelist={['*']}
                source={{ html: `<!DOCTYPE html><html><body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;width:100%;height:100%"><img src="${SUCCESS_SVG_DATA_URI}" style="width:48px;height:48px" /></body></html>` }}
                style={s.spinnerWeb}
                pointerEvents="none"
                setSupportMultipleWindows={false}
                scrollEnabled={false}
              />
            )}
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fdfdfd' },
  wrapper:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40, paddingTop: 140 },
  logoWrap:   { alignItems: 'center', justifyContent: 'center', width: '100%' },
  wordmark:   { fontFamily: AppFont.brand, fontSize: 42, color: '#4394ff', letterSpacing: 1, marginBottom: -40 },
  logoImg:    { width: '100%', maxWidth: 340, aspectRatio: 1, marginTop: 60, marginBottom: -60 },
  content:    { width: '100%', paddingHorizontal: 32, marginTop: 0 },
  buttons:    { gap: 12 },
  button: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#deecff',
  },
  buttonText: { fontFamily: AppFont.regular, fontSize: 15, color: '#4394ff', letterSpacing: 1.5 },
  legal:      { textAlign: 'center', fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginTop: 24, lineHeight: 18, paddingHorizontal: 32 },
  legalLink:  { color: '#4394ff', fontFamily: AppFont.semiBold },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgWrap:    { position: 'absolute' },
  spinnerWeb: { width: 48, height: 48, backgroundColor: 'transparent' },
});
