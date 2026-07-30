import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useState, useRef } from 'react';
import { AppFont } from '@/src/lib/fonts';
import { useNav } from '@/src/lib/NavContext';
import NavIcon from './NavIcons';

const TABS = [
  { key: 'home',              label: 'Home',          icon: 'home-outline' },
  { key: 'accounts',           label: 'Accounts',      icon: 'wallet-outline' },
  { key: 'add',               label: '',               icon: 'add' },
  { key: 'notifications-tab', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'others',            label: 'Others',        icon: 'apps-outline' },
];

const NAV_BG       = '#fffffd';
const NAV_ACTIVE   = '#000000';
const NAV_INACTIVE = 'rgba(0,0,0,0.35)';

const ADD_SIZE = 56;

const MENU_ITEMS = [
  { label: 'Create a Record',     route: '/(app)/add-recording' },
  { label: 'Create Split Bill',   route: '/(app)/split-bill' },
  { label: 'Create a Folder',     route: null },
  { label: 'Add an Account',      route: null },
  { label: 'Add a Category',      route: null },
];

export default function BottomNav() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeTab, handleNavPress, unreadCount, switchTab } = useNav();
  const [showMenu, setShowMenu] = useState(false);
  const [subMenu, setSubMenu] = useState<string | null>(null);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handlePress = (key: string) => {
    if (router.canDismiss()) {
      handleNavPress(key);
      router.dismissAll();
    } else {
      handleNavPress(key);
    }
  };

  const openMenu = () => {
    setSubMenu(null);
    setShowMenu(true);
    Animated.timing(menuAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setShowMenu(false);
      setSubMenu(null);
    });
  };

  const handleMenuItem = (item: typeof MENU_ITEMS[0]) => {
    if (item.label === 'Create a Record') {
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        setSubMenu('record');
        Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start();
      });
      return;
    }
    closeMenu();
    if (item.route) {
      router.push(item.route as any);
    } else if (item.label === 'Add an Account') {
      switchTab('accounts');
    } else if (item.label === 'Add a Category') {
      switchTab('categories');
    } else if (item.label === 'Create a Folder') {
      switchTab('home');
    }
  };

  const handleAddPress = () => {
    if (showMenu) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  return (
    <View style={s.wrap}>


      {/* Menu modal — just above the nav */}
      {showMenu && (
        <>
          <TouchableOpacity style={s.overlay} onPress={closeMenu} activeOpacity={1} />
          <Animated.View
            style={[
              s.menuWrap,
              {
                opacity: menuAnim,
                transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                bottom: 110 + (insets.bottom || 10),
              },
            ]}
          >
            <BlurView intensity={80} tint="light" style={s.menuBlur}>
              <Animated.View style={[s.menuContent, { opacity: fadeAnim }]}>
                {subMenu === 'record' ? (
                  <View style={s.menuGrid}>
                    <TouchableOpacity style={s.menuPill} onPress={() => { closeMenu(); router.push({ pathname: '/(app)/add-recording', params: { type: 'income' } } as any); }} activeOpacity={0.8}>
                      <Text style={s.menuPillText}>Money In</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.menuPill} onPress={() => { closeMenu(); router.push({ pathname: '/(app)/add-recording', params: { type: 'expense' } } as any); }} activeOpacity={0.8}>
                      <Text style={s.menuPillText}>Money Out</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.menuPill, s.menuPillLast]} onPress={() => { Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => { setSubMenu(null); Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }).start(); }); }} activeOpacity={0.8}>
                      <Text style={s.menuPillText}>Back</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.menuGrid}>
                    {MENU_ITEMS.map((item, i) => (
                      <TouchableOpacity
                        key={item.label}
                        style={[s.menuPill, i === MENU_ITEMS.length - 1 && s.menuPillLast]}
                        onPress={() => handleMenuItem(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.menuPillText}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Animated.View>
            </BlurView>
          </Animated.View>
        </>
      )}

      <View style={[s.pill, { paddingBottom: insets.bottom || 10 }]}>
        <View style={s.basin} />

        {TABS.map(tab => {
          if (tab.key === 'add') return <View key={tab.key} style={s.spacer} />;

          const isActive = activeTab === tab.key;
          const iconName = tab.key === 'notifications-tab' ? 'notifications' : tab.key;
          const badge = tab.key === 'notifications-tab' ? unreadCount : 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.item}
              onPress={() => handlePress(tab.key)}
              activeOpacity={0.7}
            >
              <View style={s.iconWrap}>
                <NavIcon name={iconName} size={22} color={isActive ? NAV_ACTIVE : NAV_INACTIVE} />
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

        {/* Floating add button */}
        <TouchableOpacity style={s.addBtn} onPress={handleAddPress} activeOpacity={0.8}>
          <NavIcon name="add" size={28} color="#fff" />
        </TouchableOpacity>
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
  overlay: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: 0,
    zIndex: 998,
  },
  menuWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  menuBlur: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    overflow: 'hidden',
  },
  menuContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  menuPill: {
    backgroundColor: '#3a3a34',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    width: '48%',
    flexGrow: 1,
  },
  menuPillLast: {
    flexGrow: 0,
    alignSelf: 'center',
  },
  menuPillText: {
    fontFamily: 'InclusiveSans-Medium',
    fontSize: 12,
    color: '#ffffff',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: NAV_BG,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
  basin: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    backgroundColor: 'transparent',
    zIndex: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  spacer: {
    flex: 1,
  },
  addBtn: {
    position: 'absolute',
    bottom: 34,
    left: '50%',
    marginLeft: -(ADD_SIZE / 2),
    width: ADD_SIZE,
    height: ADD_SIZE,
    borderRadius: ADD_SIZE / 2,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
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
