import { View, TouchableOpacity, Text, StyleSheet, Animated, Dimensions, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, memo } from 'react';
import SpacesScreen from './spaces';
import AccountsScreen from './accounts';
import BillSplitScreen from './bill-split';
import ReceiptsScreen from './receipts';
import CategoriesScreen from './categories';
import { Colors, Fonts } from '@/components/ui/theme';

const { width } = Dimensions.get('window');

const MAIN_TABS = [
  { key: 'spaces',     label: 'Spaces',     icon: 'grid' },
  { key: 'accounts',   label: 'Accounts',   icon: 'wallet-outline' },
  { key: 'categories', label: 'Categories', icon: 'pricetag-outline' },
  { key: 'notifications', label: 'Notifs',  icon: 'notifications-outline' },
  { key: 'others',     label: 'Others',     icon: 'apps-outline' },
];

const OTHERS_ITEMS = [
  { key: 'receipts',   label: 'Receipts',   icon: 'receipt-outline' },
  { key: 'bill-split', label: 'Bill Split', icon: 'people-outline' },
];

const ALL_SCREENS = ['spaces', 'accounts', 'categories', 'receipts', 'bill-split'];

const MemoSpaces     = memo(SpacesScreen);
const MemoAccounts   = memo(AccountsScreen);
const MemoBillSplit  = memo(BillSplitScreen);
const MemoReceipts   = memo(ReceiptsScreen);
const MemoCategories = memo(CategoriesScreen);

const SCREENS: Record<string, React.ReactNode> = {
  spaces:     <MemoSpaces />,
  accounts:   <MemoAccounts />,
  categories: <MemoCategories />,
  'bill-split': <MemoBillSplit />,
  receipts:   <MemoReceipts />,
};

// Notifications placeholder screen
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
  const [activeTab, setActiveTab] = useState('spaces');
  const [othersOpen, setOthersOpen] = useState(false);
  const activeTabRef = useRef('spaces');

  // Bubble animation
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(0.8)).current;

  const slideAnims = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(ALL_SCREENS.map((k, i) => [k, new Animated.Value(i === 0 ? 0 : width)]))
  ).current;

  const switchTab = (key: string) => {
    if (key === activeTabRef.current) return;
    const prev = activeTabRef.current;
    activeTabRef.current = key;
    slideAnims[key]?.setValue(width);
    setActiveTab(key);
    Animated.parallel([
      Animated.timing(slideAnims[key], { toValue: 0, duration: 260, useNativeDriver: false }),
      Animated.timing(slideAnims[prev], { toValue: -width, duration: 260, useNativeDriver: false }),
    ]).start(() => { slideAnims[prev]?.setValue(width); });
  };

  const openOthers = () => {
    setOthersOpen(true);
    Animated.parallel([
      Animated.spring(bubbleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.spring(bubbleScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
  };

  const closeOthers = () => {
    Animated.parallel([
      Animated.timing(bubbleAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(bubbleScale, { toValue: 0.8, duration: 180, useNativeDriver: true }),
    ]).start(() => setOthersOpen(false));
  };

  const handleNavPress = (key: string) => {
    if (key === 'others') {
      if (othersOpen) closeOthers();
      else openOthers();
      return;
    }
    if (othersOpen) closeOthers();
    if (key === 'notifications') {
      // Just show the notifications screen placeholder
      if (activeTabRef.current !== 'notifications') {
        const prev = activeTabRef.current;
        activeTabRef.current = 'notifications';
        setActiveTab('notifications');
        if (slideAnims[prev]) {
          Animated.timing(slideAnims[prev], { toValue: -width, duration: 260, useNativeDriver: false })
            .start(() => { slideAnims[prev]?.setValue(width); });
        }
      }
      return;
    }
    switchTab(key);
  };

  const handleOthersItem = (key: string) => {
    closeOthers();
    switchTab(key);
  };

  const isOthersItemActive = OTHERS_ITEMS.some(i => i.key === activeTab);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Main screens */}
        {ALL_SCREENS.map(key => (
          <Animated.View
            key={key}
            style={[styles.screen, { transform: [{ translateX: slideAnims[key] }], zIndex: activeTab === key ? 10 : 0 }]}
            pointerEvents={activeTab === key ? 'auto' : 'none'}
          >
            {SCREENS[key]}
          </Animated.View>
        ))}

        {/* Notifications screen */}
        {activeTab === 'notifications' && (
          <View style={[styles.screen, { zIndex: 10 }]}>
            <MemoNotifications />
          </View>
        )}
      </View>

      {/* Others bubble menu */}
      {othersOpen && (
        <>
          {/* Dismiss backdrop */}
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeOthers} activeOpacity={1} />

          <Animated.View style={[styles.bubbleMenu, {
            opacity: bubbleAnim,
            transform: [{ scale: bubbleScale }, { translateY: bubbleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          }]}>
            {OTHERS_ITEMS.map((item, i) => {
              const isActive = activeTab === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.bubbleItem, i < OTHERS_ITEMS.length - 1 && styles.bubbleItemBorder, isActive && styles.bubbleItemActive]}
                  onPress={() => handleOthersItem(item.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={item.icon as any} size={18} color={isActive ? Colors.cyan : Colors.faint} />
                  <Text style={[styles.bubbleItemLabel, isActive && styles.bubbleItemLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </>
      )}

      {/* Floating nav */}
      <SafeAreaView style={styles.navSafeArea}>
        <View style={styles.navGap} />
        <View style={styles.navPill}>
          {MAIN_TABS.map(tab => {
            const isActive = tab.key === 'others'
              ? isOthersItemActive || othersOpen
              : activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.navItem}
                onPress={() => handleNavPress(tab.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={tab.icon as any} size={20} color={isActive ? Colors.cyan : Colors.faint} />
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.navGap} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1, position: 'relative' },
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f5f5f5' },
  navSafeArea: { backgroundColor: '#ffffff' },
  navGap: { height: 20 },
  navPill: {
    flexDirection: 'row',
    backgroundColor: '#425252',
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { fontFamily: 'ChillaxRegular', fontSize: 9, color: Colors.faint },
  navLabelActive: { color: Colors.cyan, fontFamily: 'ChillaxMedium' },

  // Others bubble menu
  bubbleMenu: {
    position: 'absolute',
    bottom: 110,
    right: 24,
    backgroundColor: '#425252',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    minWidth: 140,
    zIndex: 100,
  },
  bubbleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bubbleItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  bubbleItemActive: {},
  bubbleItemLabel: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.faint },
  bubbleItemLabelActive: { color: Colors.cyan, fontFamily: 'ChillaxMedium' },
});
