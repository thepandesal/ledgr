import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { DMSans_400Regular, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import * as Font from 'expo-font';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 min — show cached data instantly, refetch in background
      gcTime: 1000 * 60 * 30,    // keep unused cache for 30 min
      retry: 2,
    },
  },
});

ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('[global error]', isFatal ? 'FATAL' : 'non-fatal', error?.message, error?.stack);
});

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await Font.loadAsync({
          DMSans_400Regular,
          DMSans_600SemiBold,
          DMSans_700Bold,
          CalSans: require('../assets/CalSans-Regular.ttf'),
        });
      } catch (e) {
        console.warn('[fonts] base fonts failed to load:', e);
      }

      setFontsLoaded(true);
    })();
  }, []);

  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const justSignedOut = useRef(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'no-scroll-shift';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = 'html { scrollbar-gutter: stable; overflow-y: scroll; }';
      document.head.appendChild(style);
    }
  }, []);

  // Handle OAuth code on web (redirected back with ?code=...)
  const [exchangingCode, setExchangingCode] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setExchangingCode(true);
      supabase.auth.exchangeCodeForSession(code).then(() => {
        window.history.replaceState({}, '', '/');
        setExchangingCode(false);
      });
    }
  }, []);

  // Handle deep link OAuth callback
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (url.includes('access_token') || url.includes('code=')) {
        try {
          if (typeof (supabase.auth as any).getSessionFromUrl === 'function') {
            await (supabase.auth as any).getSessionFromUrl({ url });
          }
        } catch (e) {
          console.warn('[auth] getSessionFromUrl failed:', e);
        }
      }
    };
    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (__DEV__) console.log('[auth] event:', String(event).replace(/[\r\n]/g, ' '));
      const path = typeof window !== 'undefined' && typeof window.location !== 'undefined' ? window.location.pathname : '';
      if (path.startsWith('/split/')) { setReady(true); return; }
      if (!session || event === 'SIGNED_OUT') {
        justSignedOut.current = true;
        setIsAuthenticated(false);
        setReady(true);
        if (event === 'SIGNED_OUT') {
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          } else {
            setTimeout(() => router.replace('/'), 0);
          }
        }
      } else if (!session.user.user_metadata?.full_name) {
        justSignedOut.current = false;
        setIsAuthenticated(true);
        setReady(true);
        router.replace('/onboarding');
      } else if (event === 'SIGNED_IN') {
        if (justSignedOut.current) { justSignedOut.current = false; return; }
        setIsAuthenticated(true);
        setReady(true);
        if (!path || path === '/' || path === '/index') {
          router.replace('/(app)/(tabs)');
        }
      } else {
        justSignedOut.current = false;
        setIsAuthenticated(true);
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [fontsLoaded]);

  if (!fontsLoaded || !ready || exchangingCode) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#00bf63" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 250,
        contentStyle: { backgroundColor: '#f5f5f5' },
      }}
    >
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="(app)" options={{ animation: 'none' }} />
      <Stack.Screen name="split" options={{ animation: 'fade', headerShown: false }} />
      <Stack.Screen name="legal" options={{ animation: 'slide_from_bottom', headerShown: false }} />
    </Stack>
    </QueryClientProvider>
  );
}

