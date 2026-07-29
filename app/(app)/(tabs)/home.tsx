import { View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, RefreshControl,
  TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { DC } from '../../../src/lib/design';
import { AppFont } from '../../../src/lib/fonts';
import { useNav, setHomeDateEditHandler } from '../../../src/lib/NavContext';
import { useRouter } from 'expo-router';
import AnimatedIcon from '@/components/ui/AnimatedIcon';
import { BlurView } from 'expo-blur';
import GooeyLoader from '@/components/ui/GooeyLoader';
import BottomSheet from '@/components/ui/BottomSheet';
import { isReminderDueToday, reminderFrequencyLabel } from '../../../src/lib/reminderUtils';
import { useState, useMemo, useEffect, useRef } from 'react';
import TourTarget from '@/components/TourTarget';

const TEAL = '#5dc4bb';

import { FACE_IMAGES } from '../../../src/lib/faceImages';
const abbrNum = (n: number) => {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const units = [{ v: 1e9, s: 'B' }, { v: 1e6, s: 'M' }, { v: 1e3, s: 'k' }];
  for (const u of units) {
    if (abs >= u.v) {
      const val = n / u.v;
      return sign + (val < 100 ? parseFloat(val.toFixed(val < 10 ? 2 : 1)) : Math.round(val)) + u.s;
    }
  }
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS = Array.from({ length: 21 }, (_, i) => 2020 + i);

type DateMode = 'monthly' | '3months';

export default function HomeScreen({ isActive }: { isActive?: boolean }) {
  const { userId, defaultCurrency, userName, user } = useUser();
  const { switchTab, openSpace, openRecording, openRecordingsPanel, openSpacesPanel, openReceivablesPanel, openRemindersPanel } = useNav();
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
  const peopleScrollRef = useRef<any>(null);
  const actionsScrollRef = useRef<any>(null);

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
      queryClient.invalidateQueries({ queryKey: ['home-people', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-spaces', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-totals', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-shared', userId] });
    };
    const id = `${userId}-${Date.now()}`;
    const channel = supabase
      .channel(`home-live-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'split_bills', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recording_reminders', filter: `user_id=eq.${userId}` }, () =>
        queryClient.invalidateQueries({ queryKey: ['home-reminders', userId] })
      )
      .subscribe();
    const sharedChannel = supabase
      .channel(`home-shared-live-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings' }, (payload: any) => {
        const checkShared = (data: any) => {
          if (!data?.shared_with) return false;
          const arr = typeof data.shared_with === 'string' ? JSON.parse(data.shared_with) : data.shared_with;
          return Array.isArray(arr) && (arr.includes(userId) || data.user_id === userId);
        };
        if (checkShared(payload.new) || checkShared(payload.old)) {
          queryClient.invalidateQueries({ queryKey: ['home-shared', userId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(sharedChannel); };
  }, [userId, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['home-recent', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-people', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-spaces', userId, monthFrom] }),
      queryClient.invalidateQueries({ queryKey: ['home-reminders', userId] }),
    ]);
    setRefreshing(false);
  };

  // ── Latest recordings ────────────────────────────────────────────────
  const { data: recent = [], isLoading: loadingRecent } = useQuery({
    queryKey: ['home-recent', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('id, name, type, amount, transaction_date')
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

  // ── Shared recordings ───────────────────────────────────────────────
  const { data: shared = [] } = useQuery({
    queryKey: ['home-shared', userId],
    queryFn: async () => {
      try {
        // Recordings shared with me by others
        const { data: sharedWithMe } = await supabase
          .from('recordings')
          .select('id, name, type, amount, paid_amount, status, user_id, transaction_date, shared_with')
          .neq('status', 'voided')
          .filter('shared_with', 'cs', `["${userId}"]`)
          .order('created_at', { ascending: false });

        // My recordings that I shared with others
        const { data: myShared } = await supabase
          .from('recordings')
          .select('id, name, type, amount, paid_amount, status, user_id, transaction_date, shared_with')
          .eq('user_id', userId)
          .neq('shared_with', '[]')
          .not('shared_with', 'is', null)
          .neq('status', 'voided')
          .order('created_at', { ascending: false });

        const allIds = [...new Set([
          ...(sharedWithMe ?? []).map((r: any) => r.user_id),
          ...(myShared ?? []).flatMap((r: any) => {
            const sw = typeof r.shared_with === 'string' ? JSON.parse(r.shared_with) : (r.shared_with ?? []);
            return Array.isArray(sw) ? sw : [];
          }),
        ].filter(Boolean))] as string[];

        const displayNames: Record<string, string> = {};
        await Promise.all(allIds.map(async (id: string) => {
          const { data: n } = await supabase.rpc('get_user_display_name', { user_id: id });
          if (n) displayNames[id] = n as string;
        }));

        // Look up my debt recordings for items shared with me
        const sharedByIds = [...new Set((sharedWithMe ?? []).map((r: any) => r.id).filter(Boolean))] as string[];
        const { data: myDebts } = sharedByIds.length > 0
          ? await supabase.from('recordings').select('id, amount, paid_amount, status, source_recording_id').eq('user_id', userId).eq('is_tagged', true).in('source_recording_id', sharedByIds)
          : { data: [] };
        const debtMap: Record<string, any> = {};
        (myDebts ?? []).forEach((d: any) => { debtMap[d.source_recording_id] = d; });

        const items: any[] = [];

        // Items shared with me → I owe the owner
        (sharedWithMe ?? []).forEach((r: any) => {
          const isOwner = r.user_id === userId;
          const debt = debtMap[r.id];
          const myPaid = debt ? Number(debt.paid_amount ?? 0) : Number(r.paid_amount ?? 0);
          const myAmount = debt ? Number(debt.amount) : Number(r.amount);
          const myStatus = debt ? debt.status : r.status;
          const isPaid = myStatus === 'paid' || (myAmount > 0 && myPaid >= myAmount - 0.01);
          items.push({
            id: r.id,
            recordingId: r.id,
            name: r.name,
            amount: myAmount,
            paidAmount: myPaid,
            status: myStatus,
            isPaid,
            isOwner,
            counterpartyId: r.user_id,
            counterpartyName: displayNames[r.user_id] ?? 'Someone',
            perspective: isOwner ? 'shared_to' : 'shared_with',
          });
        });

        // My recordings that I shared with others
        (myShared ?? []).forEach((r: any) => {
          if ((sharedWithMe ?? []).some((s: any) => s.id === r.id)) return;
          const sw = typeof r.shared_with === 'string' ? JSON.parse(r.shared_with) : (r.shared_with ?? []);
          const ids = Array.isArray(sw) ? sw : [];
          ids.forEach((friendId: string) => {
            const friendName = displayNames[friendId] ?? 'Someone';
            const paid = Number(r.paid_amount ?? 0);
            const isPaid = r.status === 'paid' || (Number(r.amount) > 0 && paid >= Number(r.amount) - 0.01);
            items.push({
              id: r.id + '_' + friendId,
              recordingId: r.id,
              name: r.name,
              amount: Number(r.amount),
              paidAmount: paid,
              status: r.status,
              isPaid,
              isOwner: true,
              counterpartyId: friendId,
              counterpartyName: friendName,
              perspective: 'shared_to',
            });
          });
        });

        return items;
      } catch { return []; }
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

  const peopleSummary = peopleData ?? [];
  const { data: spaces = [], isLoading: loadingSpaces } = useQuery({
    queryKey: ['home-spaces', userId, monthFrom],
    queryFn: async () => {
      const { data: spaceRows } = await supabase
        .from('spaces')
        .select('id, name, budget, budget_currency, space_type')
        .eq('user_id', userId)
        .neq('is_active', false)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .limit(10);

      const { data: memberRows } = await supabase
        .from('space_members')
        .select('space_id, role')
        .eq('user_id', userId)
        .eq('status', 'accepted');

      const memberSpaceIds = (memberRows ?? []).map((m: any) => m.space_id);
      let sharedSpaces: any[] = [];
      if (memberSpaceIds.length > 0) {
        const { data: sharedRows } = await supabase
          .from('spaces')
          .select('id, name, budget, budget_currency, space_type')
          .in('id', memberSpaceIds)
          .neq('is_active', false);
        sharedSpaces = (sharedRows ?? []).map((s: any) => ({
          ...s,
          space_type: 'shared',
        }));
      }

      const allSpaces = [
        ...(spaceRows ?? []),
        ...sharedSpaces,
      ].slice(0, 10);

      if (allSpaces.length === 0) return [];

      const from = monthFrom;
      const to   = monthTo;
      const ids = allSpaces.map((s: any) => s.id);

      const { data: recs } = await supabase
        .from('recordings')
        .select('space_id, amount, type')
        .in('space_id', ids)
        .neq('status', 'voided')
        .gte('transaction_date', from)
        .lte('transaction_date', to);

      const spentMap: Record<string, number> = {};
      const monthNetMap: Record<string, number> = {};
      const savedMap: Record<string, number> = {};
      (recs ?? []).forEach((r: any) => {
        if (r.type === 'expense' || r.type === 'debt') {
          spentMap[r.space_id] = (spentMap[r.space_id] ?? 0) + Number(r.amount);
        }
        if (r.type === 'income' || r.type === 'due') {
          monthNetMap[r.space_id] = (monthNetMap[r.space_id] ?? 0) + Number(r.amount);
        }
        if (r.type === 'expense' || r.type === 'debt') {
          monthNetMap[r.space_id] = (monthNetMap[r.space_id] ?? 0) - Number(r.amount);
        }
      });

      const { data: allTimeRecs } = await supabase
        .from('recordings')
        .select('space_id, amount, type')
        .in('space_id', ids)
        .neq('status', 'voided')
        .lte('transaction_date', to);

      (allTimeRecs ?? []).forEach((r: any) => {
        if (r.type === 'income' || r.type === 'due') {
          savedMap[r.space_id] = (savedMap[r.space_id] ?? 0) + Number(r.amount);
        }
        if (r.type === 'expense' || r.type === 'debt') {
          savedMap[r.space_id] = (savedMap[r.space_id] ?? 0) - Number(r.amount);
        }
      });

      return allSpaces.map((s: any) => ({
        ...s,
        spent: s.space_type === 'savings' ? (savedMap[s.id] ?? 0) : (spentMap[s.id] ?? 0),
        monthNet: s.space_type === 'savings' ? (monthNetMap[s.id] ?? 0) : undefined,
      }));
    },
    enabled: !!userId,
  });

  // ── Total counts for see more ──────────────────────────────────────────
  const { data: totalCounts = { recordings: 0, spaces: 0, reminders: 0, people: 0 } } = useQuery({
    queryKey: ['home-totals', userId],
    queryFn: async () => {
      const [rec, sp, rem, sharedSp] = await Promise.all([
        supabase.from('recordings').select('*', { count: 'exact', head: true }).eq('user_id', userId).neq('status', 'voided'),
        supabase.from('spaces').select('*', { count: 'exact', head: true }).eq('user_id', userId).neq('is_active', false),
        supabase.from('space_members').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'accepted'),
        supabase.from('recording_reminders').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
      ]);
      const { data: personCount } = await supabase
        .from('recordings')
        .select('person_name')
        .eq('user_id', userId)
        .in('type', ['debt', 'due'])
        .neq('status', 'voided')
        .neq('status', 'paid')
        .neq('person_name', '')
        .not('person_name', 'is', null);
      const distinctPeople = new Set((personCount ?? []).map((r: any) => r.person_name));
      return { recordings: rec.count ?? 0, spaces: (sp.count ?? 0) + (sharedSp.count ?? 0), reminders: rem.count ?? 0, people: distinctPeople.size };
    },
    enabled: !!userId,
  });

  const [spaceChoice, setSpaceChoice] = useState<{ id: string; name: string } | null>(null);

  const [addContactSheet, setAddContactSheet] = useState(false);
  const [addAccountSheet, setAddAccountSheet] = useState(false);
  const [accBank, setAccBank] = useState('');
  const [accName, setAccName] = useState('');
  const [accNumber, setAccNumber] = useState('');
  const [accHolder, setAccHolder] = useState('');
  const [accError, setAccError] = useState('');
  const [accLoading, setAccLoading] = useState(false);

  const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isLoading = loadingRecent || loadingPeople || loadingSpaces || loadingReminders;

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
            {/* ── RECORDS ── */}
            <SectionHeader title="RECORDS" onArrowRight={() => openRecordingsPanel()} />
            {recent.length === 0 ? (
              <EmptyRow label="no recordings" />
            ) : (
              <View style={s.list}>
                {recent.slice(0, 3).map((r: any, i: number) => {
                  const typeColor = r.type === 'expense' ? '#f96262' : r.type === 'income' ? '#2bac5a' : '#2a2a26';
                  return (
                    <TouchableOpacity key={r.id} style={[s.recRow, i === Math.min(recent.length, 3) - 1 && s.rowLast]} activeOpacity={0.7} onPress={() => openRecording(r.id)}>
                      <Text style={s.recRowName} numberOfLines={1}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</Text>
                      <Text style={[s.recRowAmount, { color: typeColor }]}>{fmt(Number(r.amount))}</Text>
                    </TouchableOpacity>
                  );
                })}
                {totalCounts.recordings > 3 && (
                  <TouchableOpacity onPress={() => openRecordingsPanel()} activeOpacity={0.7} style={s.recMoreRow}>
                    <Text style={s.recMoreText}>+ {totalCounts.recordings - 3} more</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── Reminders ── */}
            <SectionHeader title="Reminders" onArrowRight={() => openRemindersPanel()} />
            {reminders.length === 0 ? (
              <EmptyRow label="no reminders" />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {reminders.map((r: any) => (
                  <View key={r.id} style={s.reminderPill}>
                    <Text style={s.reminderPillName}>{r.name.toUpperCase()}</Text>
                    <Text style={s.reminderPillType}>{r.recording_type === 'expense' ? 'Expense' : 'Income'}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── FOLDERS ── */}
            <SectionHeader title="FOLDERS" onArrowRight={openSpacesPanel} />
            {spaces.length === 0 ? (
              <EmptyRow label="no folders" />
            ) : (
              <>
                {(() => {
                  const savingsSpaces = spaces.filter((sp: any) => sp.space_type === 'savings');
                  const expenseSpaces = spaces.filter((sp: any) => sp.space_type !== 'savings');
                  return (
                    <>
                      {savingsSpaces.length > 0 && (
                        <>
                          <Text style={s.folderSubtitle}>SAVINGS</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} nestedScrollEnabled>
                             {savingsSpaces.map((sp: any) => (
                              <TouchableOpacity key={sp.id} style={s.savingsCard} activeOpacity={0.7} onPress={() => setSpaceChoice({ id: sp.id, name: sp.name })}>
                                <View style={s.folderCardHeader}>
                                  <Text style={s.folderCardName} numberOfLines={1}>{sp.name}</Text>
                                  <View style={s.savingsBadge}><Text style={s.savingsBadgeText}>SAVINGS</Text></View>
                                </View>
                                  <Text style={[s.folderCardLabel, { color: '#3a3a34' }]}>Monthly Saved</Text>
                                  <Text style={[s.folderCardMeta, { color: '#3a3a34' }]}>{abbrNum(sp.spent ?? 0)} | <Text style={[s.folderCardMetaBold, { color: '#3a3a34' }]}>{abbrNum(sp.budget ?? 0)}</Text></Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                          <View style={{ height: 8 }} />
                        </>
                      )}
                      {expenseSpaces.length > 0 && (
                        <>
                          <Text style={s.folderSubtitle}>EXPENSE</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} nestedScrollEnabled>
                             {expenseSpaces.map((sp: any) => (
                              <TouchableOpacity key={sp.id} style={s.expenseCard} activeOpacity={0.7} onPress={() => setSpaceChoice({ id: sp.id, name: sp.name })}>
                                <View style={s.folderCardHeader}>
                                  <Text style={[s.folderCardName, { color: '#ffffff' }]} numberOfLines={1}>{sp.name}</Text>
                                  <View style={s.expenseBadge}><Text style={s.expenseBadgeText}>EXPENSE</Text></View>
                                </View>
                                  <Text style={[s.folderCardLabel, { color: '#cccccc' }]}>Monthly Expense</Text>
                                  <Text style={[s.folderCardMeta, { color: '#aaaaaa' }]}>{abbrNum(sp.spent ?? 0)} | <Text style={[s.folderCardMetaBold, { color: '#aaaaaa' }]}>{abbrNum(sp.budget ?? 0)}</Text></Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            {/* ── Actions ── */}
            <SectionHeader title="Actions" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, paddingBottom: 4 }}>
              {[
                { icon: 'chat-filled', label: 'CREATE', sub: 'RECORDING', onPress: () => router.push({ pathname: '/(app)/add-recording', params: {} } as any), tourId: 'tour-create-recording' },
                { icon: 'folder-twotone', label: 'CREATE', sub: 'FOLDER', onPress: () => switchTab('spaces'), tourId: 'tour-create-folder' },
                { icon: 'briefcase-twotone', label: 'ADD', sub: 'ACCOUNT', onPress: () => setAddAccountSheet(true) },
                { icon: 'paint-drop-half-filled-twotone', label: 'ADD', sub: 'CATEGORY', onPress: () => switchTab('categories') },
                { icon: 'person-twotone', label: 'ADD A', sub: 'CONTACT', onPress: () => setAddContactSheet(true) },
                { icon: 'watch-twotone', label: 'VIEW', sub: 'LOANS', onPress: () => openReceivablesPanel() },
                { icon: 'folder-twotone', label: 'VIEW', sub: 'FOLDER', onPress: openSpacesPanel },
              ].map((action: any, i) => (
                <View key={i} style={{ width: '33.33%', padding: 4 }}>
                  <TourTarget id={action.tourId ?? `action-${i}`}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: DC.pageActionBg, borderRadius: 10 }} activeOpacity={0.7} onPress={action.onPress}>
                      <AnimatedIcon set="line-md" icon={action.icon} size={20} color={TEAL} />
                      <View style={{ flexShrink: 1 }}>
                        <Text style={{ fontFamily: AppFont.regular, fontSize: 8, textTransform: 'uppercase', color: '#111111' }}>{action.label}</Text>
                        <Text style={{ fontFamily: AppFont.regular, fontSize: 8, textTransform: 'uppercase', color: '#111111' }}>{action.sub}</Text>
                      </View>
                    </TouchableOpacity>
                  </TourTarget>
                </View>
              ))}
            </View>

            {/* ── Loans ── */}
            <SectionHeader title="Loans" onSeeMore={() => openReceivablesPanel()} seeMoreLabel="all loans" />
            {peopleSummary.length === 0 ? (
              <EmptyRow label="no active loans" />
            ) : (
              <View
                ref={peopleScrollRef}
                style={{ overflow: 'hidden', flexDirection: 'row', cursor: 'grab' } as any}
                onMouseDown={makeScrollDragHandler(peopleScrollRef)}
                onTouchStart={makeScrollDragHandler(peopleScrollRef)}
              >
                <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 4 }}>
                {peopleSummary.map((p: any) => {
                  const isNegative = p.net < 0;
                  const absNet = Math.abs(p.net);
                  return (
                    <TouchableOpacity key={p.person} style={s.spaceCard} activeOpacity={0.7} onPress={() => openReceivablesPanel(p.person)}>
                      <AnimatedIcon set="material-symbols" icon="person-rounded" size={52} color={isNegative ? '#fee1d3' : '#bcd2c2'} />
                      <Text style={s.spaceCardName} numberOfLines={1}>{p.person}</Text>
                      <Text style={[s.spaceCardAmount, { color: '#111111' }]}>{fmt(absNet)}</Text>
                      <Text style={s.spaceCardSub}>{isNegative ? 'you owe' : 'owes you'}</Text>
                    </TouchableOpacity>
                  );
                })}
                </View>
              </View>
            )}

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
        <TouchableOpacity style={[s.choiceRow, { borderBottomWidth: 0 }]} activeOpacity={0.8} onPress={() => { const sp = spaceChoice; setSpaceChoice(null); openSpace(sp!.id, sp!.name, true); }}>
          <View style={{ flex: 1 }}>
            <Text style={s.choiceTitle}>Edit Space</Text>
            <Text style={s.choiceSub}>rename, archive, or delete</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet visible={addAccountSheet} onClose={() => { setAddAccountSheet(false); setAccBank(''); setAccName(''); setAccNumber(''); setAccHolder(''); setAccError(''); }} title="add account">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ gap: 10, paddingBottom: 16 }}>
            <TextInput style={{ borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontFamily: AppFont.regular, fontSize: 13, color: '#111' }} placeholder="bank" placeholderTextColor={Colors.faint} value={accBank} onChangeText={setAccBank} />
            <TextInput style={{ borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontFamily: AppFont.regular, fontSize: 13, color: '#111' }} placeholder="account name" placeholderTextColor={Colors.faint} value={accName} onChangeText={setAccName} />
            <TextInput style={{ borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontFamily: AppFont.regular, fontSize: 13, color: '#111' }} placeholder="account number" placeholderTextColor={Colors.faint} value={accNumber} onChangeText={setAccNumber} keyboardType="numeric" />
            <TextInput style={{ borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontFamily: AppFont.regular, fontSize: 13, color: '#111' }} placeholder="account holder" placeholderTextColor={Colors.faint} value={accHolder} onChangeText={setAccHolder} />
            {accError ? <Text style={{ color: '#e74c3c', fontSize: 12 }}>{accError}</Text> : null}
            <TouchableOpacity style={{ backgroundColor: TEAL, borderRadius: 8, paddingVertical: 12, alignItems: 'center', opacity: accLoading ? 0.6 : 1 }} disabled={accLoading} onPress={async () => {
              if (!accBank.trim() || !accName.trim() || !accNumber.trim()) { setAccError('bank, account name and number are required.'); return; }
              setAccLoading(true); setAccError('');
              const { error: err } = await supabase.from('accounts').insert({ user_id: userId, bank: accBank.trim(), account_name: accName.trim(), account_number: accNumber.trim(), holder_name: accHolder.trim() || accName.trim(), account_type: 'Savings', account_details: '', color: Colors.border });
              setAccLoading(false);
              if (err) { setAccError(err.message); return; }
              setAddAccountSheet(false); setAccBank(''); setAccName(''); setAccNumber(''); setAccHolder(''); setAccError('');
              queryClient.invalidateQueries({ queryKey: ['accounts'] });
            }}>
              <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>{accLoading ? 'saving...' : 'save account'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

      <BottomSheet visible={addContactSheet} onClose={() => setAddContactSheet(false)} title="add a contact">
        <TouchableOpacity style={s.choiceRow} activeOpacity={0.8} onPress={() => { setAddContactSheet(false); openFriendsPanel(); }}>
          <View style={{ flex: 1 }}>
            <Text style={s.choiceTitle}>Add a Friend</Text>
            <Text style={s.choiceSub}>connect with other Ledgr users</Text>
          </View>
          <Ionicons name="people-outline" size={18} color={TEAL} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.choiceRow, { borderBottomWidth: 0 }]} activeOpacity={0.8} onPress={() => { setAddContactSheet(false); openContactsPanel(); }}>
          <View style={{ flex: 1 }}>
            <Text style={s.choiceTitle}>Add a Manual Contact</Text>
            <Text style={s.choiceSub}>add someone without an account</Text>
          </View>
          <Ionicons name="person-outline" size={18} color={TEAL} />
        </TouchableOpacity>
      </BottomSheet>
    </SafeAreaView>
  );
}

function SectionHeader({ title, onSeeMore, seeMoreLabel, onArrowRight, onAdd, titleStyle }: { title: string; onSeeMore?: () => void; seeMoreLabel?: string; onArrowRight?: () => void; onAdd?: () => void; titleStyle?: any }) {
  return (
    <View style={s.sectionRow}>
      <Text style={[s.sectionTitle, titleStyle]}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {onAdd && (
          <TouchableOpacity onPress={onAdd} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="add" size={18} color="#000000" />
          </TouchableOpacity>
        )}
        {onSeeMore && (
          <TouchableOpacity onPress={onSeeMore} activeOpacity={0.7} style={s.seeMoreRow}>
            <Text style={s.seeMoreText}>{seeMoreLabel ?? 'see all'}</Text>
          </TouchableOpacity>
        )}
        {onArrowRight && (
          <TouchableOpacity onPress={onArrowRight} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-forward" size={18} color="#000000" />
          </TouchableOpacity>
        )}
      </View>
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

function makeScrollDragHandler(ref: React.RefObject<any>) {
  return (e: any) => {
    const el = ref.current as unknown as HTMLElement;
    if (!el) return;
    const startX = e.nativeEvent?.pageX ?? e.pageX ?? e.changedTouches?.[0]?.pageX;
    if (startX == null) return;
    const scrollLeft = el.scrollLeft;
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const pageX = 'changedTouches' in ev ? ev.changedTouches[0].pageX : (ev as MouseEvent).pageX;
      el.scrollLeft = scrollLeft - (pageX - startX);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove as any);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove as any);
      document.removeEventListener('touchend', onUp);
      el.style.cursor = 'grab';
    };
    el.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove as any);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove as any, { passive: true } as any);
    document.addEventListener('touchend', onUp);
  };
}

function EmptyRow({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={s.emptyRow}>
      <Text style={[s.emptyText, onPress && { color: '#9cd7d2' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fdfdfd' },
  scroll: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 80 },

  // Section header
  sectionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  sectionTitle:{ fontFamily: AppFont.semiBold, fontSize: 20, color: '#2a2a26', textTransform: 'uppercase', letterSpacing: 0.8 },
  seeMoreRow:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: DC.pageActionRadius, backgroundColor: '#ebf7f6' },
  seeMoreText: { fontFamily: AppFont.regular, fontSize: 11, color: '#4f9289' },

  // RECORDS rows
  recRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  recRowName:  { fontFamily: AppFont.semiBold, fontSize: 11, color: '#2a2a26', flex: 1 },
  recRowAmount:{ fontFamily: AppFont.semiBold, fontSize: 11 },
  recMoreRow:  { paddingVertical: 6 },
  recMoreText: { fontFamily: AppFont.regular, fontSize: 11, color: '#2a2a26' },

  // Reminder pill
  reminderPill:       { width: 120, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: '#d2d2d2', backgroundColor: 'transparent', alignItems: 'center' },
  reminderPillName:   { fontFamily: AppFont.regular, fontSize: 11, color: '#2a2a26', letterSpacing: 0.3 },
  reminderPillType:   { fontFamily: AppFont.regular, fontSize: 10, color: '#2a2a26', fontStyle: 'italic' },

  // Empty
  emptyRow:  { paddingVertical: 12 },
  emptyText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.faint },

  // Spaces album
  spaceAlbum: { gap: 10, paddingBottom: 4 },
  spaceCard: {
    width: 90,
    alignItems: 'center',
    gap: 1,
  },
  spaceCardName: { fontFamily: 'Poppins-Bold', fontSize: 10, color: '#111111', textAlign: 'center', marginTop: -6 },
  spaceCardAmount: { fontFamily: 'Poppins-Bold', fontSize: 11, color: '#111111', textAlign: 'center', lineHeight: 14 },
  spaceCardSub: { fontFamily: 'Poppins-Regular', fontSize: 9, color: '#999999', textAlign: 'center', lineHeight: 12 },
  spaceCardAllTime: { fontFamily: 'Poppins-Regular', fontSize: 9, color: '#555555', textAlign: 'center', fontStyle: 'italic', lineHeight: 12 },
  spaceCardGoal: { fontFamily: 'Poppins-Regular', fontSize: 9, color: '#bbbbbb', textAlign: 'center', fontStyle: 'italic', lineHeight: 12 },

  // Folder cards
  folderSubtitle: { fontFamily: 'Poppins-Medium', fontSize: 10, color: '#b5b4a4', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  savingsCard: {
    width: 200,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d2d2d2',
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 0,
  },
  expenseCard: {
    width: 200,
    backgroundColor: '#3a3a34',
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 0,
  },
  folderCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  folderCardName: { fontFamily: 'Poppins-Bold', fontSize: 13, color: '#000000', flex: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
  savingsBadge: { backgroundColor: '#e5f5e8', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  savingsBadgeText: { fontFamily: 'Poppins-Medium', fontSize: 9, color: '#0a550f' },
  expenseBadge: { backgroundColor: '#f9f0ec', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  expenseBadgeText: { fontFamily: 'Poppins-Medium', fontSize: 9, color: '#ff5757' },
  folderCardLabel: { fontFamily: 'Poppins-Regular', fontSize: 10, color: '#555555', letterSpacing: 0.3 },
  folderCardMeta: { fontFamily: 'Poppins-Regular', fontSize: 10, color: '#888888', letterSpacing: 0.3 },
  folderCardMetaBold: { fontFamily: 'Poppins-SemiBold', fontSize: 10, color: '#888888', letterSpacing: 0.3 },

  receivableName: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#111111', textAlign: 'center', marginTop: 4 },
  receivableAmount: { fontFamily: 'Poppins-Bold', fontSize: 11, color: '#111111', textAlign: 'center', lineHeight: 14 },
  receivableUnpaid: { fontFamily: 'Poppins-Regular', fontSize: 9, color: '#999999', textAlign: 'center', fontStyle: 'italic', lineHeight: 12 },

  // Shared list rows
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowName:      { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#111111' },
  rowSub:       { fontFamily: 'Poppins-Regular', fontSize: 10, color: '#999999' },
  rowValue:     { fontFamily: 'Poppins-Bold', fontSize: 11, color: '#111111' },
  rowLast:     { borderBottomWidth: 0 },
  rowValueBold: { fontFamily: 'Poppins-Bold', fontSize: 12, color: '#111111' },
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
