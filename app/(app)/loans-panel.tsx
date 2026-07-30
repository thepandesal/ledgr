import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, RefreshControl, Linking,
} from 'react-native';
import { useState, useMemo, useEffect } from 'react';
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

const TEAL = '#9cd7d2';
const PEACH = '#FFAB91';
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props { onClose: () => void; }

export default function LoansPanel({ onClose }: Props) {
  const { userId } = useUser();
  const { openRecording } = useNav();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const [monthOffset, setMonthOffset] = useState(0);
  const [viewMode, setViewMode] = useState<'recording' | 'people'>('recording');
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set());

  const { from, to, label } = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const to   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return { from, to, label: `${months[d.getMonth()]} ${d.getFullYear()}` };
  }, [monthOffset]);

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['loans-panel', userId, from],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('id, name, amount, status, paid_amount, transaction_date, payment_to, person_name')
        .eq('user_id', userId)
        .eq('type', 'debt')
        .neq('status', 'voided')
        .gte('transaction_date', from)
        .lte('transaction_date', to)
        .order('transaction_date', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Split bills where I'm tagged and net balance is negative (I owe them)
  const { data: splitBillItems = [] } = useQuery({
    queryKey: ['loans-split-bills', userId, from],
    queryFn: async () => {
      const { data: invites } = await supabase
        .from('split_bill_invites')
        .select('id, split_bill_id, amount, status')
        .eq('invitee_user_id', userId)
        .eq('status', 'accepted');
      if (!invites || invites.length === 0) return [];

      const billIds = invites.map((i: any) => i.split_bill_id);
      const { data: bills } = await supabase
        .from('split_bills')
        .select('id, name, user_id')
        .in('id', billIds);

      const creatorIds = [...new Set((bills ?? []).map((b: any) => b.user_id))];
      const creatorNames = await Promise.all(
        creatorIds.map((id: string) =>
          supabase.rpc('get_user_display_name', { user_id: id }).then(({ data: n }) => ({ id, name: n ?? 'unknown' }))
        )
      );

      const { data: shares } = await supabase
        .from('split_shares')
        .select('split_bill_id, slug, user_id')
        .in('split_bill_id', billIds);

      // For loans panel, we show split bills where I owe (positive amount = I owe them)
      return (bills ?? []).map((bill: any) => {
        const invite = invites.find((i: any) => i.split_bill_id === bill.id);
        const creator = creatorNames.find((c: any) => c.id === bill.user_id);
        const share = (shares ?? []).find((s: any) => s.split_bill_id === bill.id);
        const link = share?.slug && share?.user_id
          ? `https://ledgr.art/split/${share.user_id}/${share.slug}`
          : null;
        return {
          id: bill.id,
          billName: bill.name,
          creatorName: creator?.name ?? 'unknown',
          amount: Number(invite?.amount ?? 0),
          link,
          type: 'split_bill',
        };
      }).filter((b: any) => b.amount > 0);
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`loans-panel-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings', filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['loans-panel', userId] });
        queryClient.invalidateQueries({ queryKey: ['loans-split-bills', userId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_bill_invites', filter: `invitee_user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['loans-split-bills', userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['loans-panel', userId, from] });
    await queryClient.invalidateQueries({ queryKey: ['loans-split-bills', userId, from] });
    setRefreshing(false);
  };

  const filtered = loans.filter((r: any) => {
    if (statusFilter === 'unpaid') return r.status !== 'paid';
    if (statusFilter === 'paid') return r.status === 'paid';
    return true;
  });

  const totalUnpaid = loans.filter((r: any) => r.status !== 'paid').reduce((s: number, r: any) => s + Number(r.amount), 0);
  const totalPaid   = loans.filter((r: any) => r.status === 'paid').reduce((s: number, r: any) => s + Number(r.amount), 0);

  // By Recording grouped by date
  const grouped: { label: string; items: any[] }[] = [];
  filtered.forEach((r: any) => {
    const lbl = new Date(r.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const existing = grouped.find(g => g.label === lbl);
    if (existing) existing.items.push(r);
    else grouped.push({ label: lbl, items: [r] });
  });

  // By People
  const peopleMap = useMemo(() => {
    const map: Record<string, { total: number; items: any[] }> = {};
    filtered.forEach((r: any) => {
      const key = r.person_name?.trim() || r.payment_to?.trim() || 'Unknown';
      if (!map[key]) map[key] = { total: 0, items: [] };
      map[key].total += Number(r.amount);
      map[key].items.push({ ...r, _type: 'recording' });
    });
    splitBillItems.forEach((b: any) => {
      const key = b.creatorName;
      if (!map[key]) map[key] = { total: 0, items: [] };
      map[key].total += b.amount;
      map[key].items.push({ ...b, _type: 'split_bill' });
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filtered, splitBillItems]);

  const togglePerson = (name: string) => {
    setExpandedPeople(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const openSplitBillLink = (link: string | null) => {
    if (!link) { alert('Generated link is invalid.'); return; }
    Linking.openURL(link);
  };

  return (
    <SafeAreaView style={st.root}>
      <PageHeader title="Loans" onBack={onClose} titleColor={TEAL} />

      {/* Stats */}
      <View style={st.statsRow}>
        {[
          { key: 'unpaid', label: 'unpaid', value: fmt(totalUnpaid) },
          { key: 'paid',   label: 'paid',   value: fmt(totalPaid) },
          { key: 'all',    label: 'all',    value: String(loans.length) },
        ].map(st2 => {
          const active = statusFilter === st2.key;
          return (
            <TouchableOpacity key={st2.key} style={[st.statBtn, active && st.statBtnActive]} onPress={() => setStatusFilter(st2.key as any)} activeOpacity={0.7}>
              <Text style={[st.statValue, active && st.statValueActive]}>{st2.value}</Text>
              <Text style={[st.statLabel, active && st.statLabelActive]}>{st2.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Month nav */}
      <View style={st.monthNav}>

        <Text style={st.monthLabel}>{label}</Text>

      </View>

      {/* View toggle */}
      <View style={st.toggleRow}>
        <TouchableOpacity style={[st.toggleBtn, viewMode === 'recording' && st.toggleBtnActive]} onPress={() => setViewMode('recording')} activeOpacity={0.7}>
          <Text style={[st.toggleText, viewMode === 'recording' && st.toggleTextActive]}>By Recording</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.toggleBtn, viewMode === 'people' && st.toggleBtnActive]} onPress={() => setViewMode('people')} activeOpacity={0.7}>
          <Text style={[st.toggleText, viewMode === 'people' && st.toggleTextActive]}>By People</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}><GooeyLoader /></BlurView>
      ) : viewMode === 'recording' ? (
        filtered.length === 0 ? (
          <View style={st.empty}><Text style={st.emptyText}>no loans for {label}</Text></View>
        ) : (
          <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            {grouped.map(group => (
              <View key={group.label}>
                <Text style={st.dateHeader}>{group.label}</Text>
                {group.items.map((item: any, i: number) => {
                  const isPaid = item.status === 'paid';
                  const isPartial = item.status === 'partial';
                  const remaining = Number(item.amount) - Number(item.paid_amount ?? 0);
                  const isLast = i === group.items.length - 1;
                  return (
                    <TouchableOpacity key={item.id} style={[st.row, isLast && st.rowLast]} activeOpacity={0.7} onPress={() => openRecording(item.id)}>
                      <View style={st.rowLeft}>
                        <Text style={st.rowName} numberOfLines={1}>{item.name}</Text>
                        {item.person_name && <Text style={st.rowSub}>{item.person_name}</Text>}
                        <View style={[st.badge, { backgroundColor: isPaid ? '#9cd7d222' : '#FFAB9122' }]}>
                          <Text style={[st.badgeText, { color: isPaid ? '#4f9289' : PEACH }]}>
                            {isPaid ? 'paid' : isPartial ? 'partial' : 'unpaid'}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[st.rowAmount, { color: isPaid ? '#4f9289' : PEACH }]}>{fmt(Number(item.amount))}</Text>
                        {isPartial && <Text style={st.rowSub}>{fmt(remaining)} left</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        )
      ) : (
        peopleMap.length === 0 ? (
          <View style={st.empty}><Text style={st.emptyText}>no loans</Text></View>
        ) : (
          <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            {peopleMap.map(([name, { total, items }]) => {
              const expanded = expandedPeople.has(name);
              return (
                <View key={name} style={st.personCard}>
                  <TouchableOpacity style={st.personRow} onPress={() => togglePerson(name)} activeOpacity={0.7}>
                    <View style={st.personAvatar}>
                      <Text style={st.personAvatarText}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.personName}>{name}</Text>
                      <Text style={st.personSub}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
                    </View>
                    <Text style={[st.rowAmount, { color: PEACH }]}>{fmt(total)}</Text>
                  </TouchableOpacity>
                  {expanded && (
                    <View style={st.personItems}>
                      {items.map((item: any, i: number) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[st.personItem, i === items.length - 1 && { borderBottomWidth: 0 }]}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (item._type === 'split_bill') openSplitBillLink(item.link);
                            else openRecording(item.id);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={st.rowName} numberOfLines={1}>{item._type === 'split_bill' ? item.billName : item.name}</Text>
                            <Text style={st.rowSub}>{item._type === 'split_bill' ? 'split bill' : item.status}</Text>
                          </View>
                          <Text style={[st.rowAmount, { fontSize: 13, color: PEACH }]}>{fmt(Number(item.amount))}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: DC.pagePadding, paddingBottom: 80 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: DC.pagePadding, paddingVertical: 12 },
  statBtn:        { flex: 1, backgroundColor: DC.pageActionBg, borderRadius: Radius.lg, padding: 10, alignItems: 'center' },
  statBtnActive:  { backgroundColor: '#111111' },
  statValue:      { fontFamily: AppFont.bold, fontSize: 12, color: '#111111', marginBottom: 2 },
  statValueActive:{ color: '#ffffff' },
  statLabel:      { fontFamily: AppFont.regular, fontSize: 9, color: Colors.muted },
  statLabelActive:{ color: '#ffffff' },
  monthNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pageActionPaddingH, paddingVertical: DC.pageActionPaddingV, backgroundColor: DC.pageActionBg, borderRadius: DC.pageActionRadius, marginHorizontal: DC.pagePadding, marginBottom: 8 },
  monthLabel: { fontFamily: AppFont.regular, fontSize: DC.dropdownFontSize, color: DC.pageActionText },
  toggleRow:  { flexDirection: 'row', gap: 8, paddingHorizontal: DC.pagePadding, marginBottom: 8 },
  toggleBtn:  { flex: 1, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: DC.pageActionBg, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#111111' },
  toggleText: { fontFamily: AppFont.regular, fontSize: 12, color: DC.pageActionText },
  toggleTextActive: { fontFamily: AppFont.semiBold, fontSize: 12, color: '#ffffff' },
  dateHeader: { fontFamily: AppFont.semiBold, fontSize: 11, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  rowLast: { borderBottomWidth: 0 },
  rowLeft: { flex: 1, gap: 3 },
  rowName: { fontFamily: AppFont.regular, fontSize: 14, color: '#111111' },
  rowSub:  { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, fontStyle: 'italic' },
  badge:   { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  badgeText: { fontFamily: AppFont.semiBold, fontSize: 10 },
  rowAmount: { fontFamily: AppFont.bold, fontSize: 13 },
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },
  personCard:   { marginBottom: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, overflow: 'hidden' },
  personRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  personAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: PEACH + '33', justifyContent: 'center', alignItems: 'center' },
  personAvatarText: { fontFamily: AppFont.bold, fontSize: 14, color: PEACH },
  personName:   { fontFamily: AppFont.semiBold, fontSize: 14, color: '#111111' },
  personSub:    { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted },
  personItems:  { borderTopWidth: 1, borderTopColor: Colors.border },
  personItem:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
});
