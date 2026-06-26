import { View, TouchableOpacity, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, memo } from 'react';
import { BlurView } from 'expo-blur';
import SpacesScreen from './spaces';
import AccountsScreen from './accounts';
import BillSplitScreen from './bill-split';
import ReceiptsScreen from './receipts';
import CategoriesScreen from './categories';
import DashboardScreen from './dashboard';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const MAIN_TABS = [
  { key: 'spaces',        label: 'Spaces',     icon: 'grid' },
  { key: 'accounts',      label: 'Accounts',   icon: 'wallet-outline' },
  { key: 'dashboard',     label: 'Dashboard',  icon: 'pulse-outline' },
  { key: 'notifications', label: 'Notifs',     icon: 'notifications-outline' },
  { key: 'others',        label: 'Others',     icon: 'apps-outline' },
];

const OTHERS_ITEMS = [
  { key: 'receipts',    label: 'Receipts',     icon: 'receipt-outline',    route: null },
  { key: 'bill-split',  label: 'Bill Split',   icon: 'people-outline',     route: null },
  { key: 'categories',  label: 'Categories',   icon: 'pricetag-outline',   route: null },
  { key: 'loans',       label: 'Loans',        icon: 'cash-outline',       route: '/(app)/loans' },
  { key: 'receivables', label: 'Receivables',  icon: 'arrow-undo-outline', route: '/(app)/receivables' },
];

const SLIDE_KEYS = ['spaces', 'accounts', 'dashboard', 'categories', 'receipts', 'bill-split'];

const MemoSpaces     = memo(SpacesScreen);
const MemoAccounts   = memo(AccountsScreen);
const MemoBillSplit  = memo(BillSplitScreen);
const MemoReceipts   = memo(ReceiptsScreen);
const MemoCategories = memo(CategoriesScreen);
const MemoDashboard  = memo(DashboardScreen);

const SCREENS: Record<string, React.ReactNode> = {
  spaces:       <MemoSpaces />,
  accounts:     <MemoAccounts />,
  dashboard:    <MemoDashboard />,
  categories:   <MemoCategories />,
  'bill-split': <MemoBillSplit />,
  receipts:     <MemoReceipts />,
};

function NotificationsScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', gap: 12 }}>
      <Text style={{ fontSize: 40 }}>🍳</Text>
      <Text style={{ fontFamily: 'ChillaxMedium', fontSize: 18, color: Colors.text }}>notifications</Text>
      <Text style={{ fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.muted }}>we're cooking something</Text>
    </View>
  );
}
const MemoNotifications = memo(NotificationsScreen);

