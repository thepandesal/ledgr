import { Stack, useRouter } from 'expo-router';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { RobotoMono_400Regular, RobotoMono_700Bold } from '@expo-google-fonts/roboto-mono';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Fraunces_400Regular, Fraunces_600SemiBold, Fraunces_700Bold, Fraunces_900Black } from '@expo-google-fonts/fraunces';
import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

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
  const [fontsLoaded, fontError] = useFonts({
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
    'Poppins-Regular': require('../assets/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/Poppins-Bold.ttf'),
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_900Black,
    Avenelle: require('../assets/avenelle.ttf'),
    ChillaxMedium: require('../assets/Chillax-Medium.otf'),
    ChillaxRegular: require('../assets/Chillax-Regular.otf'),
    ChillaxBold: require('../assets/Chillax-Bold.otf'),
    ChillaxSemibold: require('../assets/Chillax-Semibold.otf'),
    ChillaxLight: require('../assets/Chillax-Light.otf'),
    MuseoModerno_Black: require('../assets/MuseoModerno-Black.ttf'),
    MuseoModerno_Medium: require('../assets/MuseoModerno-Medium.ttf'),
    MuseoModerno_Regular: require('../assets/MuseoModerno-Regular.ttf'),
    CalSans: require('../assets/CalSans-Regular.ttf'),
    GlacialIndifference: require('../assets/GlacialIndifference-Regular.otf'),
    GlacialIndifferenceBold: require('../assets/GlacialIndifference-Bold.otf'),
  });

  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'no-scroll-shift';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      // scrollbar-gutter is not supported in Safari — use overflow-y only
      const isChrome = typeof navigator !== 'undefined' && /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
      style.textContent = isChrome
        ? 'html { scrollbar-gutter: stable; overflow-y: scroll; }'
        : 'html { overflow-y: scroll; }';
      document.head.appendChild(style);
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
    if (!fontsLoaded && !fontError) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[auth] event:', String(event).replace(/[\r\n]/g, ' '));
      const path = typeof window !== 'undefined' && typeof window.location !== 'undefined' ? window.location.pathname : '';
      if (path.startsWith('/split/')) { setReady(true); return; }
      if (!session || event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setReady(true);
        if (event === 'SIGNED_OUT') {
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          } else {
            router.replace('/');
          }
        }
      } else if (!session.user.user_metadata?.full_name) {
        setIsAuthenticated(true);
        setReady(true);
        router.replace('/onboarding');
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        setIsAuthenticated(true);
        setReady(true);
        if ((event === 'SIGNED_IN') && (!path || path === '/' || path === '/index')) {
          router.replace('/(app)/(tabs)');
        }
      } else {
        setIsAuthenticated(true);
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [fontsLoaded, fontError]);

  if ((!fontsLoaded && !fontError) || !ready) {
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

