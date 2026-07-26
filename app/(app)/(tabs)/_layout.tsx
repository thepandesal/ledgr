import { View, TouchableOpacity, Text, StyleSheet, Animated, Platform, SafeAreaView, ScrollView, useWindowDimensions, Clipboard, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, memo, useCallback, useEffect }from 'react';
import AnimatedIcon from '@/components/ui/AnimatedIcon';
import { BlurView } from 'expo-blur';
import GooeyLoader from '@/components/ui/GooeyLoader';
import HomeScreen from './home';
import AccountsScreen from './accounts';
import BillSplitScreen from './bill-split';
import ReceiptsScreen from './receipts';
import ContactsScreen from './contacts';
import CategoriesScreen from './categories';
import DashboardScreen from './dashboard';
import NotificationsScreen from '../notifications';
import RemindersScreen from './reminders';
import SpaceDetailScreen from '../space-detail';
import RecordingDetailScreen from '../recording-detail';
import SplitBillDetailScreen from '../split-bill-detail';
import CategoriesPanel from '../top-spending';
import RecordingsPanel from '../recordings-panel';
import SpacesPanel from '../spaces-panel';
import LoansPanel from '../loans-panel';
import PeoplePanel from '../people-panel';
import RemindersPanel from '../reminders-panel';
import ContactsPanel from '../contacts-panel';
import FriendsPanel from '../friends-panel';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import BottomNav from '@/components/ui/BottomNav';
import { AppFont } from '../../../src/lib/fonts';
import { DC } from '../../../src/lib/design';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { useUser } from '../../../src/hooks/useUser';
import TourTarget from '@/components/TourTarget';
import AppTourOverlay from '@/components/AppTourOverlay';
import { TourContext, APP_TOUR_STEPS } from '../../../src/lib/TourContext';
import { NavContext } from '../../../src/lib/NavContext';
import { consumePendingTabGlobal, useNav } from '../../../src/lib/NavContext';
import type { RefObject } from 'react';
import type { View as RNView } from 'react-native';

export { BlurContext } from '../../../src/lib/BlurContext';
import { BlurContext } from '../../../src/lib/BlurContext';

// ── Brand tokens ─────────────────────────────────────────────────────────────
const HEADER_BG        = Colors.headerBg;
const HEADER_TEXT      = '#B6E1DE'; // teal text on dark header bg
const HEADER_TEXT_DIM  = '#B6E1DE99';
const HEADER_BTN_BG    = '#B6E1DE22';
const NAV_ACCENT       = DC.navActive;
const NAV_INACTIVE     = DC.navInactive; // inactive nav icon
const BUBBLE_ACTIVE_BG = '#EEF2FB'; // bubble active item bg

const MAIN_TABS = [
  { key: 'home',                label: 'Home',          icon: 'home-outline' },
  { key: 'accounts',            label: 'Accounts',      icon: 'wallet-outline' },
  { key: 'bill-split',          label: 'Split Bill',    icon: 'people-outline' },
  { key: 'notifications-tab',   label: 'Notifications', icon: 'notifications-outline' },
  { key: 'others',              label: 'Others',        icon: 'apps-outline' },
];

const TAB_META: Record<string, { title: string; subtitle: string }> = {
  accounts:      { title: 'accounts',   subtitle: 'your saved payment methods'      },
  dashboard:     { title: 'activities', subtitle: 'all your recordings in one place' },
  receipts:      { title: 'receipts',   subtitle: 'your paper trail, digitized'     },
  'bill-split':  { title: 'split bill',  subtitle: 'split expenses with friends'    },
  contacts:      { title: 'contacts',   subtitle: 'your friends & contacts'         },
  'notifications-page': { title: 'notifications', subtitle: 'your alerts'                      },
  profile:              { title: 'profile',       subtitle: 'your account details'             },
  categories:    { title: 'categories', subtitle: 'organize your recordings'        },
  loans:         { title: 'loans',      subtitle: 'payables & borrowings'           },
  receivables:   { title: 'receivables', subtitle: 'money owed to you'             },
  reminders:     { title: 'reminders',  subtitle: 'your scheduled recordings'      },
};

const OTHERS_ITEMS = [
  { key: 'dashboard',   label: 'Dashboard',   icon: 'pulse-outline',         route: null },
  { key: 'receipts',    label: 'Receipts',    icon: 'receipt-outline',       route: null },
  { key: 'bill-split',  label: 'Split Bill',  icon: 'people-outline',        route: null },
  { key: 'contacts',    label: 'Contacts',    icon: 'people-circle-outline', route: null },
  { key: 'categories',  label: 'Categories',  icon: 'pricetag-outline',      route: null },
  { key: 'reminders',   label: 'Reminders',   icon: 'alarm-outline',         route: null },
  { key: 'loans',       label: 'Loans',       icon: 'cash-outline',          route: '/(app)/loans' },
  { key: 'receivables', label: 'Receivables', icon: 'arrow-undo-outline',    route: '/(app)/receivables' },
  { key: 'profile',     label: 'Profile',     icon: 'person-outline',        route: null },
];

const SLIDE_KEYS = ['home', 'accounts', 'dashboard', 'categories', 'receipts', 'bill-split', 'contacts', 'notifications-page', 'reminders', 'profile'];

const PROFILE_DANGER   = '#FFAB91';
const PROFILE_DANGEBG  = '#FFF5F2';
const MemoHome       = memo(HomeScreen);
const MemoAccounts   = memo(AccountsScreen);
const MemoBillSplit  = memo(BillSplitScreen);
const MemoReceipts   = memo(ReceiptsScreen);
const MemoCategories = memo(CategoriesScreen);
const MemoDashboard  = memo(DashboardScreen);
const MemoContacts       = memo(ContactsScreen);
const MemoNotifications  = memo(NotificationsScreen);
const MemoReminders      = memo(RemindersScreen);

const SCREENS: Record<string, (isActive: boolean) => React.ReactNode> = {
  home:                 (isActive) => <MemoHome isActive={isActive} />,
  accounts:             (isActive) => <MemoAccounts isActive={isActive} />,
  dashboard:            (isActive) => <MemoDashboard isActive={isActive} />,
  categories:           (isActive) => <MemoCategories isActive={isActive} />,
  'bill-split':         (isActive) => <MemoBillSplit isActive={isActive} />,
  receipts:             (isActive) => <MemoReceipts isActive={isActive} />,
  contacts:             (isActive) => <MemoContacts isActive={isActive} />,
  reminders:            (isActive) => <MemoReminders isActive={isActive} />,
};

