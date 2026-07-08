import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, TextInput, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useContext, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import BottomSheet from '@/components/ui/BottomSheet';
import ActivityTabs, { ACTIVITY_TABS, ActivityTab } from '@/components/ui/ActivityTabs';
import { Colors, Fonts, Radius } from '@/components/ui/theme';
import { Spacing } from '@/components/ui/theme';
import pageStyles from '@/components/ui/pageStyles';
import { useRouter } from 'expo-router';
import { Brand } from '../../../src/lib/brand';
import { BlurContext } from '../../../src/lib/BlurContext';

const ACCENT  = '#B6E1DE'; // prev: #96D7D4
const ACCENT2 = '#282C2A';
const ACCENT_TEXT = '#101514'; // dark text on light accent

const PEACH = '#FFAB91';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

type Preset = 'this-month' | 'last-30' | 'cutoff' | 'custom';

const PRESETS: { key: Preset; label: string; icon: string }[] = [
  { key: 'this-month', label: 'This Month', icon: 'calendar-outline'   },
  { key: 'last-30',    label: 'Last 30d',   icon: 'time-outline'       },
  { key: 'cutoff',     label: 'Cutoff',     icon: 'cut-outline'        },
  { key: 'custom',     label: 'Custom',     icon: 'options-outline'    },
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

function getRangeForPreset(preset: Preset, cutoffDay: number, offset = 0): { from: Date; to: Date } {
  const now = new Date();
  if (preset === 'this-month') {
    return { from: new Date(now.getFullYear(), now.getMonth() + offset, 1), to: new Date(now.getFullYear(), now.getMonth() + offset + 1, 0) };
  }
  if (preset === 'last-30') {
    const from = new Date(now); from.setDate(now.getDate() - 30);
    return { from, to: now };
  }
  if (preset === 'cutoff') {
    const day = cutoffDay;
    let from: Date, to: Date;
    if (now.getDate() >= day) {
      from = new Date(now.getFullYear(), now.getMonth(), day);
      to   = new Date(now.getFullYear(), now.getMonth() + 1, day - 1);
    } else {
      from = new Date(now.getFullYear(), now.getMonth() - 1, day);
      to   = new Date(now.getFullYear(), now.getMonth(), day - 1);
    }
    return { from, to };
  }
  // custom — caller manages dates
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}

const MODAL_HEIGHT = '50%';

import { smartDateLabel } from '../../../src/lib/smartDateLabel';

export default function DashboardScreen() {
  const router    = useRouter();
  const { userId } = useUser();
  const { registerAdd, unregisterAdd } = useContext(BlurContext);
  const queryClient = useQueryClient();

  const [activePreset, setActivePreset] = useState<Preset>('this-month');
  const [selectedTabs, setSelectedTabs] = useState<Set<ActivityTab>>(new Set(['all']));
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [cutoffDay,    setCutoffDay]    = useState(25);
  const [cutoffInput,  setCutoffInput]  = useState('25');
  const [rangeOffset,  setRangeOffset]  = useState(0);
  const [showDateModal,  setShowDateModal]  = useState(false);
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set(['all']));

  // custom range state
  const [customFrom, setCustomFrom] = useState<Date>(new Date());
  const [customTo,   setCustomTo]   = useState<Date>(new Date());

  // calendar picker state
  const [pickingDate,  setPickingDate]  = useState<'from' | 'to'>('from');
  const [pickerMonth,  setPickerMonth]  = useState(new Date().getMonth());
  const [pickerYear,   setPickerYear]   = useState(new Date().getFullYear());

  const range = activePreset === 'custom'
    ? { from: customFrom, to: customTo }
    : getRangeForPreset(activePreset, cutoffDay, rangeOffset);

  // ── load saved settings ──
  useQuery({
    queryKey: ['user-settings', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('cutoff_day, dashboard_preset, dashboard_custom_from, dashboard_custom_to, dashboard_space_ids, dashboard_tab_ids, dashboard_range_offset, dashboard_amount_sort, dashboard_account_ids, dashboard_category_ids, spaces_date_mode, spaces_week_start, spaces_date_offset, spaces_cutoff_day, spaces_use_cutoff')
        .eq('user_id', userId)
        .maybeSingle();
      if (!data) return data;

      // Apply global spaces filter settings first (as defaults)
      const globalMode   = data.spaces_date_mode   ?? 'monthly';
      const globalOffset = Number(data.spaces_date_offset ?? 0);
      const globalCutoff = Number(data.spaces_cutoff_day  ?? 25);
      const globalUseCutoff = Boolean(data.spaces_use_cutoff);

      // Map global mode → dashboard preset
      let derivedPreset: Preset = 'this-month';
      if (globalMode === 'monthly' && globalUseCutoff) derivedPreset = 'cutoff';
      else if (globalMode === 'monthly') derivedPreset = 'this-month';

      setCutoffDay(globalCutoff);
      setCutoffInput(String(globalCutoff));

      // Dashboard-specific overrides (if saved)
      // Always use global spaces filter (no dashboard-specific override)
      setActivePreset(derivedPreset);

      if (data.dashboard_custom_from) setCustomFrom(new Date(data.dashboard_custom_from));
      if (data.dashboard_custom_to)   setCustomTo(new Date(data.dashboard_custom_to));
      if (data.dashboard_space_ids) {
        const ids = (data.dashboard_space_ids as string).split(',').filter(Boolean);
        setSelectedSpaces(new Set(ids.length ? ids : ['all']));
      }
      if (data.dashboard_tab_ids) {
        const tabs = (data.dashboard_tab_ids as string).split(',').filter(Boolean);
        setSelectedTabs(new Set(tabs.length ? tabs as ActivityTab[] : ['all']));
      }
      setRangeOffset(globalOffset);
      if (data.dashboard_amount_sort) setAmountSort(data.dashboard_amount_sort as any);

      if (data.dashboard_account_ids) {
        const ids = (data.dashboard_account_ids as string).split(',').filter(Boolean);
        setSelectedAccounts(new Set(ids.length ? ids : ['all']));
      }
      if (data.dashboard_category_ids) {
        const ids = (data.dashboard_category_ids as string).split(',').filter(Boolean);
        setSelectedCategories(new Set(ids.length ? ids : ['all']));
      }
      return data;
    },
    enabled: !!userId,
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      await supabase.from('user_settings').upsert(
        { user_id: userId, ...patch, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-settings', userId] }),
  });

  const applyPreset = (key: Preset, cutoff?: number) => {
    const day = cutoff ?? cutoffDay;
    if (key === 'cutoff' && cutoff) { setCutoffDay(cutoff); setCutoffInput(String(cutoff)); }
    setRangeOffset(0);
    saveSettings.mutate({ dashboard_range_offset: 0 });
    setActivePreset(key);
    const patch: Record<string, any> = { dashboard_preset: key };
    if (key === 'cutoff' && cutoff) patch.cutoff_day = cutoff;
    if (key === 'custom') {
      patch.dashboard_custom_from = customFrom.toISOString();
      patch.dashboard_custom_to   = customTo.toISOString();
    }
    saveSettings.mutate(patch);
  };

  const navigateRange = (dir: 1 | -1) => {
    if (activePreset === 'custom') {
      const days = Math.round((customTo.getTime() - customFrom.getTime()) / 86400000) + 1;
      const newFrom = new Date(customFrom); newFrom.setDate(newFrom.getDate() + dir * days);
      const newTo   = new Date(customTo);   newTo.setDate(newTo.getDate()   + dir * days);
      applyCustomRange(newFrom, newTo);
    } else {
      setRangeOffset(o => {
        const next = o + dir;
        saveSettings.mutate({ dashboard_range_offset: next });
        return next;
      });
    }
  };

  const applyCustomRange = (from: Date, to: Date) => {
    setCustomFrom(from); setCustomTo(to);
    setActivePreset('custom');
    saveSettings.mutate({
      dashboard_preset: 'custom',
      dashboard_custom_from: from.toISOString(),
      dashboard_custom_to:   to.toISOString(),
    });
  };

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces-list', userId],
    queryFn: async () => {
      const { data } = await supabase.from('spaces').select('id,name').eq('user_id', userId).order('name');
      return data ?? [];
    },
    enabled: !!userId,
  });


  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', userId],
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select().eq('user_id', userId).order('created_at');
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', userId],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id,name').eq('user_id', userId).order('created_at');
      return data ?? [];
    },
    enabled: !!userId,
  });

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showAddModal,    setShowAddModal]    = useState(false);

  useEffect(() => {
    registerAdd('dashboard', () => { setShowAddModal(true); setQaError(''); });
    return () => unregisterAdd('dashboard');
  }, []);

  // ── quick-add form state ──
  const [qaName,     setQaName]     = useState('');
  const [qaType,     setQaType]     = useState('expense');
  const [qaAmount,   setQaAmount]   = useState('');
  const _today = new Date();
  const _pad = (n: number) => String(n).padStart(2, '0');
  const [qaDay,      setQaDay]      = useState(String(_today.getDate()));
  const [qaMonth,    setQaMonth]    = useState(String(_today.getMonth() + 1));
  const [qaYear,     setQaYear]     = useState(String(_today.getFullYear()));
  const [qaSpaceId,  setQaSpaceId]  = useState<string | null>(null);
  const [qaCatId,    setQaCatId]    = useState<string | null>(null);
  const [qaLoading,  setQaLoading]  = useState(false);
  const [qaError,    setQaError]    = useState('');
  const headerAnim  = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const onScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const diff = y - lastScrollY.current;
    if (diff > 6 && y > 30)
      Animated.timing(headerAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    else if (diff < -6)
      Animated.timing(headerAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    lastScrollY.current = y;
  };

  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set(['all']));
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['all']));
  const [amountSort, setAmountSort] = useState<'none' | 'high' | 'low'>('none');

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['dashboard-activities', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('*, categories:category_id(name,color,icon), space:space_id(name)')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false });
      return (data ?? []).map((r: any) => ({
        ...r,
        categories: Array.isArray(r.categories) ? r.categories[0] : r.categories,
        space: Array.isArray(r.space) ? r.space[0] : r.space,
      }));
    },
    enabled: !!userId,
  });

  const isAll = selectedTabs.has('all');
  const currentTypes = isAll
    ? ['income','expense','debt','due']
    : ACTIVITY_TABS.filter(t => t.key !== 'all' && selectedTabs.has(t.key)).flatMap(t => t.types as string[]);

  const effectiveTypes = currentTypes;

  const isAllSpaces    = selectedSpaces.has('all');
  const isAllAccounts  = selectedAccounts.has('all');
  const isAllCategories = selectedCategories.has('all');


  const filtered = recordings.filter(r => {
    if (!effectiveTypes.includes(r.type)) return false;
    if (r.status === 'voided') return false;
    // When Due tab is selected, only show is_due expenses (not all expenses)
    if (!isAll && selectedTabs.has('receivables') && r.type === 'expense' && !r.is_due) return false;
    if (!isAllSpaces     && !selectedSpaces.has(r.space_id))                    return false;
    if (!isAllCategories && !selectedCategories.has(r.category_id)) return false;
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date < range.from) return false;
    const to = new Date(range.to); to.setHours(23, 59, 59);
    if (date > to) return false;
    if (statusFilter === 'active'   && r.type === 'debt' && r.status === 'paid')   return false;
    if (statusFilter === 'paid'     && r.type === 'debt' && r.status !== 'paid')   return false;
    if (statusFilter === 'pending'  && r.type === 'due'  && r.status === 'paid')   return false;
    if (statusFilter === 'received' && r.type === 'due'  && r.status !== 'paid')   return false;
    return true;
  });

  const sortedFiltered = (arr: any[]) => {
    if (amountSort === 'high') return [...arr].sort((a, b) => Number(b.amount) - Number(a.amount));
    if (amountSort === 'low')  return [...arr].sort((a, b) => Number(a.amount) - Number(b.amount));
    return arr;
  };

  const toggleSpace = (id: string) => {
    setSelectedSpaces(prev => {
      const next = new Set(prev);
      if (id === 'all') return new Set(['all']);
      next.delete('all');
      if (next.has(id)) { next.delete(id); if (next.size === 0) return new Set(['all']); }
      else next.add(id);
      return next;
    });
    // persist after state settles
    setTimeout(() => {
      setSelectedSpaces(prev => {
        const ids = [...prev].filter(x => x !== 'all');
        saveSettings.mutate({ dashboard_space_ids: ids.join(',') });
        return prev;
      });
    }, 0);
  };

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);
  const activeTabData = ACTIVITY_TABS.find(t => t.key === (isAll ? 'all' : [...selectedTabs][0])) ?? ACTIVITY_TABS[0];
  const allRecordings = (types: string[]) => recordings.filter(r => {
    if (!types.includes(r.type)) return false;
    if (r.status === 'voided') return false;
    if (!isAllSpaces && !selectedSpaces.has(r.space_id)) return false;
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date < range.from) return false;
    const to = new Date(range.to); to.setHours(23, 59, 59);
    return date <= to;
  });

  const moneyInTotal    = allRecordings(['income']).reduce((s, r) => s + Number(r.amount), 0);
  const moneyOutTotal   = allRecordings(['expense']).reduce((s, r) => {
    const net = r.is_due ? Math.max(0, Number(r.amount) - Number(r.paid_amount ?? 0)) : Number(r.amount);
    return s + net;
  }, 0);
  const loansActive     = allRecordings(['debt']).filter(r => r.status !== 'paid').length;
  const loansPaid       = allRecordings(['debt']).filter(r => r.status === 'paid').length;
  const receivablesPending  = allRecordings(['due']).filter(r => r.status !== 'paid').length +
    allRecordings(['expense']).filter(r => r.is_due && r.status !== 'paid').length;
  const receivablesReceived = allRecordings(['due']).filter(r => r.status === 'paid').length;

  const fmt     = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const fmtAbbr = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'M';
    if (n >= 1_000)     return (n / 1_000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'K';
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };
  const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtFull  = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rangeLabel = isSameDay(range.from, range.to)
    ? fmtFull(range.from)
    : `${fmtShort(range.from)} – ${fmtFull(range.to)}`;

  // ── calendar helpers ──
  const firstDay    = new Date(pickerYear, pickerMonth, 1).getDay();
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const isInRange = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    return d > customFrom && d < customTo;
  };
  const isEdge = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    return isSameDay(d, customFrom) || isSameDay(d, customTo);
  };

  const handleDayPress = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    if (pickingDate === 'from') {
      setCustomFrom(d); setCustomTo(d); setPickingDate('to');
    } else {
      if (d < customFrom) { setCustomFrom(d); setPickingDate('to'); }
      else { applyCustomRange(customFrom, d); setPickingDate('from'); }
    }
  };

  const handleTabToggle = (key: ActivityTab) => {
    setStatusFilter(null);
    if (key === 'all') {
      setSelectedTabs(new Set(['all']));
      saveSettings.mutate({ dashboard_tab_ids: '' });
      return;
    }
    setSelectedTabs(prev => {
      const next = new Set(prev);
      next.delete('all');
      if (next.has(key)) {
        next.delete(key);
        if (next.size === 0) {
          saveSettings.mutate({ dashboard_tab_ids: '' });
          return new Set(['all']);
        }
      } else {
        next.add(key);
        if (next.size === 4) {
          saveSettings.mutate({ dashboard_tab_ids: '' });
          return new Set(['all']);
        }
      }
      saveSettings.mutate({ dashboard_tab_ids: [...next].join(',') });
      return next;
    });
  };

  const handlePresetSelect = (key: Preset) => {
    if (key === 'custom') {
      if (activePreset !== 'custom') {
        const r = getRangeForPreset('this-month', cutoffDay);
        setCustomFrom(r.from); setCustomTo(r.to);
      }
      setPickingDate('from');
    }
    applyPreset(key);
  };

  const tabValue = (key: string) => {
    if (key === 'all')          return fmtAbbr(moneyInTotal + moneyOutTotal);
    if (key === 'money-in')    return fmtAbbr(moneyInTotal);
    if (key === 'money-out')   return fmtAbbr(moneyOutTotal);
    if (key === 'loans')       return String(loansActive);
    if (key === 'receivables') return String(receivablesPending);
    return '';
  };

  const saveQuickAdd = async () => {
    if (!qaName.trim() || !qaAmount) { setQaError('name and amount are required.'); return; }
    setQaLoading(true); setQaError('');
    try {
      const statusMap: Record<string, string> = {
        expense: 'paid', income: 'received', return: 'received',
        debt: 'unpaid', due: 'unpaid',
      };
      const txDate = `${qaYear}-${_pad(parseInt(qaMonth))}-${_pad(parseInt(qaDay))}`;

      if (qaType === 'expense_due') {
        await supabase.from('recordings').insert({
          user_id: userId, space_id: qaSpaceId || null,
          name: qaName.trim(), type: 'expense',
          amount: parseFloat(qaAmount), transaction_date: txDate,
          category_id: qaCatId || null, status: 'paid', is_due: true,
        });
      } else {
        await supabase.from('recordings').insert({
          user_id: userId,
          space_id: qaSpaceId || null,
          name: qaName.trim(),
          type: qaType,
          amount: parseFloat(qaAmount),
          transaction_date: txDate,
          category_id: qaCatId || null,
          status: statusMap[qaType] ?? 'paid',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard-activities', userId] });
      setShowAddModal(false);
      setQaName(''); setQaAmount(''); setQaType('expense'); setQaSpaceId(null); setQaCatId(null); setQaError('');
      setQaDay(String(new Date().getDate())); setQaMonth(String(new Date().getMonth()+1)); setQaYear(String(new Date().getFullYear()));
    } catch (e: any) { setQaError(e.message); }
    setQaLoading(false);
  };

  const typeLabel = (r: any) => {
    if (r.is_write_off) return { label: 'write-off', color: Colors.muted };
    if (r.type === 'income')  return { label: 'income',  color: ACCENT };
    if (r.type === 'expense') return { label: r.is_due ? 'expense · due' : 'expense', color: PEACH };
    if (r.type === 'debt')    return r.status === 'paid'
      ? { label: 'debt · paid',    color: ACCENT }
      : r.status === 'partial'
      ? { label: 'debt · partial', color: PEACH }
      : { label: 'debt',           color: PEACH };
    if (r.type === 'due')     return r.status === 'paid'
      ? { label: 'due · collected', color: ACCENT }
      : r.status === 'partial'
      ? { label: 'due · partial',   color: ACCENT }
      : { label: 'due',             color: ACCENT };
    return null;
  };

  return (
    <SafeAreaView style={s.container}>

      {/* ── Sheet: menu floats on top, list scrolls underneath ── */}
      <View style={s.sheet}>

        {/* Floating menu card — absolute, sits on top of list */}
        <Animated.View style={[
          s.menuCard,
          { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0,1], outputRange: [-130,0] }) }] },
        ]}>
          <ActivityTabs
            selectedTabs={selectedTabs}
            onToggle={handleTabToggle}
            tabValue={tabValue}
            activeColor={ACCENT}
            activeTextColor={ACCENT_TEXT}
          />
          <View style={s.filterRow}>
            <View style={s.dateNavRow}>
              <TouchableOpacity style={s.dateNavArrow} onPress={() => navigateRange(-1)} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={14} color={ACCENT} />
              </TouchableOpacity>
              <TouchableOpacity style={s.filterBtn} onPress={() => setShowDateModal(true)} activeOpacity={0.75}>
                <Ionicons name="calendar-outline" size={13} color={ACCENT} />
                <Text style={s.filterBtnText}>{rangeLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dateNavArrow} onPress={() => navigateRange(1)} activeOpacity={0.7}>
                <Ionicons name="chevron-forward" size={14} color={ACCENT} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[s.filterBtn, (!isAllSpaces || !isAllAccounts || !isAllCategories || amountSort !== 'none') && s.filterBtnActive]}
              onPress={() => setShowFilterModal(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="options-outline" size={13} color={(!isAllSpaces || !isAllAccounts || !isAllCategories || amountSort !== 'none') ? ACCENT : Colors.muted} />
              <Text style={[s.filterBtnText, (!isAllSpaces || !isAllAccounts || !isAllCategories || amountSort !== 'none') && s.filterBtnTextActive]}>Filter</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        {isLoading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 48 }} />
        ) : filtered.length === 0 ? (
          <View style={pageStyles.emptyBox}>
            <Text style={pageStyles.emptyText}>no {activeTabData.label.toLowerCase()} found for this period</Text>
          </View>
        ) : (
          <ScrollView key={filtered.map(i => i.id).join() + amountSort} contentContainerStyle={s.list} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
            {sortedFiltered(filtered).map((item, idx) => {
              const prevDate = sortedFiltered(filtered)[idx - 1]?.transaction_date;
              const showDate = item.transaction_date !== prevDate;
              const dateStr  = smartDateLabel(item.transaction_date);
              const tl = typeLabel(item);
              return (
                <View key={item.id}>
                  {showDate && (
                    <View style={s.dateHeaderRow}>
                      <Text style={s.dateHeaderText}>{dateStr}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={s.row} activeOpacity={0.85} onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}>
                    <View style={s.rowIconWrap}>
                      <Ionicons name={(item.categories?.icon ?? activeTabData.icon) as any} size={18} color={ACCENT} />
                    </View>
                    <View style={s.rowMid}>
                      <Text style={s.rowType}>{tl?.label ?? activeTabData.label}</Text>
                      <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                      {item.space?.name ? <Text style={s.rowSpace}>{item.space.name}</Text> : null}
                    </View>
                    <Text style={[s.rowAmount, { color: tl?.color ?? Colors.cyan }]}>
                      {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>

      {/* ── Quick Add Recording Modal ── */}
      <BottomSheet visible={showAddModal} onClose={() => setShowAddModal(false)} title="add recording" height={MODAL_HEIGHT}>
        {qaError ? <Text style={s.qaError}>{qaError}</Text> : null}

        {/* Type */}
        <Text style={s.qaLabel}>type</Text>
        {[
          { label: 'money out',  types: [{ key: 'expense', label: 'expense' }, { key: 'expense_due', label: 'expense + due' }] },
          { label: 'money in',   types: [{ key: 'income', label: 'income' }] },
          { label: 'debt',       types: [{ key: 'debt', label: 'debt' }] },
          { label: 'due',        types: [{ key: 'due', label: 'due' }] },
        ].map(group => (
          <View key={group.label} style={{ marginBottom: 6 }}>
            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 9, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>{group.label}</Text>
            <View style={s.qaTypeRow}>
              {group.types.map(t => (
                <TouchableOpacity key={t.key} style={[s.qaTypeBtn, qaType === t.key && s.qaTypeBtnActive]} onPress={() => setQaType(t.key)} activeOpacity={0.75}>
                  <Text style={[s.qaTypeBtnText, qaType === t.key && s.qaTypeBtnTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Name */}
        <Text style={s.qaLabel}>name</Text>
        <TextInput style={s.qaInput} placeholder="e.g. grocery run" placeholderTextColor={Colors.faint} value={qaName} onChangeText={setQaName} autoFocus />

        {/* Amount */}
        <Text style={s.qaLabel}>amount</Text>
        <TextInput style={s.qaInput} placeholder="0.00" placeholderTextColor={Colors.faint} value={qaAmount} onChangeText={setQaAmount} keyboardType="decimal-pad" />

        {/* Date */}
        <Text style={s.qaLabel}>date</Text>
        <View style={s.qaDateRow}>
          <View style={s.qaDatePicker}>
            <Text style={s.qaDatePickerLabel}>Month</Text>
            <View style={s.qaChips}>
              {Array.from({length:12},(_,k)=>k+1).map(m=>(
                <TouchableOpacity key={m} style={[s.qaDateChip, parseInt(qaMonth)===m && s.qaChipActive]} onPress={()=>setQaMonth(String(m))} activeOpacity={0.75}>
                  <Text style={[s.qaChipText, parseInt(qaMonth)===m && s.qaChipTextActive]}>{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{flexDirection:'row', gap:8, marginTop:8}}>
            <View style={{flex:1}}>
              <Text style={s.qaDatePickerLabel}>Day</Text>
              <TextInput style={s.qaInput} value={qaDay} onChangeText={setQaDay} keyboardType="number-pad" maxLength={2} placeholder="DD" placeholderTextColor={Colors.faint} />
            </View>
            <View style={{flex:1}}>
              <Text style={s.qaDatePickerLabel}>Year</Text>
              <TextInput style={s.qaInput} value={qaYear} onChangeText={setQaYear} keyboardType="number-pad" maxLength={4} placeholder="YYYY" placeholderTextColor={Colors.faint} />
            </View>
          </View>
        </View>

        {/* Space */}
        <Text style={s.qaLabel}>space <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, textTransform: 'none' }}>(optional)</Text></Text>
        <View style={s.qaChips}>
          <TouchableOpacity style={[s.qaChip, !qaSpaceId && s.qaChipActive]} onPress={() => setQaSpaceId(null)} activeOpacity={0.75}>
            <Text style={[s.qaChipText, !qaSpaceId && s.qaChipTextActive]}>none</Text>
          </TouchableOpacity>
          {spaces.map((sp: any) => (
            <TouchableOpacity key={sp.id} style={[s.qaChip, qaSpaceId === sp.id && s.qaChipActive]} onPress={() => setQaSpaceId(sp.id)} activeOpacity={0.75}>
              <Text style={[s.qaChipText, qaSpaceId === sp.id && s.qaChipTextActive]}>{sp.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category */}
        <Text style={s.qaLabel}>category</Text>
        <View style={s.qaChips}>
          {categories.map((cat: any) => (
            <TouchableOpacity key={cat.id} style={[s.qaChip, qaCatId === cat.id && s.qaChipActive]} onPress={() => setQaCatId(cat.id)} activeOpacity={0.75}>
              <Text style={[s.qaChipText, qaCatId === cat.id && s.qaChipTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[s.qaSaveBtn, (!qaName.trim() || !qaAmount || !qaSpaceId || !qaCatId || qaLoading) && { opacity: 0.4 }]}
          onPress={saveQuickAdd}
          disabled={!qaName.trim() || !qaAmount || !qaSpaceId || !qaCatId || qaLoading}
          activeOpacity={0.8}
        >
          {qaLoading ? <ActivityIndicator color={ACCENT_TEXT} /> : <Text style={s.qaSaveBtnText}>save</Text>}
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Date modal ── */}
      <BottomSheet visible={showDateModal} onClose={() => setShowDateModal(false)} title="date range" height={MODAL_HEIGHT}>
        {/* Preset options */}
        <View style={s.modalPresetRow}>
          {PRESETS.map(p => {
            const active = p.key === activePreset;
            return (
              <TouchableOpacity
                key={p.key}
                style={[s.modalPresetChip, active && s.modalPresetChipActive]}
                onPress={() => handlePresetSelect(p.key)}
                activeOpacity={0.75}
              >
                <Ionicons name={p.icon as any} size={13} color={active ? Colors.text : Colors.muted} />
                <Text style={[s.modalPresetText, active && s.modalPresetTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cutoff day input — shown when cutoff selected */}
        {activePreset === 'cutoff' && (
          <View style={s.cutoffRow}>
            <Text style={s.cutoffLabel}>billing cycle starts on day</Text>
            <View style={s.cutoffChips}>
              {[1,5,10,15,20,25,28].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.cutoffChip, parseInt(cutoffInput) === d && s.cutoffChipActive]}
                  onPress={() => { setCutoffInput(String(d)); applyPreset('cutoff', d); }}
                >
                  <Text style={[s.cutoffChipText, parseInt(cutoffInput) === d && s.cutoffChipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.cutoffInputRow}>
              <Text style={s.cutoffInputLabel}>or type a day</Text>
              <TextInput
                style={s.cutoffInput}
                value={cutoffInput}
                onChangeText={v => setCutoffInput(v.replace(/[^0-9]/g, ''))}
                onEndEditing={() => {
                  const d = parseInt(cutoffInput);
                  if (d >= 1 && d <= 31) applyPreset('cutoff', d);
                }}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="1–31"
                placeholderTextColor={Colors.faint}
              />
            </View>
          </View>
        )}

        {/* Calendar — shown when custom selected */}
        {activePreset === 'custom' && (
          <View style={s.calWrap}>
            <Text style={s.calHint}>
              {pickingDate === 'from' ? 'tap start date' : 'tap end date'}
            </Text>
            <View style={s.pickerNav}>
              <TouchableOpacity onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); }}>
                <Ionicons name="chevron-back" size={18} color={Colors.text} />
              </TouchableOpacity>
              <Text style={s.pickerMonthText}>{MONTHS[pickerMonth].toLowerCase()} {pickerYear}</Text>
              <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}>
                <Ionicons name="chevron-forward" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
              {['su','mo','tu','we','th','fr','sa'].map(d => (
                <Text key={d} style={s.calDay}>{d}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
              {cells.map((day, i) => {
                if (!day) return <View key={`e${i}`} style={s.calCell} />;
                const inRange = isInRange(day);
                const edge    = isEdge(day);
                const today   = isSameDay(new Date(pickerYear, pickerMonth, day), new Date());
                return (
                  <TouchableOpacity
                    key={day}
                    style={[s.calCell, inRange && s.calCellRange, edge && s.calCellEdge, !inRange && !edge && today && s.calCellToday]}
                    onPress={() => handleDayPress(day)}
                  >
                    <Text style={[s.calCellText, (edge || today) && s.calCellTextActive]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </BottomSheet>

      {/* ── Filter modal ── */}
      <BottomSheet visible={showFilterModal} onClose={() => setShowFilterModal(false)} title="filter" height={MODAL_HEIGHT}>

        {/* Clear all + section labels */}
        <TouchableOpacity
          style={s.clearBtn}
          onPress={() => {
            setSelectedSpaces(new Set(['all']));
            setSelectedAccounts(new Set(['all']));
            setSelectedCategories(new Set(['all']));
            setAmountSort('none');
            saveSettings.mutate({ dashboard_space_ids: '', dashboard_account_ids: '', dashboard_category_ids: '', dashboard_amount_sort: 'none' });
          }}
          activeOpacity={0.75}
        >
          <Text style={s.clearBtnText}>Clear All Filters</Text>
        </TouchableOpacity>

        {/* Spaces */}
        <Text style={s.filterSectionLabel}>Spaces</Text>
        <View style={s.spaceChips}>
          <TouchableOpacity style={[s.spaceChip, isAllSpaces && s.spaceChipActive]} onPress={() => { setSelectedSpaces(new Set(['all'])); saveSettings.mutate({ dashboard_space_ids: '' }); }} activeOpacity={0.75}>
            <Text style={[s.spaceChipText, isAllSpaces && s.spaceChipTextActive]}>All</Text>
          </TouchableOpacity>
          {spaces.map((sp: any) => {
            const active = selectedSpaces.has(sp.id);
            return (
              <TouchableOpacity key={sp.id} style={[s.spaceChip, active && s.spaceChipActive]} onPress={() => toggleSpace(sp.id)} activeOpacity={0.75}>
                <Text style={[s.spaceChipText, active && s.spaceChipTextActive]}>{sp.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>


        {/* Accounts */}
        <Text style={s.filterSectionLabel}>Accounts</Text>
        <View style={s.spaceChips}>
          <TouchableOpacity style={[s.spaceChip, isAllAccounts && s.spaceChipActive]} onPress={() => setSelectedAccounts(new Set(['all']))} activeOpacity={0.75}>
            <Text style={[s.spaceChipText, isAllAccounts && s.spaceChipTextActive]}>All</Text>
          </TouchableOpacity>
          {accounts.map((ac: any) => {
            const active = selectedAccounts.has(ac.id);
            return (
              <TouchableOpacity key={ac.id} style={[s.spaceChip, active && s.spaceChipActive]} onPress={() => {
                setSelectedAccounts(prev => {
                  const next = new Set(prev); next.delete('all');
                  if (next.has(ac.id)) { next.delete(ac.id); if (next.size === 0) return new Set(['all']); }
                  else next.add(ac.id);
                  const ids = [...next].join(',');
                  saveSettings.mutate({ dashboard_account_ids: ids });
                  return next;
                });
              }} activeOpacity={0.75}>
                <Text style={[s.spaceChipText, active && s.spaceChipTextActive]}>{ac.account_name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Amount sort */}
        {/* Categories */}
        <Text style={s.filterSectionLabel}>Categories</Text>
        <View style={s.spaceChips}>
          <TouchableOpacity style={[s.spaceChip, isAllCategories && s.spaceChipActive]} onPress={() => setSelectedCategories(new Set(['all']))} activeOpacity={0.75}>
            <Text style={[s.spaceChipText, isAllCategories && s.spaceChipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat: any) => {
            const active = selectedCategories.has(cat.id);
            return (
              <TouchableOpacity key={cat.id} style={[s.spaceChip, active && s.spaceChipActive]} onPress={() => {
                setSelectedCategories(prev => {
                  const next = new Set(prev); next.delete('all');
                  if (next.has(cat.id)) { next.delete(cat.id); if (next.size === 0) return new Set(['all']); }
                  else next.add(cat.id);
                  saveSettings.mutate({ dashboard_category_ids: [...next].join(',') });
                  return next;
                });
              }} activeOpacity={0.75}>
                <Text style={[s.spaceChipText, active && s.spaceChipTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.filterSectionLabel}>Sort by Amount</Text>
        <View style={s.spaceChips}>
          {(['none', 'high', 'low'] as const).map(opt => (
            <TouchableOpacity key={opt} style={[s.spaceChip, amountSort === opt && s.spaceChipActive]} onPress={() => {
              setAmountSort(opt);
              saveSettings.mutate({ dashboard_amount_sort: opt });
            }} activeOpacity={0.75}>
              <Text style={[s.spaceChipText, amountSort === opt && s.spaceChipTextActive]}>
                {opt === 'none' ? 'Default' : opt === 'high' ? 'High → Low' : 'Low → High'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>

      {/* ── Spaces modal ── */}
      <BottomSheet visible={showSpaceModal} onClose={() => setShowSpaceModal(false)} title="filter by space" height={MODAL_HEIGHT}>
        <View style={s.spaceChips}>
          <TouchableOpacity
            style={[s.spaceChip, isAllSpaces && s.spaceChipActive]}
            onPress={() => toggleSpace('all')}
            activeOpacity={0.75}
          >
            <Text style={[s.spaceChipText, isAllSpaces && s.spaceChipTextActive]}>All</Text>
          </TouchableOpacity>
          {spaces.map((sp: any) => {
            const active = selectedSpaces.has(sp.id);
            return (
              <TouchableOpacity
                key={sp.id}
                style={[s.spaceChip, active && s.spaceChipActive]}
                onPress={() => toggleSpace(sp.id)}
                activeOpacity={0.75}
              >
                <Text style={[s.spaceChipText, active && s.spaceChipTextActive]}>{sp.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.white },
  topSection: { paddingHorizontal: 25, paddingTop: 20, paddingBottom: 12 },
  titleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:      { fontFamily: 'CalSans', fontSize: 28, color: Colors.text, letterSpacing: -0.8 },
  addRecBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },

  sheet:    { flex: 1, backgroundColor: Colors.white },
  menuCard: {
    position: 'absolute', top: 0, left: 25, right: 25, zIndex: 10,
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    paddingTop: 12, paddingBottom: 8, gap: 8,
  },

  // Tab circles — now in ActivityTabs component

  // Filter row
  filterRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  dateNavRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateNavArrow:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  filterBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderMid },
  filterBtnActive: { backgroundColor: ACCENT + '22', borderColor: ACCENT },
  filterBtnText:       { fontFamily: Fonts.mono,     fontSize: 11, color: Colors.text },
  filterBtnTextActive: { fontFamily: Fonts.monoBold, fontSize: 11, color: ACCENT },

  // List
  list:           { paddingHorizontal: Spacing.page, paddingTop: 140, paddingBottom: 20, gap: 12 },
  dateHeaderRow:  { marginTop: 16, marginBottom: 8, paddingTop: 16 },
  dateHeaderText: { ...Brand.type.sectionHeader },

  // Recording row
  row:         { backgroundColor: Colors.white, borderRadius: Radius.xl, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  rowIconWrap: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  rowMid:      { flex: 1, gap: 2 },
  rowType:     { fontFamily: 'ChillaxRegular', fontSize: 10, color: Colors.muted, letterSpacing: 0.4, textTransform: 'uppercase' },
  rowName:     { fontFamily: 'ChillaxMedium',  fontSize: 14, color: Colors.text, letterSpacing: 0.1, lineHeight: 20 },
  rowSpace:    { fontFamily: Fonts.mono,        fontSize: 11, color: Colors.faint, letterSpacing: 0.2 },
  rowAmount:   { fontFamily: Fonts.monoBold,    fontSize: 15, letterSpacing: -0.4 },

  // Date modal
  modalPresetRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  modalPresetChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  modalPresetChipActive: { backgroundColor: ACCENT },
  modalPresetText:       { fontFamily: Fonts.mono,     fontSize: 12, color: Colors.muted },
  modalPresetTextActive: { fontFamily: Fonts.monoBold, fontSize: 12, color: ACCENT_TEXT },

  cutoffRow:        { marginBottom: 16, width: '100%' },
  cutoffLabel:      { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, marginBottom: 10 },
  cutoffChips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  cutoffChip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  cutoffChipActive: { backgroundColor: ACCENT },
  cutoffChipText:       { fontFamily: Fonts.mono,     fontSize: 12, color: Colors.muted },
  cutoffChipTextActive: { fontFamily: Fonts.monoBold, fontSize: 12, color: ACCENT_TEXT },
  cutoffInputRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cutoffInputLabel: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, flex: 1 },
  cutoffInput:      { backgroundColor: Colors.surface, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8, fontFamily: Fonts.monoBold, fontSize: 16, color: Colors.text, width: 70, textAlign: 'center' },

  // Calendar
  calWrap:         { width: '100%' },
  calHint:         { fontFamily: Fonts.mono, fontSize: 11, color: ACCENT, marginBottom: 10 },
  pickerNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4, marginBottom: 10 },
  pickerMonthText: { fontFamily: Fonts.monoBold, fontSize: 15, color: Colors.text },
  calDay:          { flex: 1, textAlign: 'center', fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  calCell:         { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellRange:    { backgroundColor: ACCENT + '55', borderRadius: 0 },
  calCellEdge:     { backgroundColor: ACCENT },
  calCellToday:    { backgroundColor: Colors.surface },
  calCellText:     { fontFamily: Fonts.mono,     fontSize: 13, color: Colors.text },
  calCellTextActive: { fontFamily: Fonts.monoBold, color: Colors.text },

  // Filter modal chips
  spaceChips:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 16 },
  spaceChip:           { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  spaceChipActive:     { backgroundColor: ACCENT },
  spaceChipText:       { fontFamily: Fonts.mono,     fontSize: 13, color: Colors.muted },
  spaceChipTextActive: { fontFamily: Fonts.monoBold, fontSize: 13, color: ACCENT_TEXT },
  filterSectionLabel:  { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  clearBtn:     { alignSelf: 'flex-end', marginBottom: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  clearBtnText: { fontFamily: Fonts.monoBold, fontSize: 12, color: ACCENT },

  // Quick add modal
  qaError:          { fontFamily: Fonts.mono, fontSize: 12, color: PEACH, marginBottom: 8 },
  qaLabel:          { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, marginBottom: 6, marginTop: 12, letterSpacing: 0.4, textTransform: 'uppercase' },
  qaInput:          { fontFamily: Fonts.monoBold, fontSize: 16, color: Colors.text, backgroundColor: Colors.white, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },
  qaTypeRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  qaTypeBtn:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderMid },
  qaTypeBtnActive:  { backgroundColor: ACCENT, borderColor: ACCENT },
  qaTypeBtnText:    { fontFamily: Fonts.mono,     fontSize: 11, color: Colors.muted },
  qaTypeBtnTextActive: { fontFamily: Fonts.monoBold, fontSize: 11, color: ACCENT_TEXT },
  qaChips:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaChip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderMid },
  qaChipActive:     { backgroundColor: ACCENT, borderColor: ACCENT },
  qaChipText:       { fontFamily: Fonts.mono,     fontSize: 12, color: Colors.muted },
  qaChipTextActive: { fontFamily: Fonts.monoBold, fontSize: 12, color: ACCENT_TEXT },
  qaDateRow:        { gap: 8 },
  qaDatePicker:     {},
  qaDatePickerLabel: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginBottom: 6 },
  qaDateChip:       { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderMid },
  qaSaveBtn:        { backgroundColor: ACCENT, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  qaSaveBtnText:    { fontFamily: Fonts.monoBold, fontSize: 14, color: ACCENT_TEXT },
});


