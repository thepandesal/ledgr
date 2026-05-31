import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, router } from 'expo-router';
import { Colors, Fonts } from '../../constants/theme';

const TABS = [
  { label: 'Spaces', icon: '🏠', href: '/(tabs)/spaces' },
  { label: 'Accounts', icon: '🏦', href: '/(tabs)/accounts' },
  { label: 'Receipts', icon: '🧾', href: '/(tabs)/receipts' },
  { label: 'Notifications', icon: '🔔', href: '/(tabs)/notifications' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 10 }]}>
      {TABS.map((tab) => {
        const focused = pathname.startsWith(tab.href);
        return (
          <Pressable
            key={tab.label}
            style={styles.tab}
            onPress={() => !focused && router.navigate(tab.href)}
          >
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tab: { flex: 1, alignItems: 'center' },
  icon: { fontSize: 22 },
  label: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  labelActive: { color: Colors.primary },
});
