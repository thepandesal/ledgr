import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

// Global letter spacing for all Text components
Text.defaultProps = { ...Text.defaultProps, style: [{ letterSpacing: 0.3 }, Text.defaultProps?.style] };

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
  console.log('[boot] RootLayout mounted');
  console.time('[boot] fonts');
  const [fontsLoaded, fontError] = useFonts({
    'Poppins-Regular':  require('../assets/Poppins-Regular.ttf'),
    'Poppins-Medium':   require('../assets/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/Poppins-SemiBold.ttf'),
    'Poppins-Bold':     require('../assets/Poppins-Bold.ttf'),
    'MuseoModerno-ExtraBold': require('../assets/MuseoModerno-ExtraBold.ttf'),
    'MuseoModerno-Medium':    require('../assets/MuseoModerno-Medium.ttf'),
    'MuseoModerno-Regular':   require('../assets/MuseoModerno-Regular.ttf'),
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
    console.time('[boot] auth');
    let initialEventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.timeEnd('[boot] auth');
      console.log('[boot] auth event:', event);
      const path = typeof window !== 'undefined' && typeof window.location !== 'undefined' ? window.location.pathname : '';
      if (path.startsWith('/split/')) { setReady(true); return; }

      if (event === 'SIGNED_OUT') {
        // Only redirect if we already had a session (explicit sign out), not on initial load
        if (initialEventReceived) {
          setIsAuthenticated(false);
          setReady(true);
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          } else {
            router.replace('/');
          }
        }
        return;
      }

      initialEventReceived = true;

      if (!session) {
        setIsAuthenticated(false);
        setReady(true);
      } else if (session?.user?.user_metadata?.onboarding_completed !== true) {
        setIsAuthenticated(true);
        setReady(true);
        router.replace('/onboarding');
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        setIsAuthenticated(true);
        setReady(true);
        const isAuthPage = !path || path === '/' || path === '/index';
        if (event === 'SIGNED_IN' && isAuthPage) {
          router.replace('/(app)/(tabs)');
        } else if (event === 'INITIAL_SESSION' && isAuthPage) {
          router.replace('/(app)/(tabs)');
        }
      } else {
        setIsAuthenticated(true);
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if ((!fontsLoaded && !fontError) || !ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#00bf63" />
      </View>
    );
  }

  console.timeEnd('[boot] fonts');
  console.log('[boot] rendering app');

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

