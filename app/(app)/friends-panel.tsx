import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, RefreshControl, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { BlurView } from 'expo-blur';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { AppFont } from '../../src/lib/fonts';
import { DC } from '../../src/lib/design';
import PageHeader from '@/components/ui/PageHeader';
import GooeyLoader from '@/components/ui/GooeyLoader';

const TEAL = '#9cd7d2';

interface Props { onClose: () => void; }

export default function FriendsPanel({ onClose }: Props) {
  const { userId, userName } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add friend
  const [addCode, setAddCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<{ id: string; name: string } | null>(null);
  const [verifyError, setVerifyError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const load = async () => {
    if (!userId) return;
    const { data } = await supabase.from('friendships').select('requester_id, receiver_id')
      .eq('status', 'accepted').or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
    if (!data) { setLoading(false); return; }
    const ids = data.map((f: any) => f.requester_id === userId ? f.receiver_id : f.requester_id);
    const names = await Promise.all(ids.map(async (id: string) => {
      const { data: n } = await supabase.rpc('get_user_display_name', { user_id: id });
      return { id, name: n ?? 'unknown' };
    }));
    setFriends(names);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const verifyCode = async () => {
    if (!addCode.trim()) return;
    setVerifying(true); setVerifyError(''); setVerifiedUser(null); setSendSuccess(false);
    try {
      const { data: target } = await supabase.rpc('get_user_by_profile_code', { code: addCode.trim().toUpperCase() });
      if (!target) { setVerifyError('no user found with that code'); return; }
      if (target === userId) { setVerifyError("that's your own code"); return; }
      const { data: existing } = await supabase.from('friendships')
        .select('id, status').or(`and(requester_id.eq.${userId},receiver_id.eq.${target}),and(requester_id.eq.${target},receiver_id.eq.${userId})`).maybeSingle();
      if (existing?.status === 'accepted') { setVerifyError('already friends'); return; }
      if (existing?.status === 'pending') { setVerifyError('request already sent'); return; }
      const { data: n } = await supabase.rpc('get_user_display_name', { user_id: target });
      setVerifiedUser({ id: target, name: n ?? 'unknown' });
    } catch (e: any) {
      setVerifyError(e.message ?? 'something went wrong');
    } finally {
      setVerifying(false);
    }
  };

  const sendRequest = async () => {
    if (!verifiedUser) return;
    setSending(true);
    try {
      await supabase.rpc('send_friend_request', { p_requester_id: userId, p_receiver_id: verifiedUser.id, p_requester_name: userName });
      setSendSuccess(true);
      setVerifiedUser(null);
      setAddCode('');
    } catch (e: any) {
      setVerifyError(e.message ?? 'something went wrong');
    } finally {
      setSending(false);
    }
  };

  const filtered = friends.filter(f => !search.trim() || f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={st.root}>
      <PageHeader title="Friends" onBack={onClose} titleColor={TEAL} />

      {loading ? (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}><GooeyLoader /></BlurView>
      ) : (
        <ScrollView
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Add Friend section */}
          <Text style={st.sectionTitle}>Add Friend</Text>
          <Text style={st.sectionDesc}>enter a profile code to send a friend request</Text>
          <View style={st.addRow}>
            <TextInput
              style={st.codeInput}
              value={addCode}
              onChangeText={v => { setAddCode(v); setVerifiedUser(null); setVerifyError(''); setSendSuccess(false); }}
              placeholder="e.g. ABC123"
              placeholderTextColor={Colors.faint}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[st.verifyBtn, (!addCode.trim() || verifying) && { opacity: 0.4 }]}
              onPress={verifyCode}
              disabled={!addCode.trim() || verifying}
              activeOpacity={0.8}
            >
              {verifying ? <ActivityIndicator size="small" color={TEAL} /> : <Text style={st.verifyBtnText}>Verify</Text>}
            </TouchableOpacity>
          </View>
          {verifyError ? <Text style={st.errorText}>{verifyError}</Text> : null}
          {sendSuccess ? <Text style={st.successText}>friend request sent!</Text> : null}
          {verifiedUser && (
            <View style={st.verifiedRow}>
              <View style={st.avatar}><Text style={st.avatarText}>{verifiedUser.name.charAt(0).toUpperCase()}</Text></View>
              <Text style={[st.rowName, { flex: 1 }]}>{verifiedUser.name}</Text>
              <TouchableOpacity
                style={[st.sendBtn, sending && { opacity: 0.5 }]}
                onPress={sendRequest}
                disabled={sending}
                activeOpacity={0.8}
              >
                {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.sendBtnText}>Send Request</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Friends list */}
          <Text style={[st.sectionTitle, { marginTop: 24 }]}>Friends</Text>
          <Text style={st.sectionDesc}>people you are connected with on LEDGR</Text>

          {/* Search */}
          <View style={st.searchWrap}>
            <Ionicons name="search-outline" size={13} color={Colors.faint} />
            <TextInput
              style={st.searchInput}
              placeholder="search friends..."
              placeholderTextColor={Colors.faint}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={13} color={Colors.faint} />
              </TouchableOpacity>
            )}
          </View>

          {filtered.length === 0 ? (
            <View style={st.empty}>
              <Text style={st.emptyText}>{friends.length === 0 ? 'no friends yet' : 'no results'}</Text>
            </View>
          ) : (
            <View style={st.list}>
              {filtered.map((f, i) => (
                <View key={f.id} style={[st.row, i === filtered.length - 1 && st.rowLast]}>
                  <View style={st.avatar}><Text style={st.avatarText}>{f.name.charAt(0).toUpperCase()}</Text></View>
                  <Text style={st.rowName}>{f.name}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: DC.pagePadding, paddingBottom: 80 },
  sectionTitle: { fontFamily: AppFont.bold, fontSize: 13, color: '#111111', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 2 },
  sectionDesc:  { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginBottom: 10 },
  addRow:  { flexDirection: 'row', gap: 8, marginBottom: 6 },
  codeInput: { flex: 1, fontFamily: AppFont.regular, fontSize: 14, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.borderMid },
  verifyBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: Radius.lg, backgroundColor: TEAL + '33', borderWidth: 1, borderColor: TEAL, justifyContent: 'center' },
  verifyBtnText: { fontFamily: AppFont.semiBold, fontSize: 13, color: TEAL },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 4 },
  sendBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: TEAL },
  sendBtnText: { fontFamily: AppFont.semiBold, fontSize: 12, color: '#ffffff' },
  errorText:   { fontFamily: AppFont.regular, fontSize: 12, color: '#FF5757', marginBottom: 6 },
  successText: { fontFamily: AppFont.regular, fontSize: 12, color: TEAL, marginBottom: 6 },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: DC.cardBorder, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: DC.cardBg, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: AppFont.regular, fontSize: 13, color: DC.pageText, padding: 0 },
  list:    { gap: 0 },
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  rowLast: { borderBottomWidth: 0 },
  avatar:  { width: 34, height: 34, borderRadius: 17, backgroundColor: TEAL + '33', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: AppFont.bold, fontSize: 13, color: TEAL },
  rowName: { fontFamily: AppFont.regular, fontSize: 14, color: '#111111' },
  empty:     { alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyText: { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },
});
