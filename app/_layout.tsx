import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { RobotoMono_400Regular, RobotoMono_700Bold } from '@expo-google-fonts/roboto-mono';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Fraunces_400Regular, Fraunces_600SemiBold, Fraunces_700Bold, Fraunces_900Black } from '@expo-google-fonts/fraunces';
import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
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

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      PlusJakartaSans_400Regular,
      PlusJakartaSans_500Medium,
      PlusJakartaSans_600SemiBold,
      PlusJakartaSans_700Bold,
      DMSans_400Regular,
      DMSans_500Medium,
      DMSans_600SemiBold,
      DMSans_700Bold,
      RobotoMono_400Regular,
      RobotoMono_700Bold,
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
      Outfit_400Regular,
      Outfit_600SemiBold,
      Outfit_700Bold,
      Fraunces_400Regular,
      Fraunces_600SemiBold,
      Fraunces_700Bold,
      Fraunces_900Black,
      Avenelle: require('../assets/avenelle.ttf'),
      MuseoModerno_Black: require('../assets/MuseoModerno-Black.ttf'),
      MuseoModerno_Medium: require('../assets/MuseoModerno-Medium.ttf'),
      MuseoModerno_Regular: require('../assets/MuseoModerno-Regular.ttf'),
      CalSans: require('../assets/CalSans-Regular.ttf'),
    }).catch((e) => {
      if (__DEV__) console.warn('[fonts] base fonts failed to load:', e);
    }).then(() => {
      return Font.loadAsync({
        ChillaxMedium: require('../assets/Chillax-Medium.otf'),
        ChillaxRegular: require('../assets/Chillax-Regular.otf'),
        ChillaxBold: require('../assets/Chillax-Bold.otf'),
        ChillaxSemibold: require('../assets/Chillax-Semibold.otf'),
        ChillaxLight: require('../assets/Chillax-Light.otf'),
        GlacialIndifference: require('../assets/GlacialIndifference-Regular.otf'),
        GlacialIndifferenceBold: require('../assets/GlacialIndifference-Bold.otf'),
      }).catch((e) => {
        if (__DEV__) console.warn('[fonts] otf fonts failed to load:', e);
      });
    }).finally(() => {
      setFontsLoaded(true);
    });
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
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(() => {
        window.history.replaceState({}, '', '/');
      });
    }
  }, []);

  // Handle deep link OAuth callback
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (url.includes('access_token') || url.includes('code=')) {
        const { data } = await supabase.auth.getSessionFromUrl ? 
          (supabase.auth as any).getSessionFromUrl({ url }) :
          { data: null };
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

  if (!fontsLoaded || !ready) {
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

