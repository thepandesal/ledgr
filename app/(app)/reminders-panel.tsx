import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, RefreshControl, TextInput, Modal,
} from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { AppFont } from '../../src/lib/fonts';
import { DC } from '../../src/lib/design';
import PageHeader from '@/components/ui/PageHeader';
import { useNav } from '../../src/lib/NavContext';
import GooeyLoader from '@/components/ui/GooeyLoader';
import { BlurView } from 'expo-blur';
import { isReminderDueToday, reminderFrequencyLabel } from '../../src/lib/reminderUtils';
import BottomSheet from '@/components/ui/BottomSheet';

const TEAL = '#9cd7d2';
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayStr = new Date().toISOString().split('T')[0];

interface Props { onClose: () => void; }

export default function RemindersPanel({ onClose }: Props) {
  const { userId } = useUser();
  const { openRecording } = useNav();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

  // Action modal state
  const [selectedReminder, setSelectedReminder] = useState<any>(null);
  const [showActions, setShowActions] = useState(false);
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [fulfillAmount, setFulfillAmount] = useState('');
  const [fulfillSaving, setFulfillSaving] = useState(false);
  const [fulfillIsPartial, setFulfillIsPartial] = useState(false);
  const [fulfillDay, setFulfillDay] = useState(String(new Date().getDate()));
  const [fulfillMonth, setFulfillMonth] = useState(String(new Date().getMonth() + 1));
  const [fulfillYear, setFulfillYear] = useState(String(new Date().getFullYear()));
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveMode, setMoveMode] = useState<'copy' | 'move'>('move');
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [moveSaving, setMoveSaving] = useState(false);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

  const { data: reminders = [], isLoading: loadingReminders } = useQuery({
    queryKey: ['reminders-panel', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recording_reminders')
        .select('id, name, frequency, day_of_week, day_of_month, start_date, end_date, status, recording_type, workspace_id, spaces:workspace_id(name)')
        .eq('user_id', userId)
        .order('name', { ascending: true });
      return (data ?? []).map((r: any) => ({
        ...r,
        space: Array.isArray(r.spaces) ? r.spaces[0] : r.spaces,
      }));
    },
    enabled: !!userId,
  });

  const { data: fulfilledRecs = [], isLoading: loadingRecs } = useQuery({
    queryKey: ['reminders-panel-recs', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('id, name, amount, type, status, transaction_date, reminder_id')
        .eq('user_id', userId)
        .not('reminder_id', 'is', null)
        .neq('status', 'voided')
        .order('transaction_date', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces-list', userId],
    queryFn: async () => {
      const { data } = await supabase.from('spaces').select('id, name').eq('user_id', userId).eq('is_active', true).order('name');
      return data ?? [];
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`reminders-panel-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recording_reminders', filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['reminders-panel', userId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings', filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['reminders-panel-recs', userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['reminders-panel', userId] }),
      queryClient.invalidateQueries({ queryKey: ['reminders-panel-recs', userId] }),
    ]);
    setRefreshing(false);
  };

  const isLoading = loadingReminders || loadingRecs;

  const fulfilledMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    fulfilledRecs.forEach((r: any) => {
      if (!map[r.reminder_id]) map[r.reminder_id] = [];
      map[r.reminder_id].push(r);
    });
    return map;
  }, [fulfilledRecs]);

  const filtered = reminders.filter((r: any) => statusFilter === 'all' || r.status === statusFilter);
  // Fulfilled = has a recording with paid/received status this month
  const fulfilledFully = (id: string) => fulfilledMap[id]?.some((r: any) => r.status === 'paid' || r.status === 'received') ?? false;
  // Partial = has recordings this month but none are fully paid/received
  const fulfilledPartially = (id: string) => !fulfilledFully(id) && (fulfilledMap[id]?.length ?? 0) > 0;

  const fulfilled   = filtered.filter((r: any) => r.status === 'active' && fulfilledFully(r.id));
  const ongoing     = filtered.filter((r: any) => r.status === 'active' && !fulfilledFully(r.id) && fulfilledPartially(r.id));
  const notYet      = filtered.filter((r: any) => r.status === 'active' && !fulfilledFully(r.id) && !fulfilledPartially(r.id));
  const paused      = filtered.filter((r: any) => r.status === 'paused');

  const openActions = (r: any) => { setSelectedReminder(r); setShowActions(true); };

  const handleFulfill = async () => {
    if (!selectedReminder || !fulfillAmount) return;
    setFulfillSaving(true);
    const pad = (n: string) => String(n).padStart(2, '0');
    const txDate = `${fulfillYear}-${pad(fulfillMonth)}-${pad(fulfillDay)}`;
    await supabase.from('recordings').insert({
      user_id: userId,
      space_id: selectedReminder.workspace_id ?? null,
      name: selectedReminder.name,
      type: selectedReminder.recording_type,
      amount: parseFloat(fulfillAmount),
      transaction_date: txDate,
      status: fulfillIsPartial ? 'partial' : (selectedReminder.recording_type === 'income' ? 'received' : 'paid'),
      reminder_id: selectedReminder.id,
    });
    setFulfillSaving(false);
    setShowFulfillModal(false);
    setFulfillAmount('');
    setFulfillIsPartial(false);
    setShowMonthDropdown(false);
    const today = new Date();
    setFulfillDay(String(today.getDate()));
    setFulfillMonth(String(today.getMonth() + 1));
    setFulfillYear(String(today.getFullYear()));
    queryClient.invalidateQueries({ queryKey: ['reminders-panel-recs', userId] });
  };

  const handleDelete = async () => {
    if (!selectedReminder) return;
    await supabase.from('recording_reminders').delete().eq('id', selectedReminder.id);
    setShowActions(false);
    queryClient.invalidateQueries({ queryKey: ['reminders-panel', userId] });
  };

  const handleMoveOrCopy = async () => {
    if (!selectedReminder || !selectedSpaceId) return;
    setMoveSaving(true);
    if (moveMode === 'move') {
      await supabase.from('recording_reminders').update({ workspace_id: selectedSpaceId }).eq('id', selectedReminder.id);
    } else {
      const { id, created_at, ...rest } = selectedReminder;
      await supabase.from('recording_reminders').insert({ ...rest, workspace_id: selectedSpaceId, user_id: userId });
    }
    setMoveSaving(false);
    setShowMoveModal(false);
    queryClient.invalidateQueries({ queryKey: ['reminders-panel', userId] });
  };

  const renderFulfilledCard = (r: any, i: number, arr: any[]) => {
    const recs = fulfilledMap[r.id] ?? [];
    return (
      <TouchableOpacity key={r.id} style={[st.card, i === arr.length - 1 && { marginBottom: 0 }]} activeOpacity={0.85} onLongPress={() => openActions(r)}>
        <View style={st.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={st.cardName} numberOfLines={1}>{r.name}</Text>
            {r.space?.name && <Text style={st.spaceName}>{r.space.name}</Text>}
            <Text style={st.cardSub}>{reminderFrequencyLabel(r)} · {r.recording_type}</Text>
          </View>
          <TouchableOpacity onPress={() => openActions(r)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={[st.badge, { backgroundColor: '#4f928922' }]}>
              <Text style={[st.badgeText, { color: '#4f9289' }]}>fulfilled</Text>
            </View>
          </TouchableOpacity>
        </View>
        {recs.map((rec: any, ri: number) => (
          <TouchableOpacity key={rec.id} style={[st.recRow, ri === recs.length - 1 && { borderBottomWidth: 0 }]} activeOpacity={0.7} onPress={() => openRecording(rec.id)}>
            <View style={{ flex: 1 }}>
              <Text style={st.recName} numberOfLines={1}>{rec.name}</Text>
              <Text style={st.recMeta}>{new Date(rec.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {rec.type}</Text>
            </View>
            <Text style={st.recAmount}>{fmt(Number(rec.amount))}</Text>
          </TouchableOpacity>
        ))}
      </TouchableOpacity>
    );
  };

  const renderSimpleRow = (r: any, i: number, arr: any[]) => {
    const hasPartial = fulfilledPartially(r.id);
    const partialRecs = fulfilledMap[r.id] ?? [];
    const isLast = i === arr.length - 1;

    if (hasPartial) {
      return (
        <TouchableOpacity key={r.id} style={[st.card, isLast && { marginBottom: 0 }]} activeOpacity={0.85} onPress={() => openActions(r)}>
          <View style={st.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardName} numberOfLines={1}>{r.name}</Text>
              {r.space?.name && <Text style={st.spaceName}>{r.space.name}</Text>}
              <Text style={st.cardSub}>{reminderFrequencyLabel(r)} · {r.recording_type}</Text>
            </View>
            <View style={[st.badge, { backgroundColor: '#FFAB9122' }]}>
              <Text style={[st.badgeText, { color: '#FFAB91' }]}>partial</Text>
            </View>
          </View>
          {partialRecs.map((rec: any, ri: number) => (
            <TouchableOpacity key={rec.id} style={[st.recRow, ri === partialRecs.length - 1 && { borderBottomWidth: 0 }]} activeOpacity={0.7} onPress={() => openRecording(rec.id)}>
              <View style={{ flex: 1 }}>
                <Text style={st.recName} numberOfLines={1}>{rec.name}</Text>
                <Text style={st.recMeta}>{new Date(rec.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {rec.type}</Text>
              </View>
              <Text style={st.recAmount}>{fmt(Number(rec.amount))}</Text>
            </TouchableOpacity>
          ))}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity key={r.id} style={[st.row, isLast && st.rowLast]} activeOpacity={0.7} onPress={() => openActions(r)}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={st.rowName} numberOfLines={1}>{r.name}</Text>
          {r.space?.name && <Text style={st.spaceName}>{r.space.name}</Text>}
          <Text style={st.rowSub}>{reminderFrequencyLabel(r)} · {r.recording_type}</Text>
          {isReminderDueToday(r, now) && (
            <View style={[st.badge, { backgroundColor: TEAL + '22' }]}>
              <Text style={[st.badgeText, { color: '#4f9289' }]}>due today</Text>
            </View>
          )}
        </View>
        <View style={[st.statusDot, { backgroundColor: r.status === 'active' ? TEAL : Colors.faint }]} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={st.root}>
      <PageHeader title="Reminders" onBack={onClose} titleColor={TEAL} />

      <View style={st.filterRow}>
        {(['all', 'active', 'paused'] as const).map(f => (
          <TouchableOpacity key={f} style={[st.filterBtn, statusFilter === f && st.filterBtnActive]} onPress={() => setStatusFilter(f)} activeOpacity={0.7}>
            <Text style={[st.filterBtnText, statusFilter === f && st.filterBtnTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}><GooeyLoader /></BlurView>
      ) : filtered.length === 0 ? (
        <View style={st.empty}><Text style={st.emptyText}>no reminders found</Text></View>
      ) : (
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

          {fulfilled.length > 0 && (
            <>
              <Text style={st.sectionTitle}>Fulfilled</Text>
              {fulfilled.map((r, i) => renderFulfilledCard(r, i, fulfilled))}
            </>
          )}

          {ongoing.length > 0 && (
            <>
              <Text style={st.sectionTitle}>Ongoing</Text>
              <View style={st.list}>{ongoing.map((r, i) => renderSimpleRow(r, i, ongoing))}</View>
            </>
          )}

          {paused.length > 0 && (
            <>
              <Text style={[st.sectionTitle, { color: Colors.muted }]}>Paused</Text>
              <View style={st.list}>{paused.map((r, i) => renderSimpleRow(r, i, paused))}</View>
            </>
          )}

          {notYet.length > 0 && (
            <>
              <Text style={[st.sectionTitle, { color: Colors.muted }]}>Not Yet Fulfilled</Text>
              <View style={st.list}>{notYet.map((r, i) => renderSimpleRow(r, i, notYet))}</View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── Actions modal ── */}
      <BottomSheet visible={showActions} onClose={() => setShowActions(false)} title={selectedReminder?.name ?? 'reminder'}>
        <TouchableOpacity style={st.actionRow} activeOpacity={0.7} onPress={() => { setShowActions(false); setFulfillAmount(''); setShowFulfillModal(true); }}>
          <Text style={st.actionText}>Fulfill</Text>
          <Text style={st.actionSub}>record a transaction for this reminder</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.actionRow} activeOpacity={0.7} onPress={() => { setShowActions(false); setMoveMode('move'); setSelectedSpaceId(selectedReminder?.workspace_id ?? ''); setShowMoveModal(true); }}>
          <Text style={st.actionText}>Move to Space</Text>
          <Text style={st.actionSub}>change which space this reminder belongs to</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.actionRow} activeOpacity={0.7} onPress={() => { setShowActions(false); setMoveMode('copy'); setSelectedSpaceId(''); setShowMoveModal(true); }}>
          <Text style={st.actionText}>Copy to Space</Text>
          <Text style={st.actionSub}>duplicate this reminder in another space</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.actionRow, { borderBottomWidth: 0 }]} activeOpacity={0.7} onPress={handleDelete}>
          <Text style={[st.actionText, { color: '#FF5757' }]}>Delete</Text>
          <Text style={st.actionSub}>recordings created from this reminder are kept</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Fulfill modal ── */}
      <BottomSheet visible={showFulfillModal} onClose={() => setShowFulfillModal(false)} title="fulfill reminder">
        {/* Info */}
        <View style={{ gap: 4, marginBottom: 16, padding: 12, backgroundColor: Colors.surface, borderRadius: Radius.lg }}>
          {selectedReminder?.space?.name && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 12, color: Colors.muted, width: 60 }}>Space</Text>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: '#111111' }}>{selectedReminder.space.name}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 12, color: Colors.muted, width: 60 }}>Type</Text>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: '#111111' }}>{selectedReminder?.recording_type}</Text>
          </View>
        </View>

        {/* Existing recordings this month */}
        {selectedReminder && (fulfilledMap[selectedReminder.id] ?? []).length > 0 && (
          <>
            <Text style={[st.modalLabel, { marginBottom: 6 }]}>Recordings This Month</Text>
            {(fulfilledMap[selectedReminder.id] ?? []).map((rec: any) => (
              <TouchableOpacity key={rec.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }} activeOpacity={0.7} onPress={() => { setShowFulfillModal(false); openRecording(rec.id); }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: '#111111' }} numberOfLines={1}>{rec.name}</Text>
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted }}>{new Date(rec.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {rec.status}</Text>
                </View>
                <Text style={{ fontFamily: AppFont.bold, fontSize: 13, color: '#111111' }}>{fmt(Number(rec.amount))}</Text>
              </TouchableOpacity>
            ))}
            <View style={{ height: 16 }} />
          </>
        )}

        {/* Partial / Complete toggle */}
        <Text style={[st.modalLabel, { marginBottom: 8 }]}>Payment Type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity style={[st.toggleBtn, !fulfillIsPartial && st.toggleBtnActive]} onPress={() => setFulfillIsPartial(false)} activeOpacity={0.7}>
            <Text style={[st.toggleBtnText, !fulfillIsPartial && st.toggleBtnTextActive]}>Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.toggleBtn, fulfillIsPartial && st.toggleBtnActive]} onPress={() => setFulfillIsPartial(true)} activeOpacity={0.7}>
            <Text style={[st.toggleBtnText, fulfillIsPartial && st.toggleBtnTextActive]}>Partial</Text>
          </TouchableOpacity>
        </View>

        {/* Date */}
        <Text style={[st.modalLabel, { marginBottom: 8 }]}>Transaction Date</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <View style={{ flex: 2 }}>
            <Text style={st.datePickerLabel}>Month</Text>
            <TouchableOpacity
              style={st.dropdown}
              onPress={() => setShowMonthDropdown(v => !v)}
              activeOpacity={0.8}
            >
              <Text style={st.dropdownText}>{['January','February','March','April','May','June','July','August','September','October','November','December'][parseInt(fulfillMonth) - 1]}</Text>
              <Ionicons name={showMonthDropdown ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.muted} />
            </TouchableOpacity>
            {showMonthDropdown && (
              <View style={st.dropdownList}>
                <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, idx) => (
                    <TouchableOpacity
                      key={m}
                      style={[st.dropdownItem, parseInt(fulfillMonth) === idx + 1 && st.dropdownItemActive]}
                      onPress={() => { setFulfillMonth(String(idx + 1)); setShowMonthDropdown(false); }}
                    >
                      <Text style={[st.dropdownItemText, parseInt(fulfillMonth) === idx + 1 && st.dropdownItemTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.datePickerLabel}>Day</Text>
            <TextInput style={st.dateInput} value={fulfillDay} onChangeText={setFulfillDay} keyboardType="number-pad" maxLength={2} placeholder="DD" placeholderTextColor={Colors.faint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.datePickerLabel}>Year</Text>
            <TextInput style={st.dateInput} value={fulfillYear} onChangeText={setFulfillYear} keyboardType="number-pad" maxLength={4} placeholder="YYYY" placeholderTextColor={Colors.faint} />
          </View>
        </View>

        <Text style={st.modalLabel}>Amount</Text>
        <TextInput
          style={st.modalInput}
          placeholder="0.00"
          placeholderTextColor={Colors.faint}
          value={fulfillAmount}
          onChangeText={setFulfillAmount}
          keyboardType="decimal-pad"
          autoFocus
        />
        <TouchableOpacity
          style={[st.modalBtn, (!fulfillAmount || fulfillSaving) && { opacity: 0.4 }]}
          onPress={handleFulfill}
          disabled={!fulfillAmount || fulfillSaving}
          activeOpacity={0.8}
        >
          <Text style={st.modalBtnText}>{fulfillSaving ? 'saving...' : 'Record'}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Move/Copy modal ── */}
      <BottomSheet visible={showMoveModal} onClose={() => setShowMoveModal(false)} title={moveMode === 'move' ? 'Move to Space' : 'Copy to Space'}>
        <Text style={st.modalLabel}>Select Space</Text>
        <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
          {(spaces as any[]).map((sp: any) => (
            <TouchableOpacity
              key={sp.id}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}
              onPress={() => setSelectedSpaceId(sp.id)}
            >
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selectedSpaceId === sp.id ? '#4f9289' : Colors.faint, backgroundColor: selectedSpaceId === sp.id ? '#4f9289' : 'transparent' }} />
              <Text style={{ fontFamily: AppFont.regular, fontSize: 14, color: '#111111' }}>{sp.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[st.modalBtn, (!selectedSpaceId || moveSaving) && { opacity: 0.4 }]}
          onPress={handleMoveOrCopy}
          disabled={!selectedSpaceId || moveSaving}
          activeOpacity={0.8}
        >
          <Text style={st.modalBtnText}>{moveSaving ? 'saving...' : moveMode === 'move' ? 'Move' : 'Copy'}</Text>
        </TouchableOpacity>
      </BottomSheet>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: DC.pagePadding, paddingBottom: 80 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: DC.pagePadding, paddingVertical: 12 },
  filterBtn:           { flex: 1, paddingVertical: DC.pageActionPaddingV, borderRadius: DC.pageActionRadius, backgroundColor: DC.pageActionBg, alignItems: 'center' },
  filterBtnActive:     { backgroundColor: '#111111' },
  filterBtnText:       { fontFamily: AppFont.regular, fontSize: DC.dropdownFontSize, color: DC.pageActionText },
  filterBtnTextActive: { color: '#ffffff', fontFamily: AppFont.semiBold },
  sectionTitle: { fontFamily: AppFont.bold, fontSize: 13, color: '#111111', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 20, marginBottom: 8 },
  list: { gap: 0 },

  card:       { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cardName:   { fontFamily: AppFont.semiBold, fontSize: 14, color: '#111111' },
  cardSub:    { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted },
  spaceName:  { fontFamily: AppFont.regular, fontSize: 12, color: '#9cd7d2' },
  recRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  recName:    { fontFamily: AppFont.regular, fontSize: 13, color: '#111111' },
  recMeta:    { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted },
  recAmount:  { fontFamily: AppFont.bold, fontSize: 13, color: '#111111' },

  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  rowLast: { borderBottomWidth: 0 },
  rowName: { fontFamily: AppFont.regular, fontSize: 14, color: '#111111' },
  rowSub:  { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted },
  badge:   { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  badgeText: { fontFamily: AppFont.semiBold, fontSize: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  actionRow:  { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  actionText: { fontFamily: AppFont.semiBold, fontSize: 15, color: '#111111' },
  actionSub:  { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginTop: 2 },

  modalLabel: { fontFamily: AppFont.semiBold, fontSize: 11, color: DC.pageTextMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  modalInput: { fontFamily: AppFont.regular, fontSize: 16, color: DC.pageText, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 16 },
  modalBtn:   { backgroundColor: DC.btnBg, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center' },
  modalBtnText: { fontFamily: AppFont.semiBold, fontSize: 15, color: DC.btnText },
  toggleBtn:        { flex: 1, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: DC.pageActionBg, alignItems: 'center' },
  toggleBtnActive:  { backgroundColor: '#111111' },
  toggleBtnText:    { fontFamily: AppFont.regular, fontSize: 13, color: DC.pageActionText },
  toggleBtnTextActive: { fontFamily: AppFont.semiBold, color: '#ffffff' },
  datePickerLabel: { fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  dropdown:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.borderMid },
  dropdownText:    { fontFamily: AppFont.regular, fontSize: 14, color: DC.pageText },
  dropdownList:    { position: 'absolute', top: 44, left: 0, right: 0, backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.borderMid, zIndex: 100, overflow: 'hidden' },
  dropdownItem:    { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownItemActive: { backgroundColor: DC.pageActionBg },
  dropdownItemText:   { fontFamily: AppFont.regular, fontSize: 14, color: DC.pageText },
  dropdownItemTextActive: { fontFamily: AppFont.semiBold, color: '#4f9289' },
  dateInput:       { fontFamily: AppFont.regular, fontSize: 15, color: DC.pageText, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid, textAlign: 'center' },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },
});
