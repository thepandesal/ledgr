import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppFont } from '@/src/lib/fonts';
import { useNav } from '@/src/lib/NavContext';

const TABS = [
  { key: 'home',              label: 'Home',          icon: 'home-outline' },
  { key: 'profile',           label: 'Profile',       icon: 'person-outline' },
  { key: 'bill-split',        label: 'Split Bill',    icon: 'people-outline' },
  { key: 'notifications-tab', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'others',            label: 'Others',        icon: 'apps-outline' },
];

const NAV_BG       = '#111111';
const NAV_ACTIVE   = '#ffffff';
const NAV_INACTIVE = 'rgba(255,255,255,0.45)';

export default function BottomNav() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeTab, handleNavPress, unreadCount } = useNav();

  const handlePress = (key: string) => {
    if (router.canDismiss()) {
      handleNavPress(key);
      router.dismissAll();
    } else {
      handleNavPress(key);
    }
  };

  return (
    <View style={s.wrap}>
      <View style={[s.pill, { paddingBottom: insets.bottom || 10 }]}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const badge = tab.key === 'notifications-tab' ? unreadCount : 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.item}
              onPress={() => handlePress(tab.key)}
              activeOpacity={0.7}
            >
              <View style={s.iconWrap}>
                <Ionicons
                  name={tab.icon as any}
                  size={22}
                  color={isActive ? NAV_ACTIVE : NAV_INACTIVE}
                />
                {badge > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{badge > 9 ? '9+' : String(badge)}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.label, isActive && s.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: NAV_BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: AppFont.regular,
    fontSize: 10,
    color: NAV_INACTIVE,
    letterSpacing: 0.3,
  },
  labelActive: {
    fontFamily: AppFont.semiBold,
    color: NAV_ACTIVE,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -6,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#ed6a6a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: AppFont.semiBold,
    fontSize: 8,
    color: '#fff',
    lineHeight: 13,
  },
});
