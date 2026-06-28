import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import ConfirmModal from '@/components/ui/ConfirmModal';
import BottomSheet from '@/components/ui/BottomSheet';

// ── Module-level pending focus date ─────────────────────────────────────────
export let pendingFocusDate: string | null = null;
export function setPendingFocusDate(date: string | null) { pendingFocusDate = date; }

// ── Constants ────────────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');

const BG    = '#F7F8FA';
const CARD  = '#FFFFFF';
const TEAL  = '#4ECDC4';
const TEALL = '#E0F5F4';
const TEALD = '#38B2AC';
const PEACH = '#FFAB91';
const TEXT  = '#1A1A2E';
const SEC   = '#9A9DB0';
const BOR   = '#ECECEC';
const R  = 'PlusJakartaSans_400Regular';
const M  = 'PlusJakartaSans_500Medium';
const SB = 'PlusJakartaSans_600SemiBold';
const B  = 'PlusJakartaSans_700Bold';

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
  { key: 'all',         label: 'All',         types: ['income','return','savings','expense','payment','transfer','payable','receivable'] },
  { key: 'money-in',    label: 'Money In',    types: ['income','return','savings'] },
  { key: 'money-out',   label: 'Money Out',   types: ['expense','payment','transfer'] },
  { key: 'loans',       label: 'Loans',       types: ['payable'] },
  { key: 'receivables', label: 'Receivables', types: ['receivable'] },
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

function getTypeLabel(type: string, status: string) {
  if (type === 'income')     return { label: 'income',    color: TEALD };
  if (type === 'savings')    return { label: 'savings',   color: TEALD };
  if (type === 'return')     return { label: 'return',    color: TEALD };
  if (type === 'expense')    return { label: 'expense',   color: PEACH };
  if (type === 'payment')    return { label: 'payment',   color: PEACH };
  if (type === 'transfer')   return { label: 'transfer',  color: PEACH };
  if (type === 'payable')    return status === 'paid'
    ? { label: 'loan · paid', color: TEALD }
    : { label: 'loan',        color: PEACH };
  if (type === 'receivable') return status === 'received'
    ? { label: 'receivable · received', color: TEALD }
    : { label: 'receivable',            color: TEALD };
  return { label: type, color: SEC };
}

