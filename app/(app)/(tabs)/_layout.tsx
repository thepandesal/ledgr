import { View, TouchableOpacity, Text, StyleSheet, Animated, Dimensions, Platform, Alert, SafeAreaView, ScrollView } from 'react-native';
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
import { supabase } from '../../../src/lib/supabase';
import { useUser } from '../../../src/hooks/useUser';

const { width } = Dimensions.get('window');

const MAIN_TABS = [
  { key: 'spaces',        label: 'Spaces',     icon: 'grid' },
  { key: 'accounts',      label: 'Accounts',   icon: 'wallet-outline' },
  { key: 'dashboard',     label: 'Dashboard',  icon: 'pulse-outline' },
  { key: 'notifications', label: 'Profile',   icon: 'person-outline' },
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

function ProfileScreen() {
  const router = useRouter();
  const { user, userName } = useUser();
  const email = user?.email ?? '';
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        console.log('[logout] button pressed');
        try {
          const { error } = await supabase.auth.signOut();
          console.log('[logout] signOut result:', error ? error.message : 'success');
        } catch (e) {
          console.log('[logout] signOut threw:', e);
        }
        console.log('[logout] navigating to /');
        router.replace('/' as any);
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await supabase.auth.signOut();
          } catch (e) {}
          router.replace('/' as any);
        }},
      ]
    );
  };

  return (
    <SafeAreaView style={p.container}>
      <ScrollView contentContainerStyle={p.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <View style={p.avatarSection}>
          <View style={p.avatar}>
            <Text style={p.avatarText}>{userName ? userName.charAt(0).toUpperCase() : '?'}</Text>
          </View>
          <Text style={p.name}>{userName || 'My Account'}</Text>
          <Text style={p.email}>{email}</Text>
        </View>

        {/* Info card */}
        <View style={p.card}>
          <View style={p.row}>
            <View style={p.rowIcon}><Ionicons name="person-outline" size={16} color='#4ECDC4' /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Full Name</Text>
              <Text style={p.rowValue}>{userName || '—'}</Text>
            </View>
          </View>
          <View style={p.divider} />
          <View style={p.row}>
            <View style={p.rowIcon}><Ionicons name="mail-outline" size={16} color='#4ECDC4' /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Email</Text>
              <Text style={p.rowValue}>{email || '—'}</Text>
            </View>
          </View>
          <View style={p.divider} />
          <View style={p.row}>
            <View style={p.rowIcon}><Ionicons name="calendar-outline" size={16} color='#4ECDC4' /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Member Since</Text>
              <Text style={p.rowValue}>{joinedDate || '—'}</Text>
            </View>
          </View>
          <View style={p.divider} />
          <View style={p.row}>
            <View style={p.rowIcon}><Ionicons name="shield-checkmark-outline" size={16} color='#4ECDC4' /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Account Status</Text>
              <Text style={[p.rowValue, { color: '#4ECDC4' }]}>Active</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity style={p.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color='#1A1A2E' />
          <Text style={p.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={p.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={18} color='#FFAB91' />
          <Text style={p.deleteText}>Delete Account</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
const MemoProfile = memo(ProfileScreen);

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
      Animated.spring(bubbleAnim,  { toValue: 1, useNativeDriver: false, tension: 70, friction: 10 }),
      Animated.spring(bubbleScale, { toValue: 1, useNativeDriver: false, tension: 70, friction: 10 }),
    ]).start();
  };

  const closeOthers = () => {
    Animated.parallel([
      Animated.timing(bubbleAnim,  { toValue: 0, duration: 180, useNativeDriver: false }),
      Animated.timing(bubbleScale, { toValue: 0.92, duration: 180, useNativeDriver: false }),
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

        {/* Profile screen */}
        <Animated.View
          style={[s.screen, { transform: [{ translateX: notifAnim }], zIndex: activeTab === 'notifications' ? 10 : 0 }]}
          pointerEvents={activeTab === 'notifications' ? 'auto' : 'none'}
        >
          <MemoProfile />
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

      {/* Bottom nav bar */}
      <View style={s.navBar}>
        {MAIN_TABS.map(tab => {
          const isActive = tab.key === 'others' ? isOthersActive : activeTab === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={s.navItem} onPress={() => handleNavPress(tab.key)} activeOpacity={0.7}>
              <View style={[s.navIconWrap, isActive && s.navIconWrapActive]}>
                <Ionicons name={tab.icon as any} size={20} color={isActive ? '#FFFFFF' : '#9A9DB0'} />
              </View>
              <Text style={[s.navLabel, isActive && s.navLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
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

  navBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#ECECEC',
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 8,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  navIconWrapActive: { backgroundColor: '#4ECDC4' },
  navLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, color: '#9A9DB0', letterSpacing: 0.2 },
  navLabelActive: { fontFamily: 'PlusJakartaSans_600SemiBold', color: '#4ECDC4' },

  // Bubble
  bubbleWrap: {
    position: 'absolute',
    bottom: 80,
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
  bubbleItemLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: Colors.text },
  bubbleItemLabelActive: { color: '#1A1A1A' },
});

const p = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  scroll:    { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 60, gap: 16 },

  avatarSection: { alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#4ECDC4',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  avatarText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 32, color: '#FFFFFF' },
  name:  { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#1A1A2E', letterSpacing: -0.5 },
  email: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#9A9DB0' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    borderWidth: 1, borderColor: '#ECECEC',
    paddingHorizontal: 16,
  },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E0F5F4', justifyContent: 'center', alignItems: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: '#9A9DB0', letterSpacing: 0.3 },
  rowValue: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#1A1A2E' },
  divider:  { height: 1, backgroundColor: '#ECECEC', marginLeft: 46 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#ECECEC',
    paddingVertical: 16,
  },
  logoutText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#1A1A2E' },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFF5F2', borderRadius: 16,
    borderWidth: 1, borderColor: '#FFAB91',
    paddingVertical: 16,
  },
  deleteText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: '#FFAB91' },
});

