import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator, useWindowDimensions, Animated, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useContext, useEffect, useMemo } from 'react';
import { useUser } from '../../../src/hooks/useUser';
import { useExchangeRates } from '../../../src/lib/useExchangeRates';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../../src/lib/brand';
import { BlurContext } from '../../../src/lib/BlurContext';
import TourTarget from '@/components/TourTarget';

interface SpaceData {
  id: string; name: string; color: string; icon: string;
  budget?: number | null; budget_currency?: string; spent?: number; saved?: number; savedAllTime?: number; count?: number;
  space_type?: string; savings_target_date?: string | null; is_active?: boolean;
}

const ACCENT      = '#B6E1DE'; // light mint — backgrounds only
const ACCENT_TEXT = '#101514'; // dark text ON accent bg
const ACCENT_DARK = Brand.color.accentDark; // dark teal — text/icons on white bg

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCompact = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + 'M';
  return fmt(n);
};

import { getDateRange, getDateLabel, parseLocalDate, type DateMode, type WeekStart } from '../../../src/lib/dateUtils';

const AmtView = ({ currency, value, color, style }: { currency: string; value: number; color?: string; style?: any }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 2 }, style]}>
    <Text style={{ fontFamily: Fonts.monoBold, fontSize: 9, color: Colors.faint, alignSelf: 'center' }}>{currency}</Text>
    <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: color ?? Colors.text, letterSpacing: -0.2, marginLeft: 4 }}>{fmtCompact(value)}</Text>
  </View>
);

const MOTIVATIONS = [
  'Every peso saved is a step forward.',
  'Small habits build big wealth.',
  'Track today, thrive tomorrow.',
  'You\'re in control of your finances.',
  'Consistency beats perfection.',
];

