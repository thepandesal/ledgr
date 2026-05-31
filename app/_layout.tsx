import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/providers/AuthProvider';
import { useFonts, ElmsSans_400Regular, ElmsSans_500Medium, ElmsSans_600SemiBold, ElmsSans_700Bold } from '@expo-google-fonts/elms-sans';
import { PlaywriteHU_400Regular } from '@expo-google-fonts/playwrite-hu';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ElmsSans_400Regular,
    ElmsSans_500Medium,
    ElmsSans_600SemiBold,
    ElmsSans_700Bold,
    PlaywriteHU_400Regular,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>;
  }

  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
