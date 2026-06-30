import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { useSlideScreen } from '../../src/hooks/useSlideScreen';
import { supabase } from '../../src/lib/supabase';
import ConfirmModal from '@/components/ui/ConfirmModal';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors, Fonts, Radius } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';

// ── Module-level pending focus date ─────────────────────────────────────────
export let pendingFocusDate: string | null = null;
export function setPendingFocusDate(date: string | null) { pendingFocusDate = date; }

// ── Constants ────────────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');

const PEACH = '#FFAB91';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const MODAL_HEIGHT = '50%';

type Preset = 'this-month' | 'last-30' | 'cutoff' | 'custom';
const PRESETS: { key: Preset; label: string; icon: string }[] = [
  { key: 'this-month', label: 'This Month', icon: 'calendar-outline' },
  { key: 'last-30',    label: 'Last 30d',   icon: 'time-outline'     },
  { key: 'cutoff',     label: 'Cutoff',     icon: 'cut-outline'      },
  { key: 'custom',     label: 'Custom',     icon: 'options-outline'  },
];

const ACTIVITY_TABS = [
  { key: 'all',         label: 'All',         types: ['income','expense','debt','due'] },
  { key: 'money-in',    label: 'Money In',    types: ['income'] },
  { key: 'money-out',   label: 'Money Out',   types: ['expense'] },
  { key: 'loans',       label: 'Debt',        types: ['debt'] },
  { key: 'receivables', label: 'Due',         types: ['due','expense'] },
] as const;
type ActivityTab = typeof ACTIVITY_TABS[number]['key'];

// ── Helper functions ─────────────────────────────────────────────────────────
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getRangeForPreset(preset: Preset, cutoffDay: number, offset = 0): { from: Date; to: Date } {
  const now = new Date();
  if (preset === 'this-month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth() + offset, 1),
      to:   new Date(now.getFullYear(), now.getMonth() + offset + 1, 0),
    };
  }
  if (preset === 'last-30') {
    const base = new Date(now); base.setDate(now.getDate() + offset * 30);
    const from = new Date(base); from.setDate(base.getDate() - 30);
    return { from, to: base };
  }
  if (preset === 'cutoff') {
    const baseMonth = now.getDate() >= cutoffDay ? now.getMonth() : now.getMonth() - 1;
    return {
      from: new Date(now.getFullYear(), baseMonth + offset, cutoffDay),
      to:   new Date(now.getFullYear(), baseMonth + offset + 1, cutoffDay - 1),
    };
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}

