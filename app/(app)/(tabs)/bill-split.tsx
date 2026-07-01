import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import { useRouter } from 'expo-router';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../../src/lib/brand';

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

  const [createModal, setCreateModal] = useState(false);
  const [billName, setBillName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuModal, setMenuModal] = useState(false);
  const [selected, setSelected] = useState<SplitBillRow | null>(null);
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'closed'>('all');

  const { data: bills = [], isLoading } = useQuery<SplitBillRow[]>({
    queryKey: ['split-bills', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_bills')
        .select('id, name, created_at, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!data) return [];
      const enriched = await Promise.all(data.map(async (bill: any) => {
        const [{ count: recCount }, { data: people }, { data: recs }] = await Promise.all([
          supabase.from('split_bill_recordings').select('id', { count: 'exact', head: true }).eq('split_bill_id', bill.id),
          supabase.from('bill_splits').select('person_name').eq('split_bill_id', bill.id),
          supabase.from('split_bill_recordings').select('amount_contributed').eq('split_bill_id', bill.id),
        ]);
        const uniquePeople = new Set((people ?? []).map((p: any) => p.person_name)).size;
        const total = (recs ?? []).reduce((s: number, r: any) => s + Number(r.amount_contributed), 0);
        return { ...bill, recording_count: recCount ?? 0, people_count: uniquePeople, total_amount: total, status: bill.status ?? 'ongoing' };
      }));
      return enriched;
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
    setLoading(false);
    setCreateModal(false);
    setBillName('');
    setDisplayCount(10);
    router.push({ pathname: '/(app)/split-bill-detail', params: { splitBillId: data.id, name: billName.trim() } } as any);
  };

  const handleToggleStatus = async () => {
    if (!selected) return;
    setMenuModal(false);
    const newStatus = selected.status === 'ongoing' ? 'closed' : 'ongoing';
    await supabase.from('split_bills').update({ status: newStatus }).eq('id', selected.id);
    queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
  };

  const handleDelete = async () => {
    if (!selected) return;
    setMenuModal(false);
    await supabase.from('split_bills').delete().eq('id', selected.id);
    queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filteredBills = statusFilter === 'all' ? bills : bills.filter(b => b.status === statusFilter);
  const paginatedBills = filteredBills.slice(0, displayCount);
  const hasMore = displayCount < filteredBills.length;

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isCloseToBottom && hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayCount(prev => prev + 10);
        setIsLoadingMore(false);
      }, 300);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView 
        contentContainerStyle={s.scroll} 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >

        {isLoading ? (
          <ActivityIndicator color={Brand.color.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Status filter */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
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
            {filteredBills.length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="people-outline" size={32} color={Colors.faint} />
                <Text style={Brand.type.emptyText}>{bills.length === 0 ? 'no split bills yet — tap + to create one' : `no ${statusFilter} split bills`}</Text>
              </View>
            ) : (
              <View style={s.list}>
                {paginatedBills.map(bill => (
                  <TouchableOpacity
                    key={bill.id}
                    style={s.card}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: '/(app)/split-bill-detail', params: { splitBillId: bill.id, name: bill.name } } as any)}
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
                {hasMore && (
                  <View style={s.loadMoreWrap}>
                    {isLoadingMore ? (
                      <ActivityIndicator color={Brand.color.accent} size="small" />
                    ) : (
                      <Text style={s.loadMoreText}>scroll for more</Text>
                    )}
                  </View>
                )}
              </View>
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

  list: { gap: Brand.spacing.gap },

  card:        { backgroundColor: Colors.white, borderRadius: Brand.radius.card, paddingVertical: Brand.spacing.card, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cardIconWrap:{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: Brand.color.headerBg },
  cardMid:     { flex: 1, gap: 2 },
  cardName:    { ...Brand.type.cardTitle },
  cardMeta:    { ...Brand.type.cardMeta },
  cardAmount:  { ...Brand.type.cardAmount, color: Brand.color.headerText },

  filterChip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  filterChipActive:   { backgroundColor: Brand.color.accent, borderColor: Brand.color.accent },
  filterChipText:     { fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted },
  filterChipTextActive: { fontFamily: Brand.font.monoBold, fontSize: 12, color: Brand.color.accentText },

  statusBadge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: Brand.color.accent + '44' },
  statusBadgeClosed:   { backgroundColor: Colors.surface },
  statusBadgeText:     { fontFamily: Brand.font.monoBold, fontSize: 9, color: Brand.color.accentDark, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusBadgeTextClosed: { color: Colors.muted },

  loadMoreWrap: { alignItems: 'center', paddingVertical: 20 },
  loadMoreText: { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted },

  error:       { ...Brand.type.cardMeta, color: Colors.expense, marginBottom: 8 },
  label:       { ...Brand.type.modalLabel, marginBottom: 6, marginTop: 14 },
  input:       { ...Brand.type.modalInput, backgroundColor: Colors.white, borderRadius: Brand.radius.input, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },
  saveBtn:     { backgroundColor: Brand.color.accent, borderRadius: Brand.radius.btn, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { ...Brand.type.modalBtn },
});
