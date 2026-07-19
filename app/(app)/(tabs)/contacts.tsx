import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../../src/lib/brand';
import BottomSheet from '@/components/ui/BottomSheet';

const ACCENT      = Brand.color.accent;
const ACCENT_DARK = Brand.color.accentDark;

export default function ContactsScreen({ isActive }: { isActive?: boolean }) {
  const { userId } = useUser();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isActive && userId) {
      queryClient.invalidateQueries({ queryKey: ['friends', userId] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests-incoming', userId] });
      queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
    }
  }, [isActive, userId]);

  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [responding, setResponding] = useState<string | null>(null);

  // ── Add friend modal ──────────────────────────────────────────────────────
  const [addModal, setAddModal] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [addResult, setAddResult] = useState<{ id: string; name: string; code: string } | null>(null);
  const [addError, setAddError] = useState('');
  const [addSearching, setAddSearching] = useState(false);
  const [addSending, setAddSending] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  const searchByCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setAddSearching(true);
    setAddError('');
    setAddResult(null);
    setAddSuccess(false);
    const { data: setting } = await supabase
      .from('user_settings')
      .select('user_id, profile_code')
      .eq('profile_code', code)
      .maybeSingle();
    if (!setting) { setAddError('no user found with that code'); setAddSearching(false); return; }
    if (setting.user_id === userId) { setAddError('that\'s your own code'); setAddSearching(false); return; }
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(`and(requester_id.eq.${userId},receiver_id.eq.${setting.user_id}),and(requester_id.eq.${setting.user_id},receiver_id.eq.${userId})`)
      .maybeSingle();
    if (existing?.status === 'accepted') { setAddError('you are already friends'); setAddSearching(false); return; }
    if (existing?.status === 'pending') { setAddError('friend request already sent'); setAddSearching(false); return; }
    const { data: nameData } = await supabase.rpc('get_user_display_name', { user_id: setting.user_id });
    setAddResult({ id: setting.user_id, name: nameData ?? 'unknown user', code });
    setAddSearching(false);
  };

  const sendRequest = async () => {
    if (!addResult) return;
    setAddSending(true);
    await supabase.from('friendships').insert({ requester_id: userId, receiver_id: addResult.id, status: 'pending' });
    await supabase.from('notifications').insert({
      user_id: addResult.id, type: 'friend_request',
      title: `${userName} sent you a friend request`,
      body: 'tap to accept or decline',
      message: 'tap to accept or decline',
      data: { requesterId: userId },
      is_read: false, status: 'new',
    });
    setAddSending(false);
    setAddSuccess(true);
    setAddResult(null);
    setCodeInput('');
    queryClient.invalidateQueries({ queryKey: ['friend-requests-outgoing', userId] });
  };

  const closeAddModal = () => { setAddModal(false); setCodeInput(''); setAddResult(null); setAddError(''); setAddSuccess(false); };

  // ── Outgoing pending requests ─────────────────────────────────────────────
  const { data: outgoing = [] } = useQuery<{ id: string; receiver_name: string; receiver_code: string }[]>({
    queryKey: ['friend-requests-outgoing', userId],
    queryFn: async () => {
      const { data } = await supabase.from('friendships').select('id, receiver_id').eq('requester_id', userId).eq('status', 'pending');
      if (!data || data.length === 0) return [];
      const ids = data.map((r: any) => r.receiver_id);
      const { data: settings } = await supabase.from('user_settings').select('user_id, profile_code').in('user_id', ids);
      const names = await Promise.all(ids.map((id: string) =>
        supabase.rpc('get_user_display_name', { user_id: id }).then(({ data: n }) => ({ id, name: n ?? 'unknown' }))
      ));
      return data.map((r: any) => {
        const setting = (settings ?? []).find((s: any) => s.user_id === r.receiver_id);
        const nameRow = names.find((n: any) => n.id === r.receiver_id);
        return { id: r.id, receiver_name: nameRow?.name ?? 'unknown', receiver_code: setting?.profile_code ?? '' };
      });
    },
    enabled: !!userId,
  });

  const cancelRequest = async (id: string) => {
    await supabase.from('friendships').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['friend-requests-outgoing', userId] });
  };

  // ── Friends (accepted) ────────────────────────────────────────────────────
  const { data: friends = [] } = useQuery<{ id: string; name: string; code: string }[]>({
    queryKey: ['friends', userId],
    queryFn: async () => {
      const { data } = await supabase.from('friendships').select('id, requester_id, receiver_id').eq('status', 'accepted').or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
      if (!data || data.length === 0) return [];
      const friendIds = data.map((r: any) => r.requester_id === userId ? r.receiver_id : r.requester_id);
      const { data: settings } = await supabase.from('user_settings').select('user_id, profile_code').in('user_id', friendIds);
      const names = await Promise.all(friendIds.map((id: string) =>
        supabase.rpc('get_user_display_name', { user_id: id }).then(({ data: n }) => ({ id, name: n ?? 'unknown user' }))
      ));
      return friendIds.map((id: string) => {
        const setting = (settings ?? []).find((s: any) => s.user_id === id);
        const nameRow = names.find((n: any) => n.id === id);
        return { id, name: nameRow?.name ?? 'unknown user', code: setting?.profile_code ?? '' };
      }).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!userId,
  });

  // ── Incoming friend requests ──────────────────────────────────────────────
  const { data: incoming = [] } = useQuery<{ id: string; requester_id: string; requester_name: string; requester_code: string }[]>({
    queryKey: ['friend-requests-incoming', userId],
    queryFn: async () => {
      const { data } = await supabase.from('friendships').select('id, requester_id').eq('receiver_id', userId).eq('status', 'pending');
      if (!data || data.length === 0) return [];
      const ids = data.map((r: any) => r.requester_id);
      const { data: settings } = await supabase.from('user_settings').select('user_id, profile_code').in('user_id', ids);
      const names = await Promise.all(ids.map((id: string) =>
        supabase.rpc('get_user_display_name', { user_id: id }).then(({ data: n }) => ({ id, name: n ?? 'unknown user' }))
      ));
      return data.map((r: any) => {
        const setting = (settings ?? []).find((s: any) => s.user_id === r.requester_id);
        const nameRow = names.find((n: any) => n.id === r.requester_id);
        return { id: r.id, requester_id: r.requester_id, requester_name: nameRow?.name ?? 'unknown user', requester_code: setting?.profile_code ?? '' };
      });
    },
    enabled: !!userId,
  });

  const handleRespond = async (friendshipId: string, accept: boolean) => {
    setResponding(friendshipId);
    const req = incoming.find(r => r.id === friendshipId);
    await supabase.from('friendships').update({ status: accept ? 'accepted' : 'declined' }).eq('id', friendshipId);
    if (accept && req) {
      await supabase.from('notifications').insert({
        user_id: req.requester_id, type: 'friend_request_accepted',
        title: `${userName} accepted your friend request`,
        body: 'you are now friends on Ledgr',
        message: 'you are now friends on Ledgr',
        data: { friendId: userId },
        is_read: false, status: 'new',
      });
    }
    queryClient.invalidateQueries({ queryKey: ['friend-requests-incoming', userId] });
    queryClient.invalidateQueries({ queryKey: ['friends', userId] });
    setResponding(null);
  };

  // ── Manual contacts ───────────────────────────────────────────────────────
  const { data: contacts = [], isLoading } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['contacts', userId],
    queryFn: async () => {
      const { data } = await supabase.from('contacts').select('id, name').eq('user_id', userId).order('name');
      return data ?? [];
    },
    enabled: !!userId,
  });

  const handleDelete = async () => {
    if (!selected) return;
    await supabase.from('contacts').delete().eq('id', selected.id);
    queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
    setDeleteModal(false);
    setSelected(null);
  };

  const filtered = contacts.filter(c => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={14} color={Colors.faint} />
          <TextInput style={s.searchInput} placeholder="search contacts..." placeholderTextColor={Colors.faint} value={search} onChangeText={setSearch} />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close" size={14} color={Colors.faint} /></TouchableOpacity>}
        </View>

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionHeader}>friend requests</Text>
              <View style={s.badge}><Text style={s.badgeText}>{incoming.length}</Text></View>
            </View>
            <View style={s.list}>
              {incoming.map(req => (
                <View key={req.id} style={s.row}>
                  <View style={s.avatar}><Text style={s.avatarText}>{(req.requester_name ?? '?').charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.name}>{req.requester_name}</Text>
                    <Text style={s.code}>{req.requester_code}</Text>
                  </View>
                  <TouchableOpacity style={s.declineBtn} onPress={() => handleRespond(req.id, false)} disabled={responding === req.id} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close" size={14} color={Colors.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.acceptBtn} onPress={() => handleRespond(req.id, true)} disabled={responding === req.id}>
                    {responding === req.id ? <ActivityIndicator size="small" color={ACCENT_DARK} /> : <Ionicons name="checkmark" size={14} color={ACCENT_DARK} />}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={s.divider} />
          </>
        )}

        {/* Friends */}
        <View style={s.sectionRow}>
          <Text style={s.sectionHeader}>friends</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setAddModal(true)} activeOpacity={0.8}>
            <Ionicons name="person-add-outline" size={12} color={ACCENT_DARK} />
            <Text style={s.addBtnText}>add friend</Text>
          </TouchableOpacity>
        </View>

        {/* Outgoing pending */}
        {outgoing.map(req => (
          <View key={req.id} style={s.row}>
            <View style={s.avatar}><Text style={s.avatarText}>{req.receiver_name.charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.name}>{req.receiver_name}</Text>
              <Text style={s.code}>{req.receiver_code} · pending</Text>
            </View>
            <TouchableOpacity onPress={() => cancelRequest(req.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close-circle-outline" size={16} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Accepted friends */}
        {friends.length === 0 && outgoing.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="people-outline" size={28} color={Colors.faint} />
            <Text style={Brand.type.emptyText}>no friends yet — add by profile code</Text>
          </View>
        ) : (
          <View style={s.list}>
            {friends.map(f => (
              <View key={f.id} style={s.row}>
                <View style={s.avatar}><Text style={s.avatarText}>{f.name.charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.name}>{f.name}</Text>
                  <Text style={s.code}>{f.code}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={16} color={ACCENT_DARK} />
              </View>
            ))}
          </View>
        )}

        {/* Manual contacts */}
        <View style={[s.sectionRow, { marginTop: 24 }]}>
          <Text style={s.sectionHeader}>manual contacts</Text>
          <Text style={s.sectionCount}>{contacts.length}</Text>
        </View>
        {isLoading ? (
          <ActivityIndicator color={ACCENT_DARK} style={{ marginTop: 16 }} />
        ) : filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="person-outline" size={28} color={Colors.faint} />
            <Text style={Brand.type.emptyText}>{contacts.length === 0 ? 'contacts added via split bill appear here' : 'no contacts match your search'}</Text>
          </View>
        ) : (
          <View style={s.list}>
            {filtered.map(c => (
              <View key={c.id} style={s.row}>
                <View style={s.avatar}><Text style={s.avatarText}>{c.name.charAt(0).toUpperCase()}</Text></View>
                <Text style={s.name}>{c.name}</Text>
                <TouchableOpacity onPress={() => { setSelected(c); setDeleteModal(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="ellipsis-horizontal" size={15} color={Colors.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={[Brand.type.footer, { marginTop: 32 }]}>managed by LEDGR</Text>
      </ScrollView>

      <BottomSheet visible={deleteModal} onClose={() => setDeleteModal(false)} title={selected?.name?.toLowerCase() ?? 'contact'}>
        <Text style={s.modalHint}>this only removes the contact from your list. it won't affect any split bills.</Text>
        <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} activeOpacity={0.8}><Text style={s.deleteBtnText}>remove contact</Text></TouchableOpacity>
        <TouchableOpacity style={s.cancelBtn} onPress={() => setDeleteModal(false)} activeOpacity={0.8}><Text style={s.cancelBtnText}>cancel</Text></TouchableOpacity>
      </BottomSheet>

      {/* Add friend modal */}
      <BottomSheet visible={addModal} onClose={closeAddModal} title="add friend">
        <Text style={s.modalHint}>enter a friend's profile code to send them a request.</Text>
        <View style={s.codeInputRow}>
          <TextInput
            style={s.codeInput} placeholder="LDGR-XXXX" placeholderTextColor={Colors.faint}
            value={codeInput} onChangeText={v => { setCodeInput(v.toUpperCase()); setAddError(''); setAddResult(null); setAddSuccess(false); }}
            autoCapitalize="characters" autoCorrect={false} maxLength={9} returnKeyType="search" onSubmitEditing={searchByCode}
          />
          <TouchableOpacity style={[s.searchBtn, (!codeInput.trim() || addSearching) && { opacity: 0.4 }]} onPress={searchByCode} disabled={!codeInput.trim() || addSearching} activeOpacity={0.8}>
            {addSearching ? <ActivityIndicator size="small" color={ACCENT_DARK} /> : <Ionicons name="search-outline" size={16} color={ACCENT_DARK} />}
          </TouchableOpacity>
        </View>
        {addError ? <Text style={s.addError}>{addError}</Text> : null}
        {addSuccess ? (
          <View style={s.addSuccessWrap}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.income} />
            <Text style={s.addSuccessText}>friend request sent!</Text>
          </View>
        ) : null}
        {addResult && !addSuccess ? (
          <View style={s.addResultWrap}>
            <View style={s.avatar}><Text style={s.avatarText}>{addResult.name.charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.name}>{addResult.name}</Text>
              <Text style={s.code}>{addResult.code}</Text>
            </View>
            <TouchableOpacity style={[s.acceptBtn, { paddingHorizontal: 14, width: 'auto' as any, borderRadius: Radius.pill }]} onPress={sendRequest} disabled={addSending} activeOpacity={0.8}>
              {addSending ? <ActivityIndicator size="small" color={ACCENT_DARK} /> : <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 12, color: ACCENT_DARK }}>send request</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll:    { paddingHorizontal: Spacing.page, paddingTop: 20, paddingBottom: 60 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 24, backgroundColor: Colors.surface },
  searchInput: { flex: 1, fontFamily: Fonts.mono, fontSize: 13, color: Colors.text },
  sectionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionHeader: { ...Brand.type.sectionHeader },
  sectionCount:  { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  badge:     { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: ACCENT + '44', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontFamily: Brand.font.monoBold, fontSize: 10, color: ACCENT_DARK },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 20 },
  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill, backgroundColor: ACCENT + '44' },
  addBtnText: { fontFamily: Brand.font.monoBold, fontSize: 11, color: ACCENT_DARK },
  emptyWrap: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  list: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: ACCENT + '44', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: Brand.font.monoBold, fontSize: 14, color: ACCENT_DARK },
  name:       { fontFamily: Brand.font.heading, fontSize: 14, color: Colors.text },
  code:       { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, letterSpacing: 1 },
  acceptBtn:  { width: 30, height: 30, borderRadius: 15, backgroundColor: ACCENT + '44', alignItems: 'center', justifyContent: 'center' },
  declineBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderMid },
  codeInputRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  codeInput:      { flex: 1, fontFamily: Fonts.monoBold, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, letterSpacing: 2 },
  searchBtn:      { width: 44, height: 44, borderRadius: Radius.lg, backgroundColor: ACCENT + '44', alignItems: 'center', justifyContent: 'center' },
  addError:       { fontFamily: Fonts.mono, fontSize: 12, color: Colors.expense, marginBottom: 8 },
  addSuccessWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  addSuccessText: { fontFamily: Brand.font.monoBold, fontSize: 13, color: Colors.income },
  addResultWrap:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  modalHint:     { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, marginBottom: 16 },
  deleteBtn:     { backgroundColor: Colors.expense + '18', borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.expense + '66' },
  deleteBtnText: { fontFamily: Brand.font.monoBold, fontSize: 14, color: Colors.expense },
  cancelBtn:     { backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { fontFamily: Brand.font.monoBold, fontSize: 14, color: Colors.muted },
});
