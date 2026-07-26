import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, TextInput, RefreshControl,
  Animated, Dimensions,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
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

const TEAL = '#9cd7d2';
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  person: string;
  onClose: () => void;
  onBack?: () => void;
}

const { width } = Dimensions.get('window');

export default function ReceivableDetail({ person, onClose, onBack }: Props) {
  const { userId } = useUser();
  const { openSplitBill, openRecording } = useNav();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'completed'>('pending');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: width,
      duration: 250,
      useNativeDriver: true,
    }).start(() => (onBack ? onBack() : onClose()));
  };

  const isUnassigned = person === '__unassigned__';
  const headerTitle = isUnassigned ? 'Unassigned' : person;

  const { data, isLoading } = useQuery({
    queryKey: ['receivable-detail', userId, person],
    queryFn: async () => {
      const { data: bills } = await supabase
        .from('split_bills')
        .select('id, name, status')
        .eq('user_id', userId);

      const billIds = (bills ?? []).map((b: any) => b.id);
      const billMap: Record<string, any> = {};
      (bills ?? []).forEach((b: any) => { billMap[b.id] = b; });

      // Always load recordings linked to this person (debt/due/is_due)
      const { data: personRecs } = await supabase
        .from('recordings')
        .select('id, name, amount, paid_amount, status, type, is_due, transaction_date, space_id')
        .eq('user_id', userId)
        .ilike('person_name', person)
        .neq('status', 'voided')
        .order('transaction_date', { ascending: false });

      const recEntries = (personRecs ?? []).map((r: any) => {
        const owed = Number(r.amount);
        const paid = Number(r.paid_amount ?? 0);
        const remaining = Math.max(0, owed - paid);
        const isComplete = r.status === 'paid' || (owed > 0 && paid >= owed - 0.01);
        const isReceivable = r.type === 'due' || r.is_due;
        return {
          billId: r.id, billName: r.name, billStatus: r.status,
          owed, paid, remaining, isComplete, isRecording: true,
          entryType: isReceivable ? 'receivable' : 'loan',
          transaction_date: r.transaction_date, space_id: r.space_id,
        };
      });

      if (!bills || bills.length === 0) {
        return {
          pending: { receivable: recEntries.filter(r => !r.isComplete && r.entryType === 'receivable'), loan: recEntries.filter(r => !r.isComplete && r.entryType === 'loan') },
          completed: { receivable: recEntries.filter(r => r.isComplete && r.entryType === 'receivable'), loan: recEntries.filter(r => r.isComplete && r.entryType === 'loan') },
        };
      }

      if (isUnassigned) {
        const [{ data: billSplits }, { data: items }] = await Promise.all([
          supabase.from('bill_splits').select('split_bill_id, person_name').in('split_bill_id', billIds),
          supabase.from('split_items').select('split_bill_id, cost, people, recording_type').in('split_bill_id', billIds),
        ]);

        const billsWithPeople = new Set((billSplits ?? []).map((bs: any) => bs.split_bill_id));
        const billsWithNoItemAssignments = (bills ?? []).filter((b: any) => {
          if (!billsWithPeople.has(b.id)) return false;
          const billItems = (items ?? []).filter((item: any) => item.split_bill_id === b.id);
          return billItems.every((item: any) => !item.people || item.people.length === 0);
        });

        const unassignedBillIds = new Set([
          ...(bills ?? []).filter((b: any) => !billsWithPeople.has(b.id) && b.status !== 'closed').map((b: any) => b.id),
          ...billsWithNoItemAssignments.filter((b: any) => b.status !== 'closed').map((b: any) => b.id),
        ]);

        const unassignedBills = (bills ?? []).filter((b: any) => unassignedBillIds.has(b.id));

        const { data: expenseRecs } = await supabase
          .from('recordings')
          .select('id, name, amount, paid_amount, status, transaction_date, split_bill_id, person_name, is_due')
          .eq('user_id', userId)
          .eq('type', 'expense')
          .neq('status', 'voided')
          .order('transaction_date', { ascending: false });

        const seenIds = new Set<string>();
        const unassignedRecordings: any[] = [];
        (expenseRecs ?? []).forEach((r: any) => {
          if (r.person_name) return;
          const inUnassignedBill = r.split_bill_id && unassignedBillIds.has(r.split_bill_id) && billMap[r.split_bill_id]?.status !== 'closed';
          const isDueNoSplitBill = r.is_due && !r.split_bill_id && r.status !== 'paid';
          const isDueUnassignedBill = r.is_due && inUnassignedBill && r.status !== 'paid';
          if ((inUnassignedBill || isDueNoSplitBill || isDueUnassignedBill) && !seenIds.has(r.id)) {
            seenIds.add(r.id);
            unassignedRecordings.push(r);
          }
        });

        const pendingRecs = unassignedRecordings.filter((r: any) => r.status !== 'paid');
        const pendingBills = unassignedBills.filter((b: any) => b.status !== 'closed');
        const completedBills = unassignedBills.filter((b: any) => b.status === 'closed');

        const pendingRecEntries = pendingRecs.map((r: any) => ({
          billId: r.id, billName: r.name, billStatus: r.status,
          owed: Number(r.amount), paid: Number(r.paid_amount ?? 0),
          remaining: Math.max(0, Number(r.amount) - Number(r.paid_amount ?? 0)),
          isComplete: false, isRecording: true,
          entryType: r.is_due ? 'receivable' : 'loan',
        }));
        const pendingBillEntries = pendingBills.map((b: any) => ({
          billId: b.id, billName: b.name, billStatus: b.status,
          owed: 0, paid: 0, remaining: 0, isComplete: false,
          entryType: 'receivable' as const,
        }));
        const completedBillEntries = completedBills.map((b: any) => ({
          billId: b.id, billName: b.name, billStatus: b.status,
          owed: 0, paid: 0, remaining: 0, isComplete: true,
          entryType: 'receivable' as const,
        }));
        const allPending = [...pendingRecEntries, ...pendingBillEntries];

        return {
          pending: {
            receivable: allPending.filter((b: any) => b.entryType === 'receivable'),
            loan: allPending.filter((b: any) => b.entryType === 'loan'),
          },
          completed: {
            receivable: completedBillEntries,
            loan: [],
          },
        };
      }

      const [{ data: billSplits }, { data: items }, { data: payments }] = await Promise.all([
        supabase.from('bill_splits').select('split_bill_id, person_name').in('split_bill_id', billIds),
        supabase.from('split_items').select('split_bill_id, cost, people, recording_type').in('split_bill_id', billIds),
        supabase.from('split_bill_payments').select('split_bill_id, person_name, amount, status').in('split_bill_id', billIds).eq('person_name', person).neq('status', 'cancelled'),
      ]);

      const owedMap: Record<string, number> = {};
      (items ?? []).forEach((item: any) => {
        const people: string[] = item.people ?? [];
        if (!people.includes(person)) return;
        const isDeduct = item.recording_type === 'payable';
        const pp = Number(item.cost) / people.length;
        owedMap[item.split_bill_id] = (owedMap[item.split_bill_id] ?? 0) + (isDeduct ? -pp : pp);
      });

      const paidMap: Record<string, number> = {};
      (payments ?? []).forEach((pay: any) => {
        paidMap[pay.split_bill_id] = (paidMap[pay.split_bill_id] ?? 0) + Number(pay.amount);
      });

      // Get all bill IDs where this person is involved (from bill_splits OR items)
      const personBillIdsSet = new Set<string>();
      (billSplits ?? []).filter((bs: any) => bs.person_name === person).forEach((bs: any) => personBillIdsSet.add(bs.split_bill_id));
      (items ?? []).forEach((item: any) => {
        if ((item.people ?? []).includes(person)) personBillIdsSet.add(item.split_bill_id);
      });
      const personBillIds = [...personBillIdsSet];

      const entries = personBillIds.map((billId: string) => {
        const bill = billMap[billId];
        if (!bill) return null;
        const netOwed = owedMap[billId] ?? 0;
        const paid = paidMap[billId] ?? 0;
        const isReceivable = netOwed > 0;
        const owed = Math.abs(netOwed);
        const remaining = Math.max(0, owed - paid);
        const isComplete = bill.status === 'closed' || (owed > 0 && paid >= owed - 0.01);
        return { billId, billName: bill.name, billStatus: bill.status, owed, paid, remaining, isComplete, entryType: isReceivable ? 'receivable' : 'loan' };
      }).filter(Boolean);

      // Deduplicate recordings linked to shown split bills
      const shownBillIds = entries.filter(Boolean).map((e: any) => e.billId);
      const { data: sbrRows } = shownBillIds.length > 0
        ? await supabase.from('split_bill_recordings').select('recording_id').in('split_bill_id', shownBillIds)
        : { data: [] };
      const linkedRecordingIds = new Set((sbrRows ?? []).map((r: any) => r.recording_id));

      const newRecEntries = recEntries.filter((r: any) => !linkedRecordingIds.has(r.billId));

      const all = [...entries.filter(Boolean), ...newRecEntries];

      return {
        pending: {
          receivable: all.filter((b: any) => !b.isComplete && b.entryType === 'receivable'),
          loan: all.filter((b: any) => !b.isComplete && b.entryType === 'loan'),
        },
        completed: {
          receivable: all.filter((b: any) => b.isComplete && b.entryType === 'receivable'),
          loan: all.filter((b: any) => b.isComplete && b.entryType === 'loan'),
        },
      };
    },
    enabled: !!userId && !!person,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['receivable-detail', userId, person] });
    setRefreshing(false);
  };

  const filterItems = (items: any[]) =>
    items.filter((b: any) => !search.trim() || b.billName.toLowerCase().includes(search.toLowerCase()));

  const sections = tab === 'pending'
    ? [{ key: 'receivable', label: 'Owes You', items: filterItems(data?.pending?.receivable ?? []) },
       { key: 'loan',       label: 'You Owe',  items: filterItems(data?.pending?.loan ?? []) }]
    : [{ key: 'receivable', label: 'Owes You', items: filterItems(data?.completed?.receivable ?? []) },
       { key: 'loan',       label: 'You Owe',  items: filterItems(data?.completed?.loan ?? []) }];

  const hasAny = sections.some(s => s.items.length > 0);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: slideAnim }] }]} pointerEvents="box-none">
      <SafeAreaView style={st.root}>
        <PageHeader title={headerTitle} onBack={handleClose} titleColor={TEAL} />

        {/* Tabs */}
        <View style={st.tabRow}>
          <TouchableOpacity style={[st.tab, tab === 'pending' && st.tabActive]} onPress={() => setTab('pending')} activeOpacity={0.7}>
            <Text style={[st.tabText, tab === 'pending' && st.tabTextActive]}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.tab, tab === 'completed' && st.tabActive]} onPress={() => setTab('completed')} activeOpacity={0.7}>
            <Text style={[st.tabText, tab === 'completed' && st.tabTextActive]}>Completed</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={st.searchWrap}>
          <Ionicons name="search-outline" size={13} color={Colors.faint} />
          <TextInput
            style={st.searchInput}
            placeholder="search recording name..."
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

        {isLoading ? (
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}><GooeyLoader /></BlurView>
        ) : !hasAny ? (
          <View style={st.empty}>
            <Text style={st.emptyText}>no {tab} items</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={st.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {sections.filter(s => s.items.length > 0).map(section => {
              const secOwed = section.items.reduce((s: number, b: any) => s + Number(b.owed), 0);
              const secPaid = section.items.reduce((s: number, b: any) => s + Number(b.paid), 0);
              const secRemaining = section.items.reduce((s: number, b: any) => s + Number(b.remaining), 0);
              const isRed = section.key === 'loan';
              return (
                <View key={section.key} style={{ marginBottom: 12 }}>
                  <Text style={[st.sectionLabel, isRed && { color: '#e74c3c' }]}>{section.label}</Text>
                  {section.items.map((bill: any, i: number) => (
                    <TouchableOpacity
                      key={bill.billId}
                      style={[st.row, i === section.items.length - 1 && { borderBottomWidth: 0 }]}
                      activeOpacity={0.7}
                      onPress={() => bill.isRecording ? openRecording(bill.billId) : openSplitBill(bill.billId, bill.billName)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={st.rowName} numberOfLines={1}>{bill.billName}</Text>
                        {tab === 'pending' ? (
                          <Text style={st.rowSub}>due: {fmt(bill.remaining)}{bill.paid > 0 ? ` · paid: ${fmt(bill.paid)}` : ''}</Text>
                        ) : (
                          <Text style={st.rowSub}>paid: {fmt(bill.paid)} · total: {fmt(bill.owed)}</Text>
                        )}
                      </View>
                      <Text style={[st.rowAmount, { color: isRed ? '#e74c3c' : (tab === 'pending' ? TEAL : '#111111') }]}>
                        {fmt(tab === 'pending' ? bill.owed : bill.paid)}
                      </Text>
                      <Ionicons name="chevron-forward" size={13} color={Colors.faint} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  ))}
                  {/* Per-section total */}
                  <View style={[st.row, { borderBottomWidth: 0, paddingTop: 4 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.rowName, { fontFamily: AppFont.bold }]}>Total</Text>
                      {tab === 'pending' ? (
                        <Text style={st.rowSub}>remaining: {fmt(secRemaining)}{secPaid > 0 ? ` · paid: ${fmt(secPaid)}` : ''}</Text>
                      ) : (
                        <Text style={st.rowSub}>collected: {fmt(secPaid)} · total: {fmt(secOwed)}</Text>
                      )}
                    </View>
                    <Text style={[st.rowAmount, { color: isRed ? '#e74c3c' : (tab === 'pending' ? TEAL : '#111111') }]}>
                      {fmt(tab === 'pending' ? secOwed : secPaid)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.white },
  scroll:      { paddingHorizontal: DC.pagePadding, paddingBottom: 120, paddingTop: 8 },
  tabRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: DC.pagePadding, paddingVertical: 8 },
  tab:         { flex: 1, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: DC.pageActionBg, alignItems: 'center' },
  tabActive:   { backgroundColor: '#111111' },
  tabText:     { fontFamily: AppFont.regular, fontSize: 12, color: DC.pageActionText },
  tabTextActive: { fontFamily: AppFont.semiBold, fontSize: 12, color: '#ffffff' },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: DC.cardBorder, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: DC.cardBg, marginHorizontal: DC.pagePadding, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: AppFont.regular, fontSize: 13, color: DC.pageText, padding: 0 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  rowLast:     { borderBottomWidth: 0 },
  rowName:     { fontFamily: AppFont.regular, fontSize: 14, color: '#111111' },
  rowSub:      { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, fontStyle: 'italic' },
  rowAmount:   { fontFamily: AppFont.bold, fontSize: 13 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  emptyText:   { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },
  sectionLabel: { fontFamily: AppFont.bold, fontSize: 10, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, marginTop: 8 },
});
