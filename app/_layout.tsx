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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 1000 * 60 * 10,
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
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

  useEffect(() => {
    // RN Web sets document.body.style.overflow = 'hidden' when a Modal opens,
    // which removes the scrollbar and shifts the page left. We patch the setter
    // to ignore that specific mutation.
    if (typeof document === 'undefined') return;
    const originalSetProperty = document.body.style.setProperty.bind(document.body.style);
    document.body.style.setProperty = (prop: string, value: string, priority?: string) => {
      if (prop === 'overflow' && value === 'hidden') return;
      originalSetProperty(prop, value, priority);
    };
    // Also cover direct assignment via the overflow setter
    const proto = Object.getPrototypeOf(document.body.style);
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'overflow');
    if (descriptor?.set) {
      Object.defineProperty(document.body.style, 'overflow', {
        set(v: string) { if (v !== 'hidden') descriptor.set!.call(this, v); },
        get() { return descriptor.get!.call(this); },
        configurable: true,
      });
    }
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[auth] event:', event, 'session:', !!session);
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      // Don't redirect if on split share page
      if (path.startsWith('/split/')) { setReady(true); return; }
      if (!session) {
        setReady(true);
        router.replace('/');
      } else if (!session.user.user_metadata?.full_name) {
        setReady(true);
        router.replace('/onboarding');
      } else {
        setReady(true);
        // If already inside the app (e.g. restoring after minimize), don't redirect.
        // Let Expo Router stay on the current URL.
        if (!path || path === '/' || path === '/index') {
          router.replace('/(app)/(tabs)');
        }
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
    </Stack>
    </QueryClientProvider>
  );
}

