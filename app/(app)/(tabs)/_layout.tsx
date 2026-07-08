import { View, TouchableOpacity, Text, StyleSheet, Animated, Dimensions, Platform, SafeAreaView, ScrollView, useWindowDimensions, Clipboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, memo, useCallback, useEffect }from 'react';
import { BlurView } from 'expo-blur';
import SpacesScreen from './spaces';
import AccountsScreen from './accounts';
import BillSplitScreen from './bill-split';
import ReceiptsScreen from './receipts';
import ContactsScreen from './contacts';
import CategoriesScreen from './categories';
import DashboardScreen from './dashboard';
import NotificationsScreen from '../notifications';
import RemindersScreen from './reminders';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { useUser } from '../../../src/hooks/useUser';

export { BlurContext } from '../../../src/lib/BlurContext';
import { BlurContext } from '../../../src/lib/BlurContext';

// ── Brand tokens ─────────────────────────────────────────────────────────────
const HEADER_BG        = '#1A1A1A'; // header background
const HEADER_TEXT      = '#B6E1DE'; // teal text on dark header bg
const HEADER_TEXT_DIM  = '#B6E1DE99';
const HEADER_BTN_BG    = '#B6E1DE22';
const NAV_ACCENT       = '#282C2A'; // active nav icon/label
const NAV_INACTIVE     = '#9CA3AF'; // inactive nav icon
const BUBBLE_ACTIVE_BG = '#EEF2FB'; // bubble active item bg

const { width } = Dimensions.get('window');

const MAIN_TABS = [
  { key: 'spaces',        label: 'Spaces',     icon: 'grid' },
  { key: 'accounts',      label: 'Accounts',   icon: 'wallet-outline' },
  { key: 'dashboard',     label: 'Dashboard',  icon: 'pulse-outline' },
  { key: 'notifications', label: 'Profile',   icon: 'person-outline' },
  { key: 'others',        label: 'Others',     icon: 'apps-outline' },
];

const TAB_META: Record<string, { title: string; subtitle: string }> = {
  spaces:        { title: 'spaces',     subtitle: 'track your budgets & savings'    },
  accounts:      { title: 'accounts',   subtitle: 'your saved payment methods'      },
  dashboard:     { title: 'activities', subtitle: 'all your recordings in one place' },
  notifications: { title: 'profile',   subtitle: 'your account details'            },
  receipts:      { title: 'receipts',   subtitle: 'your paper trail, digitized'     },
  'bill-split':  { title: 'split bill',  subtitle: 'split expenses with friends'    },
  contacts:      { title: 'contacts',   subtitle: 'your friends & contacts'         },
  'notifications-page': { title: 'notifications', subtitle: 'your alerts'                      },
  categories:    { title: 'categories', subtitle: 'organize your recordings'        },
  loans:         { title: 'loans',      subtitle: 'payables & borrowings'           },
  receivables:   { title: 'receivables', subtitle: 'money owed to you'             },
  reminders:     { title: 'reminders',  subtitle: 'your scheduled recordings'      },
};

const OTHERS_ITEMS = [
  { key: 'receipts',           label: 'Receipts',       icon: 'receipt-outline',       route: null },
  { key: 'bill-split',         label: 'Split Bill',     icon: 'people-outline',        route: null },
  { key: 'contacts',           label: 'Contacts',       icon: 'people-circle-outline', route: null },
  { key: 'categories',         label: 'Categories',     icon: 'pricetag-outline',      route: null },
  { key: 'reminders',          label: 'Reminders',      icon: 'alarm-outline',         route: null },
  { key: 'loans',              label: 'Loans',          icon: 'cash-outline',          route: '/(app)/loans' },
  { key: 'receivables',        label: 'Receivables',    icon: 'arrow-undo-outline',    route: '/(app)/receivables' },
  { key: 'notifications-page', label: 'Notifications',  icon: 'notifications-outline', route: null },
];

const SLIDE_KEYS = ['spaces', 'accounts', 'dashboard', 'categories', 'receipts', 'bill-split', 'contacts', 'notifications-page', 'reminders'];

