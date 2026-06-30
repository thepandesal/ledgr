import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#f5f5f5' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
      <Stack.Screen name="space-detail" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
      <Stack.Screen name="add-recording" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="split-bill" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="recording-detail" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="crop-qr" options={{ animation: 'fade', presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="capture-receipt" options={{ animation: 'none' }} />
      <Stack.Screen name="receipt-detail" options={{ animation: 'none' }} />
    </Stack>
  );
}

