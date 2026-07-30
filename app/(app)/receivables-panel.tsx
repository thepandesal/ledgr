import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, RefreshControl, TextInput,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import ReceivableDetail from './receivable-detail';
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
import BottomSheet from '@/components/ui/BottomSheet';
import DateNavBar from '@/components/ui/DateNavBar';

const TEAL = '#9cd7d2';
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type DateFilter = 'this-month' | 'monthly' | 'yearly' | 'all-time';

interface Props { onClose: () => void; initialPerson?: string | null; }

export default function ReceivablesPanel({ onClose, initialPerson }: Props) {
  const { userId } = useUser();
  const { openRecording, openSplitBill } = useNav();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set(['__unassigned__']));
  const [detailPerson, setDetailPerson] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('this-month');
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [search, setSearch] = useState('');
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  // draft state — only committed on Apply
  const [draftFilter, setDraftFilter] = useState<DateFilter>('this-month');
  const [draftMonth, setDraftMonth] = useState(new Date().getMonth());
  const [draftYear, setDraftYear] = useState(new Date().getFullYear());
  const [draftSelectedYear, setDraftSelectedYear] = useState(new Date().getFullYear());

  const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const YEARS = Array.from({ length: 21 }, (_, i) => 2020 + i);

  const initialPersonSet = useRef(false);
  useEffect(() => {
    if (!initialPerson) {
      initialPersonSet.current = false;
      return;
    }
    if (!initialPersonSet.current) {
      initialPersonSet.current = true;
      setDetailPerson(initialPerson);
    }
  }, [initialPerson]);

  const openDateSheet = () => {
    setDraftFilter(dateFilter);
    // sync draft pickers with current state
    if (dateFilter === 'this-month') {
      setDraftMonth(new Date().getMonth());
      setDraftYear(new Date().getFullYear());
    } else {
      setDraftMonth(pickerMonth);
      setDraftYear(pickerYear);
    }
    setDraftSelectedYear(selectedYear);
    setShowDateSheet(true);
  };

  const applyDateFilter = () => {
    setDateFilter(draftFilter);
    setPickerMonth(draftMonth);
    setPickerYear(draftYear);
    setSelectedYear(draftSelectedYear);
    setShowDateSheet(false);
  };

  const dateLabel = (() => {
    if (dateFilter === 'this-month' || dateFilter === 'monthly') {
      return new Date(pickerYear, pickerMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (dateFilter === 'yearly') return String(selectedYear);
    return 'All Time';
  })();

  const { data, isLoading } = useQuery({
    queryKey: ['receivables-by-people', userId, dateFilter, pickerMonth, pickerYear, selectedYear],
    queryFn: async () => {
      const now = new Date();
      let fromDate: string | null = null;
      let toDate: string | null = null;
      if (dateFilter === 'this-month' || dateFilter === 'monthly') {
        fromDate = `${pickerYear}-${String(pickerMonth+1).padStart(2,'0')}-01`;
        toDate = `${pickerYear}-${String(pickerMonth+1).padStart(2,'0')}-${new Date(pickerYear, pickerMonth+1, 0).getDate()}`;
      } else if (dateFilter === 'yearly') {
        fromDate = `${selectedYear}-01-01`;
        toDate = `${selectedYear}-12-31`;
      }
      // ── 1. Split bills YOU created ────────────────────────────────────────
      let billsQuery = supabase
        .from('split_bills')
        .select('id, name, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (fromDate) billsQuery = billsQuery.gte('created_at', fromDate);
      if (toDate) billsQuery = billsQuery.lte('created_at', toDate);
      const { data: bills } = await billsQuery;

      const billIds = (bills ?? []).map((b: any) => b.id);

      const [{ data: billSplits }, { data: items }, { data: payments }] = billIds.length > 0
        ? await Promise.all([
            supabase.from('bill_splits').select('split_bill_id, person_name').in('split_bill_id', billIds),
            supabase.from('split_items').select('split_bill_id, cost, people, recording_type').in('split_bill_id', billIds),
            supabase.from('split_bill_payments').select('split_bill_id, person_name, amount, status').in('split_bill_id', billIds).neq('status', 'cancelled'),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }];

      const billMap: Record<string, any> = {};
      (bills ?? []).forEach((b: any) => { billMap[b.id] = b; });

      // Per-person owed per bill
      const owedMap: Record<string, Record<string, number>> = {};
      (items ?? []).forEach((item: any) => {
        const people: string[] = item.people ?? [];
        if (people.length === 0) return;
        const isDeduct = item.recording_type === 'payable';
        const pp = Number(item.cost) / people.length;
        people.forEach((p: string) => {
          if (!owedMap[p]) owedMap[p] = {};
          owedMap[p][item.split_bill_id] = (owedMap[p][item.split_bill_id] ?? 0) + (isDeduct ? -pp : pp);
        });
      });

      // Per-person paid per bill
      const paidMap: Record<string, Record<string, number>> = {};
      (payments ?? []).forEach((pay: any) => {
        if (!paidMap[pay.person_name]) paidMap[pay.person_name] = {};
        paidMap[pay.person_name][pay.split_bill_id] = (paidMap[pay.person_name][pay.split_bill_id] ?? 0) + Number(pay.amount);
      });

      // Bills with people
      const billsWithPeople = new Set((billSplits ?? []).map((bs: any) => bs.split_bill_id));

      // All people across all bills
      const allPeople = [...new Set((billSplits ?? []).map((bs: any) => bs.person_name as string))];

      const peopleEntries = allPeople.map((person: string) => {
        const personBillIds = (billSplits ?? [])
          .filter((bs: any) => bs.person_name === person)
          .map((bs: any) => bs.split_bill_id);

        const billEntries = personBillIds.map((billId: string) => {
          const bill = billMap[billId];
          if (!bill) return null;
          const owed = owedMap[person]?.[billId] ?? 0;
          const paid = paidMap[person]?.[billId] ?? 0;
          const remaining = Math.max(0, owed - paid);
          const isComplete = bill.status === 'closed' || (owed > 0 && paid >= owed - 0.01);
          return { billId, billName: bill.name, billStatus: bill.status, owed, paid, remaining, isComplete };
        }).filter(Boolean).filter((b: any) => b.owed > 0);

        const totalOwed = billEntries.reduce((s: number, b: any) => s + b.owed, 0);
        const totalRemaining = billEntries.filter((b: any) => !b.isComplete).reduce((s: number, b: any) => s + b.remaining, 0);
        return { person, billEntries, totalOwed, totalRemaining };
      }).filter((p: any) => p.billEntries.length > 0 && p.totalOwed > 0)
        .sort((a: any, b: any) => b.totalRemaining - a.totalRemaining);

      // ── 2. Unassigned ─────────────────────────────────────────────────────
      // Bills with people but no items assigned to anyone
      const billsWithNoItemAssignments = (bills ?? []).filter((b: any) => {
        if (!billsWithPeople.has(b.id)) return false;
        const billItems = (items ?? []).filter((item: any) => item.split_bill_id === b.id);
        return billItems.every((item: any) => !item.people || item.people.length === 0);
      });

      // unassigned split bills (no people OR people but no item assignments), not closed
      const unassignedBillIds = new Set([
        ...(bills ?? []).filter((b: any) => !billsWithPeople.has(b.id) && b.status !== 'closed').map((b: any) => b.id),
        ...billsWithNoItemAssignments.filter((b: any) => b.status !== 'closed').map((b: any) => b.id),
      ]);
      const unassignedBills = (bills ?? []).filter((b: any) => unassignedBillIds.has(b.id));

      // fetch all expense recordings linked to unassigned bills + due recordings
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
        if (r.person_name) return; // has owes you — skip
        const inUnassignedBill = r.split_bill_id && unassignedBillIds.has(r.split_bill_id) && billMap[r.split_bill_id]?.status !== 'closed';
        const isDueNoSplitBill = r.is_due && !r.split_bill_id && r.status !== 'paid';
        const isDueUnassignedBill = r.is_due && inUnassignedBill && r.status !== 'paid';
        if ((inUnassignedBill || isDueNoSplitBill || isDueUnassignedBill) && !seenIds.has(r.id)) {
          seenIds.add(r.id);
          unassignedRecordings.push(r);
        }
      });

      // apply date filter to recordings
      const filteredUnassignedRecordings = unassignedRecordings.filter((r: any) => {
        if (!fromDate && !toDate) return true;
        const d = r.transaction_date;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
      });

      return { peopleEntries, unassignedRecordings: filteredUnassignedRecordings, unassignedBills };
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`receivables-panel-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_bills', filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['receivables-by-people', userId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_bill_payments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['receivables-by-people', userId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings', filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['receivables-by-people', userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['receivables-by-people', userId, dateFilter, pickerMonth, pickerYear, selectedYear] });
    setRefreshing(false);
  };

  const togglePerson = (key: string) => {
    setExpandedPeople(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const peopleEntries = (data?.peopleEntries ?? []).filter((p: any) =>
    !search.trim() || p.person.toLowerCase().includes(search.toLowerCase())
  );
  const unassignedRecordings = data?.unassignedRecordings ?? [];
  const unassignedBills = data?.unassignedBills ?? [];
  const hasUnassigned = unassignedRecordings.length > 0 || unassignedBills.length > 0;

  return (
    <SafeAreaView style={st.root}>
      <PageHeader title="Receivables" onBack={onClose} titleColor={TEAL} />

      {/* Controls row */}
      <View style={st.controlRow}>
        <View style={st.searchWrap}>
          <TextInput
            style={st.searchInput}
            placeholder="search person..."
            placeholderTextColor={Colors.faint}
            value={search}
            onChangeText={setSearch}
          />
          
        </View>
      </View>

      {/* Date nav */}
      <DateNavBar
        style={{ marginHorizontal: DC.pagePadding, marginBottom: 8 }}
        label={dateLabel}
        onPrev={() => {
          if (dateFilter === 'this-month') {
            const d = new Date(pickerYear, pickerMonth - 1, 1);
            setPickerMonth(d.getMonth()); setPickerYear(d.getFullYear());
            setDateFilter('monthly');
          } else if (dateFilter === 'monthly') {
            const d = new Date(pickerYear, pickerMonth - 1, 1);
            setPickerMonth(d.getMonth()); setPickerYear(d.getFullYear());
          } else if (dateFilter === 'yearly') setSelectedYear(y => y - 1);
        }}
        onNext={() => {
          if (dateFilter === 'this-month') {
            const d = new Date(pickerYear, pickerMonth + 1, 1);
            setPickerMonth(d.getMonth()); setPickerYear(d.getFullYear());
            setDateFilter('monthly');
          } else if (dateFilter === 'monthly') {
            const d = new Date(pickerYear, pickerMonth + 1, 1);
            setPickerMonth(d.getMonth()); setPickerYear(d.getFullYear());
          } else if (dateFilter === 'yearly') setSelectedYear(y => y + 1);
        }}
        onLabelPress={openDateSheet}
      />

      {isLoading ? (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}><GooeyLoader /></BlurView>
      ) : peopleEntries.length === 0 && !hasUnassigned ? (
        <View style={st.empty}><Text style={st.emptyText}>no receivables yet</Text></View>
      ) : (
        <ScrollView
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Unassigned card */}
          {hasUnassigned && (
            <View style={st.personCard}>
              <TouchableOpacity style={st.personRow} onPress={() => togglePerson('__unassigned__')} activeOpacity={0.7}>
                <View style={[st.personAvatar, { backgroundColor: Colors.surface }]} />
                <View style={{ flex: 1 }}>
                  <Text style={st.personName}>Unassigned</Text>
                  <Text style={st.personSub}>{unassignedRecordings.length + unassignedBills.length} item{unassignedRecordings.length + unassignedBills.length !== 1 ? 's' : ''}</Text>
                </View>
              </TouchableOpacity>
              {expandedPeople.has('__unassigned__') && (
                <View style={st.personItems}>
                  {(() => {
                    const pendingBills = unassignedBills.filter((b: any) => b.status !== 'closed');
                    const completedBills = unassignedBills.filter((b: any) => b.status === 'closed');
                    const pendingRecs = unassignedRecordings;
                    const hasAnyPending = pendingBills.length > 0 || pendingRecs.length > 0;
                    return (
                      <>
                        {hasAnyPending && (
                          <>
                            <Text style={st.personSectionLabel}>Pending</Text>
                            {pendingRecs.map((r: any, i: number) => (
                              <TouchableOpacity
                                key={r.id}
                                style={[st.personItem, i === pendingRecs.length - 1 && pendingBills.length === 0 && completedBills.length === 0 && { borderBottomWidth: 0 }]}
                                activeOpacity={0.7}
                                onPress={() => openRecording(r.id)}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={st.rowName} numberOfLines={1}>{r.name}</Text>
                                  <Text style={st.rowSub}>due · {Number(r.paid_amount ?? 0) > 0 ? `paid: ${fmt(Number(r.paid_amount))}` : 'no payment yet'}</Text>
                                </View>
                                <Text style={[st.rowAmount, { fontSize: 13, color: TEAL }]}>{fmt(Number(r.amount))}</Text>
                              </TouchableOpacity>
                            ))}
                              {pendingBills.map((b: any, i: number) => (
                              <TouchableOpacity
                                key={b.id}
                                style={[st.personItem, i === pendingBills.length - 1 && completedBills.length === 0 && { borderBottomWidth: 0 }]}
                                activeOpacity={0.7}
                                onPress={() => openSplitBill(b.id, b.name)}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={st.rowName} numberOfLines={1}>{b.name}</Text>
                                  <Text style={st.rowSub}>split bill · no people added</Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </>
                        )}
                        {completedBills.length > 0 && (
                          <>
                            <Text style={[st.personSectionLabel, { borderTopWidth: hasAnyPending ? 1 : 0, borderTopColor: Colors.border }]}>Completed</Text>
                            {completedBills.map((b: any, i: number) => (
                              <TouchableOpacity
                                key={b.id}
                                style={[st.personItem, i === completedBills.length - 1 && { borderBottomWidth: 0 }]}
                                activeOpacity={0.7}
                                onPress={() => openSplitBill(b.id, b.name)}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={st.rowName} numberOfLines={1}>{b.name}</Text>
                                <View style={[st.badge, { backgroundColor: '#9cd7d222', marginTop: 2 }]}>
                                  <Text style={[st.badgeText, { color: '#4f9289' }]}>closed</Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                            ))}
                          </>
                        )}
                        <TouchableOpacity style={st.showAllBtn} onPress={() => setDetailPerson('__unassigned__')} activeOpacity={0.7}>
                          <Text style={st.showAllText}>show all</Text>
                        </TouchableOpacity>
                      </>
                    );
                  })()}
                </View>
              )}
            </View>
          )}

          {/* People cards */}
          {peopleEntries.map((personData: any) => {
            const expanded = expandedPeople.has(personData.person);
            const pendingBills = personData.billEntries.filter((b: any) => !b.isComplete);
            const allCompletedBills = personData.billEntries.filter((b: any) => b.isComplete);
            const completedBills = allCompletedBills.slice(0, 3);
            const hasMoreCompleted = allCompletedBills.length > 3;

            return (
              <View key={personData.person} style={st.personCard}>
                <TouchableOpacity style={st.personRow} onPress={() => togglePerson(personData.person)} activeOpacity={0.7}>
                  <View style={st.personAvatar}>
                    <Text style={st.personAvatarText}>{personData.person.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.personName}>{personData.person}</Text>
                  </View>
                  <Text style={[st.rowAmount, { color: '#111111' }]}>
                    {fmt(personData.totalRemaining)}
                  </Text>
                </TouchableOpacity>

                {expanded && (
                  <View style={st.personItems}>
                    {pendingBills.length > 0 && (
                      <>
                        <Text style={st.personSectionLabel}>Pending</Text>
                        {pendingBills.map((bill: any, i: number) => (
                          <TouchableOpacity
                            key={bill.billId}
                            style={[st.personItem, i === pendingBills.length - 1 && completedBills.length === 0 && { borderBottomWidth: 0 }]}
                            activeOpacity={0.7}
                            onPress={() => openSplitBill(bill.billId, bill.billName)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={st.rowName} numberOfLines={1}>{bill.billName}</Text>
                              <Text style={st.rowSub}>
                                due: {fmt(bill.remaining)}{bill.paid > 0 ? ` · paid: ${fmt(bill.paid)}` : ''}
                              </Text>
                            </View>
                            <Text style={[st.rowAmount, { fontSize: 13, color: TEAL }]}>{fmt(bill.owed)}</Text>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                    {completedBills.length > 0 && (
                      <>
                        <Text style={[st.personSectionLabel, { borderTopWidth: pendingBills.length > 0 ? 1 : 0, borderTopColor: Colors.border }]}>Completed</Text>
                        {completedBills.map((bill: any, i: number) => (
                          <TouchableOpacity
                            key={bill.billId}
                            style={[st.personItem, i === completedBills.length - 1 && { borderBottomWidth: 0 }]}
                            activeOpacity={0.7}
                            onPress={() => openSplitBill(bill.billId, bill.billName)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={st.rowName} numberOfLines={1}>{bill.billName}</Text>
                              <View style={[st.badge, { backgroundColor: '#9cd7d222', marginTop: 2 }]}>
                                <Text style={[st.badgeText, { color: '#4f9289' }]}>received</Text>
                              </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={[st.rowAmount, { fontSize: 13, color: '#111111' }]}>{fmt(bill.paid)}</Text>
                              <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted }}>{fmt(bill.owed)} debt</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                    <TouchableOpacity style={st.showAllBtn} onPress={() => setDetailPerson(personData.person)} activeOpacity={0.7}>
                      <Text style={st.showAllText}>show all</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

        </ScrollView>
      )}

      {detailPerson && (
        <View style={StyleSheet.absoluteFill}>
          <ReceivableDetail
            person={detailPerson}
            onClose={() => setDetailPerson(null)}
          />
        </View>
      )}

      <BottomSheet visible={showDateSheet} onClose={() => setShowDateSheet(false)} title="date filter">
        {/* Mode buttons */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {(['this-month', 'monthly', 'yearly', 'all-time'] as DateFilter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: draftFilter === f ? '#111111' : DC.pageActionBg }}
              onPress={() => setDraftFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={{ fontFamily: draftFilter === f ? AppFont.semiBold : AppFont.regular, fontSize: 13, color: draftFilter === f ? '#ffffff' : DC.pageActionText }}>
                {f === 'this-month' ? 'This Month' : f === 'monthly' ? 'Monthly' : f === 'yearly' ? 'Yearly' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Monthly sub-picker */}
        {draftFilter === 'monthly' && (
          <>
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Month</Text>
            <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {MONTHS_FULL.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < 11 ? 1 : 0, borderBottomColor: Colors.border, gap: 10 }}
                  onPress={() => setDraftMonth(i)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontFamily: draftMonth === i ? AppFont.semiBold : AppFont.regular, fontSize: 14, color: '#111111' }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 8 }}>Year</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {YEARS.map(y => (
                <TouchableOpacity
                  key={y}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: draftYear === y ? '#111111' : DC.pageActionBg }}
                  onPress={() => setDraftYear(y)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: draftYear === y ? '#ffffff' : DC.pageActionText }}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Yearly sub-picker */}
        {draftFilter === 'yearly' && (
          <>
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Year</Text>
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {YEARS.map((y, i) => (
                <TouchableOpacity
                  key={y}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < YEARS.length - 1 ? 1 : 0, borderBottomColor: Colors.border, gap: 10 }}
                  onPress={() => setDraftSelectedYear(y)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontFamily: draftSelectedYear === y ? AppFont.semiBold : AppFont.regular, fontSize: 14, color: '#111111' }}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <TouchableOpacity
          style={{ backgroundColor: '#111111', borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20 }}
          onPress={applyDateFilter}
          activeOpacity={0.8}
        >
          <Text style={{ fontFamily: AppFont.semiBold, fontSize: 15, color: '#ffffff' }}>Apply</Text>
        </TouchableOpacity>
      </BottomSheet>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: DC.pagePadding, paddingBottom: 80, paddingTop: 8 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: DC.pagePadding, paddingVertical: 8 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: DC.cardBorder, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: DC.cardBg },
  searchInput: { flex: 1, fontFamily: AppFont.regular, fontSize: 13, color: DC.pageText, padding: 0 },
  rowName:     { fontFamily: AppFont.regular, fontSize: 14, color: '#111111' },
  rowSub:      { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, fontStyle: 'italic' },
  badge:       { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  badgeText:   { fontFamily: AppFont.semiBold, fontSize: 10 },
  rowAmount:   { fontFamily: AppFont.bold, fontSize: 13 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText:   { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },
  personCard:      { marginBottom: 8, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, overflow: 'hidden' },
  personRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  personAvatar:    { width: 36, height: 36, borderRadius: 18, backgroundColor: TEAL + '33', justifyContent: 'center', alignItems: 'center' },
  personAvatarText:{ fontFamily: AppFont.bold, fontSize: 14, color: TEAL },
  personName:      { fontFamily: AppFont.regular, fontSize: 14, color: '#111111' },
  personSub:       { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted },
  personItems:     { borderTopWidth: 1, borderTopColor: Colors.border },
  personItem:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  personSectionLabel: { fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: Colors.surface },
  showAllBtn: { paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border },
  showAllText: { fontFamily: AppFont.semiBold, fontSize: 12, color: TEAL },
});
