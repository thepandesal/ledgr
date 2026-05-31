import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  ElmsSans_400Regular,
  ElmsSans_500Medium,
  ElmsSans_600SemiBold,
  ElmsSans_700Bold,
} from '@expo-google-fonts/elms-sans';
import { PlaywriteHU_400Regular } from '@expo-google-fonts/playwrite-hu';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../src/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ElmsSans_400Regular,
    ElmsSans_500Medium,
    ElmsSans_600SemiBold,
    ElmsSans_700Bold,
    PlaywriteHU_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="workspace" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}
