import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Fonts } from './theme';
import { useNav } from '../../src/lib/NavContext';

const NAV_ACCENT   = '#282C2A';
const NAV_INACTIVE = '#9CA3AF';
const BUBBLE_ACTIVE_BG = '#EEF2FB';

const MAIN_TABS = [
  { key: 'spaces',            label: 'Spaces',        icon: 'grid' },
  { key: 'accounts',          label: 'Accounts',      icon: 'wallet-outline' },
  { key: 'dashboard',         label: 'Dashboard',     icon: 'pulse-outline' },
  { key: 'notifications-tab', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'others',            label: 'Others',        icon: 'apps-outline' },
];

export default function MiniNavBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeTab, handleNavPress, unreadCount, setPendingTab } = useNav();

  const isNotifTabActive = activeTab === 'notifications-page';

  const onTabPress = (key: string) => {
    setPendingTab(key);
    router.back();
  };

  return (
    <View style={[s.bar, { paddingBottom: insets.bottom || 8 }]}>
      {MAIN_TABS.map(tab => {
        const isActive = tab.key === 'notifications-tab' ? isNotifTabActive : activeTab === tab.key;
        const showBadge = tab.key === 'notifications-tab' && unreadCount > 0;
        return (
          <TouchableOpacity
            key={tab.key}
            style={s.item}
            onPress={() => onTabPress(tab.key)}
            activeOpacity={0.7}
          >
            <View style={s.iconWrap}>
              <Ionicons name={tab.icon as any} size={22} color={isActive ? NAV_ACCENT : NAV_INACTIVE} />
              {showBadge && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
                </View>
              )}
            </View>
            <Text style={[s.label, isActive && s.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar:         { flexDirection: 'row', backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border, height: 64, paddingTop: 8 },
  item:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconWrap:    { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  label:       { fontFamily: 'ChillaxRegular', fontSize: 10, color: NAV_INACTIVE, letterSpacing: 0.4 },
  labelActive: { fontFamily: 'ChillaxMedium', fontSize: 10, color: NAV_ACCENT },
  badge:       { position: 'absolute', top: -2, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#ed6a6a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText:   { fontFamily: 'ChillaxMedium', fontSize: 9, color: '#fff', lineHeight: 14 },
});
