import { Stack, useRouter } from 'expo-router';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { RobotoMono_400Regular, RobotoMono_700Bold } from '@expo-google-fonts/roboto-mono';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    RobotoMono_400Regular,
    RobotoMono_700Bold,
    Avenelle: require('../assets/avenelle.ttf'),
    ChillaxMedium: require('../assets/Chillax-Medium.otf'),
  });

  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!fontsLoaded) return;
    let redirected = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (redirected) return;
      redirected = true;
      // Don't redirect if on split share page
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      if (path.startsWith('/split/')) { setReady(true); return; }
      if (!session) {
        router.replace('/');
      } else if (!session.user.user_metadata?.full_name) {
        router.replace('/onboarding');
      } else {
        router.replace('/(app)/(tabs)');
      }
      setReady(true);
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
  );
}