const CURRENCIES = [
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar', country: 'Australia', flag: 'au' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real', country: 'Brazil', flag: 'br' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar', country: 'Canada', flag: 'ca' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan', country: 'China', flag: 'cn' },
  { code: 'EUR', symbol: '€', label: 'Euro', country: 'European Union', flag: 'eu' },
  { code: 'GBP', symbol: '£', label: 'British Pound', country: 'United Kingdom', flag: 'gb' },
  { code: 'HKD', symbol: 'HK$', label: 'Hong Kong Dollar', country: 'Hong Kong', flag: 'hk' },
  { code: 'IDR', symbol: 'Rp', label: 'Indonesian Rupiah', country: 'Indonesia', flag: 'id' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee', country: 'India', flag: 'in' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen', country: 'Japan', flag: 'jp' },
  { code: 'KRW', symbol: '₩', label: 'South Korean Won', country: 'South Korea', flag: 'kr' },
  { code: 'MXN', symbol: 'MX$', label: 'Mexican Peso', country: 'Mexico', flag: 'mx' },
  { code: 'MYR', symbol: 'RM', label: 'Malaysian Ringgit', country: 'Malaysia', flag: 'my' },
  { code: 'NZD', symbol: 'NZ$', label: 'New Zealand Dollar', country: 'New Zealand', flag: 'nz' },
  { code: 'PHP', symbol: '₱', label: 'Philippine Peso', country: 'Philippines', flag: 'ph' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar', country: 'Singapore', flag: 'sg' },
  { code: 'CHF', symbol: 'Fr', label: 'Swiss Franc', country: 'Switzerland', flag: 'ch' },
  { code: 'THB', symbol: '฿', label: 'Thai Baht', country: 'Thailand', flag: 'th' },
  { code: 'USD', symbol: '$', label: 'US Dollar', country: 'United States', flag: 'us' },
  { code: 'VND', symbol: '₫', label: 'Vietnamese Dong', country: 'Vietnam', flag: 'vn' },
];

