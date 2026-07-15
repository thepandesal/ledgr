/**
 * ScreenChrome.tsx
 * Shared header + bottom nav for standalone pushed screens (loans, receivables, …)
 * so they match the tab screens (spaces, dashboard) which get chrome from TabsLayout.
 */
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing } from './theme';

const HEADER_BG   = Colors.headerBg;
const HEADER_TEXT = '#B6E1DE';
const NAV_ACCENT   = '#282C2A';
const NAV_INACTIVE = '#9CA3AF';

const MAIN_TABS = [
  { key: 'spaces',            label: 'Spaces',        icon: 'grid' },
  { key: 'accounts',          label: 'Accounts',      icon: 'wallet-outline' },
  { key: 'dashboard',         label: 'Dashboard',     icon: 'pulse-outline' },
  { key: 'notifications-tab', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'others',            label: 'Others',        icon: 'apps-outline' },
] as const;

export default function ScreenChrome({
  title,
  children,
  headerRight,
}: {
  title: string;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goTab = (key: string) => {
    tabEvents.emit(key);
    router.back();
  };

  return (
    <View style={s.container}>
      {/* Shared dark header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={HEADER_TEXT} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{title}</Text>
        <View style={s.headerBtn}>{headerRight}</View>
      </View>

      <View style={s.content}>{children}</View>

      {/* Shared bottom nav */}
      <View style={[s.navBar, { paddingBottom: insets.bottom || 8 }]}>
        {MAIN_TABS.map(tab => (
          <TouchableOpacity key={tab.key} style={s.navItem} onPress={() => goTab(tab.key)} activeOpacity={0.7}>
            <View style={s.navIconWrap}>
              <Ionicons name={tab.icon as any} size={22} color={NAV_INACTIVE} />
            </View>
            <Text style={s.navLabel}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content:   { flex: 1 },

  header: { backgroundColor: HEADER_BG, paddingHorizontal: Spacing.page, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#333', zIndex: 10 },
  headerBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: '#B6E1DE22', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: 'CalSans', fontSize: 20, color: HEADER_TEXT, letterSpacing: -0.3, textAlign: 'center' },

  navBar: { flexDirection: 'row', backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border, height: 64, paddingTop: 8 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navIconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontFamily: 'ChillaxRegular', fontSize: 10, color: NAV_INACTIVE, letterSpacing: 0.4 },
});
