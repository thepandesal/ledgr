import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator, useWindowDimensions, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useContext, useEffect, useMemo } from 'react';
import { useUser } from '../../../src/hooks/useUser';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../../src/lib/brand';
import { BlurContext } from '../../../src/lib/BlurContext';

interface SpaceData {
  id: string; name: string; color: string; icon: string;
  budget?: number | null; spent?: number; saved?: number; savedAllTime?: number; count?: number;
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

type DateMode = 'monthly' | 'weekly' | 'daily' | 'yearly';
type WeekStart = 'monday' | 'sunday' | 'saturday';

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
  const { userId, userName } = useUser();
  const [createModal, setCreateModal] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceBudget, setSpaceBudget] = useState('');
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
      const [{ data: allRecs }, { data: allTimeRecs }] = await Promise.all([
        supabase.from('recordings').select('space_id, amount, type, is_due, paid_amount')
          .eq('user_id', userId).gte('transaction_date', fromStr).lte('transaction_date', toStr),
        supabase.from('recordings').select('space_id, amount, type')
          .eq('user_id', userId).in('type', ['income', 'return']),
      ]);

      const spentMap: Record<string, number> = {};
      const savedMap: Record<string, number> = {};
      const savedAllTimeMap: Record<string, number> = {};
      const countMap: Record<string, number> = {};

      (allTimeRecs ?? []).forEach((r: any) => {
        savedAllTimeMap[r.space_id] = (savedAllTimeMap[r.space_id] ?? 0) + Number(r.amount);
      });
      
      // Debug: log what we're processing
      console.log('[Spaces Query] Date range:', fromStr, 'to', toStr);
      console.log('[Spaces Query] useCutoff:', useCutoff, 'cutoffDay:', cutoffDay, 'dateMode:', dateMode);
      console.log('[Spaces Query] Total recordings fetched:', (allRecs ?? []).length);
      
      (allRecs ?? []).forEach((r: any) => {
        // Only count primary transaction types (income, expense, debt, due)
        // Exclude payment and return to match space-detail page
        if (['income', 'expense', 'debt', 'due'].includes(r.type)) {
          countMap[r.space_id] = (countMap[r.space_id] || 0) + 1;
        }
        
        // Calculate amounts based on type
        if (r.type === 'income') {
          savedMap[r.space_id] = (savedMap[r.space_id] || 0) + Number(r.amount);
        } else if (r.type === 'return') {
          // Returns are money coming back (like income)
          savedMap[r.space_id] = (savedMap[r.space_id] || 0) + Number(r.amount);
        } else if (r.type === 'expense') {
          // For expenses, if it's due, only count the outstanding amount
          const net = r.is_due ? Math.max(0, Number(r.amount) - Number(r.paid_amount ?? 0)) : Number(r.amount);
          spentMap[r.space_id] = (spentMap[r.space_id] || 0) + net;
        } else if (r.type === 'debt') {
          spentMap[r.space_id] = (spentMap[r.space_id] || 0) + Number(r.amount);
        } else if (r.type === 'payment') {
          spentMap[r.space_id] = (spentMap[r.space_id] || 0) + Number(r.amount);
        }
        // 'due' type is income-like, so we don't add it to spent
      });
      
      // Debug: log counts per space
      console.log('[Spaces Query] Count map:', countMap);
      
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

  // ── Date range calculator ────────────────────────────────────────────
  const getDateRange = (mode: DateMode, offset: number, ws: WeekStart, useCutoffParam: boolean, cutoffDayParam: number): { from: Date; to: Date } => {
    const now = new Date();
    if (mode === 'monthly') {
      if (useCutoffParam && cutoffDayParam >= 1 && cutoffDayParam <= 31) {
        // Determine current cutoff cycle based on today's date
        // If today >= cutoffDay, cycle is cutoffDay this month → cutoffDay-1 next month
        // If today < cutoffDay, cycle is cutoffDay last month → cutoffDay-1 this month
        const now2 = new Date();
        let cycleStartMonth = now2.getMonth();
        let cycleStartYear  = now2.getFullYear();
        if (now2.getDate() < cutoffDay) {
          // We're before the cutoff, so current cycle started last month
          cycleStartMonth -= 1;
          if (cycleStartMonth < 0) { cycleStartMonth = 11; cycleStartYear -= 1; }
        }
        // Apply offset (each offset moves one full cycle = 1 month)
        cycleStartMonth += offset;
        // Normalise overflow/underflow
        const baseDate = new Date(cycleStartYear, cycleStartMonth, 1);
        const y = baseDate.getFullYear();
        const m = baseDate.getMonth();
        const from = new Date(y, m, cutoffDay);
        const to   = new Date(y, m + 1, cutoffDay - 1);
        return { from, to };
      }
      const y = now.getFullYear();
      const m = now.getMonth() + offset;
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
    }
    if (mode === 'yearly') {
      const y = now.getFullYear() + offset;
      return {
        from: new Date(y, 0, 1),
        to:   new Date(y, 11, 31),
      };
    }
    if (mode === 'daily') {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      return { from: d, to: d };
    }
    // weekly
    const startDay = ws === 'monday' ? 1 : ws === 'sunday' ? 0 : 6;
    const today = new Date(now);
    const day = today.getDay();
    const diff = (day - startDay + 7) % 7;
    const weekFrom = new Date(today);
    weekFrom.setDate(today.getDate() - diff + offset * 7);
    const weekTo = new Date(weekFrom);
    weekTo.setDate(weekFrom.getDate() + 6);
    return { from: weekFrom, to: weekTo };
  };

  // ── Date label formatter ─────────────────────────────────────────────
  const getDateLabel = (mode: DateMode, offset: number, ws: WeekStart): string => {
    const { from, to } = getDateRange(mode, offset, ws, useCutoff, cutoffDay);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fullMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    if (mode === 'monthly') {
      if (useCutoff && cutoffDay >= 1 && cutoffDay <= 31) {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${months[from.getMonth()]} ${from.getDate()} – ${months[to.getMonth()]} ${to.getDate()}`;
      }
      return `${fullMonths[from.getMonth()]} ${from.getFullYear()}`;
    }
    if (mode === 'yearly')  return `${from.getFullYear()}`;
    if (mode === 'daily') {
      const now = new Date();
      const isToday = from.toDateString() === now.toDateString();
      if (isToday) return 'Today';
      return `${months[from.getMonth()]} ${from.getDate()}, ${from.getFullYear()}`;
    }
    // weekly — get ISO week number
    const jan1 = new Date(from.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((from.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const fromStr = `${months[from.getMonth()]} ${from.getDate()}`;
    const toStr   = `${months[to.getMonth()]} ${to.getDate()}`;
    return `Wk ${weekNum} · ${fromStr} – ${toStr}`;
  };

  const openCreate = () => {
    setSpaceName(''); setError(''); setSpaceBudget('');
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
        space_type: spaceType,
        savings_target_date: spaceType === 'savings' && spaceTargetDate.trim() ? spaceTargetDate.trim() : null,
      }).eq('id', selectedSpace.id);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from('spaces').insert({
        user_id: userId, name: spaceName.trim(), color: ACCENT, icon: 'grid',
        budget: spaceBudget.trim() ? parseFloat(spaceBudget) : null,
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
    supabase.from('spaces').select('budget').eq('id', selectedSpace.id).single()
      .then(({ data }) => { if (data?.budget) setSpaceBudget(String(data.budget)); });
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
    const budget      = space.budget ?? 0;
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
          <View style={s.cardRow}><Text style={s.cardRowLabel}>spend</Text><Text style={[s.cardRowValue, over && { color: Colors.expense }]}>{fmtCompact(value)}</Text></View>
          {budget > 0 && (<>
            <View style={s.cardRow}><Text style={s.cardRowLabel}>budget</Text><Text style={s.cardRowValue}>{fmtCompact(budget)}</Text></View>
            <View style={s.cardRow}><Text style={s.cardRowLabel}>usable</Text><Text style={[s.cardRowValue, { color: statusColor }]}>{fmtCompact(Math.max(remaining, 0))}</Text></View>
          </>)}
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
    const budget      = space.budget ?? 0;
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
          <View style={s.cardRow}><Text style={s.cardRowLabel}>saved</Text><Text style={[s.cardRowValue, { color: ACCENT_DARK }]}>{fmtCompact(value)}</Text></View>
          {budget > 0 && (<>
            <View style={s.cardRow}><Text style={s.cardRowLabel}>goal</Text><Text style={s.cardRowValue}>{fmtCompact(budget)}</Text></View>
            <View style={s.cardRow}><Text style={s.cardRowLabel}>remaining</Text><Text style={[s.cardRowValue, { color: statusColor }]}>{fmtCompact(remaining)}</Text></View>
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
  const dateLabel = useMemo(() => getDateLabel(dateMode, dateOffset, weekStart), [dateMode, dateOffset, weekStart, useCutoff, cutoffDay]);
  const dateRange = useMemo(() => getDateRange(dateMode, dateOffset, weekStart, useCutoff, cutoffDay), [dateMode, dateOffset, weekStart, useCutoff, cutoffDay]);
  const expenseActive   = spaces.filter(sp => (sp.space_type ?? 'expense') === 'expense' && sp.is_active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const savingsActive   = spaces.filter(sp => sp.space_type === 'savings'  && sp.is_active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const expenseInactive = spaces.filter(sp => (sp.space_type ?? 'expense') === 'expense' && sp.is_active === false).sort((a, b) => a.name.localeCompare(b.name));
  const savingsInactive = spaces.filter(sp => sp.space_type === 'savings'  && sp.is_active === false).sort((a, b) => a.name.localeCompare(b.name));
  const expenseSpaces   = activeTab === 'active' ? expenseActive : expenseInactive;
  const savingsSpaces   = activeTab === 'active' ? savingsActive : savingsInactive;
  const motivation = MOTIVATIONS[new Date().getDay() % MOTIVATIONS.length];

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Active / Inactive toggle */}
        <View style={s.actionRow}>
          <View style={s.tabToggle}>
            <TouchableOpacity
              style={[s.tabBtn, activeTab === 'active' && s.tabBtnActive]}
              onPress={() => switchTab('active')}
              activeOpacity={0.8}
            >
              <Text style={[s.tabBtnText, activeTab === 'active' && s.tabBtnTextActive]}>active</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabBtn, activeTab === 'inactive' && s.tabBtnActive]}
              onPress={() => switchTab('inactive')}
              activeOpacity={0.8}
            >
              <Text style={[s.tabBtnText, activeTab === 'inactive' && s.tabBtnTextActive]}>inactive</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date filter row */}
        <View style={s.dateFilterRow}>
          {/* Left: arrows + date label */}
          <View style={s.dateNav}>
            <TouchableOpacity style={s.dateNavArrow} onPress={() => { const next = dateOffset - 1; setDateOffset(next); saveSetting({ spaces_date_offset: next }); }} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={12} color={ACCENT_DARK} />
            </TouchableOpacity>
            <TouchableOpacity style={s.dateLabelBtn} onPress={openMonthYearModal} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={11} color={ACCENT_DARK} />
              <Text style={s.dateLabelText}>{dateLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dateNavArrow} onPress={() => { const next = dateOffset + 1; setDateOffset(next); saveSetting({ spaces_date_offset: next }); }} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={12} color={ACCENT_DARK} />
            </TouchableOpacity>
          </View>
          {/* Right: mode selector button */}
          <TouchableOpacity style={s.modeSelectorBtn} onPress={openDateModal} activeOpacity={0.8}>
            <Ionicons name="options-outline" size={11} color={ACCENT_DARK} />
            <Text style={s.modeSelectorText}>{dateMode}</Text>
          </TouchableOpacity>
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
        <TextInput style={s.input} placeholder="e.g. 10000" placeholderTextColor={Colors.faint} value={spaceBudget} onChangeText={setSpaceBudget} keyboardType="decimal-pad" />
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
      <BottomSheet visible={dateModalOpen} onClose={closeDateModal} title="date filter" height="50%">
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
  actionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.page, marginTop: 20, marginBottom: 8 },
  tabToggle:       { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.pill, padding: 3, borderWidth: 1, borderColor: Colors.border },
  tabBtn:          { paddingHorizontal: 18, paddingVertical: 6, borderRadius: Radius.pill },
  tabBtnActive:    { backgroundColor: ACCENT },
  tabBtnText:      { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  tabBtnTextActive:{ fontFamily: Fonts.monoBold, fontSize: 11, color: ACCENT_TEXT },

  slideOuter: { overflow: 'hidden' },
  slidePair:  { flexDirection: 'row' },

  // ── Empty ────────────────────────────────────────────────────────────────
  emptyWrap: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: Spacing.page },
  emptyText: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted },

  // ── Section ──────────────────────────────────────────────────────────────
  sectionHeader: { ...Brand.type.sectionHeader, marginBottom: 8, marginTop: Brand.spacing.section, paddingHorizontal: Spacing.page, textAlign: 'center' },
  list: { marginBottom: 8, paddingHorizontal: Spacing.page },

  // ── Card ─────────────────────────────────────────────────────────────────
  card:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardLeft:     { width: 120, gap: 4, paddingLeft: 8, paddingRight: 12, marginRight: 12, borderRightWidth: 3, borderRightColor: ACCENT },
  cardName:     { fontFamily: 'ChillaxMedium', fontSize: 14, color: Colors.text },
  cardMeta:     { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  cardRight:    { flex: 1, gap: 3 },
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardRowLabel: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, letterSpacing: 0.3, width: 60 },
  cardRowValue: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text, letterSpacing: -0.2 },

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
  dateFilterRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.page, marginBottom: 8 },
  dateNav:           { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modeSelectorBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  modeSelectorText:  { fontFamily: Fonts.monoBold, fontSize: 10, color: ACCENT_DARK },
  dateNavArrow:      { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dateLabelBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  dateLabelText:     { fontFamily: Fonts.monoBold, fontSize: 10, color: ACCENT_DARK },
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
