import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
      <Stack.Screen name="space-detail" options={{ animation: 'none', presentation: 'transparentModal' }} />
      <Stack.Screen name="add-recording" options={{ animation: 'none', presentation: 'transparentModal', contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen name="split-bill" options={{ animation: 'none', presentation: 'transparentModal' }} />
      <Stack.Screen name="recording-detail" options={{ animation: 'none', presentation: 'transparentModal' }} />
      <Stack.Screen name="split-bill-detail" options={{ animation: 'none', presentation: 'transparentModal' }} />
      <Stack.Screen name="account-detail" options={{ animation: 'none', presentation: 'transparentModal' }} />
      <Stack.Screen name="receipt-detail" options={{ animation: 'none', presentation: 'transparentModal' }} />
      <Stack.Screen name="loans" options={{ animation: 'none', presentation: 'transparentModal' }} />
      <Stack.Screen name="receivables" options={{ animation: 'none', presentation: 'transparentModal' }} />
      <Stack.Screen name="notifications" options={{ animation: 'none', presentation: 'transparentModal' }} />
      <Stack.Screen name="crop-qr" options={{ animation: 'fade', presentation: 'fullScreenModal', headerShown: false }} />
      <Stack.Screen name="capture-receipt" options={{ animation: 'none', presentation: 'transparentModal' }} />
    </Stack>
  );
}