function fmtAbbr(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtAmount(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function getTypeLabel(type: string, status: string, is_due?: boolean, paid_amount?: number, amount?: number) {
  if (type === 'income')  return { label: 'income',  color: Colors.cyan };
  if (type === 'expense') {
    if (is_due) {
      const paid = Number(paid_amount ?? 0);
      const total = Number(amount ?? 0);
      const collected = total > 0 && paid >= total - 0.01;
      const partial   = paid > 0 && !collected;
      if (collected) return { label: 'expense · collected',        color: Colors.cyan };
      if (partial)   return { label: 'expense · due · partial',    color: PEACH };
      return               { label: 'expense · due',               color: PEACH };
    }
    return { label: 'expense', color: PEACH };
  }
  if (type === 'debt') {
    if (status === 'paid')    return { label: 'debt · paid',           color: Colors.cyan };
    if (status === 'partial') return { label: 'debt · partially paid', color: PEACH };
    return                           { label: 'debt',                  color: PEACH };
  }
  if (type === 'due') {
    if (status === 'paid')    return { label: 'due · collected',        color: Colors.cyan };
    if (status === 'partial') return { label: 'due · partially paid',   color: Colors.cyan };
    return                           { label: 'due',                    color: Colors.cyan };
  }
  return { label: type, color: Colors.muted };
}

// ── Component ────────────────────────────────────────────────────────────────
function smartDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date  = new Date(y, m - 1, d);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.floor((todayStart.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  // Same week (Sun-Sat containing today)
  const todayDay = todayStart.getDay(); // 0=Sun
  const weekStart = new Date(todayStart); weekStart.setDate(todayStart.getDate() - todayDay);
  const weekEnd   = new Date(weekStart);  weekEnd.setDate(weekStart.getDate() + 6);
  if (date >= weekStart && date <= weekEnd)
    return date.toLocaleDateString('en-US', { weekday: 'long' });

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SpaceDetailScreen() {
  const { spaceId, name } = useLocalSearchParams<{ spaceId: string; name: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useUser();

  // Slide animation
  const { slideAnim, handleBack } = useSlideScreen();

  // Date range state
  const [activePreset, setActivePreset] = useState<Preset>('this-month');
  const [rangeOffset,  setRangeOffset]  = useState(0);
  const [cutoffDay,    setCutoffDay]    = useState(25);
  const [cutoffInput,  setCutoffInput]  = useState('25');
  const [customFrom,   setCustomFrom]   = useState<Date>(new Date());
  const [customTo,     setCustomTo]     = useState<Date>(new Date());

  // Calendar picker state
  const [pickingDate, setPickingDate] = useState<'from' | 'to'>('from');
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear,  setPickerYear]  = useState(new Date().getFullYear());

  // Tab filter state
  const [selectedTabs, setSelectedTabs] = useState<Set<ActivityTab>>(new Set(['all']));

  // Category filter state
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['all']));

  // Modal visibility
  const [showDateModal,   setShowDateModal]   = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [confirmModal,    setConfirmModal]    = useState(false);

  // Delete state
  const [pendingDeleteId,   setPendingDeleteId]   = useState('');
  const [pendingDeleteName, setPendingDeleteName] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['recordings', spaceId, userId],
    queryFn: async () => {
      const normalize = (data: any[]) => data.map((r: any) => ({
        ...r,
        categories: Array.isArray(r.categories) ? r.categories[0] : r.categories,
      }));
      const query = supabase
        .from('recordings')
        .select('*, categories:category_id(name,color,icon)');
      if (spaceId === 'all') {
        if (!userId) return [];
        const { data } = await query.eq('user_id', userId).order('transaction_date', { ascending: false });
        return normalize(data ?? []);
      }
      const { data } = await query.eq('space_id', spaceId).order('transaction_date', { ascending: false });
      return normalize(data ?? []);
    },
    enabled: !!spaceId && (spaceId !== 'all' || !!userId),
  });

  const { data: spaceData } = useQuery({
    queryKey: ['space-budget', spaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('spaces')
        .select('budget, space_type')
        .eq('id', spaceId)
        .single();
      return data;
    },
    enabled: !!spaceId && spaceId !== 'all',
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('id,name')
        .eq('user_id', userId)
        .order('created_at');
      return data ?? [];
    },
    enabled: !!userId,
  });

  const budget       = spaceData?.budget ?? null;
  const isExpSpace   = (spaceData?.space_type ?? 'expense') === 'expense';
  const isAllCats    = selectedCategories.has('all');

  // ── Computed values ────────────────────────────────────────────────────────
  const range = activePreset === 'custom'
    ? { from: customFrom, to: customTo }
    : getRangeForPreset(activePreset, cutoffDay, rangeOffset);

  const isAll = selectedTabs.has('all');
  const currentTypes = isAll
    ? ['income','expense','debt','due']
    : ACTIVITY_TABS.filter(t => t.key !== 'all' && selectedTabs.has(t.key)).flatMap(t => [...t.types]);

  const filtered = recordings.filter(r => {
    if (!currentTypes.includes(r.type)) return false;
    // When Due tab is selected, only show is_due expenses
    if (!isAll && selectedTabs.has('receivables') && r.type === 'expense' && !r.is_due) return false;
    if (!isAllCats && !selectedCategories.has(r.category_id)) return false;
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date < range.from) return false;
    const to = new Date(range.to); to.setHours(23, 59, 59);
    return date <= to;
  });

  // Group filtered by date
  const grouped: { key: string; label: string; date: Date; items: any[] }[] = [];
  filtered.forEach(r => {
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const k = dateKey(date);
    const existing = grouped.find(g => g.key === k);
    if (existing) existing.items.push(r);
    else grouped.push({
      key:   k,
      label: smartDateLabel(r.transaction_date),
      date,
      items: [r],
    });
  });
  grouped.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Stats (all recordings, not date-filtered)
  const moneyIn  = recordings.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
  const moneyOut = recordings.filter(r => r.type === 'expense').reduce((s, r) => {
    const net = r.is_due ? Math.max(0, Number(r.amount) - Number(r.paid_amount ?? 0)) : Number(r.amount);
    return s + net;
  }, 0);
  const loansActive        = recordings.filter(r => r.type === 'debt' && r.status !== 'paid').length;
  const receivablesPending = recordings.filter(r =>
    (r.type === 'due' && r.status !== 'paid') ||
    (r.type === 'expense' && r.is_due && Number(r.paid_amount ?? 0) < Number(r.amount) - 0.01)
  ).length;
  const mainValue  = isExpSpace ? moneyOut : moneyIn;
  const pct        = budget ? Math.min(mainValue / budget, 1) : 0;
  const overBudget = isExpSpace && budget ? mainValue > budget : false;

  // Tab circle values
  const tabValue = (key: string) => {
    if (key === 'all')          return fmtAbbr(moneyIn + moneyOut);
    if (key === 'money-in')     return fmtAbbr(moneyIn);
    if (key === 'money-out')    return fmtAbbr(moneyOut);
    if (key === 'loans')        return String(loansActive);
    if (key === 'receivables')  return String(receivablesPending);
    return '';
  };

  // Range label
  const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtFull  = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rangeLabel = isSameDay(range.from, range.to)
    ? fmtFull(range.from)
    : `${fmtShort(range.from)} – ${fmtFull(range.to)}`;

  // Calendar helpers
  const firstDay    = new Date(pickerYear, pickerMonth, 1).getDay();
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  const isInRange = (day: number) => { const d = new Date(pickerYear, pickerMonth, day); return d > customFrom && d < customTo; };
  const isEdge    = (day: number) => { const d = new Date(pickerYear, pickerMonth, day); return isSameDay(d, customFrom) || isSameDay(d, customTo); };

  // ── Event handlers ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Push a history entry on web so minimize/restore keeps us here
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState(null, '', window.location.href);
    }
  }, []);

  // Prevent Chrome minimize/restore from popping back to spaces on web
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (typeof window !== 'undefined' && window.history) {
          window.history.pushState(null, '', window.location.href);
        }
      }
    };
    const onPopState = (e: PopStateEvent) => {
      // Re-push so the page doesn't navigate away on restore
      if (typeof window !== 'undefined' && document.visibilityState === 'hidden') {
        window.history.pushState(null, '', window.location.href);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useFocusEffect(useCallback(() => {
    if (!spaceId) return;
    queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
    setPendingFocusDate(null);
  }, [spaceId]));

  const confirmDelete = async () => {
    await supabase.from('recordings').delete().eq('id', pendingDeleteId);
    queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
    setConfirmModal(false);
  };

  const navigateRange = (dir: 1 | -1) => {
    if (activePreset === 'custom') {
      const days = Math.round((customTo.getTime() - customFrom.getTime()) / 86400000) + 1;
      const newFrom = new Date(customFrom); newFrom.setDate(newFrom.getDate() + dir * days);
      const newTo   = new Date(customTo);   newTo.setDate(newTo.getDate()   + dir * days);
      setCustomFrom(newFrom); setCustomTo(newTo);
    } else {
      setRangeOffset(o => o + dir);
    }
  };

  const applyPreset = (key: Preset) => {
    setRangeOffset(0);
    setActivePreset(key);
    if (key === 'custom') setPickingDate('from');
  };

  const handleDayPress = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    if (pickingDate === 'from') {
      setCustomFrom(d); setCustomTo(d); setPickingDate('to');
    } else {
      if (d < customFrom) setCustomFrom(d);
      else { setCustomTo(d); setActivePreset('custom'); }
      setPickingDate('from');
    }
  };

  const handleTabToggle = (key: ActivityTab) => {
    if (key === 'all') { setSelectedTabs(new Set(['all'])); return; }
    setSelectedTabs(prev => {
      const next = new Set(prev);
      next.delete('all');
      if (next.has(key)) { next.delete(key); if (next.size === 0) return new Set(['all']); }
      else { next.add(key); if (next.size === 4) return new Set(['all']); }
      return next;
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[{ flex: 1, backgroundColor: Colors.white }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{name}</Text>
          {spaceId !== 'all' && (
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => router.push({ pathname: '/(app)/add-recording', params: { spaceId, spaceName: name, defaultDate: new Date().toISOString().split('T')[0] } } as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Main scroll */}
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Tab circles — dashboard style */}
          <View style={s.tabRow}>
            {ACTIVITY_TABS.map(tab => {
              const isActive = selectedTabs.has(tab.key);
              return (
                <TouchableOpacity key={tab.key} style={s.tabWrap} onPress={() => handleTabToggle(tab.key)} activeOpacity={0.75}>
                  <View style={[s.tabCircle, isActive && s.tabCircleActive]}>
                    <Text style={[s.tabCircleValue, isActive && s.tabCircleValueActive]}>{tabValue(tab.key)}</Text>
                  </View>
                  <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Filter controls row */}
          <View style={s.filterControlsRow}>
            <View style={s.dateNavRow}>
              <TouchableOpacity style={s.dateNavArrow} onPress={() => navigateRange(-1)} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={14} color={Colors.cyan} />
              </TouchableOpacity>
              <TouchableOpacity style={s.filterBtn} onPress={() => setShowDateModal(true)} activeOpacity={0.75}>
                <Ionicons name="calendar-outline" size={13} color={Colors.cyan} />
                <Text style={s.filterBtnText}>{rangeLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dateNavArrow} onPress={() => navigateRange(1)} activeOpacity={0.7}>
                <Ionicons name="chevron-forward" size={14} color={Colors.cyan} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.filterBtn} onPress={() => setShowFilterModal(true)} activeOpacity={0.75}>
              <Ionicons name="options-outline" size={13} color={!isAllCats ? Colors.cyan : Colors.muted} />
              <Text style={[s.filterBtnText, !isAllCats && { color: Colors.cyan }]}>Filter</Text>
            </TouchableOpacity>
          </View>

          <View style={s.divider} />

          {/* Recordings section */}
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>recordings</Text>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Colors.cyan} style={{ marginTop: 24 }} />
          ) : filtered.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyText}>no recordings found for this period</Text>
            </View>
          ) : (
            grouped.map(group => (
              <View key={group.key}>
                <View style={s.dateHeaderRow}>
                  <Text style={s.dateHeaderText}>{group.label}</Text>
                </View>
                {group.items.map(item => {
                  const tl = getTypeLabel(item.type, item.status, item.is_due, item.paid_amount, item.amount);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={s.row}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                      onLongPress={() => { setPendingDeleteId(item.id); setPendingDeleteName(item.name); setConfirmModal(true); }}
                    >
                      <View style={s.rowIconWrap}>
                        <Ionicons name={(item.categories?.icon ?? 'ellipse-outline') as any} size={18} color={Colors.cyan} />
                      </View>
                      <View style={s.rowMid}>
                        <Text style={s.rowType}>{tl.label}</Text>
                        <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                      </View>
                      <Text style={[s.rowAmount, { color: tl.color }]}>
                        {item.is_due
                          ? Math.max(0, Number(item.amount) - Number(item.paid_amount ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })
                          : fmtAmount(Number(item.amount))}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Date modal */}
      <BottomSheet visible={showDateModal} onClose={() => setShowDateModal(false)} title="date range" height={MODAL_HEIGHT}>
        <View style={s.chipRow}>
          {PRESETS.map(p => {
            const active = p.key === activePreset;
            return (
              <TouchableOpacity key={p.key} style={[s.chip, active && s.chipActive]} onPress={() => applyPreset(p.key)} activeOpacity={0.75}>
                <Ionicons name={p.icon as any} size={13} color={active ? Colors.white : Colors.muted} />
                <Text style={[s.chipText, active && s.chipTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activePreset === 'cutoff' && (
          <View style={{ marginBottom: 16 }}>
            <Text style={s.modalLabel}>billing cycle starts on day</Text>
            <View style={s.chipRow}>
              {[1,5,10,15,20,25,28].map(d => (
                <TouchableOpacity key={d} style={[s.chip, parseInt(cutoffInput) === d && s.chipActive]} onPress={() => { setCutoffInput(String(d)); setCutoffDay(d); }}>
                  <Text style={[s.chipText, parseInt(cutoffInput) === d && s.chipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {activePreset === 'custom' && (
          <View style={s.calWrap}>
            <Text style={s.calHint}>{pickingDate === 'from' ? 'tap start date' : 'tap end date'}</Text>
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
              {['su','mo','tu','we','th','fr','sa'].map(d => <Text key={d} style={s.calDay}>{d}</Text>)}
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

      {/* Filter modal */}
      <BottomSheet visible={showFilterModal} onClose={() => setShowFilterModal(false)} title="filter" height={MODAL_HEIGHT}>
        <TouchableOpacity style={s.clearBtn} onPress={() => setSelectedCategories(new Set(['all']))} activeOpacity={0.75}>
          <Text style={s.clearBtnText}>Clear Filters</Text>
        </TouchableOpacity>
        <Text style={s.sectionLabel}>Categories</Text>
        <View style={s.chipRow}>
          <TouchableOpacity style={[s.chip, isAllCats && s.chipActive]} onPress={() => setSelectedCategories(new Set(['all']))} activeOpacity={0.75}>
            <Text style={[s.chipText, isAllCats && s.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat: any) => {
            const active = selectedCategories.has(cat.id);
            return (
              <TouchableOpacity key={cat.id} style={[s.chip, active && s.chipActive]} onPress={() => {
                setSelectedCategories(prev => {
                  const next = new Set(prev); next.delete('all');
                  if (next.has(cat.id)) { next.delete(cat.id); if (next.size === 0) return new Set(['all']); }
                  else next.add(cat.id);
                  return next;
                });
              }} activeOpacity={0.75}>
                <Text style={[s.chipText, active && s.chipTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      {/* Delete confirm */}
      <ConfirmModal
        visible={confirmModal}
        onClose={() => setConfirmModal(false)}
        title="delete recording"
        message={`Delete "${pendingDeleteName}"?`}
        actions={[
          { label: 'cancel', onPress: () => setConfirmModal(false), muted: true },
          { label: 'delete', onPress: confirmDelete, destructive: true },
        ]}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // Header
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 16, paddingBottom: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  title:   { flex: 1, fontFamily: Brand.font.display, fontSize: 20, color: Colors.text, letterSpacing: -0.3 },
  addBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.cyan, alignItems: 'center', justifyContent: 'center' },

  // Scroll
  scroll: { paddingHorizontal: 25, paddingBottom: 80 },
  divider: { height: 8, backgroundColor: Colors.surface, marginHorizontal: -25, marginVertical: 8 },

  // Section row (recordings only)
  sectionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 8 },
  sectionHeader: { ...Brand.type.sectionHeader },

  // Filter controls row
  filterControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 16, paddingBottom: 4 },
  filterRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateNavRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateNavArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  filterBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderMid },
  filterBtnText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.text },

  // Tab circles — dashboard style
  tabRow:               { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 4 },
  tabWrap:              { flex: 1, alignItems: 'center' },
  tabCircle:            { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  tabCircleActive:      { backgroundColor: Colors.cyan },
  tabCircleValue:       { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, letterSpacing: -0.3 },
  tabCircleValueActive: { color: Colors.white },
  tabLabel:             { fontFamily: Fonts.mono,     fontSize: 9,  color: Colors.muted, marginTop: 5, letterSpacing: 0.2 },
  tabLabelActive:       { fontFamily: Fonts.monoBold, fontSize: 9,  color: Colors.cyan },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { ...Brand.type.emptyText },

  // Date groups
  dateHeaderRow:  { marginTop: 12, marginBottom: 6, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  dateHeaderText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, letterSpacing: 1.4, textTransform: 'uppercase' },

  // Recording row
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIconWrap: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  rowMid:      { flex: 1, gap: 2 },
  rowType:     { fontFamily: Fonts.mono,     fontSize: 10, color: Colors.muted, letterSpacing: 0.4, textTransform: 'uppercase' },
  rowName:     { ...Brand.type.cardTitle },
  rowAmount:   { fontFamily: Fonts.monoBold, fontSize: 14, letterSpacing: -0.3 },

  // Modal chips
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  chipActive:     { backgroundColor: Colors.cyan },
  chipText:       { fontFamily: Fonts.mono,     fontSize: 12, color: Colors.muted },
  chipTextActive: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.white },
  modalLabel:     { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, marginBottom: 10 },
  sectionLabel:   { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  clearBtn:       { alignSelf: 'flex-end', marginBottom: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  clearBtnText:   { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.cyan },

  // Calendar
  calWrap:         { width: '100%' },
  calHint:         { fontFamily: Fonts.mono, fontSize: 11, color: Colors.cyan, marginBottom: 10 },
  pickerNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4, marginBottom: 10 },
  pickerMonthText: { fontFamily: Fonts.monoBold, fontSize: 15, color: Colors.text },
  calDay:          { flex: 1, textAlign: 'center', fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  calCell:         { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellRange:    { backgroundColor: Colors.cyan + '55', borderRadius: 0 },
  calCellEdge:     { backgroundColor: Colors.cyan },
  calCellToday:    { backgroundColor: Colors.surface },
  calCellText:     { fontFamily: Fonts.mono,     fontSize: 13, color: Colors.text },
  calCellTextActive: { fontFamily: Fonts.monoBold, color: Colors.text },
});