export default function TabsLayout() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('spaces');
  const [othersOpen, setOthersOpen] = useState(false);
  const activeTabRef = useRef('spaces');

  const bubbleAnim  = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(0.92)).current;

  const slideAnims = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(SLIDE_KEYS.map((k, i) => [k, new Animated.Value(i === 0 ? 0 : width)]))
  ).current;

  // Notification slide anim
  const notifAnim = useRef(new Animated.Value(width)).current;

  const switchTab = (key: string) => {
    if (key === activeTabRef.current) return;
    const prev = activeTabRef.current;
    activeTabRef.current = key;
    setActiveTab(key);

    const incoming = key === 'notifications' ? notifAnim : slideAnims[key];
    const outgoing = prev === 'notifications' ? notifAnim : slideAnims[prev];

    incoming?.setValue(width);
    Animated.parallel([
      Animated.timing(incoming, { toValue: 0, duration: 260, useNativeDriver: false }),
      Animated.timing(outgoing, { toValue: -width, duration: 260, useNativeDriver: false }),
    ]).start(() => { outgoing?.setValue(width); });
  };

  const openOthers = () => {
    setOthersOpen(true);
    Animated.parallel([
      Animated.spring(bubbleAnim,  { toValue: 1, useNativeDriver: true, tension: 70, friction: 10 }),
      Animated.spring(bubbleScale, { toValue: 1, useNativeDriver: true, tension: 70, friction: 10 }),
    ]).start();
  };

  const closeOthers = () => {
    Animated.parallel([
      Animated.timing(bubbleAnim,  { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(bubbleScale, { toValue: 0.92, duration: 180, useNativeDriver: true }),
    ]).start(() => setOthersOpen(false));
  };

  const handleNavPress = (key: string) => {
    if (key === 'others') { othersOpen ? closeOthers() : openOthers(); return; }
    if (othersOpen) closeOthers();
    switchTab(key);
  };

  const handleOthersItem = (item: typeof OTHERS_ITEMS[0]) => {
    closeOthers();
    if (item.route) {
      router.push(item.route as any);
    } else {
      switchTab(item.key);
    }
  };

  const isOthersActive = OTHERS_ITEMS.some(i => i.key === activeTab) || othersOpen;

  return (
    <View style={s.container}>
      <View style={s.content}>
        {/* Slideable screens */}
        {SLIDE_KEYS.map(key => (
          <Animated.View
            key={key}
            style={[s.screen, { transform: [{ translateX: slideAnims[key] }], zIndex: activeTab === key ? 10 : 0 }]}
            pointerEvents={activeTab === key ? 'auto' : 'none'}
          >
            {SCREENS[key]}
          </Animated.View>
        ))}

        {/* Notifications — animated like other tabs */}
        <Animated.View
          style={[s.screen, { transform: [{ translateX: notifAnim }], zIndex: activeTab === 'notifications' ? 10 : 0 }]}
          pointerEvents={activeTab === 'notifications' ? 'auto' : 'none'}
        >
          <MemoNotifications />
        </Animated.View>
      </View>

      {/* Others bubble */}
      {othersOpen && (
        <>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeOthers} activeOpacity={1} />
          <Animated.View style={[s.bubbleWrap, {
            opacity: bubbleAnim,
            transform: [
              { scale: bubbleScale },
              { translateY: bubbleAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            ],
          }]}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={60} tint="light" style={s.bubbleInner}>
                <BubbleContent items={OTHERS_ITEMS} activeTab={activeTab} onPress={handleOthersItem} />
              </BlurView>
            ) : (
              <View style={[s.bubbleInner, s.bubbleInnerAndroid]}>
                <BubbleContent items={OTHERS_ITEMS} activeTab={activeTab} onPress={handleOthersItem} />
              </View>
            )}
          </Animated.View>
        </>
      )}

      {/* Floating nav pill */}
      <View style={s.navFloatWrap} pointerEvents="box-none">
        <View style={s.navPill}>
          {MAIN_TABS.map(tab => {
            const isActive = tab.key === 'others' ? isOthersActive : activeTab === tab.key;
            return (
              <TouchableOpacity key={tab.key} style={s.navItem} onPress={() => handleNavPress(tab.key)} activeOpacity={0.7}>
                <View style={[s.navIconWrap, isActive && s.navIconWrapActive]}>
                  <Ionicons name={tab.icon as any} size={20} color={isActive ? '#FFFFFF' : '#9A9DB0'} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function BubbleContent({ items, activeTab, onPress }: {
  items: typeof OTHERS_ITEMS;
  activeTab: string;
  onPress: (item: typeof OTHERS_ITEMS[0]) => void;
}) {
  return (
    <>
      {items.map((item, i) => {
        const isActive = activeTab === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            style={[s.bubbleItem, i < items.length - 1 && s.bubbleItemBorder]}
            onPress={() => onPress(item)}
            activeOpacity={0.7}
          >
            <View style={[s.bubbleIconWrap, isActive && s.bubbleIconWrapActive]}>
              <Ionicons name={item.icon as any} size={16} color={isActive ? Colors.white : Colors.text} />
            </View>
            <Text style={[s.bubbleItemLabel, isActive && s.bubbleItemLabelActive]}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={12} color={Colors.faint} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { flex: 1, position: 'relative' },
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F7F8FA' },

  navFloatWrap: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  navPill: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  navItem: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  navIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  navIconWrapActive: {
    backgroundColor: '#4ECDC4',
  },

  // Bubble
  bubbleWrap: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 100,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  bubbleInner: {
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  bubbleInnerAndroid: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  bubbleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  bubbleItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  bubbleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleIconWrapActive: { backgroundColor: '#D1E6E0' },
  bubbleItemLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.text },
  bubbleItemLabelActive: { color: '#1A1A1A' },
});
