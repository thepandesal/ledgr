import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, RefreshControl, Animated, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
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
import { useState, useMemo, useEffect, useRef } from 'react';

const TEAL = '#5dc4bb';
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
  const { userId, defaultCurrency } = useUser();
  const { switchTab, openSpace, openRecording, openTopSpending, openRecordingsPanel, openSpacesPanel, openReceivablesPanel, openRemindersPanel } = useNav();
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
  const scrollRef = useRef<any>(null);
  const peopleScrollRef = useRef<any>(null);

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
      queryClient.invalidateQueries({ queryKey: ['home-summary-v2', userId, monthFrom] }),
      queryClient.invalidateQueries({ queryKey: ['home-recent', userId] }),
      queryClient.invalidateQueries({ queryKey: ['home-people', userId] }),
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
      if (!data) return { all: [], total: 0 };
      const map: Record<string, { name: string; icon: string; total: number }> = {};
      data.forEach((r: any) => {
        const cat = Array.isArray(r.categories) ? r.categories[0] : r.categories;
        const key = r.category_id ?? '__none__';
        if (!map[key]) map[key] = { name: cat?.name ?? 'Uncategorized', icon: cat?.icon ?? 'apps-outline', total: 0, categoryId: r.category_id ?? null };
        map[key].total += Number(r.amount);
      });
      const all = Object.values(map).sort((a, b) => b.total - a.total);
      return { all, total: all.length };
    },
    enabled: !!userId,
  });

  const allCats = topCategoriesData?.all ?? [];
  const totalTopCategories = topCategoriesData?.total ?? 0;

  const [selectedPieCat, setSelectedPieCat] = useState<number | null>(null);
  const pieFadeAnim = useRef(new Animated.Value(1)).current;

  const selectPie = (index: number | null) => {
    setSelectedPieCat(index);
    pieFadeAnim.setValue(0.6);
    Animated.timing(pieFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const pieCategories = useMemo(() => {
    if (allCats.length === 0) return [];
    const top4 = allCats.slice(0, 4);
    const rest = allCats.slice(4);
    if (rest.length > 0) {
      const othersTotal = rest.reduce((s, c) => s + c.total, 0);
      top4.push({ name: 'Others', icon: 'apps-outline', total: othersTotal, categoryId: null });
    }
    return top4;
  }, [allCats]);

  const pieColors = ['#9cd7d2', '#5dc4bb', '#4f9289', '#3d7a72', '#b6e1de'];
  const totalPie = useMemo(() => pieCategories.reduce((s, c) => s + c.total, 0), [pieCategories]);

  const pieSegments = useMemo(() => {
    if (totalPie === 0) return [];
    let startAngle = -Math.PI / 2;
    const rOuter = 55;
    const rInner = 25;
    const cx = 60;
    const cy = 60;
    return pieCategories.map((cat, i) => {
      const pct = cat.total / totalPie;
      const endAngle = startAngle + pct * 2 * Math.PI;
      const largeArc = pct > 0.5 ? 1 : 0;
      const x1o = cx + rOuter * Math.cos(startAngle);
      const y1o = cy + rOuter * Math.sin(startAngle);
      const x2o = cx + rOuter * Math.cos(endAngle);
      const y2o = cy + rOuter * Math.sin(endAngle);
      const x1i = cx + rInner * Math.cos(endAngle);
      const y1i = cy + rInner * Math.sin(endAngle);
      const x2i = cx + rInner * Math.cos(startAngle);
      const y2i = cy + rInner * Math.sin(startAngle);
      const path = `M${x1o},${y1o} A${rOuter},${rOuter} 0 ${largeArc},1 ${x2o},${y2o} L${x1i},${y1i} A${rInner},${rInner} 0 ${largeArc},0 ${x2i},${y2i} Z`;
      const seg = { path, color: pieColors[i % pieColors.length], cat, pct, index: i };
      startAngle = endAngle;
      return seg;
    });
  }, [pieCategories, totalPie]);

  const top3 = allCats.slice(0, 3);

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
          if (r.user_id === userId && (sharedWithMe ?? []).some((s: any) => s.id === r.id)) return;
          const sw = typeof r.shared_with === 'string' ? JSON.parse(r.shared_with) : (r.shared_with ?? []);
          const ids = Array.isArray(sw) ? sw : [];
          ids.forEach((friendId: string) => {
            const friendName = displayNames[friendId] ?? 'Someone';
            const paid = Number(r.paid_amount ?? 0);
            const isPaid = r.status === 'paid' || (Number(r.amount) > 0 && paid >= Number(r.amount) - 0.01);
            items.push({
              id: r.id + '_' + friendId,
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

  // ── People — unified loans + receivables ──────────────────────────────
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

      // All recordings with a person (filtered to financial relationships)
      const { data: allRecs } = await supabase
        .from('recordings')
        .select('person_name, type, amount, paid_amount, status, is_due')
        .eq('user_id', userId)
        .neq('person_name', '')
        .not('person_name', 'is', null)
        .neq('status', 'voided');
      const recs = (allRecs ?? []).filter(
        (r: any) => r.type === 'debt' || r.type === 'due' || r.is_due
      );

      // Shared recordings (expenses shared with me) — shown as debts I owe to the sharer
      const { data: sharedRecs } = await supabase
        .from('recordings')
        .select('id, user_id, name, amount, status')
        .filter('shared_with', 'cs', `["${userId}"]`)
        .neq('status', 'voided');
      const sharedMap: Record<string, { name: string; total: number }> = {};
      for (const sr of (sharedRecs ?? [])) {
        if (sr.status === 'paid') continue;
        const ownerId = sr.user_id;
        if (!sharedMap[ownerId]) {
          const { data: ownerName } = await supabase.rpc('get_user_display_name', { user_id: ownerId });
          sharedMap[ownerId] = { name: ownerName ?? 'unknown', total: 0 };
        }
        sharedMap[ownerId].total += Number(sr.amount ?? 0);
      }

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
        const paid = Number(r.paid_amount ?? 0);
        const remaining = Number(r.amount) - paid;
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

      // Shared recordings — I owe the owner
      Object.entries(sharedMap).forEach(([ownerId, data]) => {
        const name = data.name;
        if (!details[name]) details[name] = { owedToMe: 0, iOwe: 0 };
        details[name].iOwe += data.total;
        net[name] = (net[name] ?? 0) - data.total;
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

  const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isLoading = loadingCats || loadingRecent || loadingPeople || loadingSpaces || loadingReminders;

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
            <SectionHeader title="Top Spending" onSeeMore={openTopSpending} seeMoreLabel="go to categories" />
            {allCats.length === 0 ? (
              <EmptyRow label="no expenses this month" onPress={openTopSpending} />
            ) : (
              <View style={s.topSpendingRow}>
                <View style={s.pieColumn}>
                  <Pressable onPress={(e) => {
                    const ev = e.nativeEvent as any;
                    const x = ev.offsetX ?? ev.locationX;
                    const y = ev.offsetY ?? ev.locationY;
                    if (x == null) return;
                    const dx = x - 60;
                    const dy = y - 60;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 25) { selectPie(null); return; }
                    let angle = Math.atan2(dy, dx) + Math.PI / 2;
                    if (angle < 0) angle += 2 * Math.PI;
                    const totalPct = angle / (2 * Math.PI);
                    let cum = 0;
                    for (const seg of pieSegments) {
                      cum += seg.pct;
                      if (totalPct <= cum) { selectPie(seg.index === selectedPieCat ? null : seg.index); return; }
                    }
                  }}>
                    <View>
                      <Svg width={120} height={120} viewBox="0 0 120 120">
                        {pieSegments.map((seg, i) => (
                          <Path key={i} d={seg.path} fill={seg.color} opacity={selectedPieCat === null || selectedPieCat === seg.index ? 1 : 0.3} />
                        ))}
                        <Path d={`M60,35 A25,25 0 1,1 59.9,35 Z`} fill="#ffffff" />
                      </Svg>
                    </View>
                  </Pressable>
                  <View style={s.pieLabel}>
                    {selectedPieCat !== null ? (
                      <>
                        <Text style={s.pieLabelName} numberOfLines={1}>{pieCategories[selectedPieCat].name}</Text>
                        <Text style={s.pieLabelAmount}>{fmt(pieCategories[selectedPieCat].total)}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={s.pieLabelName} numberOfLines={1}>Total</Text>
                        <Text style={s.pieLabelAmount}>{fmt(totalPie)}</Text>
                      </>
                    )}
                  </View>
                </View>
                <View style={s.top3Column}>
                  {top3.map((cat, i) => (
                    <TouchableOpacity key={i} style={s.top3Card} activeOpacity={0.7} onPress={() => openRecordingsPanel({ categoryId: cat.categoryId ?? undefined, categoryName: cat.name })}>
                      <AnimatedIcon set="basil" icon={cat.icon} size={18} color="#111111" />
                      <View style={{ flex: 1 }}>
                        <Text style={s.catName} numberOfLines={1}>{cat.name}</Text>
                        <Text style={s.catAmount}>{fmt(cat.total)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ── Spaces ── */}
            <SectionHeader title="Spaces" onSeeMore={openSpacesPanel} seeMoreLabel="go to spaces" />
            {spaces.length === 0 ? (
              <EmptyRow label="no spaces" />
            ) : (
              <View
                ref={scrollRef}
                style={{ overflow: 'hidden', flexDirection: 'row', cursor: 'grab' } as any}
                onMouseDown={makeScrollDragHandler(scrollRef)}
                onTouchStart={makeScrollDragHandler(scrollRef)}
              >
                <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 4 }}>
                  {spaces.map((sp: any) => (
                    <TouchableOpacity key={sp.id} style={s.spaceCard} activeOpacity={0.7} onPress={() => setSpaceChoice({ id: sp.id, name: sp.name })}>
                      <AnimatedIcon set="line-md" icon="folder-twotone" size={80} color={sp.space_type === 'shared' ? '#e8e8e8' : sp.space_type === 'savings' ? '#bcd2c2' : '#fee1d3'} />
                      <Text style={s.spaceCardName} numberOfLines={1}>{sp.name}</Text>
                      <Text style={s.spaceCardAmount}>{fmt(sp.monthNet ?? sp.spent)}</Text>
                      {sp.space_type === 'savings' && (
                        <Text style={s.spaceCardAllTime}>{abbrNum(sp.spent)}{sp.budget ? <Text style={s.spaceCardGoal}> / {abbrNum(sp.budget)}</Text> : null}</Text>
                      )}
                      {sp.budget && sp.space_type !== 'savings' && <Text style={s.spaceCardSub}>{fmt(sp.budget)}</Text>}
                    </TouchableOpacity>
                  ))}
                  {totalCounts.spaces > spaces.length && (
                    <TouchableOpacity style={s.spaceCard} activeOpacity={0.7} onPress={openSpacesPanel}>
                      <AnimatedIcon set="line-md" icon="folder-twotone" size={80} color="#e8e8e8" />
                      <Text style={s.spaceCardName}>+{totalCounts.spaces - spaces.length} more</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[s.spaceCard, { borderWidth: 1.5, borderColor: '#e0e0e0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }]} activeOpacity={0.7} onPress={() => switchTab('spaces')}>
                    <Ionicons name="add-outline" size={28} color="#bbb" style={{ marginTop: 8 }} />
                    <Text style={[s.spaceCardName, { color: '#bbb', marginTop: -2 }]}>Add Space</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── Latest Recordings ── */}
            <SectionHeader title="Recordings" onSeeMore={openRecordingsPanel} seeMoreLabel="go to recordings" />
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

            {/* ── Reminders ── */}
            <SectionHeader title="Reminders" onSeeMore={openRemindersPanel} seeMoreLabel="go to reminders" />
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

            {/* ── Shared Recordings ── */}
            <SectionHeader title="Shared" />
            {shared.length === 0 ? (
              <EmptyRow label="no shared recordings" />
            ) : (
              <View style={s.list}>
                {shared.map((r: any, i: number) => {
                  const statusLabel = r.isPaid ? 'Closed' : (r.status === 'partial' ? 'Partial' : 'Pending');
                  const counterpartyLabel = r.isOwner ? r.counterpartyName : 'Your Transaction';
                  return (
                    <TouchableOpacity key={r.id} style={[s.row, i === shared.length - 1 && s.rowLast]} activeOpacity={0.7} onPress={() => openRecording(r.id)}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName} numberOfLines={1}>{r.name}</Text>
                        <Text style={s.rowSub} numberOfLines={1}>{counterpartyLabel}</Text>
                        <Text style={[s.rowSub, { fontStyle: 'italic' }]}>{statusLabel}</Text>
                      </View>
                      <Text style={s.rowValueBold}>{fmt(r.amount)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── People ── */}
            <SectionHeader title="People" onSeeMore={() => openReceivablesPanel()} seeMoreLabel="all people" />
            {peopleSummary.length === 0 ? (
              <EmptyRow label="no people with balances" />
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
                      <AnimatedIcon set="material-symbols" icon="person-rounded" size={80} color={p.isFriend ? '#9cd7d2' : '#e8e8e8'} />
                      <Text style={s.spaceCardName} numberOfLines={1}>{p.person}</Text>
                      <Text style={[s.spaceCardAmount, { color: isNegative ? '#e74c3c' : '#2A7A6F' }]}>
                        {isNegative ? '-' : ''}{fmt(absNet)}
                      </Text>
                      <Text style={s.spaceCardSub}>{isNegative ? 'you owe' : 'owes you'}</Text>
                    </TouchableOpacity>
                  );
                })}
                </View>
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
        <TouchableOpacity style={[s.choiceRow, { borderBottomWidth: 0 }]} activeOpacity={0.8} onPress={() => { const sp = spaceChoice; setSpaceChoice(null); openSpace(sp!.id, sp!.name, true); }}>
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
  root:   { flex: 1, backgroundColor: '#ffffff' },
  scroll: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 80 },

  // Month nav
  monthNav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pageActionPaddingH, paddingVertical: DC.pageActionPaddingV, backgroundColor: DC.pageActionBg, borderRadius: DC.pageActionRadius, marginHorizontal: 28, marginTop: 4, marginBottom: 4 },
  monthBtnText: { fontFamily: AppFont.regular, fontSize: DC.dropdownFontSize, color: DC.pageActionText },

  // Section header
  sectionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  sectionTitle:{ fontFamily: 'Poppins-Bold', fontSize: 13, color: '#9cd7d2', textTransform: 'uppercase', letterSpacing: 0.8 },
  seeMoreRow:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: DC.pageActionRadius, backgroundColor: DC.pageActionBg, borderWidth: DC.pageActionBorderWidth },
  seeMoreText: { fontFamily: AppFont.regular, fontSize: 12, color: DC.pageActionText },

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
  receivableName: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#111111', textAlign: 'center', marginTop: 4 },
  receivableAmount: { fontFamily: 'Poppins-Bold', fontSize: 11, color: '#111111', textAlign: 'center', lineHeight: 14 },
  receivableUnpaid: { fontFamily: 'Poppins-Regular', fontSize: 9, color: '#999999', textAlign: 'center', fontStyle: 'italic', lineHeight: 12 },

  // Top spending
  topSpendingRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  pieColumn: { alignItems: 'center', gap: 8 },
  pieLabel: { alignItems: 'center', maxWidth: 120 },
  pieLabelName: { fontFamily: 'Poppins-Bold', fontSize: 10, color: '#111111', textAlign: 'center' },
  pieLabelAmount: { fontFamily: 'Poppins-Regular', fontSize: 10, color: '#555555', textAlign: 'center' },
  top3Column: { flex: 1, gap: 6 },
  top3Card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  catName:   { fontFamily: 'Poppins-Bold', fontSize: 11, color: '#111111' },
  catAmount: { fontFamily: 'Poppins-Regular', fontSize: 10, color: '#555555' },

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