export default function SpacesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId, userName, defaultCurrency } = useUser();
  const { convert, rateMap } = useExchangeRates();
  const insets = useSafeAreaInsets();
  const [createModal, setCreateModal] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceBudget, setSpaceBudget] = useState('');
  const [spaceBudgetCurrency, setSpaceBudgetCurrency] = useState('PHP');
  const [showBudgetCurrencyModal, setShowBudgetCurrencyModal] = useState(false);
  const BUDGET_CURRENCIES = ['PHP','USD','EUR','GBP','JPY','AUD','CAD','SGD','MYR','IDR','THB','VND','KRW','CNY','INR','HKD','NZD','CHF','BRL','MXN'];
  const [spaceType, setSpaceType] = useState<'expense' | 'savings'>('expense');
  const [spaceTargetDate, setSpaceTargetDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuModal, setMenuModal] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<SpaceData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { width: W } = useWindowDimensions();

  // ── Date filter state ────────────────────────────────────────────────────
  const [dateMode, setDateMode]       = useState<DateMode>('monthly');
  const [dateOffset, setDateOffset]   = useState(0);
  const [weekStart, setWeekStart]     = useState<WeekStart>('monday');
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [monthYearModalOpen, setMonthYearModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);

  const openDateModal = () => { setDateModalOpen(true); setBlur(true); };
  const closeDateModal = () => { setDateModalOpen(false); setBlur(false); };
  const openMonthYearModal = () => {
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + dateOffset, 1);
    setSelectedMonth(targetDate.getMonth());
    setSelectedYear(targetDate.getFullYear());
    setMonthDropdownOpen(false);
    setYearDropdownOpen(false);
    setMonthYearModalOpen(true);
    setBlur(true);
  };
  const closeMonthYearModal = () => { setMonthYearModalOpen(false); setBlur(false); };
  const [useCutoff, setUseCutoff]         = useState(false);
  const [cutoffDay, setCutoffDay]         = useState(25);

  const switchTab = (tab: 'active' | 'inactive') => {
    Animated.timing(slideAnim, {
      toValue: tab === 'inactive' ? -W : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
    setActiveTab(tab);
  };

  const { data: spaces = [] } = useQuery<SpaceData[]>({
    queryKey: ['spaces', userId, dateMode, dateOffset, weekStart, useCutoff, cutoffDay],
    queryFn: async () => {
      const { data } = await supabase.from('spaces').select().eq('user_id', userId).order('created_at');
      if (!data) return [];
      const { from, to } = getDateRange(dateMode, dateOffset, weekStart, useCutoff, cutoffDay);
      // Convert dates to YYYY-MM-DD strings in local timezone to avoid UTC conversion issues
      const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
      const toStr   = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
      
      // Fetch all recordings in date range for this user
      const [{ data: allRecs }, { data: allTimeSums }, { data: splitBillRecs }] = await Promise.all([
        supabase.from('recordings').select('id, space_id, amount, type, is_due, paid_amount, transaction_date, currency')
          .eq('user_id', userId).gte('transaction_date', fromStr).lte('transaction_date', toStr),
        supabase.rpc('get_space_all_time_totals', { p_user_id: userId }),
        supabase.from('split_bill_payments')
          .select('id, amount, split_bill_id')
          .eq('status', 'active'),
      ]);

      // split_bill payments no longer carry space/date info without the join — skip them
      const splitBillPaymentMap: Record<string, { spaceId: string; date: string }> = {};

      const spentMap: Record<string, number> = {};
      const savedMap: Record<string, number> = {};
      const savedAllTimeMap: Record<string, number> = {};
      const countMap: Record<string, number> = {};

      (allTimeSums ?? []).forEach((r: any) => {
        savedAllTimeMap[r.space_id] = Number(r.income_total ?? 0) - Number(r.expense_total ?? 0);
      });

      (allRecs ?? []).forEach((r: any) => {
        if (r.status === 'voided') return;
        if (['income', 'expense', 'debt', 'due'].includes(r.type)) {
          countMap[r.space_id] = (countMap[r.space_id] || 0) + 1;
        }
        const amt = convert(Number(r.amount), r.currency ?? defaultCurrency, defaultCurrency);
        if (r.type === 'income' || r.type === 'due' || r.type === 'receivable' || r.type === 'return') {
          savedMap[r.space_id] = (savedMap[r.space_id] || 0) + amt;
        } else if (r.type === 'expense') {
          spentMap[r.space_id] = (spentMap[r.space_id] || 0) + amt;
        } else if (r.type === 'debt') {
          spentMap[r.space_id] = (spentMap[r.space_id] || 0) + amt;
        } else if (r.type === 'payment') {
          spentMap[r.space_id] = (spentMap[r.space_id] || 0) + amt;
        }
      });
      
      // Add split bill payments to savedMap — filtered by parent recording's transaction_date
      Object.entries(splitBillPaymentMap).forEach(([paymentId, { spaceId, date }]) => {
        if (date < fromStr || date > toStr) return;
        const p = (splitBillRecs ?? []).find((x: any) => x.id === paymentId);
        if (p) savedMap[spaceId] = (savedMap[spaceId] || 0) + Number(p.amount);
      });

      return data.map((s: any) => ({ ...s, spent: spentMap[s.id] ?? 0, saved: savedMap[s.id] ?? 0, savedAllTime: savedAllTimeMap[s.id] ?? 0, count: countMap[s.id] ?? 0 })) as SpaceData[];
    },
    enabled: !!userId,
  });

  // ── Load saved date settings ──────────────────────────────────────────────
  const { data: dateSettings } = useQuery({
    queryKey: ['spaces-settings', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('spaces_date_mode, spaces_week_start, spaces_date_offset, spaces_cutoff_day, spaces_use_cutoff')
        .eq('user_id', userId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!userId,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!dateSettings) return;
    if (dateSettings.spaces_date_mode)  setDateMode(dateSettings.spaces_date_mode as DateMode);
    if (dateSettings.spaces_week_start) setWeekStart(dateSettings.spaces_week_start as WeekStart);
    if (dateSettings.spaces_date_offset != null) setDateOffset(Number(dateSettings.spaces_date_offset));
    if (dateSettings.spaces_cutoff_day != null)  setCutoffDay(Number(dateSettings.spaces_cutoff_day));
    if (dateSettings.spaces_use_cutoff  != null)  setUseCutoff(Boolean(dateSettings.spaces_use_cutoff));
  }, [dateSettings]);

  const { setBlur, registerAdd, unregisterAdd } = useContext(BlurContext);

  // ── Persist date settings ───────────────────────────────────────────────
  const saveSetting = async (patch: Record<string, any>) => {
    await supabase.from('user_settings').upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  };

  // ── Date label formatter ─────────────────────────────────────────────
  const getLabel = (mode: DateMode, offset: number, ws: WeekStart): string =>
    getDateLabel(mode, offset, ws, useCutoff, cutoffDay);

  const openCreate = () => {
    setSpaceName(''); setError(''); setSpaceBudget('');
    setSpaceBudgetCurrency(defaultCurrency);
    setSpaceType('expense'); setSpaceTargetDate(''); setEditMode(false);
    setCreateModal(true); setBlur(true);
  };

  useEffect(() => {
    registerAdd('spaces', openCreate);
    return () => unregisterAdd('spaces');
  }, []);

  const handleCreate = async () => {
    if (!spaceName.trim()) { setError('name is required.'); return; }
    setLoading(true);
    if (editMode && selectedSpace) {
      const { error: err } = await supabase.from('spaces').update({
        name: spaceName.trim(),
        budget: spaceBudget.trim() ? parseFloat(spaceBudget) : null,
        budget_currency: spaceBudgetCurrency,
        space_type: spaceType,
        savings_target_date: spaceType === 'savings' && spaceTargetDate.trim() ? spaceTargetDate.trim() : null,
      }).eq('id', selectedSpace.id);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from('spaces').insert({
        user_id: userId, name: spaceName.trim(), color: ACCENT, icon: 'grid',
        budget: spaceBudget.trim() ? parseFloat(spaceBudget) : null,
        budget_currency: spaceBudgetCurrency,
        space_type: spaceType,
        savings_target_date: spaceType === 'savings' && spaceTargetDate.trim() ? spaceTargetDate.trim() : null,
      }).select().single();
      if (err) { setError(err.message); setLoading(false); return; }
    }
    queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
    setLoading(false); setCreateModal(false); setEditMode(false); setBlur(false);
  };

  const handleEditSpace = () => {
    if (!selectedSpace) return;
    setMenuModal(false); setBlur(false); setEditMode(true);
    setSpaceName(selectedSpace.name);
    setSpaceType((selectedSpace.space_type as any) ?? 'expense');
    setSpaceTargetDate(selectedSpace.savings_target_date ?? '');
    setSpaceBudget('');
    supabase.from('spaces').select('budget, budget_currency').eq('id', selectedSpace.id).single()
      .then(({ data }) => {
        if (data?.budget) setSpaceBudget(String(data.budget));
        if (data?.budget_currency) setSpaceBudgetCurrency(data.budget_currency);
      });
    setError(''); setCreateModal(true);
  };

  const handleDeleteSpace = async () => {
    setMenuModal(false); setBlur(false);
    await supabase.from('spaces').delete().eq('id', selectedSpace!.id);
    queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
  };

  const handleToggleActive = async () => {
    if (!selectedSpace) return;
    setMenuModal(false); setBlur(false);
    await supabase.from('spaces').update({ is_active: !selectedSpace.is_active }).eq('id', selectedSpace.id);
    queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
  };

  const renderExpenseCard = (space: SpaceData) => {
    const value       = space.spent ?? 0;
    const budget      = space.budget ? convert(space.budget, space.budget_currency ?? 'PHP', defaultCurrency) : 0;
    const over        = budget > 0 && value > budget;
    const remaining   = budget - value;
    const statusColor = over ? Colors.expense : budget > 0 && remaining / budget < 0.2 ? '#F97316' : ACCENT_DARK;
    return (
      <TouchableOpacity key={space.id} style={s.card} activeOpacity={0.85} onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}>
        <View style={s.cardLeft}>
          <Text style={s.cardName}>{String(space.name).toLowerCase()}</Text>
          <Text style={s.cardMeta}>{space.count ?? 0} transaction{(space.count ?? 0) !== 1 ? 's' : ''}</Text>
        </View>
        <View style={s.cardRight}>
          <View style={s.cardRow}><Text style={s.cardRowLabel}>money in</Text><AmtView currency={defaultCurrency} value={space.saved ?? 0} /></View>
          <View style={s.cardRow}><Text style={s.cardRowLabel}>money out</Text><AmtView currency={defaultCurrency} value={value} color={over ? Colors.expense : undefined} /></View>
          {budget > 0 && (
            <View style={s.cardRow}><Text style={s.cardRowLabel}>budget</Text><AmtView currency={defaultCurrency} value={budget} color={statusColor} /></View>
          )}
        </View>
        <TouchableOpacity onPress={() => { setSelectedSpace(space); setMenuModal(true); setBlur(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={14} color={Colors.muted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderSavingsCard = (space: SpaceData) => {
    const value       = space.saved ?? 0;
    const allTime     = space.savedAllTime ?? 0;
    const budget      = space.budget ? convert(space.budget, space.budget_currency ?? 'PHP', defaultCurrency) : 0;
    const remaining   = Math.max(budget - allTime, 0);
    const pct         = budget > 0 ? Math.min(allTime / budget, 1) : 0;
    const statusColor = pct >= 1 ? ACCENT_DARK : '#F97316';
    return (
      <TouchableOpacity key={space.id} style={s.card} activeOpacity={0.85} onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}>
        <View style={s.cardLeft}>
          <Text style={s.cardName}>{String(space.name).toLowerCase()}</Text>
          <Text style={s.cardMeta}>{space.count ?? 0} transaction{(space.count ?? 0) !== 1 ? 's' : ''}</Text>
        </View>
        <View style={s.cardRight}>
          <View style={s.cardRow}><Text style={s.cardRowLabel}>saved</Text><AmtView currency={defaultCurrency} value={value} color={ACCENT_DARK} /></View>
          <View style={s.cardRow}><Text style={s.cardRowLabel}>all time</Text><AmtView currency={defaultCurrency} value={allTime} color={ACCENT_DARK} /></View>
          {budget > 0 && (<>
            <View style={s.cardRow}><Text style={s.cardRowLabel}>goal</Text><AmtView currency={defaultCurrency} value={budget} /></View>
            <View style={s.cardRow}><Text style={s.cardRowLabel}>remaining</Text><AmtView currency={defaultCurrency} value={remaining} color={statusColor} /></View>
          </>)}
        </View>
        <TouchableOpacity onPress={() => { setSelectedSpace(space); setMenuModal(true); setBlur(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={14} color={Colors.muted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const firstName = userName?.split(' ')[0] || 'there';
  
  // Memoize date calculations to prevent infinite loops
  const dateLabel = useMemo(() => getLabel(dateMode, dateOffset, weekStart), [dateMode, dateOffset, weekStart, useCutoff, cutoffDay]);
  const dateRange = useMemo(() => getDateRange(dateMode, dateOffset, weekStart, useCutoff, cutoffDay), [dateMode, dateOffset, weekStart, useCutoff, cutoffDay]);
  const expenseActive   = spaces.filter(sp => (sp.space_type ?? 'expense') === 'expense' && sp.is_active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const savingsActive   = spaces.filter(sp => sp.space_type === 'savings'  && sp.is_active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const expenseInactive = spaces.filter(sp => (sp.space_type ?? 'expense') === 'expense' && sp.is_active === false).sort((a, b) => a.name.localeCompare(b.name));
  const savingsInactive = spaces.filter(sp => sp.space_type === 'savings'  && sp.is_active === false).sort((a, b) => a.name.localeCompare(b.name));
  const expenseSpaces   = activeTab === 'active' ? expenseActive : expenseInactive;
  const savingsSpaces   = activeTab === 'active' ? savingsActive : savingsInactive;
  const motivation = MOTIVATIONS[new Date().getDay() % MOTIVATIONS.length];

  // ── Pending space invites (as invitee) ─────────────────────────────────────────────
  const { data: pendingInvites = [], refetch: refetchInvites } = useQuery<{ id: string; space_id: string; role: string; spaceName: string; ownerName: string }[]>({
    queryKey: ['pending-space-invites', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('space_members')
        .select('id, space_id, role, invited_by')
        .eq('user_id', userId)
        .eq('status', 'pending');
      if (!data || data.length === 0) return [];
      const spaceIds = data.map((m: any) => m.space_id);
      const { data: spaces } = await supabase.from('spaces').select('id, name').in('id', spaceIds);
      const ownerNames = await Promise.all(
        data.map((m: any) =>
          supabase.rpc('get_user_display_name', { user_id: m.invited_by }).then(({ data: n }) => ({ id: m.id, name: n ?? 'unknown' }))
        )
      );
      return data.map((m: any) => ({
        id: m.id,
        space_id: m.space_id,
        role: m.role,
        spaceName: (spaces ?? []).find((s: any) => s.id === m.space_id)?.name ?? 'unknown space',
        ownerName: ownerNames.find(o => o.id === m.id)?.name ?? 'unknown',
      }));
    },
    enabled: !!userId,
  });

  const [respondingInvite, setRespondingInvite] = useState<string | null>(null);

  const respondToSpaceInvite = async (id: string, accept: boolean) => {
    setRespondingInvite(id);
    await supabase.from('space_members').update({ status: accept ? 'accepted' : 'declined' }).eq('id', id);
    refetchInvites();
    queryClient.invalidateQueries({ queryKey: ['shared-spaces', userId] });
    queryClient.invalidateQueries({ queryKey: ['pending-space-invites', userId] });
    setRespondingInvite(null);
  };
  const { data: sharedSpaces = [] } = useQuery<(SpaceData & { role: string; ownerName: string })[]>({
    queryKey: ['shared-spaces', userId, dateMode, dateOffset, weekStart, useCutoff, cutoffDay, defaultCurrency],
    queryFn: async () => {
      const { data: members } = await supabase
        .from('space_members')
        .select('space_id, role')
        .eq('user_id', userId)
        .eq('status', 'accepted');
      if (!members || members.length === 0) return [];
      const spaceIds = members.map((m: any) => m.space_id);
      const { data: spaceRows } = await supabase
        .from('spaces')
        .select('id, name, color, icon, budget, space_type, savings_target_date, is_active, user_id')
        .in('id', spaceIds);
      if (!spaceRows) return [];
      const ownerIds = [...new Set(spaceRows.map((s: any) => s.user_id))];
      const ownerNames = await Promise.all(
        ownerIds.map((id: string) =>
          supabase.rpc('get_user_display_name', { user_id: id }).then(({ data }) => ({ id, name: data ?? 'unknown' }))
        )
      );
      // Fetch recording stats for each shared space
      const { from, to } = getDateRange(dateMode, dateOffset, weekStart, useCutoff, cutoffDay);
      const fromStr = `${from.getFullYear()}-${String(from.getMonth()+1).padStart(2,'0')}-${String(from.getDate()).padStart(2,'0')}`;
      const toStr   = `${to.getFullYear()}-${String(to.getMonth()+1).padStart(2,'0')}-${String(to.getDate()).padStart(2,'0')}`;
      const { data: allRecs } = await supabase.from('recordings')
        .select('space_id, amount, type')
        .in('space_id', spaceIds)
        .gte('transaction_date', fromStr).lte('transaction_date', toStr);
      const { data: allTimeSumsShared } = await supabase.rpc('get_space_all_time_totals_by_ids', { p_space_ids: spaceIds });
      const spentMap: Record<string, number> = {};
      const savedMap: Record<string, number> = {};
      const savedAllTimeMap: Record<string, number> = {};
      (allTimeSumsShared ?? []).forEach((r: any) => {
        savedAllTimeMap[r.space_id] = Number(r.income_total ?? 0) - Number(r.expense_total ?? 0);
      });
      (allRecs ?? []).forEach((r: any) => {
        if (r.type === 'income' || r.type === 'due' || r.type === 'receivable' || r.type === 'return') savedMap[r.space_id] = (savedMap[r.space_id] ?? 0) + Number(r.amount);
        else if (r.type === 'expense' || r.type === 'debt') spentMap[r.space_id] = (spentMap[r.space_id] ?? 0) + Number(r.amount);
      });
      return spaceRows.map((sp: any) => {
        const member = members.find((m: any) => m.space_id === sp.id);
        const owner = ownerNames.find((o: any) => o.id === sp.user_id);
        return { ...sp, spent: spentMap[sp.id] ?? 0, saved: savedMap[sp.id] ?? 0, savedAllTime: savedAllTimeMap[sp.id] ?? 0, count: 0, role: member?.role ?? 'viewer', ownerName: owner?.name ?? 'unknown' };
      });
    },
    enabled: !!userId,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
    await queryClient.invalidateQueries({ queryKey: ['shared-spaces', userId] });
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Pending space invites */}
        {pendingInvites.length > 0 && (
          <View style={{ paddingHorizontal: Spacing.page, paddingTop: 16, gap: 8 }}>
            <Text style={s.sectionHeader}>space invites</Text>
            {pendingInvites.map(invite => (
              <View key={invite.id} style={{ backgroundColor: ACCENT + '22', borderRadius: Radius.lg, padding: 14, gap: 8 }}>
                <View style={{ gap: 2 }}>
                  <Text style={{ fontFamily: Fonts.display, fontSize: 13, color: Colors.text }}>{invite.spaceName}</Text>
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>
                    from {invite.ownerName} · role: {invite.role}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderMid }}
                    onPress={() => respondToSpaceInvite(invite.id, false)}
                    disabled={respondingInvite === invite.id}
                  >
                    <Text style={{ fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.muted }}>decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 2, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: ACCENT_DARK, alignItems: 'center' }}
                    onPress={() => respondToSpaceInvite(invite.id, true)}
                    disabled={respondingInvite === invite.id}
                  >
                    {respondingInvite === invite.id
                      ? <ActivityIndicator size="small" color={Colors.white} />
                      : <Text style={{ fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.white }}>accept</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Date filter row */}
        <View style={s.dateFilterRow}>
          <TouchableOpacity style={s.modeSelectorBtn} onPress={openDateModal} activeOpacity={0.8}>
            <Ionicons name="options-outline" size={13} color={ACCENT_DARK} />
            <Text style={s.modeSelectorText}>filter</Text>
          </TouchableOpacity>
          <View style={s.dateNav}>
            <TouchableOpacity style={s.dateNavArrow} onPress={() => { const next = dateOffset - 1; setDateOffset(next); saveSetting({ spaces_date_offset: next }); }} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={14} color={ACCENT_DARK} />
            </TouchableOpacity>
            <TouchableOpacity style={s.dateLabelBtn} onPress={openMonthYearModal} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={13} color={ACCENT_DARK} />
              <Text style={s.dateLabelText}>{dateLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dateNavArrow} onPress={() => { const next = dateOffset + 1; setDateOffset(next); saveSetting({ spaces_date_offset: next }); }} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={14} color={ACCENT_DARK} />
            </TouchableOpacity>
          </View>
          <TourTarget id="tour-new-space">
            <TouchableOpacity style={s.modeSelectorBtn} onPress={openCreate} activeOpacity={0.8}>
              <Ionicons name="add" size={13} color={ACCENT_DARK} />
              <Text style={s.modeSelectorText}>new space</Text>
            </TouchableOpacity>
          </TourTarget>
        </View>

        {/* ── Empty ── */}
        {spaces.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>no spaces yet — tap + to create one</Text>
          </View>
        ) : (
          <View style={s.slideOuter}>
            <Animated.View style={[s.slidePair, { width: W * 2, transform: [{ translateX: slideAnim }] }]}>

              {/* ── Panel 1: Active ── */}
              <View style={{ width: W }}>
                {expenseActive.length === 0 && savingsActive.length === 0 && (
                  <View style={s.emptyWrap}><Text style={s.emptyText}>no active spaces</Text></View>
                )}
                {expenseActive.length > 0 && (
                  <>
                    <Text style={s.sectionHeader}>expense trackers</Text>
                    <View style={s.list}>{expenseActive.map(space => renderExpenseCard(space))}</View>
                  </>
                )}
                {savingsActive.length > 0 && (
                  <>
                    <Text style={s.sectionHeader}>savings trackers</Text>
                    <View style={s.list}>{savingsActive.map(space => renderSavingsCard(space))}</View>
                  </>
                )}
              </View>

              {/* ── Panel 2: Inactive ── */}
              <View style={{ width: W }}>
                {expenseInactive.length === 0 && savingsInactive.length === 0 && (
                  <View style={s.emptyWrap}><Text style={s.emptyText}>no inactive spaces</Text></View>
                )}
                {expenseInactive.length > 0 && (
                  <>
                    <Text style={s.sectionHeader}>expense trackers</Text>
                    <View style={s.list}>{expenseInactive.map(space => renderExpenseCard(space))}</View>
                  </>
                )}
                {savingsInactive.length > 0 && (
                  <>
                    <Text style={s.sectionHeader}>savings trackers</Text>
                    <View style={s.list}>{savingsInactive.map(space => renderSavingsCard(space))}</View>
                  </>
                )}
              </View>

            </Animated.View>
          </View>
        )}

        <Text style={s.footer}>managed by LEDGR</Text>

        {/* ── Shared spaces ── */}
        {sharedSpaces.length > 0 && (
          <>
            <Text style={[s.sectionHeader, { marginTop: 24 }]}>shared spaces</Text>
            <View style={s.list}>
              {sharedSpaces.map((space: any) => {
                const isExpense = (space.space_type ?? 'expense') === 'expense';
                const value   = space.spent ?? 0;
                const saved   = space.saved ?? 0;
                const allTime = space.savedAllTime ?? 0;
                const budget  = space.budget ?? 0;
                const over    = isExpense && budget > 0 && value > budget;
                const remaining = isExpense ? budget - value : Math.max(budget - allTime, 0);
                const statusColor = over ? Colors.expense : budget > 0 && isExpense && remaining / budget < 0.2 ? '#F97316' : ACCENT_DARK;
                const savingsPct  = budget > 0 ? Math.min(allTime / budget, 1) : 0;
                const savingsColor = savingsPct >= 1 ? ACCENT_DARK : '#F97316';
                return (
                  <TouchableOpacity
                    key={space.id}
                    style={s.card}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
                  >
                    <View style={s.cardLeft}>
                      <Text style={s.cardName}>{String(space.name).toLowerCase()}</Text>
                      <Text style={s.cardMeta}>{isExpense ? 'expense tracker' : 'savings tracker'}</Text>
                      <Text style={[s.cardMeta, { color: ACCENT_DARK }]}>{space.role} · {space.ownerName}</Text>
                    </View>
                    <View style={s.cardRight}>
                      {isExpense ? (
                        <>
                          <View style={s.cardRow}><Text style={s.cardRowLabel}>money in</Text><Text style={s.cardRowValue}>{fmtCompact(saved)}</Text></View>
                          <View style={s.cardRow}><Text style={s.cardRowLabel}>money out</Text><Text style={[s.cardRowValue, over && { color: Colors.expense }]}>{fmtCompact(value)}</Text></View>
                          {budget > 0 && <View style={s.cardRow}><Text style={s.cardRowLabel}>budget</Text><Text style={[s.cardRowValue, { color: statusColor }]}>{fmtCompact(budget)}</Text></View>}
                        </>
                      ) : (
                        <>
                          <View style={s.cardRow}><Text style={s.cardRowLabel}>saved</Text><Text style={[s.cardRowValue, { color: ACCENT_DARK }]}>{fmtCompact(saved)}</Text></View>
                          <View style={s.cardRow}><Text style={s.cardRowLabel}>all time</Text><Text style={[s.cardRowValue, { color: ACCENT_DARK }]}>{fmtCompact(allTime)}</Text></View>
                          {budget > 0 && (
                            <>
                              <View style={s.cardRow}><Text style={s.cardRowLabel}>goal</Text><Text style={s.cardRowValue}>{fmtCompact(budget)}</Text></View>
                              <View style={s.cardRow}><Text style={s.cardRowLabel}>remaining</Text><Text style={[s.cardRowValue, { color: savingsColor }]}>{fmtCompact(remaining)}</Text></View>
                            </>
                          )}
                        </>
                      )}
                    </View>
                    <Ionicons name="people-outline" size={14} color={Colors.muted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Create / Edit modal ── */}
      <BottomSheet visible={createModal} onClose={() => { setCreateModal(false); setEditMode(false); setBlur(false); }} title={editMode ? 'edit space' : 'new space'} height='50%'>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Text style={s.label}>type</Text>
        <View style={s.typeRow}>
          {(['expense', 'savings'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.typeBtn, spaceType === t && s.typeBtnActive]} onPress={() => setSpaceType(t)} activeOpacity={0.75}>
              <Text style={[s.typeBtnText, spaceType === t && s.typeBtnTextActive]}>{t} tracker</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.label}>name</Text>
        <TextInput style={s.input} placeholder="e.g. household" placeholderTextColor={Colors.faint} value={spaceName} onChangeText={v => { setSpaceName(v.slice(0, 20)); setError(''); }} maxLength={20} autoFocus />
        <Text style={s.label}>{spaceType === 'expense' ? 'budget' : 'target goal'} <Text style={{ color: Colors.muted }}>(optional)</Text></Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput style={[s.input, { flex: 1 }]} placeholder="e.g. 10000" placeholderTextColor={Colors.faint} value={spaceBudget} onChangeText={setSpaceBudget} keyboardType="decimal-pad" />
          <TouchableOpacity
            style={{ paddingHorizontal: 12, paddingVertical: 12, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMid }}
            onPress={() => setShowBudgetCurrencyModal(true)}
          >
            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text }}>{spaceBudgetCurrency}</Text>
          </TouchableOpacity>
        </View>
        {spaceType === 'savings' && (
          <>
            <Text style={s.label}>target date <Text style={{ color: Colors.muted }}>(optional)</Text></Text>
            <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.faint} value={spaceTargetDate} onChangeText={setSpaceTargetDate} />
          </>
        )}
        <TouchableOpacity style={[s.saveBtn, (!spaceName.trim() || loading) && { opacity: 0.4 }]} onPress={handleCreate} disabled={loading || !spaceName.trim()} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={s.saveBtnText}>{editMode ? 'save changes' : 'create space'}</Text>}
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet visible={showBudgetCurrencyModal} onClose={() => setShowBudgetCurrencyModal(false)} title="budget currency" height="50%">
        <ScrollView showsVerticalScrollIndicator={false}>
          {BUDGET_CURRENCIES.map(c => (
            <TouchableOpacity
              key={c}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border }}
              onPress={() => { setSpaceBudgetCurrency(c); setShowBudgetCurrencyModal(false); }}
            >
              <Text style={{ fontFamily: spaceBudgetCurrency === c ? Fonts.monoBold : Fonts.mono, fontSize: 14, color: Colors.text }}>{c}</Text>
              {spaceBudgetCurrency === c && <Ionicons name="checkmark" size={16} color={ACCENT_DARK} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>

      <ConfirmModal
        visible={menuModal}
        onClose={() => { setMenuModal(false); setBlur(false); }}
        title={selectedSpace?.name?.toLowerCase() ?? 'space'}
        actions={[
          { label: 'cancel',                                          onPress: () => { setMenuModal(false); setBlur(false); }, muted: true },
          { label: 'edit',                                            onPress: handleEditSpace },
          { label: selectedSpace?.is_active !== false ? 'mark inactive' : 'mark active', onPress: handleToggleActive },
          { label: 'delete',                                          onPress: handleDeleteSpace, destructive: true },
        ]}
      />

      {/* ── Date filter modal ── */}
      <BottomSheet visible={dateModalOpen} onClose={closeDateModal} title="filter" height="55%">
        {/* Active / Inactive */}
        <Text style={s.dateModalLabel}>show</Text>
        <View style={s.tabRow}>
          {(['active', 'inactive'] as const).map(tab => (
            <TouchableOpacity key={tab} style={s.tabWrap} onPress={() => switchTab(tab)} activeOpacity={0.75}>
              <View style={[s.tabCircle, activeTab === tab && s.tabCircleActive]}>
                <Text style={[s.tabCircleValue, activeTab === tab && s.tabCircleValueActive]}>
                  {tab === 'active'
                    ? spaces.filter(sp => sp.is_active !== false).length
                    : spaces.filter(sp => sp.is_active === false).length}
                </Text>
              </View>
              <Text style={[s.tabLabel, activeTab === tab && s.tabLabelActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Mode chips */}
        <Text style={s.dateModalLabel}>view by</Text>
        <View style={s.modeChips}>
          {(['monthly', 'weekly', 'daily', 'yearly'] as DateMode[]).map(m => (
            <TouchableOpacity
              key={m}
              style={[s.modeChip, dateMode === m && s.modeChipActive]}
              onPress={() => { setDateMode(m); setDateOffset(0); saveSetting({ spaces_date_mode: m, spaces_date_offset: 0 }); }}
              activeOpacity={0.75}
            >
              <Text style={[s.modeChipText, dateMode === m && s.modeChipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick presets */}
        <Text style={s.dateModalLabel}>quick jump</Text>
        <View style={s.modeChips}>
          <TouchableOpacity style={s.presetChip} onPress={() => { setDateMode('daily'); setDateOffset(0); saveSetting({ spaces_date_mode: 'daily', spaces_date_offset: 0 }); closeDateModal(); }} activeOpacity={0.75}>
            <Text style={s.presetChipText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.presetChip} onPress={() => { setDateMode('weekly'); setDateOffset(0); saveSetting({ spaces_date_mode: 'weekly', spaces_date_offset: 0 }); closeDateModal(); }} activeOpacity={0.75}>
            <Text style={s.presetChipText}>This Week</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.presetChip} onPress={() => { setDateMode('monthly'); setDateOffset(0); saveSetting({ spaces_date_mode: 'monthly', spaces_date_offset: 0 }); closeDateModal(); }} activeOpacity={0.75}>
            <Text style={s.presetChipText}>This Month</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.presetChip} onPress={() => { setDateMode('yearly'); setDateOffset(0); saveSetting({ spaces_date_mode: 'yearly', spaces_date_offset: 0 }); closeDateModal(); }} activeOpacity={0.75}>
            <Text style={s.presetChipText}>This Year</Text>
          </TouchableOpacity>
        </View>

        {/* Cutoff — only visible in monthly mode */}
        {dateMode === 'monthly' && (
          <>
            <Text style={s.dateModalLabel}>use cutoff date?</Text>
            <View style={s.modeChips}>
              <TouchableOpacity
                style={[s.modeChip, useCutoff && s.modeChipActive]}
                onPress={() => { setUseCutoff(true); saveSetting({ spaces_use_cutoff: true }); }}
                activeOpacity={0.75}
              >
                <Text style={[s.modeChipText, useCutoff && s.modeChipTextActive]}>yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeChip, !useCutoff && s.modeChipActive]}
                onPress={() => { setUseCutoff(false); saveSetting({ spaces_use_cutoff: false }); }}
                activeOpacity={0.75}
              >
                <Text style={[s.modeChipText, !useCutoff && s.modeChipTextActive]}>no</Text>
              </TouchableOpacity>
            </View>
            {useCutoff && (
              <>
                <Text style={s.dateModalLabel}>cutoff day <Text style={{ textTransform: 'none', fontFamily: Fonts.mono }}>(1–31)</Text></Text>
                <TextInput
                  style={s.cutoffInput}
                  value={String(cutoffDay)}
                  onChangeText={v => {
                    const n = parseInt(v.replace(/[^0-9]/g, ''));
                    if (!isNaN(n) && n >= 1 && n <= 31) {
                      setCutoffDay(n);
                      saveSetting({ spaces_cutoff_day: n });
                    } else if (v === '') {
                      setCutoffDay(1);
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholderTextColor={Colors.faint}
                  placeholder="e.g. 25"
                />
              </>
            )}
          </>
        )}

        {/* Week start selector — only visible in weekly mode */}
        {dateMode === 'weekly' && (
          <>
            <Text style={s.dateModalLabel}>week starts on</Text>
            <View style={s.modeChips}>
              {(['monday', 'sunday', 'saturday'] as WeekStart[]).map(ws => (
                <TouchableOpacity
                  key={ws}
                  style={[s.modeChip, weekStart === ws && s.modeChipActive]}
                  onPress={() => { setWeekStart(ws); setDateOffset(0); saveSetting({ spaces_week_start: ws, spaces_date_offset: 0 }); }}
                  activeOpacity={0.75}
                >
                  <Text style={[s.modeChipText, weekStart === ws && s.modeChipTextActive]}>{ws}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </BottomSheet>

      {/* ── Month/Year Selector modal ── */}
      <BottomSheet visible={monthYearModalOpen} onClose={closeMonthYearModal} title="select date" height="40%">
        <Text style={s.label}>month</Text>
        <TouchableOpacity
          style={s.pickerButton}
          onPress={() => {
            setMonthDropdownOpen(!monthDropdownOpen);
            setYearDropdownOpen(false);
          }}
          activeOpacity={0.7}
        >
          <Text style={s.pickerButtonText}>
            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][selectedMonth]}
          </Text>
          <Ionicons name={monthDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color={Colors.text} />
        </TouchableOpacity>
        {monthDropdownOpen && (
          <ScrollView style={s.pickerDropdown} nestedScrollEnabled>
            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
              <TouchableOpacity
                key={idx}
                style={[s.pickerOption, selectedMonth === idx && s.pickerOptionActive]}
                onPress={() => {
                  setSelectedMonth(idx);
                  setMonthDropdownOpen(false);
                }}
              >
                <Text style={[s.pickerOptionText, selectedMonth === idx && s.pickerOptionTextActive]}>{month}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={s.label}>year</Text>
        <TouchableOpacity
          style={s.pickerButton}
          onPress={() => {
            setYearDropdownOpen(!yearDropdownOpen);
            setMonthDropdownOpen(false);
          }}
          activeOpacity={0.7}
        >
          <Text style={s.pickerButtonText}>{selectedYear}</Text>
          <Ionicons name={yearDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color={Colors.text} />
        </TouchableOpacity>
        {yearDropdownOpen && (
          <ScrollView style={s.pickerDropdown} nestedScrollEnabled>
            {Array.from({ length: 2050 - 2020 + 1 }, (_, i) => 2020 + i).map(year => (
              <TouchableOpacity
                key={year}
                style={[s.pickerOption, selectedYear === year && s.pickerOptionActive]}
                onPress={() => {
                  setSelectedYear(year);
                  setYearDropdownOpen(false);
                }}
              >
                <Text style={[s.pickerOptionText, selectedYear === year && s.pickerOptionTextActive]}>{year}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity
          style={s.saveBtn}
          onPress={() => {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            const targetOffset = (selectedYear - currentYear) * 12 + (selectedMonth - currentMonth);
            setDateMode('monthly');
            setDateOffset(targetOffset);
            saveSetting({ spaces_date_mode: 'monthly', spaces_date_offset: targetOffset });
            closeMonthYearModal();
          }}
          activeOpacity={0.8}
        >
          <Text style={s.saveBtnText}>apply</Text>
        </TouchableOpacity>
      </BottomSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingBottom: 60 },

  // ── Header ──────────────────────────────────────────────────────────────
  slideOuter: { overflow: 'hidden' },
  slidePair:  { flexDirection: 'row' },

  // ── Circle tabs (active/inactive) ──────────────────────────────────────────────────────────────────────────────────────
  tabRow:               { flexDirection: 'row', justifyContent: 'center', gap: 32, paddingVertical: 8 },
  tabWrap:              { alignItems: 'center' },
  tabCircle:            { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  tabCircleActive:      { backgroundColor: ACCENT },
  tabCircleValue:       { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.muted },
  tabCircleValueActive: { color: ACCENT_TEXT },
  tabLabel:             { fontFamily: Fonts.regular, fontSize: 9, color: Colors.muted, marginTop: 5, letterSpacing: 0.2 },
  tabLabelActive:       { fontFamily: Fonts.semiBold, fontSize: 9, color: ACCENT_TEXT },

  // ── Empty ────────────────────────────────────────────────────────────────
  emptyWrap: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: Spacing.page },
  emptyText: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted },

  // ── Section ──────────────────────────────────────────────────────────────
  sectionHeader: { ...Brand.type.sectionHeader, marginBottom: 8, marginTop: Brand.spacing.section, paddingHorizontal: Spacing.page, textAlign: 'center' },
  list: { marginBottom: 8, paddingHorizontal: Spacing.page },

  // ── Card ─────────────────────────────────────────────────────────────────
  card:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardLeft:     { width: 120, gap: 4, paddingLeft: 8, paddingRight: 12, marginRight: 12, borderRightWidth: 3, borderRightColor: ACCENT },
  cardName:     { fontFamily: Fonts.display, fontSize: 14, color: Colors.text },
  cardMeta:     { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  cardRight:    { flex: 1, gap: 3 },
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardRowLabel: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, letterSpacing: 0.3, width: 72 },
  cardRowValue: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardRowCurrency: { fontFamily: Fonts.monoBold, fontSize: 9, color: Colors.text, letterSpacing: 0.2, alignSelf: 'center' },
  cardRowAmount:   { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text, letterSpacing: -0.2 },

  // ── Modal ─────────────────────────────────────────────────────────────────
  error:   { fontFamily: Fonts.mono, fontSize: 12, color: Colors.expense, marginBottom: 8 },
  label:   { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, marginBottom: 6, marginTop: 14, letterSpacing: 0.4, textTransform: 'uppercase' },
  input:   { fontFamily: Fonts.monoBold, fontSize: 15, color: Colors.text, backgroundColor: Colors.white, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },

  typeRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  typeBtnActive:     { backgroundColor: ACCENT, borderColor: ACCENT },
  typeBtnText:       { fontFamily: Fonts.mono,     fontSize: 12, color: Colors.muted },
  typeBtnTextActive: { fontFamily: Fonts.monoBold, fontSize: 12, color: ACCENT_TEXT },

  saveBtn:     { backgroundColor: ACCENT, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { fontFamily: Fonts.monoBold, fontSize: 14, color: ACCENT_TEXT },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint, textAlign: 'center', marginTop: 32, paddingHorizontal: Spacing.page },

  // ── Date filter ──────────────────────────────────────────────────────────
  dateFilterRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.page, marginTop: 20, marginBottom: 8 },
  dateNav:           { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modeSelectorBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderMid },
  modeSelectorText:  { fontFamily: Fonts.mono, fontSize: 11, color: Colors.text },
  dateNavArrow:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  dateLabelBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderMid },
  dateLabelText:     { fontFamily: Fonts.mono, fontSize: 11, color: Colors.text },
  dateModalLabel:    { fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  modeChips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeChip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  modeChipActive:    { backgroundColor: ACCENT, borderColor: ACCENT },
  modeChipText:      { fontFamily: Fonts.mono,     fontSize: 12, color: Colors.muted },
  modeChipTextActive:{ fontFamily: Fonts.monoBold, fontSize: 12, color: ACCENT_TEXT },
  presetChip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMid },
  presetChipText:    { fontFamily: Fonts.mono, fontSize: 12, color: Colors.text },
  cutoffInput:       { fontFamily: Fonts.monoBold, fontSize: 15, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid, marginTop: 4, width: 80 },

  // ── Month/Year Picker ────────────────────────────────────────────────────
  pickerWrapper:         { marginBottom: 16 },
  pickerButton:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderRadius: Radius.lg, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderMid },
  pickerButtonText:      { fontFamily: Fonts.monoBold, fontSize: 15, color: Colors.text },
  pickerDropdown:        { maxHeight: 200, borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.lg, marginTop: 4, backgroundColor: Colors.white },
  pickerOption:          { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerOptionActive:    { backgroundColor: Colors.surface },
  pickerOptionText:      { fontFamily: Fonts.mono, fontSize: 14, color: Colors.text },
  pickerOptionTextActive:{ fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.text },
});
