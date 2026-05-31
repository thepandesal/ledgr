import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Colors, Fonts } from '../../src/constants/theme';
import { BottomNav } from '../../src/components/ui';

function ProfileButton() {
  return (
    <Pressable style={styles.profileButton}>
      <Text style={styles.profileText}>U</Text>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: Fonts.header, fontSize: 20, color: Colors.text },
          headerRight: () => <ProfileButton />,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'ios',
        }}
      >
        <Stack.Screen name="spaces/index" options={{ title: 'Spaces' }} />
        <Stack.Screen name="spaces/workspace/[id]" options={{ title: 'Dashboard', headerShown: true }} />
        <Stack.Screen name="accounts/index" options={{ title: 'Accounts' }} />
        <Stack.Screen name="receipts/index" options={{ title: 'Receipts' }} />
        <Stack.Screen name="notifications/index" options={{ title: 'Notifications' }} />
      </Stack>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  profileButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontSize: 14 },
});
