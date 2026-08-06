import { View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, RefreshControl, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { DC } from '../../../src/lib/design';
import { useNav, setHomeDateEditHandler } from '../../../src/lib/NavContext';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LOADING_SPINNER_SVG_DATA_URI } from '../../../src/lib/loadingSpinnerBase64';
import BottomSheet from '@/components/ui/BottomSheet';
import { useState, useMemo, useEffect } from 'react';

async function receiptActions({
  action, entry, userId, supabaseClient, onDone,
}: {
  action: 'delete' | 'unlink';
  entry: any;
  userId: string;
  supabaseClient: typeof supabase;
  onDone: () => void;
}) {
  if (action === 'delete') {
    const { data: photos } = await supabaseClient.from('receipt_photos').select('storage_path').eq('entry_id', entry.id);
    if (photos && photos.length > 0) {
      await supabaseClient.storage.from('receipts').remove(photos.map((p: any) => p.storage_path));
      await supabaseClient.from('receipt_photos').delete().eq('entry_id', entry.id);
    }
    await supabaseClient.from('receipt_entries').delete().eq('id', entry.id);
  } else {
    await supabaseClient.from('receipt_entries').update({ recording_id: null }).eq('id', entry.id);
  }
  onDone();
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS = Array.from({ length: 21 }, (_, i) => 2020 + i);

type DateMode = 'monthly' | '3months';

export default function HomeScreen({ isActive }: { isActive?: boolean }) {
  const { userId } = useUser();
  const { switchTab, openRecording, openRecordingsPanel, openReceivablesPanel, openSplitBill } = useNav();
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
      queryClient.invalidateQueries({ queryKey: ['home-recent', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-people', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-split-bills', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-receipts', userId] });
    };
    const id = `${userId}-${Date.now()}`;
    const channel = supabase
      .channel(`home-live-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_bills', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receipt_entries', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['home-recent', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-people', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-split-bills', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-receipts', userId] }),
    ]);
    setRefreshing(false);
  };

  // ── Latest recordings ────────────────────────────────────────────────
  const { data: recent = [], isLoading: loadingRecent } = useQuery({
    queryKey: ['home-recent', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('id, name, type, amount, transaction_date, space_id, category_id, categories:category_id(icon), space:space_id(name)')
        .eq('user_id', userId)
        .neq('status', 'voided')
        .neq('is_tagged', true)
        .neq('is_system_generated', true)
        .order('created_at', { ascending: false })
        .limit(3);
      return data ?? [];
    },
    enabled: !!userId,
  });

  // ── Recent Receipts ───────────────────────────────────────────────────────
  const { data: recentReceipts = [], isLoading: loadingReceipts } = useQuery({
    queryKey: ['home-receipts', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('receipt_entries')
        .select('id, note, created_at, recording_id, receipt_photos(id)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);
      return (data ?? []).map((e: any) => ({
        ...e,
        photo_count: Array.isArray(e.receipt_photos) ? e.receipt_photos.length : 0,
        recording: e.recording_id ? { name: '' } : null,
      }));
    },
    enabled: !!userId,
    staleTime: 0,
  });

  useEffect(() => {
    if (isActive && userId) {
      queryClient.invalidateQueries({ queryKey: ['home-receipts', userId] });
    }
  }, [isActive, userId]);

  // ── Split Bills ───────────────────────────────────────────────────────
  const { data: splitBills = [], isLoading: loadingSplitBills } = useQuery({
    queryKey: ['home-split-bills', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_bills')
        .select('id, name, created_at, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);
      if (!data || data.length === 0) return [];
      const billIds = data.map((b: any) => b.id);
      const [{ data: allItems }, { data: allPeople }] = await Promise.all([
        supabase.from('split_items').select('split_bill_id, cost, people').in('split_bill_id', billIds),
        supabase.from('split_items').select('split_bill_id, people').in('split_bill_id', billIds),
      ]);
      return data.map((bill: any) => {
        const billItems = (allItems ?? []).filter((i: any) => i.split_bill_id === bill.id);
        const allPeopleInBill = [...new Set(
          billItems.flatMap((i: any) => i.people ?? [])
        )];
        return {
          ...bill,
          people_count: allPeopleInBill.length,
          total_amount: billItems.reduce((s: number, i: any) => s + Number(i.cost), 0),
        };
      });
    },
    enabled: !!userId,
  });

  // ── Loans — unified loans + receivables ──────────────────────────────
  const { data: peopleData, isLoading: loadingPeople } = useQuery({
    queryKey: ['home-people', userId],
    queryFn: async () => {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, receiver_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
      const friendIds = (friendships ?? []).map((f: any) => f.requester_id === userId ? f.receiver_id : f.requester_id);
      const friendNames = await Promise.all(friendIds.map((id: string) =>
        supabase.rpc('get_user_display_name', { user_id: id }).then(({ data: n }) => (n ?? '').toLowerCase())
      ));
      const friendNameSet = new Set(friendNames);

      // All recordings with a person (filtered to financial relationships, exclude old mirror debts)
      const { data: allRecs } = await supabase
        .from('recordings')
        .select('id, person_name, type, amount, paid_amount, status, is_due, source_recording_id, is_tagged')
        .eq('user_id', userId)
        .neq('person_name', '')
        .not('person_name', 'is', null)
        .neq('status', 'voided');
      const recs = (allRecs ?? []).filter(
        (r: any) => (r.type === 'debt' && !r.is_tagged) || r.type === 'due' || r.is_due
      );

      // Compute paid from returns (shared with both users)
      const recIds = recs.flatMap(r => [r.id, r.source_recording_id].filter(Boolean));
      const { data: copies } = recIds.length > 0 ? await supabase.from('recordings')
        .select('id, source_recording_id').in('source_recording_id', recIds).neq('status', 'voided')
        : { data: [] };
      const allIds = [...new Set([...recIds, ...(copies ?? []).map((c: any) => c.id)])];

      // Shared recordings where I'm tagged — I owe the owner (single-entry model)
      const { data: sharedRecs } = await supabase
        .from('recordings')
        .select('id, user_id, name, amount, status')
        .filter('shared_with', 'cs', `["${userId}"]`)
        .neq('user_id', userId)
        .eq('tagged_friend_user_id', userId)
        .neq('status', 'voided');
      // Add shared recording IDs to allIds for return computation
      (sharedRecs ?? []).forEach((sr: any) => {
        if (sr.status === 'paid') return;
        allIds.push(sr.id);
      });
      // Query returns for all recording IDs (own recordings, copies, shared)
      const { data: returns } = allIds.length > 0 ? await supabase.from('recordings')
        .select('linked_recording_id, amount').eq('type', 'return').neq('status', 'voided').in('linked_recording_id', allIds)
        : { data: [] };
      const returnSum: Record<string, number> = {};
      (returns ?? []).forEach((p: any) => {
        returnSum[p.linked_recording_id] = (returnSum[p.linked_recording_id] ?? 0) + Number(p.amount);
      });
      const sharedMap: Record<string, { name: string; total: number }> = {};
      for (const sr of (sharedRecs ?? [])) {
        if (sr.status === 'paid') continue;
        const totalPaid = returnSum[sr.id] ?? 0;
        if (totalPaid >= Number(sr.amount ?? 0) - 0.01) continue;
        const ownerId = sr.user_id;
        if (!sharedMap[ownerId]) {
          const { data: ownerName } = await supabase.rpc('get_user_display_name', { user_id: ownerId });
          sharedMap[ownerId] = { name: ownerName ?? 'unknown', total: 0 };
        }
        sharedMap[ownerId].total += Math.max(0, Number(sr.amount ?? 0) - totalPaid);
      }

      // Backward compat: old mirror debt recordings in my account
      const { data: oldDebts } = await supabase
        .from('recordings')
        .select('id, person_name, amount, paid_amount, status')
        .eq('user_id', userId)
        .eq('type', 'debt')
        .eq('is_tagged', true)
        .neq('status', 'voided');
      const oldDebtMap: Record<string, number> = {};
      (oldDebts ?? []).forEach((d: any) => {
        const name = d.person_name?.toLowerCase() || 'unknown';
        const remaining = Math.max(0, Number(d.amount) - Number(d.paid_amount ?? 0));
        if (remaining > 0.01) {
          oldDebtMap[name] = (oldDebtMap[name] ?? 0) + remaining;
        }
      });

      // Scope split data to user's bills
      const { data: userBills } = await supabase
        .from('split_bills')
        .select('id')
        .eq('user_id', userId);
      const billIds = (userBills ?? []).map((b: any) => b.id);

      const { data: splits } = billIds.length > 0
        ? await supabase.from('bill_splits').select('person_name').in('split_bill_id', billIds)
        : { data: [] };
      const splitPeople = [...new Set((splits ?? []).map((s: any) => s.person_name).filter(Boolean))];

      // Split bill items for amounts (old schema)
      const { data: items } = billIds.length > 0
        ? await supabase.from('split_items').select('cost, people, recording_type').in('split_bill_id', billIds)
        : { data: [] };

      // Payments
      const { data: payments } = billIds.length > 0
        ? await supabase.from('split_bill_payments').select('person_name, amount, status').in('split_bill_id', billIds).neq('status', 'cancelled')
        : { data: [] };

      // Calculate net per person
      const net: Record<string, number> = {};
      const details: Record<string, { owedToMe: number; iOwe: number }> = {};

      (recs ?? []).forEach((r: any) => {
        if (!r.person_name) return;
        if (r.status === 'paid' || r.status === 'closed') return;
        const linkedReturns = (returnSum[r.id] ?? 0) + (r.source_recording_id ? (returnSum[r.source_recording_id] ?? 0) : 0);
        const copyReturns = (copies ?? []).filter((c: any) => c.source_recording_id === r.id || c.source_recording_id === r.source_recording_id)
          .reduce((sum: number, c: any) => sum + (returnSum[c.id] ?? 0), 0);
        const paid = Math.min(linkedReturns + copyReturns, Number(r.amount));
        const remaining = Math.max(0, Number(r.amount) - paid);
        if (remaining <= 0.01) return;
        if (!details[r.person_name]) details[r.person_name] = { owedToMe: 0, iOwe: 0 };
        if (r.type === 'due' || r.is_due) { details[r.person_name].owedToMe += remaining; net[r.person_name] = (net[r.person_name] ?? 0) + remaining; }
        else { details[r.person_name].iOwe += remaining; net[r.person_name] = (net[r.person_name] ?? 0) - remaining; }
      });

      // Combine split people (may or may not have recordings)
      splitPeople.forEach((name: string) => {
        if (!details[name]) details[name] = { owedToMe: 0, iOwe: 0 };
      });

      // Calculate split bill debts
      (items ?? []).forEach((item: any) => {
        const people: string[] = item.people ?? [];
        if (!people.length) return;
        const isDeduct = item.recording_type === 'payable';
        const pp = Number(item.cost) / people.length;
        people.forEach((p: string) => {
          if (!details[p]) details[p] = { owedToMe: 0, iOwe: 0 };
          net[p] = (net[p] ?? 0) + (isDeduct ? -pp : pp);
          if (isDeduct) details[p].iOwe += pp;
          else details[p].owedToMe += pp;
        });
      });

      // Subtract payments
      (payments ?? []).forEach((pay: any) => {
        net[pay.person_name] = (net[pay.person_name] ?? 0) - Number(pay.amount);
        if (details[pay.person_name]) details[pay.person_name].owedToMe -= Number(pay.amount);
      });

      // Add shared recordings — debts others told me I owe
      Object.values(sharedMap).forEach((data) => {
        if (!details[data.name]) details[data.name] = { owedToMe: 0, iOwe: 0 };
        details[data.name].iOwe += data.total;
        net[data.name] = (net[data.name] ?? 0) - data.total;
      });

      // Backward compat: old mirror debt recordings in my account
      Object.entries(oldDebtMap).forEach(([name, remaining]) => {
        if (!details[name]) details[name] = { owedToMe: 0, iOwe: 0 };
        details[name].iOwe += remaining;
        net[name] = (net[name] ?? 0) - remaining;
      });

      const people = Object.entries(details)
        .filter(([name]) => name)
        .map(([name, d]) => ({
          person: name,
          net: Math.round((net[name] ?? 0) * 100) / 100,
          isFriend: friendNameSet.has(name.toLowerCase()),
          owedToMe: Math.round(d.owedToMe * 100) / 100,
          iOwe: Math.round(d.iOwe * 100) / 100,
        }))
        .filter(p => Math.abs(p.net) > 0.01)
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

      return people;
    },
    enabled: !!userId,
  });

  const peopleSummary = (peopleData ?? []).slice(0, 3);

  const [receiptActionEntry, setReceiptActionEntry] = useState<any>(null);

  const handleReceiptAction = (action: 'delete' | 'unlink', entry: any) =>
    receiptActions({ action, entry, userId: userId!, supabaseClient: supabase, onDone: () => queryClient.invalidateQueries({ queryKey: ['home-receipts', userId] }) });

  const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isLoading = loadingRecent || loadingPeople || loadingSplitBills || loadingReceipts;

  const { setHomeDateLabel } = useNav();

  useEffect(() => {
    setHomeDateEditHandler(() => setShowDateSheet(true));
    return () => setHomeDateEditHandler(null);
  }, []);

  useEffect(() => {
    setHomeDateLabel(monthLabel);
  }, [monthLabel, setHomeDateLabel]);

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Recent Transactions */}
        <SectionHeader title="Transactions" onArrowRight={() => openRecordingsPanel()} />
        {recent.length === 0 ? <EmptyRow label="no recordings" /> : (
          <View style={s.sectionContentLeft}>
            <View style={s.recList}>
              <View style={s.recTimelineCol}>
                {recent.slice(0, 3).map((r: any, i: number) => {
                  const count = Math.min(recent.length, 3);
                  const isFirst = i === 0;
                  const isLast = i === count - 1;
                  const showDot = count > 1 && (isFirst || isLast);
                  const showLine = count > 1 && !isFirst && !isLast;
                  return (
                    <View key={r.id} style={s.recDotWrap}>
                      {showDot && (<><View style={isFirst ? s.recLineHidden : s.recLineSegment} /><View style={s.recDot} /><View style={isLast ? s.recLineHidden : s.recLineSegment} /></>)}
                      {showLine && <View style={[s.recLineSegment, { flex: 1 }]} />}
                    </View>
                  );
                })}
              </View>
              <View style={s.recCardsCol}>
                {recent.slice(0, 3).map((r: any) => {
                  const isOut = ['expense','debt','payment'].includes(r.type);
                  const dateObj = new Date(r.transaction_date + 'T00:00:00');
                  const today = new Date(); today.setHours(0,0,0,0);
                  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
                  const dateLabel = dateObj.getTime() === today.getTime() ? 'Today'
                    : dateObj.getTime() === yesterday.getTime() ? 'Yesterday'
                    : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const nameStr = r.name.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                  return (
                    <TouchableOpacity key={r.id} style={s.recCard} activeOpacity={0.7} onPress={() => openRecording(r.id)}>
                      <View style={s.recDateCol}><Text style={s.recDateText}>{dateLabel}</Text></View>
                      <View style={s.recCardDivider} />
                      <View style={s.recContentCol}>
                        <Text style={s.recAmount}>{isOut ? '- ' : ''}{fmt(Number(r.amount))}</Text>
                        <Text style={s.recName} numberOfLines={1}>{nameStr}</Text>
                        <Text style={s.recFolder} numberOfLines={1}>{r.space?.name ?? 'No Folder'}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}
        <View style={s.divider} />

        {/* Loans */}
        <SectionHeader title="Loans" onArrowRight={() => openReceivablesPanel()} />
        {peopleSummary.length === 0 ? <EmptyRow label="no active loans" /> : (
          <View style={s.sectionContentLeft}>
            {peopleSummary.map((p: any, i: number) => {
              const isNegative = p.net < 0;
              const absNet = Math.abs(p.net);
              const initials = p.person.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <TouchableOpacity key={p.person} style={[s.loanRow, i < peopleSummary.length - 1 && s.loanRowBorder]} activeOpacity={0.7} onPress={() => openReceivablesPanel(p.person)}>
                  <View style={s.loanAvatar}><Text style={s.loanAvatarText}>{initials}</Text></View>
                  <Text style={s.loanName} numberOfLines={1}>{p.person}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.loanLabel}>{isNegative ? 'You Owe' : 'Owes You'}</Text>
                    <Text style={[s.loanAmount, { color: isNegative ? DC.btnDangerBg : DC.incomeColor }]}>{fmt(absNet)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={s.divider} />

        {/* Receipts */}
        <SectionHeader title="Receipts" onArrowRight={() => switchTab('receipts')} />
        {recentReceipts.length === 0 ? <EmptyRow label="no receipts yet" /> : (
          <View style={s.sectionContentLeft}>
            {recentReceipts.map((entry: any, i: number) => {
              return (
                <TouchableOpacity key={entry.id} style={[s.loanRow, i < recentReceipts.length - 1 && s.loanRowBorder]} activeOpacity={0.7}
                  onPress={() => router.push({ pathname: '/(app)/receipt-detail', params: { receiptId: entry.id } } as any)}
                  onLongPress={() => setReceiptActionEntry(entry)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.receiptName} numberOfLines={1}>{entry.note ?? 'untitled'}</Text>
                    <Text style={s.receiptSub}>{entry.photo_count} {entry.photo_count === 1 ? 'photo' : 'photos'}</Text>
                  </View>
                  <View style={[s.linkedBadge, { backgroundColor: entry.recording ? '#e8f4f3' : '#f5f5f5' }]}>
                    <Text style={[s.linkedText, { color: entry.recording ? '#4f9289' : '#aaa' }]}>
                      {entry.recording ? 'linked' : 'unlinked'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={s.divider} />

        {/* Receipt action sheet */}
        <BottomSheet visible={!!receiptActionEntry} onClose={() => setReceiptActionEntry(null)} title="receipt">
          <TouchableOpacity style={s.choiceRow} activeOpacity={0.8} onPress={() => {
            const e = receiptActionEntry;
            setReceiptActionEntry(null);
            router.push({ pathname: '/(app)/capture-receipt', params: { receiptId: e?.id } } as any);
          }}>
            <View style={{ flex: 1 }}><Text style={s.choiceTitle}>Add Photos</Text><Text style={s.choiceSub}>Add more photos to this receipt</Text></View>
          </TouchableOpacity>
          {receiptActionEntry?.recording_id && (
            <TouchableOpacity style={s.choiceRow} activeOpacity={0.8} onPress={() => {
              const e = receiptActionEntry;
              setReceiptActionEntry(null);
              handleReceiptAction('unlink', e);
            }}>
              <View style={{ flex: 1 }}><Text style={s.choiceTitle}>Unlink Receipt</Text><Text style={s.choiceSub}>Remove the recording link</Text></View>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.choiceRow} activeOpacity={0.8} onPress={() => {
            const e = receiptActionEntry;
            setReceiptActionEntry(null);
            Alert.alert('Delete Receipt', 'This will delete all photos. Cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => handleReceiptAction('delete', e) },
            ]);
          }}>
            <View style={{ flex: 1 }}><Text style={[s.choiceTitle, { color: '#e53935' }]}>Delete Receipt</Text><Text style={s.choiceSub}>Permanently remove this receipt</Text></View>
          </TouchableOpacity>
        </BottomSheet>

        {/* Split Bills */}
        <SectionHeader title="Split Bills" onArrowRight={() => switchTab('bill-split')} />
        {splitBills.length === 0 ? <EmptyRow label="no split bills" /> : (
          <View style={s.sectionContentLeft}>
            {splitBills.map((bill: any, i: number) => (
              <TouchableOpacity key={bill.id} style={[s.loanRow, i < splitBills.length - 1 && s.loanRowBorder]} activeOpacity={0.7} onPress={() => openSplitBill(bill.id, bill.name)}>
                <View style={[s.loanAvatar, { backgroundColor: '#e8f4f3' }]}>
                  <Text style={[s.loanAvatarText, { color: '#4f9289' }]}>{bill.people_count}</Text>
                </View>
                <Text style={s.loanName} numberOfLines={1}>{bill.name}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.loanAmount, { color: DC.pageText }]}>{fmt(bill.total_amount)}</Text>
                  <Text style={s.loanLabel}>{bill.people_count} {bill.people_count !== 1 ? 'people' : 'person'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Loading overlay */}
      {isLoading && (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <View style={s.loaderCenter}>
            {Platform.OS === 'web' ? (
              <img src={LOADING_SPINNER_SVG_DATA_URI} alt="loading" style={{ width: 48, height: 48 }} />
            ) : (
              <WebView
                originWhitelist={['*']}
                source={{ html: `<!DOCTYPE html><html><body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;width:100%;height:100%"><img src="${LOADING_SPINNER_SVG_DATA_URI}" style="width:48px;height:48px" /></body></html>` }}
                style={{ width: 48, height: 48, backgroundColor: 'transparent' }}
                pointerEvents="none"
                setSupportMultipleWindows={false}
                scrollEnabled={false}
              />
            )}
          </View>
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
              <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#4f9289', marginBottom: 16 }}>
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
    </SafeAreaView>
  );
}


function SectionHeader({ title, onArrowRight }: { title: string; onArrowRight?: () => void }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{title}</Text>
      {onArrowRight && (
        <TouchableOpacity onPress={onArrowRight} activeOpacity={0.8} style={s.viewBtn}>
          <Text style={s.viewBtnText}>View</Text>
        </TouchableOpacity>
      )}
    </View>
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
  // Part 14: root, scroll, divider
  root:   { flex: 1, backgroundColor: DC.pageBg },
  scroll: { paddingTop: 20, paddingBottom: 80 },
  divider: { height: DC.rowDivider.height, backgroundColor: DC.rowDivider.backgroundColor, marginTop: 28, marginBottom: 28 },

  // Section header
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: DC.pagePadding },
  sectionContent: { paddingHorizontal: DC.pagePadding },
  sectionContentLeft: { paddingLeft: DC.pagePadding, paddingRight: DC.pagePadding },
  sectionTitle: { fontFamily: 'Poppins-Bold', fontSize: 14, color: DC.pageText },
  viewBtn:      { backgroundColor: DC.viewBtnBg, borderRadius: DC.viewBtnRadius, paddingHorizontal: DC.viewBtnPaddingH, paddingVertical: DC.viewBtnPaddingV },
  viewBtnText:  { fontFamily: 'Poppins-Regular', fontSize: DC.viewBtnFontSize, color: DC.viewBtnText },

  // Rows shared across sections
  recList:       { flexDirection: 'row', gap: 10 },
  recTimelineCol: { width: 12, alignItems: 'flex-start' },
  recDotWrap:     { flex: 1, alignItems: 'flex-start', justifyContent: 'center', minHeight: 74 },
  recDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d2d2d2', zIndex: 1, marginLeft: -4.25 },
  recLineSegment: { flex: 1, width: 1.5, backgroundColor: '#d2d2d2', minHeight: 10 },
  recLineHidden:  { flex: 1, width: 1.5, backgroundColor: 'transparent' },
  recCardsCol:    { flex: 1, gap: 10 },
  recCard:       { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1.5, borderColor: '#d2d2d2', borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden' },
  recDateCol:    { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  recDateText:   { fontFamily: 'Poppins-Bold', fontSize: 11, color: DC.pageTextMuted, textAlign: 'center' },
  recCardDivider:{ width: 0.5, backgroundColor: '#d2d2d2' },
  recContentCol: { flex: 1, paddingVertical: 14, paddingHorizontal: 14, justifyContent: 'center' },
  recAmount:     { fontFamily: 'Poppins-Bold', fontSize: 11, color: DC.pageText, marginBottom: 2 },
  recName:       { fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageText },
  recFolder:     { fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageTextMuted },
  recRowWrap:    { flexDirection: 'row', alignItems: 'stretch', marginBottom: 10 },
  recTimeline:   { width: 20, alignItems: 'center', paddingTop: 16 },
  recLine:       { flex: 1, width: 1, backgroundColor: '#e0e0e0', marginTop: 4 },
  recRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: DC.rowDivider.height, borderBottomColor: DC.rowDivider.backgroundColor },
  recRowLast:    { borderBottomWidth: 0 },
  recRowName:    { fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText },
  recRowSub:     { fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted, marginTop: 2 },
  recRowAmount:  { fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText },

  // Reminders
  reminderRow: { paddingVertical: 10, borderBottomWidth: DC.rowDivider.height, borderBottomColor: DC.rowDivider.backgroundColor },
  reminderRowLast: { borderBottomWidth: 0 },

  // Folders
  folderSubtitle: { fontFamily: 'Poppins-Bold', fontSize: 12, color: '#8c52ff', marginBottom: 8 },
  folderRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: DC.rowDivider.height, borderBottomColor: DC.rowDivider.backgroundColor },
  folderRowLast:  { borderBottomWidth: 0 },

  // Part 19: loans
  loanRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  loanRowBorder:  { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  loanCard:       { width: 80, alignItems: 'center', gap: 3 },
  loanAvatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: DC.viewBtnBg, alignItems: 'center', justifyContent: 'center' },
  loanAvatarText: { fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.viewBtnText },
  loanName:       { fontFamily: 'Poppins-Regular', fontSize: 13, color: DC.pageText, flex: 1 },
  loanLabel:      { fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageTextMuted, textAlign: 'right' },
  loanAmount:     { fontFamily: 'Poppins-Bold', fontSize: 13, textAlign: 'right' },

  linkedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  linkedText:  { fontFamily: 'Poppins-SemiBold', fontSize: 10 },

  receiptName: { fontFamily: 'Poppins-Regular', fontSize: 13, color: DC.pageText },
  receiptSub:  { fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageTextMuted, marginTop: 1 },

  // Part 20: empty + bottom sheet styles
  emptyRow:  { paddingVertical: 12, paddingHorizontal: DC.pagePadding },
  emptyText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.faint },
  choiceRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  choiceTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#111111' },
  choiceSub:   { fontFamily: 'Poppins-Regular', fontSize: 11, color: '#999999', marginTop: 2 },
  chip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#eeeeee' },
  chipActive:  { backgroundColor: '#ebf7f6', borderColor: '#9cd7d2' },
  chipText:    { fontFamily: 'Poppins-Regular', fontSize: 13, color: '#666666' },
  chipTextActive: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: '#4f9289' },
  sheetLabel:  { fontFamily: 'Poppins-SemiBold', fontSize: 11, color: '#999999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  dropCol:     { height: 160, backgroundColor: '#f5f5f5', borderRadius: 8 },
  dropItem:    { paddingVertical: 10, paddingHorizontal: 12 },
  dropItemActive: { backgroundColor: '#ebf7f6', borderRadius: 6 },
  dropText:    { fontFamily: 'Poppins-Regular', fontSize: 13, color: '#666666' },
  dropTextActive: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: '#4f9289' },
  applyBtn:    { backgroundColor: '#4f9289', borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  applyBtnText: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#ffffff' },
  loaderCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
