import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { DC } from '../../../src/lib/design';
import { AppFont } from '../../../src/lib/fonts';
import { useNav } from '../../../src/lib/NavContext';
import { useRouter } from 'expo-router';
import AnimatedIcon from '@/components/ui/AnimatedIcon';
import { BlurView } from 'expo-blur';
import GooeyLoader from '@/components/ui/GooeyLoader';
import BottomSheet from '@/components/ui/BottomSheet';
import { isReminderDueToday, reminderFrequencyLabel } from '../../../src/lib/reminderUtils';
import { useState, useMemo, useEffect } from 'react';

const TEAL = '#5dc4bb';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS = Array.from({ length: 21 }, (_, i) => 2020 + i);

type DateMode = 'monthly' | '3months';

export default function HomeScreen({ isActive }: { isActive?: boolean }) {
  const { userId, defaultCurrency } = useUser();
  const { switchTab, openSpace, openRecording, openTopSpending, openRecordingsPanel, openSpacesPanel, openLoansPanel, openReceivablesPanel, openRemindersPanel } = useNav();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dateMode, setDateMode] = useState<DateMode>('monthly');
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [rangeFromMonth, setRangeFromMonth] = useState(new Date().getMonth());
  const [rangeFromYear, setRangeFromYear] = useState(new Date().getFullYear());
  const [showDateSheet, setShowDateSheet] = useState(false);
  // draft state — only applied on Apply
  const [draftMode, setDraftMode] = useState<DateMode>('monthly');
  const [draftPickerMonth, setDraftPickerMonth] = useState(new Date().getMonth());
  const [draftPickerYear, setDraftPickerYear] = useState(new Date().getFullYear());
  const [draftFromMonth, setDraftFromMonth] = useState(new Date().getMonth());
  const [draftFromYear, setDraftFromYear] = useState(new Date().getFullYear());

  const [refreshing, setRefreshing] = useState(false);

  const { from: monthFrom, to: monthTo, label: monthLabel } = useMemo(() => {
    if (dateMode === 'monthly') {
      const d = new Date(pickerYear, pickerMonth, 1);
      const from = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
      const to   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()}`;
      return { from, to, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
    }
    // 3 months — auto-compute until as from + 2 months
    const toD = new Date(rangeFromYear, rangeFromMonth + 2, 1);
    const rangeToMonth = toD.getMonth();
    const rangeToYear = toD.getFullYear();
    const from = `${rangeFromYear}-${String(rangeFromMonth+1).padStart(2,'0')}-01`;
    const toDate = new Date(rangeToYear, rangeToMonth+1, 0);
    const to = `${rangeToYear}-${String(rangeToMonth+1).padStart(2,'0')}-${toDate.getDate()}`;
    return { from, to, label: `${MONTHS_SHORT[rangeFromMonth]} ${rangeFromYear} – ${MONTHS_SHORT[rangeToMonth]} ${rangeToYear}` };
  }, [dateMode, pickerMonth, pickerYear, rangeFromMonth, rangeFromYear]);

  // ── Realtime listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ['home-summary-v2', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-recent', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-loans', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-receivables', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-spaces', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-totals', userId] });
    };
    const channel = supabase
      .channel(`home-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_bills', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recording_reminders', filter: `user_id=eq.${userId}` }, () =>
        queryClient.invalidateQueries({ queryKey: ['home-reminders', userId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['home-summary-v2', userId, monthFrom] }),
      queryClient.invalidateQueries({ queryKey: ['home-recent', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-loans', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-receivables', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-spaces', userId, monthFrom] }),
      queryClient.invalidateQueries({ queryKey: ['home-reminders', userId] }),
    ]);
    setRefreshing(false);
  };

  // ── Top categories this month ───────────────────────────────────────────
  const { data: topCategoriesData, isLoading: loadingCats } = useQuery({
    queryKey: ['home-summary-v2', userId, monthFrom],
    queryFn: async () => {
      const from = monthFrom;
      const to   = monthTo;
      const { data } = await supabase
        .from('recordings')
        .select('amount, category_id, categories:category_id(name, icon)')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .neq('status', 'voided')
        .gte('transaction_date', from)
        .lte('transaction_date', to);
      if (!data) return { items: [], total: 0 };
      const map: Record<string, { name: string; icon: string; total: number }> = {};
      data.forEach((r: any) => {
        const cat = Array.isArray(r.categories) ? r.categories[0] : r.categories;
        const key = r.category_id ?? '__none__';
        if (!map[key]) map[key] = { name: cat?.name ?? 'Uncategorized', icon: cat?.icon ?? 'other-1-outline', total: 0, categoryId: r.category_id ?? null };
        map[key].total += Number(r.amount);
      });
      const all = Object.values(map).sort((a, b) => b.total - a.total);
      return { items: all.slice(0, 4), total: all.length };
    },
    enabled: !!userId,
  });

  const topCategories = topCategoriesData?.items ?? [];
  const totalTopCategories = topCategoriesData?.total ?? 0;

  // ── Latest recordings ────────────────────────────────────────────────
  const { data: recent = [], isLoading: loadingRecent } = useQuery({
    queryKey: ['home-recent', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('id, name, type, amount, transaction_date')
        .eq('user_id', userId)
        .neq('status', 'voided')
        .order('created_at', { ascending: false })
        .limit(3);
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Reminders ─────────────────────────────────────────────────────────
  const { data: reminders = [], isLoading: loadingReminders } = useQuery({
    queryKey: ['home-reminders', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recording_reminders')
        .select('id, name, frequency, day_of_week, day_of_month, start_date, status, recording_type')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('name', { ascending: true })
        .limit(3);
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Loans ───────────────────────────────────────────────────────────────
  const { data: loans = [], isLoading: loadingLoans } = useQuery({
    queryKey: ['home-loans', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('id, name, amount, status, split_bill_id')
        .eq('user_id', userId)
        .eq('type', 'debt')
        .neq('status', 'paid')
        .neq('status', 'voided')
        .order('transaction_date', { ascending: false })
        .limit(3);
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Receivables — by people (split bills you created) ─────────────────
  const { data: receivablesPeople = [], isLoading: loadingReceivables } = useQuery({
    queryKey: ['home-receivables', userId],
    queryFn: async () => {
      const { data: bills } = await supabase
        .from('split_bills').select('id, name, status').eq('user_id', userId);
      if (!bills || bills.length === 0) return [];
      const billIds = bills.map((b: any) => b.id);
      const [{ data: billSplits }, { data: items }, { data: payments }] = await Promise.all([
        supabase.from('bill_splits').select('split_bill_id, person_name').in('split_bill_id', billIds),
        supabase.from('split_items').select('split_bill_id, cost, people, recording_type').in('split_bill_id', billIds),
        supabase.from('split_bill_payments').select('split_bill_id, person_name, amount, status').in('split_bill_id', billIds).neq('status', 'cancelled'),
      ]);
      const billMap: Record<string, any> = {};
      bills.forEach((b: any) => { billMap[b.id] = b; });
      const owedMap: Record<string, Record<string, number>> = {};
      (items ?? []).forEach((item: any) => {
        const people: string[] = item.people ?? [];
        if (!people.length) return;
        const isDeduct = item.recording_type === 'payable';
        const pp = Number(item.cost) / people.length;
        people.forEach((p: string) => {
          if (!owedMap[p]) owedMap[p] = {};
          owedMap[p][item.split_bill_id] = (owedMap[p][item.split_bill_id] ?? 0) + (isDeduct ? -pp : pp);
        });
      });
      const paidMap: Record<string, Record<string, number>> = {};
      (payments ?? []).forEach((pay: any) => {
        if (!paidMap[pay.person_name]) paidMap[pay.person_name] = {};
        paidMap[pay.person_name][pay.split_bill_id] = (paidMap[pay.person_name][pay.split_bill_id] ?? 0) + Number(pay.amount);
      });
      const allPeople = [...new Set((billSplits ?? []).map((bs: any) => bs.person_name as string))];
      return allPeople.map((person: string) => {
        const personBillIds = (billSplits ?? []).filter((bs: any) => bs.person_name === person).map((bs: any) => bs.split_bill_id);
        const billEntries = personBillIds.map((billId: string) => {
          const bill = billMap[billId]; if (!bill) return null;
          const owed = owedMap[person]?.[billId] ?? 0;
          const paid = paidMap[person]?.[billId] ?? 0;
          return { billId, billName: bill.name, billStatus: bill.status, owed, paid, remaining: Math.max(0, owed - paid), isComplete: bill.status === 'closed' || (owed > 0 && paid >= owed - 0.01) };
        }).filter(Boolean).filter((b: any) => b.owed > 0);
        const totalRemaining = billEntries.reduce((s: number, b: any) => s + (b.remaining ?? 0), 0);
        return { person, billEntries, totalOwed: billEntries.reduce((s: number, b: any) => s + (b.owed ?? 0), 0), totalRemaining };
      }).filter((p: any) => p.billEntries.length > 0 && (p.totalRemaining ?? 0) > 0)
        .sort((a: any, b: any) => b.totalRemaining - a.totalRemaining)
        .slice(0, 3);
    },
    enabled: !!userId,
  });

  // ── Spaces (top 3, with current-month spent) ────────────────────────────
  const { data: spaces = [], isLoading: loadingSpaces } = useQuery({
    queryKey: ['home-spaces', userId, monthFrom],
    queryFn: async () => {
      const { data: spaceRows } = await supabase
        .from('spaces')
        .select('id, name, budget, budget_currency, space_type')
        .eq('user_id', userId)
        .neq('is_active', false)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .limit(3);
      if (!spaceRows || spaceRows.length === 0) return [];

      const from = monthFrom;
      const to   = monthTo;
      const ids = spaceRows.map((s: any) => s.id);

      const { data: recs } = await supabase
        .from('recordings')
        .select('space_id, amount, type')
        .in('space_id', ids)
        .neq('status', 'voided')
        .gte('transaction_date', from)
        .lte('transaction_date', to);

      const spentMap: Record<string, number> = {};
      const savedMap: Record<string, number> = {};
      (recs ?? []).forEach((r: any) => {
        if (r.type === 'expense' || r.type === 'debt') {
          spentMap[r.space_id] = (spentMap[r.space_id] ?? 0) + Number(r.amount);
        }
      });

      // For savings spaces: fetch all-time up to end of selected month
      const { data: savingsRecs } = await supabase
        .from('recordings')
        .select('space_id, amount, type')
        .in('space_id', ids)
        .neq('status', 'voided')
        .lte('transaction_date', to);

      (savingsRecs ?? []).forEach((r: any) => {
        if (r.type === 'income' || r.type === 'due') {
          savedMap[r.space_id] = (savedMap[r.space_id] ?? 0) + Number(r.amount);
        }
      });

      return spaceRows.map((s: any) => ({
        ...s,
        spent: s.space_type === 'savings' ? (savedMap[s.id] ?? 0) : (spentMap[s.id] ?? 0),
      }));
    },
    enabled: !!userId,
  });

  // ── Total counts for see more ──────────────────────────────────────────
  const { data: totalCounts = { recordings: 0, spaces: 0, reminders: 0, loans: 0, receivables: 0 } } = useQuery({
    queryKey: ['home-totals', userId],
    queryFn: async () => {
      const [rec, sp, rem, ln, rv] = await Promise.all([
        supabase.from('recordings').select('*', { count: 'exact', head: true }).eq('user_id', userId).neq('status', 'voided'),
        supabase.from('spaces').select('*', { count: 'exact', head: true }).eq('user_id', userId).neq('is_active', false),
        supabase.from('recording_reminders').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
        supabase.from('recordings').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('type', 'debt').neq('status', 'paid').neq('status', 'voided'),
        supabase.from('recordings').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('type', 'receivable').neq('status', 'received').neq('status', 'voided'),
      ]);
      return { recordings: rec.count ?? 0, spaces: sp.count ?? 0, reminders: rem.count ?? 0, loans: ln.count ?? 0, receivables: rv.count ?? 0 };
    },
    enabled: !!userId,
  });

  const [spaceChoice, setSpaceChoice] = useState<{ id: string; name: string } | null>(null);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isLoading = loadingCats || loadingRecent || loadingLoans || loadingReceivables || loadingSpaces || loadingReminders;

  return (
    <SafeAreaView style={s.root}>
      {/* ── Date nav ── */}
      <View style={s.monthNav}>
        <TouchableOpacity onPress={() => {
          if (dateMode === 'monthly') {
            const d = new Date(pickerYear, pickerMonth - 1, 1);
            setPickerMonth(d.getMonth());
            setPickerYear(d.getFullYear());
          } else {
            const d = new Date(rangeFromYear, rangeFromMonth - 3, 1);
            setRangeFromMonth(d.getMonth());
            setRangeFromYear(d.getFullYear());
          }
        }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={13} color={DC.pageActionText} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          setDraftMode(dateMode);
          setDraftPickerMonth(pickerMonth);
          setDraftPickerYear(pickerYear);
          setDraftFromMonth(rangeFromMonth);
          setDraftFromYear(rangeFromYear);
          setShowDateSheet(true);
        }} activeOpacity={0.7} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.monthBtnText}>{monthLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          if (dateMode === 'monthly') {
            const d = new Date(pickerYear, pickerMonth + 1, 1);
            setPickerMonth(d.getMonth());
            setPickerYear(d.getFullYear());
          } else {
            const d = new Date(rangeFromYear, rangeFromMonth + 3, 1);
            setRangeFromMonth(d.getMonth());
            setRangeFromYear(d.getFullYear());
          }
        }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={13} color={DC.pageActionText} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <>
            {/* ── Top Spending ── */}
            <SectionHeader title="Top Spending" onSeeMore={openTopSpending} seeMoreLabel={totalTopCategories > topCategories.length ? `see ${totalTopCategories - topCategories.length} more...` : 'see all'} />
            {topCategories.length === 0 ? (
              <EmptyRow label="no expenses this month" onPress={openTopSpending} />
            ) : (
              <View style={s.catGrid}>
                {topCategories.map((cat, i) => (
                  <TouchableOpacity key={i} style={s.catCard} activeOpacity={0.7} onPress={() => openRecordingsPanel({ categoryId: cat.categoryId ?? undefined, categoryName: cat.name })}>
                    <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                      <AnimatedIcon set="basil" icon={cat.icon} size={28} color="#111111" />
                    </View>
                    <Text style={s.catName} numberOfLines={1}>{cat.name}</Text>
                    <Text style={s.catAmount}>{fmt(cat.total)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Latest Recordings ── */}
            <SectionHeader title="Recordings" onSeeMore={openRecordingsPanel} seeMoreLabel={totalCounts.recordings > recent.length ? `see ${totalCounts.recordings - recent.length} more...` : 'see all'} />
            {recent.length === 0 ? (
              <EmptyRow label="go to recordings" onPress={openRecordingsPanel} />
            ) : (
              <View style={s.list}>
                {recent.map((r: any, i: number) => (
                  <TouchableOpacity key={r.id} style={[s.row, i === recent.length - 1 && s.rowLast]} activeOpacity={0.7} onPress={() => openRecording(r.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowName} numberOfLines={1}>{r.name}</Text>
                      <Text style={s.rowSub}>{r.type}</Text>
                      <Text style={s.rowSub}>{r.transaction_date ? new Date(r.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Text>
                    </View>
                    <Text style={s.rowValueBold}>{fmt(Number(r.amount))}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Spaces ── */}
            <SectionHeader title="Spaces" onSeeMore={openSpacesPanel} seeMoreLabel={totalCounts.spaces > spaces.length ? `see ${totalCounts.spaces - spaces.length} more...` : 'see all'} />
            {spaces.length === 0 ? (
              <EmptyRow label="go to spaces" onPress={openSpacesPanel} />
            ) : (
              <View style={s.list}>
                {spaces.map((sp: any, i: number) => (
                  <TouchableOpacity
                    key={sp.id}
                    style={[s.row, i === spaces.length - 1 && s.rowLast]}
                    activeOpacity={0.7}
                    onPress={() => setSpaceChoice({ id: sp.id, name: sp.name })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowName} numberOfLines={1}>{sp.name}</Text>
                      <Text style={s.rowSub}>{sp.space_type === 'savings' ? 'savings tracker' : 'expense tracker'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.rowValue}>{fmt(sp.spent)}</Text>
                      {sp.budget && (
                        <Text style={s.rowSub}>{fmt(sp.budget)}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Reminders ── */}
            <SectionHeader title="Reminders" onSeeMore={openRemindersPanel} seeMoreLabel={totalCounts.reminders > reminders.length ? `see ${totalCounts.reminders - reminders.length} more...` : 'see all'} />
            {reminders.length === 0 ? (
              <EmptyRow label="go to reminders" onPress={openRemindersPanel} />
            ) : (
              <View style={s.list}>
                {reminders.map((r: any, i: number) => {
                  const due = isReminderDueToday(r, new Date());
                  return (
                    <View key={r.id} style={[s.row, i === reminders.length - 1 && s.rowLast]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName} numberOfLines={1}>{r.name}</Text>
                        <Text style={s.rowSub}>{reminderFrequencyLabel(r)} · {r.recording_type}</Text>
                      </View>
                      {due && (
                        <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 11, color: TEAL }}>due today</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Loans ── */}
            <SectionHeader title="Loans" onSeeMore={openLoansPanel} seeMoreLabel={totalCounts.loans > loans.length ? `see ${totalCounts.loans - loans.length} more...` : 'see all'} />
            {loans.length === 0 ? (
              <EmptyRow label="go to loans" onPress={openLoansPanel} />
            ) : (
              <View style={s.list}>
                {loans.map((l: any, i: number) => (
                  <TouchableOpacity key={l.id} style={[s.row, i === loans.length - 1 && s.rowLast]} activeOpacity={0.7} onPress={() => openRecording(l.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowName} numberOfLines={1}>{l.name}</Text>
                      <Text style={s.rowSub}>{l.split_bill_id ? 'split bill' : 'recording'}</Text>
                    </View>
                    <Text style={s.rowValueBold}>{fmt(Number(l.amount))}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Receivables ── */}
            <SectionHeader title="Receivables" onSeeMore={openReceivablesPanel} seeMoreLabel={receivablesPeople.length > 0 ? 'see all' : undefined} />
            {receivablesPeople.length === 0 ? (
              <EmptyRow label="go to receivables" onPress={openReceivablesPanel} />
            ) : (
              <View style={s.list}>
                {receivablesPeople.map((p: any, i: number) => (
                  <TouchableOpacity
                    key={p.person}
                    style={[s.row, i === receivablesPeople.length - 1 && s.rowLast]}
                    activeOpacity={0.7}
                    onPress={openReceivablesPanel}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowName} numberOfLines={1}>{p.person}</Text>
                      <Text style={s.rowSub}>
                        {(p.billEntries ?? []).filter((b: any) => !b.isComplete).length} unpaid
                      </Text>
                    </View>
                    <Text style={[s.rowValueBold, { color: '#111111' }]}>
                      {fmt(Number(p.totalRemaining ?? 0))}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
      </ScrollView>

      {/* Loading overlay */}
      {isLoading && (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <GooeyLoader />
        </BlurView>
      )}

      <BottomSheet visible={showDateSheet} onClose={() => setShowDateSheet(false)} title="date range">
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          <TouchableOpacity style={[s.chip, draftPickerMonth === new Date().getMonth() && draftPickerYear === new Date().getFullYear() && draftMode === 'monthly' && s.chipActive]} onPress={() => { setDraftMode('monthly'); setDraftPickerMonth(new Date().getMonth()); setDraftPickerYear(new Date().getFullYear()); }} activeOpacity={0.75}>
            <Text style={[s.chipText, draftPickerMonth === new Date().getMonth() && draftPickerYear === new Date().getFullYear() && draftMode === 'monthly' && s.chipTextActive]}>This Month</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.chip, draftMode === 'monthly' && !(draftPickerMonth === new Date().getMonth() && draftPickerYear === new Date().getFullYear()) && s.chipActive]} onPress={() => setDraftMode('monthly')} activeOpacity={0.75}>
            <Text style={[s.chipText, draftMode === 'monthly' && !(draftPickerMonth === new Date().getMonth() && draftPickerYear === new Date().getFullYear()) && s.chipTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.chip, draftMode === '3months' && s.chipActive]} onPress={() => setDraftMode('3months')} activeOpacity={0.75}>
            <Text style={[s.chipText, draftMode === '3months' && s.chipTextActive]}>3 Months</Text>
          </TouchableOpacity>
        </View>

        {draftMode === 'monthly' && !(draftPickerMonth === new Date().getMonth() && draftPickerYear === new Date().getFullYear()) && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetLabel}>Month</Text>
              <ScrollView style={s.dropCol} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity key={m} style={[s.dropItem, draftPickerMonth === i && s.dropItemActive]} onPress={() => setDraftPickerMonth(i)} activeOpacity={0.75}>
                    <Text style={[s.dropText, draftPickerMonth === i && s.dropTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetLabel}>Year</Text>
              <ScrollView style={s.dropCol} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {YEARS.map(y => (
                  <TouchableOpacity key={y} style={[s.dropItem, draftPickerYear === y && s.dropItemActive]} onPress={() => setDraftPickerYear(y)} activeOpacity={0.75}>
                    <Text style={[s.dropText, draftPickerYear === y && s.dropTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {draftMode === '3months' && (() => {
          const autoTo = new Date(draftFromYear, draftFromMonth + 2, 1);
          return (
            <>
              <Text style={s.sheetLabel}>From</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <ScrollView style={s.dropCol} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {MONTHS.map((m, i) => (
                      <TouchableOpacity key={m} style={[s.dropItem, draftFromMonth === i && s.dropItemActive]} onPress={() => setDraftFromMonth(i)} activeOpacity={0.75}>
                        <Text style={[s.dropText, draftFromMonth === i && s.dropTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={{ flex: 1 }}>
                  <ScrollView style={s.dropCol} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {YEARS.map(y => (
                      <TouchableOpacity key={y} style={[s.dropItem, draftFromYear === y && s.dropItemActive]} onPress={() => setDraftFromYear(y)} activeOpacity={0.75}>
                        <Text style={[s.dropText, draftFromYear === y && s.dropTextActive]}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
              <Text style={s.sheetLabel}>Until (auto)</Text>
              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 14, color: '#4f9289', marginBottom: 16 }}>
                {MONTHS[autoTo.getMonth()]} {autoTo.getFullYear()}
              </Text>
            </>
          );
        })()}

        <TouchableOpacity
          style={s.applyBtn}
          activeOpacity={0.8}
          onPress={() => {
            setDateMode(draftMode);
            setPickerMonth(draftPickerMonth);
            setPickerYear(draftPickerYear);
            setRangeFromMonth(draftFromMonth);
            setRangeFromYear(draftFromYear);
            setShowDateSheet(false);
          }}
        >
          <Text style={s.applyBtnText}>Apply</Text>
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet visible={!!spaceChoice} onClose={() => setSpaceChoice(null)} title={spaceChoice?.name ?? ''}>
        <TouchableOpacity style={s.choiceRow} activeOpacity={0.8} onPress={() => { const sp = spaceChoice; setSpaceChoice(null); openRecordingsPanel({ spaceId: sp!.id, spaceName: sp!.name }); }}>
          <View style={{ flex: 1 }}>
            <Text style={s.choiceTitle}>View Recordings</Text>
            <Text style={s.choiceSub}>browse this space's recordings</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.choiceRow, { borderBottomWidth: 0 }]} activeOpacity={0.8} onPress={() => { const sp = spaceChoice; setSpaceChoice(null); openRecordingsPanel({ spaceId: sp!.id, spaceName: sp!.name }); }}>
          <View style={{ flex: 1 }}>
            <Text style={s.choiceTitle}>Edit Space</Text>
            <Text style={s.choiceSub}>rename, archive, or delete</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
        </TouchableOpacity>
      </BottomSheet>
    </SafeAreaView>
  );
}

function SectionHeader({ title, onSeeMore, seeMoreLabel }: { title: string; onSeeMore?: () => void; seeMoreLabel?: string }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{title}</Text>
      {onSeeMore && (
        <TouchableOpacity onPress={onSeeMore} activeOpacity={0.7} style={s.seeMoreRow}>
          <Text style={s.seeMoreText}>{seeMoreLabel ?? 'see all'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function SeeMore({ total, shown, onPress, alwaysShow }: { total: number; shown: number; onPress: () => void; alwaysShow?: boolean }) {
  const remaining = total - shown;
  if (!alwaysShow && remaining <= 0) return null;
  const label = remaining > 0 ? `see ${remaining} more...` : 'see all';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={s.seeMoreRow}>
      <Text style={s.seeMoreText}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyRow({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={s.emptyRow}>
      <Text style={[s.emptyText, onPress && { color: '#9cd7d2' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#ffffff' },
  scroll: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 80 },

  // Month nav
  monthNav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pageActionPaddingH, paddingVertical: DC.pageActionPaddingV, backgroundColor: DC.pageActionBg, borderRadius: DC.pageActionRadius, marginHorizontal: 28, marginTop: 4, marginBottom: 4 },
  monthBtnText: { fontFamily: AppFont.regular, fontSize: DC.dropdownFontSize, color: DC.pageActionText },

  // Section header
  sectionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 14 },
  sectionTitle:{ fontFamily: 'Poppins-Bold', fontSize: 20, color: '#9cd7d2' },
  seeMoreRow:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: DC.pageActionRadius, backgroundColor: DC.pageActionBg, borderWidth: DC.pageActionBorderWidth },
  seeMoreText: { fontFamily: AppFont.regular, fontSize: 12, color: DC.pageActionText },

  // Empty
  emptyRow:  { paddingVertical: 12 },
  emptyText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.faint },

  // Top spending grid
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCard: {
    width: '47%',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 6,
  },
  catName:   { fontFamily: 'Poppins-Bold', fontSize: 13, color: '#111111' },
  catAmount: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#555555' },

  // Shared list rows
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowName:      { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#111111' },
  rowSub:       { fontFamily: 'Poppins-Regular', fontSize: 11, color: '#999999' },
  rowValue:     { fontFamily: 'Poppins-Bold', fontSize: 13, color: '#111111' },
  rowLast:     { borderBottomWidth: 0 },
  rowValueBold: { fontFamily: 'Poppins-Bold', fontSize: 14, color: '#111111' },
  choiceRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  choiceTitle: { fontFamily: AppFont.semiBold, fontSize: 14, color: '#111111' },
  choiceSub:   { fontFamily: AppFont.regular, fontSize: 11, color: '#999999', marginTop: 2 },
  chip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#eeeeee' },
  chipActive:  { backgroundColor: '#ebf7f6', borderColor: '#9cd7d2' },
  chipText:    { fontFamily: AppFont.regular, fontSize: 13, color: '#666666' },
  chipTextActive: { fontFamily: AppFont.semiBold, fontSize: 13, color: '#4f9289' },
  sheetLabel:  { fontFamily: AppFont.semiBold, fontSize: 11, color: '#999999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  dropCol:      { height: 160, backgroundColor: '#f5f5f5', borderRadius: 8 },
  dropItem:     { paddingVertical: 10, paddingHorizontal: 12 },
  dropItemActive: { backgroundColor: '#ebf7f6', borderRadius: 6 },
  dropText:     { fontFamily: AppFont.regular, fontSize: 13, color: '#666666' },
  dropTextActive: { fontFamily: AppFont.semiBold, fontSize: 13, color: '#4f9289' },
  applyBtn:     { backgroundColor: '#4f9289', borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  applyBtnText: { fontFamily: AppFont.semiBold, fontSize: 15, color: '#ffffff' },
});
