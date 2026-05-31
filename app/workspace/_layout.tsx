import { Stack } from 'expo-router';
import { Colors, Fonts } from '../../src/constants/theme';

export default function WorkspaceLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { fontFamily: Fonts.bodySemiBold, fontSize: 17, color: Colors.text },
        headerTintColor: Colors.primary,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="recordings" options={{ title: 'Recordings' }} />
      <Stack.Screen name="splits" options={{ title: 'Bill Splits' }} />
      <Stack.Screen name="members" options={{ title: 'Members' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