// ── Component ────────────────────────────────────────────────────────────────
export default function SpaceDetailScreen() {
  const { spaceId, name } = useLocalSearchParams<{ spaceId: string; name: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useUser();

  // Slide animation
  const slideAnim = useRef(new Animated.Value(width)).current;

  // Menu hide/show on scroll
  const menuAnim    = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);

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
      const query = supabase
        .from('recordings')
        .select('*, categories:category_id(name,color,icon)');
      if (spaceId === 'all') {
        if (!userId) return [];
        const { data } = await query.eq('user_id', userId).order('transaction_date', { ascending: false });
        return data ?? [];
      }
      const { data } = await query.eq('space_id', spaceId).order('transaction_date', { ascending: false });
      return data ?? [];
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
    ? ['income','return','savings','expense','payment','transfer','payable','receivable']
    : ACTIVITY_TABS.filter(t => t.key !== 'all' && selectedTabs.has(t.key)).flatMap(t => [...t.types]);

  const filtered = recordings.filter(r => {
    if (!currentTypes.includes(r.type)) return false;
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
      label: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      date,
      items: [r],
    });
  });
  grouped.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Stats (all recordings, not date-filtered)
  const moneyIn  = recordings.filter(r => ['income','savings','return'].includes(r.type)).reduce((s, r) => s + Number(r.amount), 0);
  const moneyOut = recordings.filter(r => ['expense','payment','transfer'].includes(r.type)).reduce((s, r) => s + Number(r.amount), 0);
  const loansActive        = recordings.filter(r => r.type === 'payable'    && r.status !== 'paid').length;
  const receivablesPending = recordings.filter(r => r.type === 'receivable' && r.status !== 'received').length;
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
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
  }, []);

  useFocusEffect(useCallback(() => {
    if (!spaceId) return;
    queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
    setPendingFocusDate(null);
  }, [spaceId]));

  const onScroll = (e: any) => {
    const y    = e.nativeEvent.contentOffset.y;
    const diff = y - lastScrollY.current;
    if (diff > 6 && y > 30)
      Animated.timing(menuAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    else if (diff < -6)
      Animated.timing(menuAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    lastScrollY.current = y;
  };

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

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
    <Animated.View style={[{ flex: 1, backgroundColor: BG }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color={SEC} />
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

        {/* Stats card */}
        <View style={s.statsCard}>
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statValue}>{fmtAbbr(moneyIn)}</Text>
              <Text style={s.statLabel}>Money In</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={[s.statValue, { color: PEACH }]}>{fmtAbbr(moneyOut)}</Text>
              <Text style={s.statLabel}>Money Out</Text>
            </View>
            {budget && (
              <>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: overBudget ? PEACH : TEAL }]}>{fmtAbbr(Math.abs(budget - mainValue))}</Text>
                  <Text style={s.statLabel}>{overBudget ? 'Over' : 'Left'}</Text>
                </View>
              </>
            )}
          </View>
          {budget && (
            <View style={s.budgetTrack}>
              <View style={[s.budgetFill, { width: `${pct * 100}%` as any, backgroundColor: overBudget ? PEACH : TEAL }]} />
            </View>
          )}
        </View>

        {/* Sheet with floating menu */}
        <View style={{ flex: 1 }}>

          {/* Sticky menu card */}
          <Animated.View style={[s.menuCard, {
            opacity: menuAnim,
            transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-220, 0] }) }],
          }]}>
            {/* Tab circles */}
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

            {/* Filter row: date nav + filter button */}
            <View style={s.filterRow}>
              <View style={s.dateNavRow}>
                <TouchableOpacity style={s.dateNavArrow} onPress={() => navigateRange(-1)} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={14} color={TEALD} />
                </TouchableOpacity>
                <TouchableOpacity style={s.filterBtn} onPress={() => setShowDateModal(true)} activeOpacity={0.75}>
                  <Ionicons name="calendar-outline" size={13} color={TEALD} />
                  <Text style={s.filterBtnText}>{rangeLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.dateNavArrow} onPress={() => navigateRange(1)} activeOpacity={0.7}>
                  <Ionicons name="chevron-forward" size={14} color={TEALD} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={s.filterBtn} onPress={() => setShowFilterModal(true)} activeOpacity={0.75}>
                <Ionicons name="options-outline" size={13} color={!isAllCats ? TEAL : SEC} />
                <Text style={[s.filterBtnText, !isAllCats && { color: TEALD }]}>Filter</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Recordings */}
          {isLoading ? (
            <ActivityIndicator color={TEAL} style={{ marginTop: 48 }} />
          ) : filtered.length === 0 ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={28} color="#fff" />
              </View>
              <Text style={s.emptyTitle}>nothing here</Text>
              <Text style={s.emptyText}>no recordings found{'\n'}for this period</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
            >
              {grouped.map(group => (
                <View key={group.key}>
                  <View style={s.dateHeaderRow}>
                    <Text style={s.dateHeaderText}>{group.label}</Text>
                  </View>
                  {group.items.map(item => {
                    const tl = getTypeLabel(item.type, item.status);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={s.row}
                        activeOpacity={0.85}
                        onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                        onLongPress={() => { setPendingDeleteId(item.id); setPendingDeleteName(item.name); setConfirmModal(true); }}
                      >
                        <View style={s.rowIconWrap}>
                          <Ionicons name={(item.categories?.icon ?? 'ellipse-outline') as any} size={18} color={TEALD} />
                        </View>
                        <View style={s.rowMid}>
                          <Text style={s.rowType}>{tl.label}</Text>
                          <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                        </View>
                        <Text style={[s.rowAmount, { color: tl.color }]}>
                          {fmtAmount(Number(item.amount))}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
              <View style={{ height: 80 }} />
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      {/* Date modal */}
      <BottomSheet visible={showDateModal} onClose={() => setShowDateModal(false)} title="date range" height={MODAL_HEIGHT}>
        <View style={s.chipRow}>
          {PRESETS.map(p => {
            const active = p.key === activePreset;
            return (
              <TouchableOpacity key={p.key} style={[s.chip, active && s.chipActive]} onPress={() => applyPreset(p.key)} activeOpacity={0.75}>
                <Ionicons name={p.icon as any} size={13} color={active ? '#fff' : SEC} />
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
                <Ionicons name="chevron-back" size={18} color={TEXT} />
              </TouchableOpacity>
              <Text style={s.pickerMonthText}>{MONTHS[pickerMonth].toLowerCase()} {pickerYear}</Text>
              <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}>
                <Ionicons name="chevron-forward" size={18} color={TEXT} />
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
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  title:   { flex: 1, fontFamily: B, fontSize: 28, color: TEXT, letterSpacing: -0.8 },
  addBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },

  // Stats card
  statsCard:   { marginHorizontal: 16, backgroundColor: CARD, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 20, marginBottom: 10, gap: 12 },
  statsRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statItem:    { flex: 1, alignItems: 'center', gap: 4 },
  statValue:   { fontFamily: B,  fontSize: 16, color: TEXT, letterSpacing: -0.4 },
  statLabel:   { fontFamily: R,  fontSize: 10, color: SEC,  letterSpacing: 0.2 },
  statDivider: { width: 1, height: 28, backgroundColor: BOR },
  budgetTrack: { height: 4, backgroundColor: BOR, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  budgetFill:  { height: 4, borderRadius: 2 },

  // Menu card
  menuCard: {
    position: 'absolute', top: 0, left: 16, right: 16, zIndex: 10,
    backgroundColor: CARD, borderRadius: 20,
    paddingTop: 12, paddingBottom: 8, gap: 8,
  },

  // Tab circles
  tabRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 4 },
  tabWrap: { flex: 1, alignItems: 'center' },
  tabCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: TEALL },
  tabCircleActive:      { backgroundColor: TEAL },
  tabCircleValue:       { fontFamily: B, fontSize: 11, color: SEC,     letterSpacing: -0.3 },
  tabCircleValueActive: { fontFamily: B, fontSize: 11, color: '#FFFFFF' },
  tabLabel:       { fontFamily: R,  fontSize: 9, color: SEC,  marginTop: 5, letterSpacing: 0.2 },
  tabLabelActive: { fontFamily: SB, fontSize: 9, color: TEAL },

  // Filter row
  filterRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  dateNavRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateNavArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: TEALL },
  filterBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: CARD, borderWidth: 1, borderColor: BOR },
  filterBtnText: { fontFamily: M, fontSize: 11, color: TEXT },

  // Empty state
  emptyWrap:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingBottom: 80 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  emptyTitle:    { fontFamily: SB, fontSize: 16, color: TEXT },
  emptyText:     { fontFamily: M,  fontSize: 13, color: SEC, textAlign: 'center', lineHeight: 21 },

  // List
  list:           { paddingHorizontal: 16, paddingTop: 155, paddingBottom: 20, gap: 12 },
  dateHeaderRow:  { marginTop: 16, marginBottom: 8, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: BOR, paddingTop: 16 },
  dateHeaderText: { fontFamily: SB, fontSize: 10, color: SEC, letterSpacing: 1.4, textTransform: 'uppercase' },

  // Recording row
  row:       { backgroundColor: CARD, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  rowIconWrap: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', backgroundColor: TEALL },
  rowMid:    { flex: 1, gap: 2 },
  rowType:   { fontFamily: M,  fontSize: 10, color: SEC,  letterSpacing: 0.4, textTransform: 'uppercase' },
  rowName:   { fontFamily: SB, fontSize: 14, color: TEXT, letterSpacing: 0.1, lineHeight: 20 },
  rowAmount: { fontFamily: B,  fontSize: 15, letterSpacing: -0.4 },

  // Modal chips
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: BG },
  chipActive:   { backgroundColor: TEAL },
  chipText:     { fontFamily: M,  fontSize: 12, color: SEC  },
  chipTextActive: { fontFamily: SB, fontSize: 12, color: '#fff' },
  modalLabel:   { fontFamily: M, fontSize: 12, color: SEC, marginBottom: 10 },
  sectionLabel: { fontFamily: SB, fontSize: 11, color: SEC, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  clearBtn:     { alignSelf: 'flex-end', marginBottom: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: TEALL },
  clearBtnText: { fontFamily: SB, fontSize: 12, color: TEALD },

  // Calendar
  calWrap:    { width: '100%' },
  calHint:    { fontFamily: R, fontSize: 11, color: TEALD, marginBottom: 10 },
  pickerNav:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4, marginBottom: 10 },
  pickerMonthText: { fontFamily: SB, fontSize: 15, color: TEXT },
  calDay:     { flex: 1, textAlign: 'center', fontFamily: R, fontSize: 10, color: SEC },
  calCell:    { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  calCellRange:  { backgroundColor: TEAL + '55', borderRadius: 0 },
  calCellEdge:   { backgroundColor: TEAL },
  calCellToday:  { backgroundColor: BG },
  calCellText:   { fontFamily: R,  fontSize: 13, color: TEXT },
  calCellTextActive: { fontFamily: SB, color: TEXT },
});