function ProfileScreen() {
  const router = useRouter();
  const { switchTab, openContactsPanel, openFriendsPanel } = useNav();
  const { user, userId, userName, profileCode, defaultCurrency, setDefaultCurrency } = useUser();
  const [codeCopied, setCodeCopied] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<string[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showAllFriends, setShowAllFriends] = useState(false);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [friendRequests, setFriendRequests] = useState<{ id: string; name: string; requesterId: string }[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<{ id: string; name: string; receiverId: string }[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendCode, setAddFriendCode] = useState('');
  const [addFriendError, setAddFriendError] = useState('');
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const email = user?.email ?? '';
  const userId = user?.id ?? '';

  useEffect(() => {
    if (!userId) return;
    // Load friends
    supabase.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted')
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
      .then(async ({ data }) => {
        if (!data) return;
        const ids = data.map((f: any) => f.requester_id === userId ? f.receiver_id : f.requester_id);
        const names = await Promise.all(ids.map(async (id: string) => {
          const { data: n } = await supabase.rpc('get_user_display_name', { user_id: id });
          return { id, name: n ?? 'unknown' };
        }));
        setFriends(names);
      });
    // Load contacts
    supabase.from('contacts').select('name').eq('user_id', userId).order('name')
      .then(({ data }) => { if (data) setContacts(data.map((c: any) => c.name)); setProfileLoading(false); });
    // Load friend requests (pending, where current user is receiver)
    supabase.from('friendships').select('id, requester_id').eq('receiver_id', userId).eq('status', 'pending')
      .then(async ({ data }) => {
        if (!data || data.length === 0) return;
        const requests = await Promise.all(data.map(async (f: any) => {
          const { data: n } = await supabase.rpc('get_user_display_name', { user_id: f.requester_id });
          return { id: f.id, name: n ?? 'unknown', requesterId: f.requester_id };
        }));
        setFriendRequests(requests);
      });
    // Load outgoing requests (pending, where current user is requester)
    supabase.from('friendships').select('id, receiver_id').eq('requester_id', userId).eq('status', 'pending')
      .then(async ({ data }) => {
        if (!data || data.length === 0) return;
        const requests = await Promise.all(data.map(async (f: any) => {
          const { data: n } = await supabase.rpc('get_user_display_name', { user_id: f.receiver_id });
          return { id: f.id, name: n ?? 'unknown', receiverId: f.receiver_id };
        }));
        setOutgoingRequests(requests);
      });
  }, [userId]);

  const respondToRequest = async (id: string, accept: boolean) => {
    setRespondingId(id);
    await supabase.rpc('respond_to_friend_request', { friendship_id: id, accepted: accept, responder_name: userName, responder_id: userId });
    setFriendRequests(prev => prev.filter(r => r.id !== id));
    if (accept) {
      const req = friendRequests.find(r => r.id === id);
      if (req) setFriends(prev => [...prev, { id: req.requesterId, name: req.name }]);
    }
    setRespondingId(null);
  };

  const sendFriendRequest = async () => {
    if (!addFriendCode.trim()) return;
    setAddFriendLoading(true); setAddFriendError('');
    try {
      // Look up user by profile code
      const { data: target } = await supabase.rpc('get_user_by_profile_code', { code: addFriendCode.trim().toUpperCase() });
      if (!target) { setAddFriendError('no user found with that code'); return; }
      if (target === userId) { setAddFriendError('that\'s your own code'); return; }
      // Check not already friends or pending
      const { data: existing } = await supabase.from('friendships')
        .select('id, status').or(`and(requester_id.eq.${userId},receiver_id.eq.${target}),and(requester_id.eq.${target},receiver_id.eq.${userId})`).maybeSingle();
      if (existing) { setAddFriendError(existing.status === 'accepted' ? 'already friends' : 'request already sent'); return; }
      await supabase.rpc('send_friend_request', { requester_id: userId, receiver_id: target, requester_name: userName });
      const { data: n } = await supabase.rpc('get_user_display_name', { user_id: target });
      setOutgoingRequests(prev => [...prev, { id: '', name: n ?? 'unknown', receiverId: target }]);
      setShowAddFriend(false); setAddFriendCode('');
    } catch (e: any) {
      setAddFriendError(e.message ?? 'something went wrong');
    } finally {
      setAddFriendLoading(false);
    }
  };

  const showToast = () => {
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  };

  const copyCode = () => {
    if (!profileCode) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(profileCode).then(() => showToast());
    } else {
      Clipboard.setString(profileCode);
      showToast();
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== 'delete') { setDeleteError('type "delete" to confirm'); return; }
    setDeleting(true); setDeleteError('');
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('not authenticated');
      const { error } = await supabase.rpc('delete_user_data', { target_user_id: currentUser.id });
      if (error) throw error;
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') window.location.href = '/';
      else router.replace('/' as any);
    } catch (e: any) {
      setDeleteError(e.message ?? 'something went wrong.');
      setDeleting(false);
    }
  };

  return (
    <View style={p.container}>
      <ScrollView contentContainerStyle={p.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={p.avatarSection}>
          <View style={p.avatar}>
            <Text style={p.avatarText}>{userName ? userName.charAt(0).toUpperCase() : '?'}</Text>
          </View>
          <Text style={p.name}>{userName || 'My Account'}</Text>
          <Text style={p.email}>{email}</Text>
          <TouchableOpacity style={p.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={p.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* General Information */}
        <Text style={p.sectionLabel}>General Information</Text>
        <View style={p.card}>
          {/* Name */}
          <View style={p.row}>
            <View style={p.rowIcon}><AnimatedIcon set="basil" icon="user-solid" size={16} color={Colors.muted} /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Name</Text>
              <Text style={p.rowValue}>{userName || '—'}</Text>
            </View>
          </View>
          <View style={p.divider} />
          {/* Email */}
          <View style={p.row}>
            <View style={p.rowIcon}><AnimatedIcon set="basil" icon="gmail-solid" size={16} color={Colors.muted} /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Email</Text>
              <Text style={p.rowValue}>{email || '—'}</Text>
            </View>
          </View>
          <View style={p.divider} />
          {/* Subscription */}
          <View style={p.row}>
            <View style={p.rowIcon}><AnimatedIcon set="basil" icon="lightning-solid" size={16} color={Colors.muted} /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Subscription</Text>
              <Text style={[p.rowValue, { color: HEADER_BG }]}>Free</Text>
            </View>
          </View>
          <View style={p.divider} />
          {/* Profile Code */}
          <View style={p.row}>
            <View style={p.rowIcon}><AnimatedIcon set="basil" icon="id-card-solid" size={16} color={Colors.muted} /></View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Profile Code</Text>
              <Text style={[p.rowValue, { fontFamily: AppFont.bold, letterSpacing: 1.5 }]}>{profileCode || '—'}</Text>
            </View>
            <TouchableOpacity onPress={copyCode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <AnimatedIcon set="basil" icon="clipboard-solid" size={18} color={Colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={p.divider} />
          {/* Default Currency */}
          <TouchableOpacity style={p.row} onPress={() => setShowCurrencyModal(true)} activeOpacity={0.7}>
            <View style={p.rowIcon}>
              <AnimatedIcon set="circle-flags" icon={CURRENCIES.find(c => c.code === defaultCurrency)?.flag ?? 'us'} size={24} />
            </View>
            <View style={p.rowBody}>
              <Text style={p.rowLabel}>Default Currency</Text>
              <Text style={p.rowValue}>{CURRENCIES.find(c => c.code === defaultCurrency)?.country ?? ''} - {defaultCurrency}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.faint} />
          </TouchableOpacity>
        </View>

        {/* Friends */}
        <Text style={p.sectionLabel}>Friends</Text>
        <View style={p.card}>
          {friends.length === 0 ? (
            <View style={[p.row, p.rowLast]}>
              <Text style={[p.rowValue, { color: Colors.faint }]}>no friends yet</Text>
            </View>
          ) : (
            (showAllFriends ? friends : friends.slice(0, 3)).map((f, i, arr) => (
              <View key={f.id}>
                <View style={[p.row, i === arr.length - 1 && p.rowLast]}>
                  <View style={p.rowIcon}><AnimatedIcon set="basil" icon="user-solid" size={16} color={Colors.muted} /></View>
                  <Text style={p.rowValue}>{f.name}</Text>
                </View>
                {i < arr.length - 1 && <View style={p.divider} />}
              </View>
            ))
          )}
        </View>
        <TouchableOpacity style={p.seeMoreBtn} onPress={openFriendsPanel} activeOpacity={0.7}>
          <Text style={p.seeMoreText}>{friends.length > 3 ? `see ${friends.length - 3} more...` : 'see all'}</Text>
        </TouchableOpacity>

        {/* Pending friend requests (incoming) */}
        {friendRequests.length > 0 && (
          <>
            <Text style={[p.sectionLabel, { marginTop: 8 }]}>Pending Requests</Text>
            <View style={p.card}>
              {friendRequests.map((req, i) => (
                <View key={req.id}>
                  <View style={[p.row, { gap: 10 }]}>
                    <View style={p.rowIcon}><AnimatedIcon set="basil" icon="user-solid" size={16} color={Colors.muted} /></View>
                    <Text style={[p.rowValue, { flex: 1 }]}>{req.name}</Text>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: HEADER_BG + '33', opacity: respondingId === req.id ? 0.5 : 1 }}
                      onPress={() => respondToRequest(req.id, true)}
                      disabled={respondingId === req.id}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontFamily: AppFont.semiBold, fontSize: 12, color: HEADER_BG }}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, opacity: respondingId === req.id ? 0.5 : 1 }}
                      onPress={() => respondToRequest(req.id, false)}
                      disabled={respondingId === req.id}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted }}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                  {i < friendRequests.length - 1 && <View style={p.divider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Outgoing friend requests */}
        {outgoingRequests.length > 0 && (
          <>
            <Text style={[p.sectionLabel, { marginTop: 8 }]}>Outgoing Requests</Text>
            <View style={p.card}>
              {outgoingRequests.map((req, i) => (
                <View key={req.id || req.receiverId}>
                  <View style={p.row}>
                    <View style={p.rowIcon}><AnimatedIcon set="basil" icon="user-solid" size={16} color={Colors.muted} /></View>
                    <Text style={[p.rowValue, { flex: 1 }]}>{req.name}</Text>
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.faint, fontStyle: 'italic' }}>pending</Text>
                  </View>
                  {i < outgoingRequests.length - 1 && <View style={p.divider} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Contacts */}
        <Text style={p.sectionLabel}>Contacts</Text>
        <View style={p.card}>
          {contacts.length === 0 ? (
            <View style={[p.row, p.rowLast]}>
              <Text style={[p.rowValue, { color: Colors.faint }]}>no contacts yet</Text>
            </View>
          ) : (
            contacts.slice(0, 3).map((c, i, arr) => (
              <View key={c}>
                <View style={[p.row, i === arr.length - 1 && p.rowLast]}>
                  <View style={p.rowIcon}><AnimatedIcon set="basil" icon="contacts-solid" size={16} color={Colors.muted} /></View>
                  <Text style={p.rowValue}>{c}</Text>
                </View>
                {i < arr.length - 1 && <View style={p.divider} />}
              </View>
            ))
          )}
        </View>
        <TouchableOpacity style={p.seeMoreBtn} onPress={openContactsPanel} activeOpacity={0.7}>
          <Text style={p.seeMoreText}>{contacts.length > 3 ? `see ${contacts.length - 3} more...` : 'see all'}</Text>
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity style={p.deleteBtn} onPress={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteError(''); }} activeOpacity={0.8}>
          <Text style={p.deleteText}>Delete Account</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Toast */}
      {toastVisible && (
        <Animated.View style={[p.toast, { opacity: toastAnim }]}>
          <Text style={p.toastText}>copied to clipboard</Text>
        </Animated.View>
      )}

      {/* Loading overlay */}
      {profileLoading && (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <GooeyLoader />
        </BlurView>
      )}

      {/* Add Friend modal */}
      {showAddFriend && (
        <View style={p.modalOverlay}>
          <View style={p.modalBox}>
            <Text style={p.modalTitle}>Add Friend</Text>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted, marginBottom: 12 }}>Enter their profile code to send a friend request.</Text>
            <TextInput
              style={p.deleteInput}
              value={addFriendCode}
              onChangeText={v => { setAddFriendCode(v); setAddFriendError(''); }}
              placeholder="e.g. ABC123"
              placeholderTextColor={Colors.faint}
              autoCapitalize="characters"
              autoFocus
            />
            {addFriendError ? <Text style={[p.deleteErrorText, { marginBottom: 8 }]}>{addFriendError}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[p.modalCancelBtn, { flex: 1 }]} onPress={() => setShowAddFriend(false)} activeOpacity={0.8}>
                <Text style={p.modalCancelText}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[p.deleteConfirmBtn, { backgroundColor: HEADER_BG, opacity: (!addFriendCode.trim() || addFriendLoading) ? 0.4 : 1 }]}
                onPress={sendFriendRequest}
                disabled={!addFriendCode.trim() || addFriendLoading}
                activeOpacity={0.8}
              >
                {addFriendLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={p.deleteConfirmText}>Send Request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Currency picker modal ── */}
      {showCurrencyModal && (
        <Modal visible animationType="slide" transparent statusBarTranslucent onRequestClose={() => { setShowCurrencyModal(false); setCurrencySearch(''); }}>
          <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1 }}>
            <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.82)' }}>
              <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16 }}>
                  <Text style={{ fontFamily: AppFont.bold, fontSize: 22, color: DC.accent1, letterSpacing: -0.5 }}>Select Currency</Text>
                  <TouchableOpacity onPress={() => { setShowCurrencyModal(false); setCurrencySearch(''); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: AppFont.bold, fontSize: 14, color: DC.pageText }}>✕</Text>
                    </View>
                  </TouchableOpacity>
                </View>
                <View style={p.searchRow}>
                  <Ionicons name="search-outline" size={14} color={Colors.faint} />
                  <TextInput
                    style={p.searchInput}
                    placeholder="search country or currency..."
                    placeholderTextColor={Colors.faint}
                    value={currencySearch}
                    onChangeText={setCurrencySearch}
                    autoFocus
                  />
                  {currencySearch.length > 0 && (
                    <TouchableOpacity onPress={() => setCurrencySearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={14} color={Colors.faint} />
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                  {CURRENCIES.filter(c =>
                    !currencySearch.trim() ||
                    c.country.toLowerCase().includes(currencySearch.toLowerCase()) ||
                    c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
                    c.label.toLowerCase().includes(currencySearch.toLowerCase())
                  ).map(c => (
                    <TouchableOpacity
                      key={c.code}
                      style={[p.currencyRow, defaultCurrency === c.code && p.currencyRowActive]}
                      onPress={() => { setDefaultCurrency(c.code); setShowCurrencyModal(false); setCurrencySearch(''); }}
                      activeOpacity={0.75}
                    >
                      <AnimatedIcon set="circle-flags" icon={c.flag} size={32} />
                      <View style={{ flex: 1 }}>
                        <Text style={p.currencyCode}>{c.country}</Text>
                        <Text style={p.currencyLabel}>{c.code} · {c.symbol} · {c.label}</Text>
                      </View>
                      {defaultCurrency === c.code && <Ionicons name="checkmark" size={16} color={HEADER_BG} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      )}

      {/* ── Delete account confirmation modal ── */}
      {showDeleteModal && (
        <View style={p.modalOverlay}>
          <View style={p.modalBox}>
            <Text style={p.modalTitle}>delete account</Text>
            <Text style={p.deleteWarning}>
              this will permanently delete your account and ALL your data — recordings, spaces, receipts, reminders, everything. this cannot be undone.
            </Text>
            <Text style={p.deletePrompt}>type "delete" to confirm</Text>
            <TextInput
              style={p.deleteInput}
              value={deleteConfirmText}
              onChangeText={v => { setDeleteConfirmText(v); setDeleteError(''); }}
              placeholder="delete"
              placeholderTextColor={Colors.faint}
              autoCapitalize="none"
              autoFocus
            />
            {deleteError ? <Text style={p.deleteErrorText}>{deleteError}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[p.modalCancelBtn, { flex: 1 }]} onPress={() => setShowDeleteModal(false)} disabled={deleting} activeOpacity={0.8}>
                <Text style={p.modalCancelText}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[p.deleteConfirmBtn, (deleting || deleteConfirmText.toLowerCase() !== 'delete') && { opacity: 0.4 }]}
                onPress={handleDeleteAccount}
                disabled={deleting || deleteConfirmText.toLowerCase() !== 'delete'}
                activeOpacity={0.8}
              >
                {deleting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={p.deleteConfirmText}>delete forever</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
const MemoProfile = ProfileScreen;
const MemoSpaceDetail     = memo(SpaceDetailScreen);
const MemoRecordingDetail = memo(RecordingDetailScreen);

const NAV_TOUR_IDS: Record<string, string> = {
  spaces: 'tour-nav-spaces',
  accounts: 'tour-nav-accounts',
  dashboard: 'tour-nav-dashboard',
  others: 'tour-nav-others',
};

export default function TabsLayout() {
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const winWidthRef = useRef(W);
  winWidthRef.current = W;
  const { user, userName } = useUser();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('home');
  const [othersOpen, setOthersOpen] = useState(false);
  const activeTabRef = useRef('home');
  const titleAnim = useRef(new Animated.Value(1)).current;
  const blurAnim   = useRef(new Animated.Value(0)).current;
  const [blurActive, setBlurActive] = useState(false);
  const addHandlers = useRef<Record<string, () => void>>({});
  const [, forceUpdate] = useState(0);

  const tourTargets = useRef(new Map<string, RefObject<RNView | null>>());
  const registerTourTarget = useCallback((id: string, ref: RefObject<RNView | null>) => {
    tourTargets.current.set(id, ref);
  }, []);
  const unregisterTourTarget = useCallback((id: string) => {
    tourTargets.current.delete(id);
  }, []);

  const [tourVisible, setTourVisible] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourLoading, setTourLoading] = useState(false);

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
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [activeSpaceId,   setActiveSpaceId]   = useState<string | null>(null);
  const [activeSpaceName, setActiveSpaceName] = useState<string | null>(null);
  const [activeSpaceOpenEdit, setActiveSpaceOpenEdit] = useState(false);
  const spaceSlideAnim = useRef(new Animated.Value(winWidthRef.current)).current;

  const openSpace = useCallback((spaceId: string, name: string, edit = false) => {
    setActiveSpaceId(spaceId);
    setActiveSpaceName(name);
    setActiveSpaceOpenEdit(edit);
    spaceSlideAnim.setValue(winWidthRef.current);
    Animated.timing(spaceSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, []);

  const closeSpace = useCallback(() => {
    Animated.timing(spaceSlideAnim, { toValue: winWidthRef.current, duration: 260, useNativeDriver: true }).start(() => {
      setActiveSpaceId(null);
      setActiveSpaceName(null);
      setActiveSpaceOpenEdit(false);
    });
  }, []);

  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const recordingSlideAnim = useRef(new Animated.Value(winWidthRef.current)).current;

  const openRecording = useCallback((recordingId: string) => {
    setActiveRecordingId(recordingId);
    recordingSlideAnim.setValue(winWidthRef.current);
    Animated.timing(recordingSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, []);

  const closeRecording = useCallback(() => {
    Animated.timing(recordingSlideAnim, { toValue: winWidthRef.current, duration: 260, useNativeDriver: true }).start(() => {
      setActiveRecordingId(null);
    });
  }, []);

  const [activeSplitBillId,   setActiveSplitBillId]   = useState<string | null>(null);
  const [activeSplitBillName, setActiveSplitBillName] = useState<string | null>(null);
  const splitBillSlideAnim = useRef(new Animated.Value(winWidthRef.current)).current;

  const openSplitBill = useCallback((splitBillId: string, name: string) => {
    setActiveSplitBillId(splitBillId);
    setActiveSplitBillName(name);
    splitBillSlideAnim.setValue(winWidthRef.current);
    Animated.timing(splitBillSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, []);

  const closeSplitBill = useCallback(() => {
    Animated.timing(splitBillSlideAnim, { toValue: winWidthRef.current, duration: 260, useNativeDriver: true }).start(() => {
      setActiveSplitBillId(null);
      setActiveSplitBillName(null);
    });
  }, []);

  const [topSpendingOpen, setTopSpendingOpen] = useState(false);
  const topSpendingOpenRef = useRef(false);
  const topSpendingAnim = useRef(new Animated.Value(winWidthRef.current)).current;

  const openTopSpending = useCallback(() => {
    topSpendingOpenRef.current = true;
    setTopSpendingOpen(true);
    topSpendingAnim.setValue(winWidthRef.current);
    Animated.timing(topSpendingAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, []);

  const closeTopSpending = useCallback(() => {
    topSpendingOpenRef.current = false;
    Animated.timing(topSpendingAnim, { toValue: winWidthRef.current, duration: 260, useNativeDriver: true }).start(() => {
      setTopSpendingOpen(false);
    });
  }, []);

  const dismissTopSpending = useCallback(() => {
    topSpendingAnim.setValue(winWidthRef.current);
    setTopSpendingOpen(false);
  }, []);

  const [recordingsPanelOpen, setRecordingsPanelOpen] = useState(false);
  const recordingsPanelOpenRef = useRef(false);
  const recordingsPanelAnim = useRef(new Animated.Value(winWidthRef.current)).current;
  const [recordingsPanelOpts, setRecordingsPanelOpts] = useState<{ categoryId?: string; categoryName?: string; spaceId?: string; spaceName?: string }>({});

  const openRecordingsPanel = useCallback((opts?: { categoryId?: string; categoryName?: string; spaceId?: string; spaceName?: string }) => {
    recordingsPanelOpenRef.current = true;
    setRecordingsPanelOpts(opts ?? {});
    recordingsPanelAnim.setValue(winWidthRef.current);
    setRecordingsPanelOpen(true);
    requestAnimationFrame(() => {
      Animated.timing(recordingsPanelAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    });
  }, []);

  const closeRecordingsPanel = useCallback(() => {
    recordingsPanelOpenRef.current = false;
    Animated.timing(recordingsPanelAnim, { toValue: winWidthRef.current, duration: 260, useNativeDriver: true }).start(() => {
      setRecordingsPanelOpen(false);
    });
  }, []);

  const [spacesPanelOpen, setSpacesPanelOpen] = useState(false);
  const spacesPanelOpenRef = useRef(false);
  const spacesPanelAnim = useRef(new Animated.Value(winWidthRef.current)).current;

  const openSpacesPanel = useCallback(() => {
    spacesPanelOpenRef.current = true;
    setSpacesPanelOpen(true);
    spacesPanelAnim.setValue(winWidthRef.current);
    requestAnimationFrame(() => {
      Animated.timing(spacesPanelAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    });
  }, []);

  const closeSpacesPanel = useCallback(() => {
    spacesPanelOpenRef.current = false;
    Animated.timing(spacesPanelAnim, { toValue: winWidthRef.current, duration: 260, useNativeDriver: true }).start(() => {
      setSpacesPanelOpen(false);
    });
  }, []);

  const [loansPanelOpen, setLoansPanelOpen] = useState(false);
  const loansPanelOpenRef = useRef(false);
  const loansPanelAnim = useRef(new Animated.Value(winWidthRef.current)).current;
  const openLoansPanel = useCallback(() => { loansPanelOpenRef.current = true; setLoansPanelOpen(true); loansPanelAnim.setValue(winWidthRef.current); requestAnimationFrame(() => { Animated.timing(loansPanelAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); }); }, []);
  const closeLoansPanel = useCallback(() => { loansPanelOpenRef.current = false; Animated.timing(loansPanelAnim, { toValue: winWidthRef.current, duration: 260, useNativeDriver: true }).start(() => { setLoansPanelOpen(false); }); }, []);

  const [receivablesPanelOpen, setReceivablesPanelOpen] = useState(false);
  const receivablesPanelOpenRef = useRef(false);
  const receivablesPanelAnim = useRef(new Animated.Value(winWidthRef.current)).current;
  const [receivablesInitialPerson, setReceivablesInitialPerson] = useState<string | null>(null);
  const openReceivablesPanel = useCallback((person?: string) => { setReceivablesInitialPerson(person ?? null); receivablesPanelOpenRef.current = true; setReceivablesPanelOpen(true); receivablesPanelAnim.setValue(winWidthRef.current); requestAnimationFrame(() => { Animated.timing(receivablesPanelAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); }); }, []);
  const closeReceivablesPanel = useCallback(() => { receivablesPanelOpenRef.current = false; setReceivablesInitialPerson(null); Animated.timing(receivablesPanelAnim, { toValue: winWidthRef.current, duration: 260, useNativeDriver: true }).start(() => { setReceivablesPanelOpen(false); }); }, []);

  const [remindersPanelOpen, setRemindersPanelOpen] = useState(false);
  const remindersPanelOpenRef = useRef(false);
  const remindersPanelAnim = useRef(new Animated.Value(winWidthRef.current)).current;
  const openRemindersPanel = useCallback(() => { remindersPanelOpenRef.current = true; setRemindersPanelOpen(true); remindersPanelAnim.setValue(winWidthRef.current); requestAnimationFrame(() => { Animated.timing(remindersPanelAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); }); }, []);
  const closeRemindersPanel = useCallback(() => { remindersPanelOpenRef.current = false; Animated.timing(remindersPanelAnim, { toValue: winWidthRef.current, duration: 260, useNativeDriver: true }).start(() => { setRemindersPanelOpen(false); }); }, []);

  const [contactsPanelOpen, setContactsPanelOpen] = useState(false);
  const contactsPanelAnim = useRef(new Animated.Value(winWidthRef.current)).current;
  const openContactsPanel = useCallback(() => { setContactsPanelOpen(true); contactsPanelAnim.setValue(winWidthRef.current); requestAnimationFrame(() => { Animated.timing(contactsPanelAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); }); }, []);
  const closeContactsPanel = useCallback(() => { Animated.timing(contactsPanelAnim, { toValue: winWidthRef.current, duration: 260, useNativeDriver: true }).start(() => { setContactsPanelOpen(false); }); }, []);

  const [friendsPanelOpen, setFriendsPanelOpen] = useState(false);
  const friendsPanelAnim = useRef(new Animated.Value(winWidthRef.current)).current;
  const openFriendsPanel = useCallback(() => { setFriendsPanelOpen(true); friendsPanelAnim.setValue(winWidthRef.current); requestAnimationFrame(() => { Animated.timing(friendsPanelAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(); }); }, []);
  const closeFriendsPanel = useCallback(() => { Animated.timing(friendsPanelAnim, { toValue: winWidthRef.current, duration: 260, useNativeDriver: true }).start(() => { setFriendsPanelOpen(false); }); }, []);

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
      }, (payload) => {
        const n = payload.new as any;
        if (n.user_id === userId) fetchUnread();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchUnread]);

  const slideAnims = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(SLIDE_KEYS.map((k) => [k, new Animated.Value(k === 'home' ? 0 : winWidthRef.current)]))
  ).current;

  // Notification slide anim — no longer needed (notifications-page is in SLIDE_KEYS)

  // ── Reposition off-screen panels when window resizes ──
  useEffect(() => {
    const updateHidden = (anim: Animated.Value | undefined) => {
      if (anim && (anim as any).__getValue() !== 0) {
        anim.setValue(W);
      }
    };
    SLIDE_KEYS.forEach(key => { if (key !== 'home') updateHidden(slideAnims[key]); });
    updateHidden(spaceSlideAnim);
    updateHidden(recordingSlideAnim);
    updateHidden(splitBillSlideAnim);
    updateHidden(topSpendingAnim);
    updateHidden(recordingsPanelAnim);
    updateHidden(spacesPanelAnim);
    updateHidden(loansPanelAnim);
    updateHidden(receivablesPanelAnim);
    updateHidden(remindersPanelAnim);
    updateHidden(contactsPanelAnim);
    updateHidden(friendsPanelAnim);
  }, [W]);

  // Per-tab navigation stack cache (Instagram-style)
  const tabStacks = useRef<Record<string, { spaceId: string | null; spaceName: string | null; recordingId: string | null; topSpendingOpen: boolean; recordingsPanelOpen: boolean; spacesPanelOpen: boolean; loansPanelOpen: boolean; receivablesPanelOpen: boolean; remindersPanelOpen: boolean }>>({});

  const switchTab = useCallback((key: string) => {
    if (key === activeTabRef.current) return;
    const prev = activeTabRef.current;

    // Save current panel state for the outgoing tab
    tabStacks.current[prev] = {
      spaceId: activeSpaceId,
      spaceName: activeSpaceName,
      recordingId: activeRecordingId,
      topSpendingOpen: topSpendingOpenRef.current,
      recordingsPanelOpen: recordingsPanelOpenRef.current,
      spacesPanelOpen: spacesPanelOpenRef.current,
      loansPanelOpen: loansPanelOpenRef.current,
      receivablesPanelOpen: receivablesPanelOpenRef.current,
      remindersPanelOpen: remindersPanelOpenRef.current,
    };

    // Instantly hide panels without animation
    setActiveSpaceId(null);
    setActiveSpaceName(null);
    setActiveRecordingId(null);
    spaceSlideAnim.setValue(winWidthRef.current);
    recordingSlideAnim.setValue(winWidthRef.current);
    topSpendingOpenRef.current = topSpendingOpenRef.current; // preserve — panel stays mounted
    topSpendingAnim.setValue(winWidthRef.current); // hide off-screen while on other tab
    recordingsPanelOpenRef.current = recordingsPanelOpenRef.current;
    recordingsPanelAnim.setValue(winWidthRef.current);
    spacesPanelOpenRef.current = spacesPanelOpenRef.current;
    spacesPanelAnim.setValue(winWidthRef.current);
    loansPanelAnim.setValue(winWidthRef.current);
    receivablesPanelAnim.setValue(winWidthRef.current);
    remindersPanelAnim.setValue(winWidthRef.current);
    contactsPanelAnim.setValue(winWidthRef.current);
    friendsPanelAnim.setValue(winWidthRef.current);
    // Hide conditional panels and reset refs
    loansPanelOpenRef.current = false;
    setLoansPanelOpen(false);
    receivablesPanelOpenRef.current = false;
    setReceivablesPanelOpen(false);
    remindersPanelOpenRef.current = false;
    setRemindersPanelOpen(false);
    setContactsPanelOpen(false);
    setFriendsPanelOpen(false);

    activeTabRef.current = key;

    const incoming = slideAnims[key];
    const outgoing = slideAnims[prev];

    // Instant swap — no animation between different tabs
    outgoing?.setValue(winWidthRef.current);
    incoming?.setValue(0);

    // Restore saved panel state for the incoming tab
    const saved = tabStacks.current[key];
    if (saved?.spaceId) {
      setActiveSpaceId(saved.spaceId);
      setActiveSpaceName(saved.spaceName);
      spaceSlideAnim.setValue(0);
    }
    if (saved?.recordingId) {
      setActiveRecordingId(saved.recordingId);
      recordingSlideAnim.setValue(0);
    }
    if (saved?.topSpendingOpen) {
      topSpendingOpenRef.current = true;
      setTopSpendingOpen(true);
      topSpendingAnim.setValue(0);
    }
    if (saved?.recordingsPanelOpen) {
      recordingsPanelOpenRef.current = true;
      setRecordingsPanelOpen(true);
      recordingsPanelAnim.setValue(0);
    }
    if (saved?.spacesPanelOpen) {
      spacesPanelOpenRef.current = true;
      setSpacesPanelOpen(true);
      spacesPanelAnim.setValue(0);
    }
    if (saved?.loansPanelOpen) {
      loansPanelOpenRef.current = true;
      setLoansPanelOpen(true);
      loansPanelAnim.setValue(0);
    }
    if (saved?.receivablesPanelOpen) {
      receivablesPanelOpenRef.current = true;
      setReceivablesPanelOpen(true);
      receivablesPanelAnim.setValue(0);
    }
    if (saved?.remindersPanelOpen) {
      remindersPanelOpenRef.current = true;
      setRemindersPanelOpen(true);
      remindersPanelAnim.setValue(0);
    }

    setActiveTab(key);
    titleAnim.setValue(1);
  }, [activeSpaceId, activeSpaceName, activeRecordingId]);

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

  const handleNavPress = useCallback((key: string) => {
    if (key === 'others') { othersOpen ? closeOthers() : openOthers(); return; }
    if (othersOpen) closeOthers();
    if (key === 'notifications-tab') {
      setUnreadCount(0);
      switchTab('notifications-page');
      supabase.from('notifications')
        .update({ status: 'saw', is_read: true, read: true })
        .eq('user_id', userId)
        .in('status', ['new'])
        .neq('type', 'expense_tag');
      return;
    }
    switchTab(key);
  }, [othersOpen, closeOthers, openOthers, switchTab, userId]);

  // Consume any pending tab set before this layout mounted (e.g. from detail screen nav)
  useEffect(() => {
    const pending = consumePendingTabGlobal();
    if (pending) handleNavPress(pending);
  }, []);

  // When a detail screen sets a pendingTab, switch to it after router.back()
  useEffect(() => {
    if (pendingTab) {
      handleNavPress(pendingTab);
      setPendingTab(null);
    }
  }, [pendingTab, handleNavPress]);

  const handleOthersItem = (item: typeof OTHERS_ITEMS[0]) => {
    closeOthers();
    if (item.route) {
      router.push(item.route as any);
    } else {
      switchTab(item.key);
    }
  };

  const isOthersActive = OTHERS_ITEMS.some(i => i.key === activeTab) || othersOpen;
  const isNotifTabActive = activeTab === 'notifications-page';

  useEffect(() => {
    const checkTour = (pending?: boolean) => {
      if (pending === true) {
        setTourVisible(true);
        setTourStep(0);
      }
    };
    checkTour(user?.user_metadata?.onboarding_pending === true);
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      checkTour(u?.user_metadata?.onboarding_pending === true);
    });
  }, [user?.user_metadata?.onboarding_pending]);

  useEffect(() => {
    if (!tourVisible) return;
    const step = APP_TOUR_STEPS[tourStep];
    if (step?.tab && step.tab !== activeTabRef.current) {
      if (othersOpen) closeOthers();
      switchTab(step.tab);
    }
  }, [tourStep, tourVisible]);

  const finishTour = async () => {
    setTourLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { onboarding_pending: false, onboarding_completed: true },
      });
      if (error) throw error;
      setTourVisible(false);
    } catch (e) {
      console.warn('[tour] finish failed:', e);
    } finally {
      setTourLoading(false);
    }
  };

  const handleTourNext = () => {
    if (tourStep >= APP_TOUR_STEPS.length - 1) finishTour();
    else setTourStep(i => i + 1);
  };

  return (
    <TourContext.Provider value={{ register: registerTourTarget, unregister: unregisterTourTarget }}>
    <BlurContext.Provider value={{ setBlur, registerAdd, unregisterAdd, activeTab, __hasProvider: true }}>
    <NavContext.Provider value={{ activeTab, switchTab, handleNavPress, unreadCount, pendingTab, setPendingTab, openSpace, closeSpace, activeSpaceId, activeSpaceName, openRecording, closeRecording, activeRecordingId, openSplitBill, closeSplitBill, activeSplitBillId, activeSplitBillName, openTopSpending, closeTopSpending, openRecordingsPanel, closeRecordingsPanel, openSpacesPanel, closeSpacesPanel, openLoansPanel, closeLoansPanel, openReceivablesPanel, closeReceivablesPanel, openRemindersPanel, closeRemindersPanel, openContactsPanel, closeContactsPanel, openFriendsPanel, closeFriendsPanel }}>
    <View style={s.container}>

      {/* ── Shared flat header ── */}
      <View style={[s.waveBg, { paddingTop: insets.top + 20 }]}>
        <Text style={s.appLabelText}>LEDGR</Text>
        <Animated.View style={{ opacity: titleAnim }}>
          <Text style={s.pageTitle}>Hi, {userName?.split(' ')[0] || 'there'}!</Text>
        </Animated.View>
      </View>

      <View style={s.content}>
        {/* Slideable screens */}
        {SLIDE_KEYS.map(key => (
          <Animated.View
            key={key}
            style={[s.screen, { transform: [{ translateX: slideAnims[key] }], zIndex: activeTab === key ? 10 : 0 }]}
            pointerEvents={activeTab === key ? 'auto' : 'none'}
          >
            {key === 'profile' ? <MemoProfile /> : key === 'notifications-page' ? <MemoNotifications isActive={activeTab === 'notifications-page'} /> : SCREENS[key]?.(activeTab === key)}
          </Animated.View>
        ))}
      </View>

      {/* Space detail panel — slides in over content, under header+nav */}
      {activeSpaceId && (
        <Animated.View
          style={[s.screen, s.panel, { transform: [{ translateX: spaceSlideAnim }], zIndex: 20 }]}
        >
          <MemoSpaceDetail
            spaceId={activeSpaceId}
            name={activeSpaceName ?? ''}
            onClose={closeSpace}
            openEdit={activeSpaceOpenEdit}
          />
        </Animated.View>
      )}

      {/* Recording detail panel — slides in over space detail */}
      {activeRecordingId && (
        <Animated.View
          style={[s.screen, s.panel, { transform: [{ translateX: recordingSlideAnim }], zIndex: 70 }]}
        >
          <MemoRecordingDetail
            recordingId={activeRecordingId}
            onClose={closeRecording}
          />
        </Animated.View>
      )}

      {/* Split bill detail panel — slides in over recording detail */}
      {activeSplitBillId && (
        <Animated.View
          style={[s.screen, s.panel, { transform: [{ translateX: splitBillSlideAnim }], zIndex: 80 }]}
        >
          <SplitBillDetailScreen
            splitBillId={activeSplitBillId}
            name={activeSplitBillName ?? ''}
            onClose={closeSplitBill}
          />
        </Animated.View>
      )}

      {/* Top Spending panel — always mounted, shown/hidden via transform */}
      <Animated.View
        style={[s.screen, s.panel, { transform: [{ translateX: topSpendingAnim }], zIndex: 50 }]}
        pointerEvents={activeTab === 'home' && topSpendingOpen ? 'auto' : 'none'}
      >
        <CategoriesPanel onClose={closeTopSpending} />
      </Animated.View>

      {/* Recordings panel — conditionally rendered like space/recording panels */}
      {recordingsPanelOpen && (
        <Animated.View
          style={[s.screen, s.panel, { transform: [{ translateX: recordingsPanelAnim }], zIndex: 65 }]}
        >
          <RecordingsPanel onClose={closeRecordingsPanel} {...recordingsPanelOpts} />
        </Animated.View>
      )}

      {/* Spaces panel — conditionally rendered */}
      {spacesPanelOpen && (
        <Animated.View style={[s.screen, s.panel, { transform: [{ translateX: spacesPanelAnim }], zIndex: 55 }]}>
          <SpacesPanel onClose={closeSpacesPanel} />
        </Animated.View>
      )}

      {/* Loans panel */}
      <Animated.View style={[s.screen, s.panel, { transform: [{ translateX: loansPanelAnim }], zIndex: 55 }]}
        pointerEvents={loansPanelOpen ? 'auto' : 'none'}>
        <LoansPanel onClose={closeLoansPanel} />
      </Animated.View>

      {/* Receivables panel */}
      <Animated.View style={[s.screen, s.panel, { transform: [{ translateX: receivablesPanelAnim }], zIndex: 55 }]}
        pointerEvents={receivablesPanelOpen ? 'auto' : 'none'}>
        <PeoplePanel onClose={closeReceivablesPanel} initialPerson={receivablesInitialPerson} />
      </Animated.View>

      {/* Reminders panel */}
      <Animated.View style={[s.screen, s.panel, { transform: [{ translateX: remindersPanelAnim }], zIndex: 55 }]}
        pointerEvents={remindersPanelOpen ? 'auto' : 'none'}>
        <RemindersPanel onClose={closeRemindersPanel} />
      </Animated.View>

      {/* Contacts panel */}
      {contactsPanelOpen && (
        <Animated.View style={[s.screen, s.panel, { transform: [{ translateX: contactsPanelAnim }], zIndex: 60 }]}>
          <ContactsPanel onClose={closeContactsPanel} />
        </Animated.View>
      )}

      {/* Friends panel */}
      {friendsPanelOpen && (
        <Animated.View style={[s.screen, s.panel, { transform: [{ translateX: friendsPanelAnim }], zIndex: 60 }]}>
          <FriendsPanel onClose={closeFriendsPanel} />
        </Animated.View>
      )}

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
                <BubbleContent items={OTHERS_ITEMS} activeTab={activeTab} onPress={handleOthersItem} unreadCount={unreadCount} />
              </BlurView>
            ) : (
              <View style={[s.bubbleInner, s.bubbleInnerAndroid]}>
                <BubbleContent items={OTHERS_ITEMS} activeTab={activeTab} onPress={handleOthersItem} unreadCount={unreadCount} />
              </View>
            )}
          </Animated.View>
        </>
      )}

      {/* Bottom nav bar */}
      {/* Bottom nav — position absolute so it overlays transparentModal screens */}
      <BottomNav />

      <AppTourOverlay
        visible={tourVisible}
        steps={APP_TOUR_STEPS}
        stepIndex={tourStep}
        targets={tourTargets.current}
        onNext={handleTourNext}
        onSkip={finishTour}
        loading={tourLoading}
      />

      {/* ── Global blur overlay (covers header + content) ── */}
      {blurActive && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: blurAnim, zIndex: 50, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.05)', pointerEvents: 'none' } as any]}
        />
      )}

    </View>
    </NavContext.Provider>
    </BlurContext.Provider>
    </TourContext.Provider>
  );
}

function BubbleContent({ items, activeTab, onPress, unreadCount }: {
  items: typeof OTHERS_ITEMS;
  activeTab: string;
  onPress: (item: typeof OTHERS_ITEMS[0]) => void;
  unreadCount: number;
}) {
  return (
    <>
      {items.map((item, i) => {
        const isActive = activeTab === item.key;
        const showBadge = false;
        return (
          <TouchableOpacity
            key={item.key}
            style={[s.bubbleItem, i < items.length - 1 && s.bubbleItemBorder]}
            onPress={() => onPress(item)}
            activeOpacity={0.7}
          >
            <View style={[s.bubbleIconWrap, isActive && s.bubbleIconWrapActive]}>
              <Ionicons name={item.icon as any} size={16} color={isActive ? NAV_ACCENT : Colors.text} />
              {showBadge && (
                <View style={s.bubbleBadge}>
                  <Text style={s.navBadgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
                </View>
              )}
            </View>
            <Text style={[s.bubbleItemLabel, isActive && s.bubbleItemLabelActive]}>{item.label}</Text>
            {showBadge && (
              <View style={s.bubbleBadgeLabel}>
                <Text style={s.bubbleBadgeLabelText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={12} color={Colors.faint} style={{ marginLeft: showBadge ? 0 : 'auto' }} />
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
  panel:     { bottom: 0 },

  // ── Shared header
  waveBg:       { backgroundColor: Colors.white, paddingHorizontal: DC.pagePadding, paddingBottom: 14, zIndex: 10, alignItems: 'flex-start' },
  appLabelText: { fontFamily: AppFont.brandLight, fontSize: 16, color: DC.pageText, letterSpacing: 0.5 },
  pageTitle:    { fontFamily: AppFont.bold, fontSize: 18, color: DC.pageText, letterSpacing: 0.3 },
  pageSubtitle: { display: 'none' as any },
  waveTitleRow: { alignItems: 'center' },
  wave:         { display: 'none' as any },
  addBtn:       { display: 'none' as any },

  navBadgeText: { fontFamily: AppFont.semiBold, fontSize: 9, color: '#fff', lineHeight: 14 },

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
  bubbleBadge:           { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#ed6a6a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bubbleBadgeLabel:      { marginLeft: 'auto', minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#ed6a6a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  bubbleBadgeLabelText:  { fontFamily: 'ChillaxMedium', fontSize: 10, color: '#fff', lineHeight: 14 },
});

const p = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll:    { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100, gap: 12 },

  // ── Avatar
  avatarSection: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: HEADER_BG,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  avatarText: { fontFamily: AppFont.bold, fontSize: 28, color: HEADER_TEXT },
  name:  { fontFamily: AppFont.bold, fontSize: 22, color: Colors.text, letterSpacing: -0.3 },
  email: { fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted },

  // ── Info rows (same style as accounts cards)
  card: {
    backgroundColor: Colors.white,
    borderRadius: 0,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.3, textTransform: 'uppercase' },
  rowValue: { fontFamily: AppFont.regular, fontSize: 14, color: Colors.text },
  divider:  { height: 0 }, // kept for compat but unused

  sectionLabel: { fontFamily: AppFont.semiBold, fontSize: 11, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8, marginBottom: 4 },
  seeMoreBtn:  { alignSelf: 'center', marginTop: 10, paddingHorizontal: DC.pageActionPaddingH, paddingVertical: DC.pageActionPaddingV, borderRadius: DC.pageActionRadius, backgroundColor: DC.pageActionBg, borderWidth: DC.pageActionBorderWidth },
  seeMoreText: { fontFamily: AppFont.regular, fontSize: DC.dropdownFontSize, color: DC.pageActionText },

  // ── Action buttons
  logoutBtn: {
    alignSelf: 'stretch',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, marginTop: 12,
  },
  logoutText: { fontFamily: AppFont.regular, fontSize: 14, color: Colors.text },

  deleteBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: PROFILE_DANGEBG, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: PROFILE_DANGER,
    paddingVertical: 14,
  },
  deleteText: { fontFamily: AppFont.regular, fontSize: 14, color: PROFILE_DANGER },

  // ── Modals
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', zIndex: 200, padding: 24,
  },
  modalBox: {
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 24, width: '100%',
  },
  modalTitle: { fontFamily: AppFont.bold, fontSize: 18, color: Colors.text, marginBottom: 16, letterSpacing: -0.3 },
  modalCancelBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.pill,
    paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  modalCancelText: { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },

  // Currency picker
  currencyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: Radius.md,
  },
  currencyRowActive: { backgroundColor: Colors.surface },
  currencySymbol: { fontFamily: AppFont.bold, fontSize: 18, color: Colors.text, width: 28, textAlign: 'center' },
  currencyCode:   { fontFamily: AppFont.bold, fontSize: 13, color: Colors.text },
  currencyLabel:  { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted },
  searchRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 12 },
  searchInput:{ flex: 1, fontFamily: AppFont.regular, fontSize: 13, color: Colors.text, padding: 0 },

  // Delete confirmation
  deleteWarning:     { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted, lineHeight: 20, marginBottom: 16 },
  deletePrompt:      { fontFamily: AppFont.bold, fontSize: 11, color: Colors.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  deleteInput:       { fontFamily: AppFont.regular, fontSize: 15, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },
  deleteErrorText:   { fontFamily: AppFont.regular, fontSize: 12, color: PROFILE_DANGER, marginTop: 6 },
  deleteConfirmBtn:  { flex: 1, backgroundColor: PROFILE_DANGER, borderRadius: Radius.pill, paddingVertical: 12, alignItems: 'center' },
  deleteConfirmText: { fontFamily: AppFont.semiBold, fontSize: 13, color: '#fff' },
  toast: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#111111', borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  toastText: { fontFamily: AppFont.regular, fontSize: 12, color: '#ffffff' },
});