const PROFILE_BG       = '#F7F8FA';
const PROFILE_TITLE    = '#1A1A2E';
const PROFILE_MUTED    = '#9A9DB0';
const PROFILE_BORDER   = '#ECECEC';
const PROFILE_DANGER   = '#FFAB91';
const PROFILE_DANGEBG  = '#FFF5F2';
const MemoSpaces     = memo(SpacesScreen);
const MemoAccounts   = memo(AccountsScreen);
const MemoBillSplit  = memo(BillSplitScreen);
const MemoReceipts   = memo(ReceiptsScreen);
const MemoCategories = memo(CategoriesScreen);
const MemoDashboard  = memo(DashboardScreen);
const MemoContacts       = memo(ContactsScreen);
const MemoNotifications  = memo(NotificationsScreen);
const MemoReminders      = memo(RemindersScreen);

const SCREENS: Record<string, React.ReactNode> = {
  spaces:               <MemoSpaces />,
  accounts:             <MemoAccounts />,
  dashboard:            <MemoDashboard />,
  categories:           <MemoCategories />,
  'bill-split':         <MemoBillSplit />,
  receipts:             <MemoReceipts />,
  contacts:             <MemoContacts />,
  'notifications-page': <MemoNotifications />,
  reminders:            <MemoReminders />,
};

