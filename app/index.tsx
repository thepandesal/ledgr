import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const { width, height } = Dimensions.get('window');

const ANIM_DONE_MS = 2000;
const SLIDE_DURATION = 600;
const FADE_DURATION = 500;
const FADE_DELAY = SLIDE_DURATION + 100;

const SVG_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  img { width: 80vw; max-width: 360px; height: auto; }
</style>
</head>
<body>
  <img src="data:image/svg+xml;base64,__SVG_BASE64__" />
</body>
</html>`;

// Inline SVG for web platform
const SVG_DATA_URI = require('../assets/ledgr-logo-animated.svg');

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
      // Slide logo up just a little
      logoTranslateY.value = withTiming(height * 0.02, {
        duration: SLIDE_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      // Fade in buttons
      contentOpacity.value = withDelay(
        FADE_DELAY,
        withTiming(1, { duration: FADE_DURATION }),
      );
      // Fade in legal text slightly after buttons
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

  const renderLogo = () => {
    return null; // rendered inline below
  };

  // Decode data URI to get raw SVG markup for inline rendering (required for Safari animation support)
  const svgMarkup = Platform.OS === 'web'
    ? (() => {
        try {
          const raw = SVG_DATA_URI;
          if (raw.startsWith('data:image/svg+xml;base64,')) {
            return atob(raw.split(',')[1]);
          }
          if (raw.startsWith('data:image/svg+xml;utf8,') || raw.startsWith('data:image/svg+xml;charset=utf-8,')) {
            return decodeURIComponent(raw.split(',')[1]);
          }
          return raw; // fallback: treat as plain SVG string
        } catch { return ''; }
      })()
    : '';

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <View style={s.wrapper}>

        {/* Animated logo */}
        <Animated.View style={[s.logoWrap, logoStyle]}>
          {Platform.OS === 'web' ? (
            <div
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
              style={{ width: '80%', maxWidth: 360 } as any}
            />
          ) : (
            (() => {
              const WebView = require('react-native-webview').WebView;
              return (
                <WebView
                  source={{ html: buildWebViewHtml() }}
                  style={s.webview}
                  scrollEnabled={false}
                  pointerEvents="none"
                  originWhitelist={['*']}
                  backgroundColor="transparent"
                  androidLayerType="hardware"
                />
              );
            })()
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

function buildWebViewHtml() {
  // Read SVG file as raw string for embedding in WebView
  const fs = require('fs');
  const path = require('path');
  try {
    const svgPath = path.join(__dirname, '..', 'assets', 'ledgr-logo-animated.svg');
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    const b64 = btoa(unescape(encodeURIComponent(svgContent)));
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;display:flex;align-items:center;justify-content:center;overflow:hidden}img{width:100%;height:auto}</style></head><body><img src="data:image/svg+xml;base64,${b64}"/></body></html>`;
  } catch {
    return '';
  }
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fdfdfd' },
  wrapper:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  logoWrap:   { alignItems: 'center', justifyContent: 'center', width: '100%' },
  webview:    { width: width * 0.8, height: width * 0.4, backgroundColor: 'transparent', marginBottom: -width * 0.15 },
  content:    { width: '100%', paddingHorizontal: 32, marginTop: 60 },
  buttons:    { gap: 12 },
  button: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#111111',
  },
  buttonText: { fontFamily: AppFont.semiBold, fontSize: 15, color: '#ffffff', letterSpacing: 1.5 },
  legal:      { textAlign: 'center', fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginTop: 24, lineHeight: 18, paddingHorizontal: 32 },
  legalLink:  { color: Colors.cyan, fontFamily: AppFont.semiBold },
});
