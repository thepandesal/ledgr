import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import { useRouter } from 'expo-router';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../../src/lib/brand';
import { useNav } from '../../../src/lib/NavContext';

interface SplitBillRow {
  id: string;
  name: string;
  created_at: string;
  recording_count: number;
  people_count: number;
  total_amount: number;
  status: 'ongoing' | 'closed';
}

export default function BillSplitScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useUser();
  const { openSplitBill } = useNav();

  const [createModal, setCreateModal] = useState(false);
  const [billName, setBillName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuModal, setMenuModal] = useState(false);
  const [selected, setSelected] = useState<SplitBillRow | null>(null);
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'closed'>('all');
  const [viewMode, setViewMode] = useState<'date' | 'person'>('date');

  // ── Date filter (monthly) ─────────────────────────────────────────────
  const [monthOffset, setMonthOffset] = useState(0);

  const { from: monthFrom, to: monthTo, label: monthLabel } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + monthOffset;
    const from = new Date(y, m, 1);
    const to   = new Date(y, m + 1, 0);
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const d = new Date(y, m, 1);
    return { from, to, label: `${months[d.getMonth()]} ${d.getFullYear()}` };
  }, [monthOffset]);

  const { data: bills = [], isLoading } = useQuery<SplitBillRow[]>({
    queryKey: ['split-bills', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_bills')
        .select('id, name, created_at, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!data) return [];
      const billIds = data.map((b: any) => b.id);
      if (billIds.length === 0) return [];
      const [{ data: allRecordings }, { data: allPeople }] = await Promise.all([
        supabase.from('split_bill_recordings').select('split_bill_id, amount_contributed').in('split_bill_id', billIds),
        supabase.from('bill_splits').select('split_bill_id, person_name').in('split_bill_id', billIds),
      ]);
      return data.map((bill: any) => {
        const recs = (allRecordings ?? []).filter((r: any) => r.split_bill_id === bill.id);
        const people = (allPeople ?? []).filter((p: any) => p.split_bill_id === bill.id);
        return {
          ...bill,
          recording_count: recs.length,
          people_count: new Set(people.map((p: any) => p.person_name)).size,
          total_amount: recs.reduce((s: number, r: any) => s + Number(r.amount_contributed), 0),
          status: bill.status ?? 'ongoing',
        };
      });
    },
    enabled: !!userId,
  });

  // ── Per-person view data ──────────────────────────────────────────────
  const { data: personData = [] } = useQuery<{ person: string; bills: { id: string; name: string; status: string; share: number }[] }[]>({
    queryKey: ['split-bills-by-person', userId],
    queryFn: async () => {
      const { data: allBills } = await supabase
        .from('split_bills')
        .select('id, name, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!allBills || allBills.length === 0) return [];
      const billIds = allBills.map((b: any) => b.id);

      const { data: allPeople } = await supabase
        .from('bill_splits')
        .select('split_bill_id, person_name')
        .in('split_bill_id', billIds);

      const { data: items } = await supabase
        .from('split_items')
        .select('split_bill_id, cost, people, recording_type')
        .in('split_bill_id', billIds);

      // Build per-person per-bill share from items
      const shareMap: Record<string, Record<string, number>> = {};
      (items ?? []).forEach((item: any) => {
        if (!item.people?.length) return;
        const pp = Number(item.cost) / item.people.length;
        item.people.forEach((p: string) => {
          const key = p.toLowerCase();
          if (!shareMap[key]) shareMap[key] = {};
          shareMap[key][item.split_bill_id] = (shareMap[key][item.split_bill_id] ?? 0) + pp;
        });
      });

      // Collect all unique people across all bills
      const peopleMap: Record<string, Set<string>> = {};
      (allPeople ?? []).forEach((row: any) => {
        const key = row.person_name.toLowerCase();
        if (!peopleMap[key]) peopleMap[key] = new Set();
        peopleMap[key].add(row.split_bill_id);
      });

      return Object.entries(peopleMap)
        .map(([person, billSet]) => ({
          person,
          bills: [...billSet].map(billId => {
            const bill = allBills.find((b: any) => b.id === billId);
            return {
              id: billId,
              name: bill?.name ?? '',
              status: bill?.status ?? 'ongoing',
              share: shareMap[person]?.[billId] ?? 0,
            };
          }).filter(b => b.name),
        }))
        .filter(p => p.bills.length > 0)
        .sort((a, b) => a.person.localeCompare(b.person));
    },
    enabled: !!userId,
  });

  const handleCreate = async () => {
    if (!billName.trim()) { setError('name is required.'); return; }
    setLoading(true);
    const { data, error: err } = await supabase.from('split_bills')
      .insert({ user_id: userId, name: billName.trim() })
      .select('id')
      .single();
    if (err) { setError(err.message); setLoading(false); return; }
    queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    queryClient.invalidateQueries({ queryKey: ['split-bills-by-person', userId] });
    setLoading(false);
    setCreateModal(false);
    setBillName('');
    setDisplayCount(10);
    openSplitBill(data.id, billName.trim());
  };

  const handleToggleStatus = async () => {
    if (!selected) return;
    setMenuModal(false);
    const newStatus = selected.status === 'ongoing' ? 'closed' : 'ongoing';
    await supabase.from('split_bills').update({ status: newStatus }).eq('id', selected.id);
    queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    queryClient.invalidateQueries({ queryKey: ['split-bills-by-person', userId] });
  };

  const handleDelete = async () => {
    if (!selected) return;
    setMenuModal(false);
    await supabase.from('split_bills').delete().eq('id', selected.id);
    queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    queryClient.invalidateQueries({ queryKey: ['split-bills-by-person', userId] });
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      const d = new Date(b.created_at);
      if (d < monthFrom || d > monthTo) return false;
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      return true;
    });
  }, [bills, monthFrom, monthTo, statusFilter]);

  // Group paginated bills by date
  const grouped = useMemo(() => {
    const paged = filteredBills.slice(0, displayCount);
    const map: Record<string, SplitBillRow[]> = {};
    paged.forEach(b => {
      const d = new Date(b.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return Object.entries(map);
  }, [filteredBills, displayCount]);

  // Filter person data by status
  const filteredPersonData = useMemo(() => {
    return personData.map(p => ({
      ...p,
      bills: p.bills.filter(b => statusFilter === 'all' || b.status === statusFilter),
    })).filter(p => p.bills.length > 0);
  }, [personData, statusFilter]);

  const hasMore = displayCount < filteredBills.length;

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    if (isCloseToBottom && hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => { setDisplayCount(prev => prev + 10); setIsLoadingMore(false); }, 300);
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    await queryClient.invalidateQueries({ queryKey: ['split-bills-by-person', userId] });
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <ActivityIndicator color={Brand.color.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Filter row */}
            <View style={s.filterRow}>
              {/* Status chips */}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                {(['all', 'ongoing', 'closed'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[s.filterChip, statusFilter === f && s.filterChipActive]}
                    onPress={() => { setStatusFilter(f); setDisplayCount(10); }}
                  >
                    <Text style={[s.filterChipText, statusFilter === f && s.filterChipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* View toggle */}
              <View style={s.viewToggle}>
                <TouchableOpacity
                  style={[s.toggleBtn, viewMode === 'date' && s.toggleBtnActive]}
                  onPress={() => setViewMode('date')}
                >
                  <Ionicons name="calendar-outline" size={13} color={viewMode === 'date' ? Brand.color.accentDark : Colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.toggleBtn, viewMode === 'person' && s.toggleBtnActive]}
                  onPress={() => setViewMode('person')}
                >
                  <Ionicons name="people-outline" size={13} color={viewMode === 'person' ? Brand.color.accentDark : Colors.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Date nav — only in date mode */}
            {viewMode === 'date' && (
              <View style={s.dateNav}>
                <TouchableOpacity style={s.dateNavArrow} onPress={() => { setMonthOffset(o => o - 1); setDisplayCount(10); }} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={14} color={Brand.color.accentDark} />
                </TouchableOpacity>
                <View style={s.dateLabelBtn}>
                  <Ionicons name="calendar-outline" size={13} color={Brand.color.accentDark} />
                  <Text style={s.dateLabelText}>{monthLabel}</Text>
                </View>
                <TouchableOpacity style={s.dateNavArrow} onPress={() => { setMonthOffset(o => o + 1); setDisplayCount(10); }} activeOpacity={0.7}>
                  <Ionicons name="chevron-forward" size={14} color={Brand.color.accentDark} />
                </TouchableOpacity>
              </View>
            )}

            {/* BY DATE view */}
            {viewMode === 'date' && (
              filteredBills.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Ionicons name="people-outline" size={32} color={Colors.faint} />
                  <Text style={Brand.type.emptyText}>{bills.length === 0 ? 'no split bills yet — tap + to create one' : `no ${statusFilter === 'all' ? '' : statusFilter + ' '}split bills in ${monthLabel}`}</Text>
                </View>
              ) : (
                <View style={s.list}>
                  {grouped.map(([dateLabel, groupBills]) => (
                    <View key={dateLabel}>
                      <View style={s.dateHeaderRow}>
                        <Text style={s.dateHeaderText}>{dateLabel}</Text>
                      </View>
                      {groupBills.map(bill => (
                        <TouchableOpacity
                          key={bill.id}
                          style={s.card}
                          activeOpacity={0.85}
                          onPress={() => openSplitBill(bill.id, bill.name)}
                        >
                          <View style={s.cardIconWrap}>
                            <Ionicons name="people-outline" size={18} color={Brand.color.headerText} />
                          </View>
                          <View style={s.cardMid}>
                            <Text style={s.cardName} numberOfLines={1}>{bill.name}</Text>
                            <Text style={s.cardMeta}>
                              {bill.recording_count} recording{bill.recording_count !== 1 ? 's' : ''} · {bill.people_count} {bill.people_count !== 1 ? 'people' : 'person'}
                            </Text>
                          </View>
                          <View style={[s.statusBadge, bill.status === 'closed' && s.statusBadgeClosed]}>
                            <Text style={[s.statusBadgeText, bill.status === 'closed' && s.statusBadgeTextClosed]}>{bill.status}</Text>
                          </View>
                          <Text style={s.cardAmount}>{fmt(bill.total_amount)}</Text>
                          <TouchableOpacity onPress={() => { setSelected(bill); setMenuModal(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
                            <Ionicons name="ellipsis-horizontal" size={15} color={Colors.muted} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                  {hasMore && (
                    <View style={s.loadMoreWrap}>
                      {isLoadingMore
                        ? <ActivityIndicator color={Brand.color.accent} size="small" />
                        : <Text style={s.loadMoreText}>scroll for more</Text>}
                    </View>
                  )}
                </View>
              )
            )}

            {/* BY PERSON view */}
            {viewMode === 'person' && (
              filteredPersonData.length === 0 ? (
                <View style={s.emptyWrap}>
                  <Ionicons name="people-outline" size={32} color={Colors.faint} />
                  <Text style={Brand.type.emptyText}>no people found</Text>
                </View>
              ) : (
                <View style={s.list}>
                  {filteredPersonData.map(p => (
                    <View key={p.person}>
                      <View style={s.dateHeaderRow}>
                        <Text style={s.dateHeaderText}>{p.person}</Text>
                      </View>
                      {p.bills.map(b => (
                        <TouchableOpacity
                          key={b.id}
                          style={s.card}
                          activeOpacity={0.85}
                          onPress={() => openSplitBill(b.id, b.name)}
                        >
                          <View style={s.cardIconWrap}>
                            <Ionicons name="people-outline" size={18} color={Brand.color.headerText} />
                          </View>
                          <View style={s.cardMid}>
                            <Text style={s.cardName} numberOfLines={1}>{b.name}</Text>
                          </View>
                          <View style={[s.statusBadge, b.status === 'closed' && s.statusBadgeClosed]}>
                            <Text style={[s.statusBadgeText, b.status === 'closed' && s.statusBadgeTextClosed]}>{b.status}</Text>
                          </View>
                          {b.share > 0 && <Text style={s.cardAmount}>{fmt(b.share)}</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              )
            )}
          </>
        )}

        <Text style={[Brand.type.footer, { marginTop: 32 }]}>managed by LEDGR</Text>
      </ScrollView>

      <BottomSheet visible={createModal} onClose={() => setCreateModal(false)} title="new split bill" height="35%">
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Text style={s.label}>name</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. dinner with friends"
          placeholderTextColor={Colors.faint}
          value={billName}
          onChangeText={v => { setBillName(v); setError(''); }}
          autoFocus
        />
        <TouchableOpacity
          style={[s.saveBtn, (!billName.trim() || loading) && { opacity: 0.4 }]}
          onPress={handleCreate}
          disabled={loading || !billName.trim()}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color={Brand.color.accentText} /> : <Text style={s.saveBtnText}>create</Text>}
        </TouchableOpacity>
      </BottomSheet>

      <ConfirmModal
        visible={menuModal}
        onClose={() => setMenuModal(false)}
        title={selected?.name?.toLowerCase() ?? 'split bill'}
        actions={[
          { label: 'cancel', onPress: () => setMenuModal(false), muted: true },
          { label: selected?.status === 'ongoing' ? 'mark closed' : 'mark ongoing', onPress: handleToggleStatus },
          { label: 'delete', onPress: handleDelete, destructive: true },
        ]}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll:    { paddingHorizontal: Spacing.page, paddingTop: 20, paddingBottom: 60 },

  emptyWrap: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  list: {},

  filterRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  filterChip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  filterChipActive:     { backgroundColor: Brand.color.accent, borderColor: Brand.color.accent },
  filterChipText:       { fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted },
  filterChipTextActive: { fontFamily: Brand.font.monoBold, fontSize: 12, color: Brand.color.accentText },

  viewToggle:      { flexDirection: 'row', borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, overflow: 'hidden' },
  toggleBtn:       { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: Colors.surface },
  toggleBtnActive: { backgroundColor: Brand.color.accent + '44' },

  dateNav:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  dateNavArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  dateLabelBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderMid },
  dateLabelText: { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.text },

  dateHeaderRow:  { marginTop: 12, marginBottom: 6, paddingTop: 12 },
  dateHeaderText: { fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted, letterSpacing: 1.4, textTransform: 'uppercase' },

  card:         { backgroundColor: Colors.white, paddingVertical: Brand.spacing.card, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cardIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.color.headerBg },
  cardMid:      { flex: 1, gap: 2 },
  cardName:     { ...Brand.type.cardTitle },
  cardMeta:     { ...Brand.type.cardMeta },
  cardAmount:   { ...Brand.type.cardAmount, color: Brand.color.headerText },

  statusBadge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: Brand.color.accent + '44' },
  statusBadgeClosed:     { backgroundColor: Colors.surface },
  statusBadgeText:       { fontFamily: Brand.font.monoBold, fontSize: 9, color: Brand.color.accentDark, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusBadgeTextClosed: { color: Colors.muted },

  loadMoreWrap: { alignItems: 'center', paddingVertical: 20 },
  loadMoreText: { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted },

  error:       { ...Brand.type.cardMeta, color: Colors.expense, marginBottom: 8 },
  label:       { ...Brand.type.modalLabel, marginBottom: 6, marginTop: 14 },
  input:       { ...Brand.type.modalInput, backgroundColor: Colors.white, borderRadius: Brand.radius.input, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },
  saveBtn:     { backgroundColor: Brand.color.accent, borderRadius: Brand.radius.btn, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { ...Brand.type.modalBtn },
});