function ProfileScreen() {
  const router = useRouter();
  const { user, userName, profileCode } = useUser();
  const [codeCopied, setCodeCopied] = useState(false);
  const email = user?.email ?? '';

  const copyCode = () => {
    if (!profileCode) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(profileCode).then(() => { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); });
    } else {
      Clipboard.setString(profileCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  const handleLogout = async () => {
    console.log('[logout] button pressed');
    try {
      const { error } = await supabase.auth.signOut();
      console.log('[logout] signOut result:', error ? error.message : 'success');
    } catch (e) {
      console.log('[logout] signOut threw:', e);
    }
    console.log('[logout] navigating to /');
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    } else {
      router.replace('/' as any);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    router.replace('/' as any);
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
            <View style={p.rowIcon}><Ionicons name="person-outline" size={16} color={Colors.muted} /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Full Name</Text>
              <Text style={p.rowValue}>{userName || '—'}</Text>
            </View>
          </View>
          <View style={p.divider} />
          <View style={p.row}>
            <View style={p.rowIcon}><Ionicons name="mail-outline" size={16} color={Colors.muted} /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Email</Text>
              <Text style={p.rowValue}>{email || '—'}</Text>
            </View>
          </View>
          <View style={p.divider} />
          <View style={p.row}>
            <View style={p.rowIcon}><Ionicons name="calendar-outline" size={16} color={Colors.muted} /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Member Since</Text>
              <Text style={p.rowValue}>{joinedDate || '—'}</Text>
            </View>
          </View>
          <View style={p.divider} />
          <View style={p.row}>
            <View style={p.rowIcon}><Ionicons name="shield-checkmark-outline" size={16} color={Colors.muted} /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Account Status</Text>
              <Text style={[p.rowValue, { color: HEADER_BG }]}>Active</Text>
            </View>
          </View>
          <View style={p.divider} />
          <TouchableOpacity style={p.row} onPress={copyCode} activeOpacity={0.7}>
            <View style={p.rowIcon}><Ionicons name="qr-code-outline" size={16} color={Colors.muted} /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Profile Code</Text>
              <Text style={[p.rowValue, { fontFamily: Fonts.monoBold, letterSpacing: 1.5 }]}>{profileCode || '—'}</Text>
            </View>
            <Ionicons name={codeCopied ? 'checkmark-circle' : 'copy-outline'} size={16} color={codeCopied ? HEADER_BG : Colors.faint} />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <TouchableOpacity style={p.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={Colors.muted} />
          <Text style={p.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={p.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={18} color={PROFILE_DANGER} />
          <Text style={p.deleteText}>Delete Account</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
const MemoProfile = ProfileScreen;

export default function TabsLayout() {
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState('spaces');
  const [othersOpen, setOthersOpen] = useState(false);
  const activeTabRef = useRef('spaces');
  const titleAnim = useRef(new Animated.Value(1)).current;
  const blurAnim   = useRef(new Animated.Value(0)).current;
  const [blurActive, setBlurActive] = useState(false);
  const addHandlers = useRef<Record<string, () => void>>({});
  const [, forceUpdate] = useState(0);

  const setBlur = (v: boolean) => {
    setBlurActive(v);
    Animated.timing(blurAnim, { toValue: v ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  };

  const registerAdd = (tab: string, fn: () => void) => {
    addHandlers.current[tab] = fn;
    forceUpdate(n => n + 1);
  };

  const unregisterAdd = (tab: string) => {
    delete addHandlers.current[tab];
    forceUpdate(n => n + 1);
  };

  const bubbleAnim  = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(0.92)).current;

  // ── Unread notification badge ──────────────────────────────────────────────────
  const { userId } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!userId) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'new');
    setUnreadCount(count ?? 0);
  }, [userId]);

  useEffect(() => {
    fetchUnread();
    if (!userId) return;
    // Realtime subscription — badge updates live on new notification
    const channel = supabase
      .channel('notifications-badge')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchUnread]);

  const slideAnims = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(SLIDE_KEYS.map((k, i) => [k, new Animated.Value(i === 0 ? 0 : width)]))
  ).current;

  // Notification slide anim
  const notifAnim = useRef(new Animated.Value(width)).current;

  const switchTab = useCallback((key: string) => {
    if (key === activeTabRef.current) return;
    const prev = activeTabRef.current;
    activeTabRef.current = key;

    const incoming = key === 'notifications' ? notifAnim : slideAnims[key];
    const outgoing = prev === 'notifications' ? notifAnim : slideAnims[prev];
    incoming?.setValue(width);

    // Start animations immediately on native thread
    Animated.parallel([
      Animated.timing(incoming, { toValue: 0, duration: 320, useNativeDriver: true }),
      Animated.timing(outgoing, { toValue: -width, duration: 320, useNativeDriver: true }),
    ]).start(() => { outgoing?.setValue(width); });

    Animated.timing(titleAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setActiveTab(key);
      Animated.timing(titleAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    });
  }, []);

  const openOthers = useCallback(() => {
    setOthersOpen(true);
    Animated.parallel([
      Animated.spring(bubbleAnim,  { toValue: 1, useNativeDriver: true, tension: 70, friction: 10 }),
      Animated.spring(bubbleScale, { toValue: 1, useNativeDriver: true, tension: 70, friction: 10 }),
    ]).start();
  }, []);

  const closeOthers = useCallback(() => {
    Animated.parallel([
      Animated.timing(bubbleAnim,  { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(bubbleScale, { toValue: 0.92, duration: 180, useNativeDriver: true }),
    ]).start(() => setOthersOpen(false));
  }, []);

  const handleNavPress = (key: string) => {
    if (key === 'others') { othersOpen ? closeOthers() : openOthers(); return; }
    if (othersOpen) closeOthers();
    switchTab(key);
  };

  const handleOthersItem = (item: typeof OTHERS_ITEMS[0]) => {
    closeOthers();
    if (item.key === 'notifications-page') setUnreadCount(0);
    if (item.route) {
      router.push(item.route as any);
    } else {
      switchTab(item.key);
    }
  };

  const isOthersActive = OTHERS_ITEMS.some(i => i.key === activeTab) || othersOpen;

  return (
    <BlurContext.Provider value={{ setBlur, registerAdd, unregisterAdd, activeTab, __hasProvider: true }}>
    <View style={s.container}>

      {/* ── Shared flat header ── */}
      <View style={s.waveBg}>
        <View style={s.appLabel}>
          <Text style={s.appLabelText}>L</Text>
        </View>
        <Animated.View style={[s.waveTitleRow, { opacity: titleAnim }]}>
          <Text style={s.pageTitle}>{TAB_META[activeTab]?.title ?? activeTab}</Text>
        </Animated.View>
        <View style={{ width: 36 }} />
      </View>

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
          const showBadge = tab.key === 'others' && unreadCount > 0;
          return (
            <TouchableOpacity key={tab.key} style={s.navItem} onPress={() => handleNavPress(tab.key)} activeOpacity={0.7}>
              <View style={[s.navIconWrap, isActive && s.navIconWrapActive]}>
                <Ionicons name={tab.icon as any} size={22} color={isActive ? NAV_ACCENT : NAV_INACTIVE} />
                {showBadge && (
                  <View style={s.navBadge}>
                    <Text style={s.navBadgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.navLabel, isActive && s.navLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Global blur overlay (covers header + content) ── */}
      {blurActive && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: blurAnim, zIndex: 50, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.05)', pointerEvents: 'none' } as any]}
        />
      )}

    </View>
    </BlurContext.Provider>
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
              <Ionicons name={item.icon as any} size={16} color={isActive ? NAV_ACCENT : Colors.text} />
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
  container: { flex: 1, backgroundColor: Colors.white },
  content:   { flex: 1, position: 'relative' },
  screen:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.white },

  // ── Shared header
  waveBg:       { backgroundColor: HEADER_BG, paddingHorizontal: Spacing.page, paddingTop: 28, paddingBottom: 16, zIndex: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
  appLabel:     { width: 36, height: 36, borderRadius: 18, backgroundColor: '#B6E1DE22', alignItems: 'center', justifyContent: 'center' },
  appLabelText: { fontFamily: 'MuseoModerno_Black', fontSize: 18, color: HEADER_TEXT },
  pageTitle:    { flex: 1, fontFamily: 'CalSans', fontSize: 20, color: HEADER_TEXT, letterSpacing: -0.3, textAlign: 'center' },
  pageSubtitle: { display: 'none' as any },
  waveTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  wave:         { display: 'none' as any },
  addBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: HEADER_BTN_BG, alignItems: 'center', justifyContent: 'center' },

  navBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
    paddingHorizontal: 0,
  },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navIconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: {},
  navLabel:       { fontFamily: 'ChillaxRegular', fontSize: 10, color: NAV_INACTIVE, letterSpacing: 0.4 },
  navLabelActive: { fontFamily: 'ChillaxMedium',  fontSize: 10, color: NAV_ACCENT },
  navBadge: { position: 'absolute', top: -2, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#ed6a6a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  navBadgeText: { fontFamily: 'ChillaxMedium', fontSize: 9, color: '#fff', lineHeight: 14 },

  // Bubble
  bubbleWrap: {
    position: 'absolute', bottom: 72, left: 20, right: 20,
    borderRadius: Radius.xl, overflow: 'hidden', zIndex: 100,
    borderWidth: 1, borderColor: Colors.border,
  },
  bubbleInner:        { paddingVertical: 6, borderRadius: Radius.xl, overflow: 'hidden' },
  bubbleInnerAndroid: { backgroundColor: 'rgba(255,255,255,0.97)' },
  bubbleItem:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 20 },
  bubbleItemBorder:   { borderBottomWidth: 1, borderBottomColor: Colors.border },
  bubbleIconWrap:       { width: 32, height: 32, borderRadius: Radius.md, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  bubbleIconWrapActive: { backgroundColor: BUBBLE_ACTIVE_BG },
  bubbleItemLabel:       { fontFamily: 'ChillaxRegular', fontSize: 14, color: Colors.text },
  bubbleItemLabelActive: { fontFamily: 'ChillaxMedium',  fontSize: 14, color: NAV_ACCENT },
});

const p = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll:    { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60, gap: 12 },

  // ── Avatar
  avatarSection: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: HEADER_BG,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  avatarText: { fontFamily: 'MuseoModerno_Black', fontSize: 28, color: HEADER_TEXT },
  name:  { fontFamily: 'CalSans', fontSize: 22, color: Colors.text, letterSpacing: -0.3 },
  email: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },

  // ── Info rows (same style as accounts cards)
  card: {
    backgroundColor: Colors.white,
    borderRadius: 0,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, letterSpacing: 0.3, textTransform: 'uppercase' },
  rowValue: { fontFamily: 'ChillaxMedium', fontSize: 14, color: Colors.text },
  divider:  { height: 0 }, // kept for compat but unused

  // ── Action buttons
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, marginTop: 8,
  },
  logoutText: { fontFamily: 'ChillaxMedium', fontSize: 14, color: Colors.text },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PROFILE_DANGEBG, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: PROFILE_DANGER,
    paddingVertical: 14,
  },
  deleteText: { fontFamily: 'ChillaxMedium', fontSize: 14, color: PROFILE_DANGER },
});

