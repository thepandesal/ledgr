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

export let pendingFocusDate: string | null = null;
export function setPendingFocusDate(date: string | null) { pendingFocusDate = date; }

const { width } = Dimensions.get('window');

const BG    = '#F7F8FA';
const CARD  = '#FFFFFF';
const TEAL  = '#4ECDC4';
const TEALL = '#E0F5F4';
const PEACH = '#FFAB91';
const TEXT  = '#1A1A2E';
const SEC   = '#9A9DB0';
const BOR   = '#ECECEC';
const TEALD = '#38B2AC';
const R  = 'PlusJakartaSans_400Regular';
const M  = 'PlusJakartaSans_500Medium';
const SB = 'PlusJakartaSans_600SemiBold';
const B  = 'PlusJakartaSans_700Bold';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
type Preset = 'this-month' | 'last-30' | 'cutoff' | 'custom';
const PRESETS: { key: Preset; label: string; icon: string }[] = [
  { key: 'this-month', label: 'This Month', icon: 'calendar-outline' },
  { key: 'last-30',    label: 'Last 30d',   icon: 'time-outline'     },
  { key: 'cutoff',     label: 'Cutoff',     icon: 'cut-outline'      },
  { key: 'custom',     label: 'Custom',     icon: 'options-outline'  },
];

function getRangeForPreset(preset: Preset, cutoffDay: number, offset = 0): { from: Date; to: Date } {
  const now = new Date();
  if (preset === 'this-month') {
    return { from: new Date(now.getFullYear(), now.getMonth() + offset, 1), to: new Date(now.getFullYear(), now.getMonth() + offset + 1, 0) };
  }
  if (preset === 'last-30') {
    const base = new Date(now); base.setDate(now.getDate() + offset * 30);
    const from = new Date(base); from.setDate(base.getDate() - 30);
    return { from, to: base };
  }
  if (preset === 'cutoff') {
    const day = cutoffDay;
    const baseMonth = now.getDate() >= day ? now.getMonth() : now.getMonth() - 1;
    const from = new Date(now.getFullYear(), baseMonth + offset, day);
    const to   = new Date(now.getFullYear(), baseMonth + offset + 1, day - 1);
    return { from, to };
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}

const ACTIVITY_TABS = [
  { key: 'all',         label: 'All',         types: ['income','return','savings','expense','payment','transfer','payable','receivable'] },
  { key: 'money-in',    label: 'Money In',    types: ['income','return','savings'] },
  { key: 'money-out',   label: 'Money Out',   types: ['expense','payment','transfer'] },
  { key: 'loans',       label: 'Loans',       types: ['payable'] },
  { key: 'receivables', label: 'Receivables', types: ['receivable'] },
] as const;
type ActivityTab = typeof ACTIVITY_TABS[number]['key'];

function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function dateKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

function typeLabel(type: string, status: string) {
  if (type === 'income')     return { label: 'income',    color: TEAL  };
  if (type === 'savings')    return { label: 'savings',   color: TEAL  };
  if (type === 'return')     return { label: 'return',    color: TEAL  };
  if (type === 'expense')    return { label: 'expense',   color: PEACH };
  if (type === 'payment')    return { label: 'payment',   color: PEACH };
  if (type === 'transfer')   return { label: 'transfer',  color: PEACH };
  if (type === 'payable')    return status === 'paid'
    ? { label: 'loan · paid',    color: TEAL  }
    : { label: 'loan',           color: PEACH };
  if (type === 'receivable') return status === 'received'
    ? { label: 'receivable · received', color: TEAL  }
    : { label: 'receivable',            color: TEAL  };
  return { label: type, color: SEC };
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function SpaceDetailScreen() {
  const { spaceId, name } = useLocalSearchParams<{ spaceId: string; name: string; color: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;
  const queryClient = useQueryClient();
  const { userId } = useUser();

  const [activePreset, setActivePreset] = useState<Preset>('this-month');
  const [rangeOffset,  setRangeOffset]  = useState(0);
  const [cutoffDay,    setCutoffDay]    = useState(25);
  const [cutoffInput,  setCutoffInput]  = useState('25');
  const [customFrom,   setCustomFrom]   = useState<Date>(new Date());
  const [customTo,     setCustomTo]     = useState<Date>(new Date());
  const [showDateModal, setShowDateModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [pickingDate,  setPickingDate]  = useState<'from' | 'to'>('from');
  const [pickerMonth,  setPickerMonth]  = useState(new Date().getMonth());
  const [pickerYear,   setPickerYear]   = useState(new Date().getFullYear());

  const range = activePreset === 'custom'
    ? { from: customFrom, to: customTo }
    : getRangeForPreset(activePreset, cutoffDay, rangeOffset);
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [pendingDeleteName, setPendingDeleteName] = useState('');
  const [selectedTabs, setSelectedTabs] = useState<Set<ActivityTab>>(new Set(['all']));
  const menuAnim   = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const MENU_HEIGHT = 200;

  const onScroll = (e: any) => {
    const y    = e.nativeEvent.contentOffset.y;
    const diff = y - lastScrollY.current;
    if (diff > 6 && y > 30)
      Animated.timing(menuAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    else if (diff < -6)
      Animated.timing(menuAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    lastScrollY.current = y;
  };

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['recordings', spaceId, userId],
    queryFn: async () => {
      const query = supabase.from('recordings')
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
      const { data } = await supabase.from('spaces').select('budget, space_type').eq('id', spaceId).single();
      return data;
    },
    enabled: !!spaceId && spaceId !== 'all',
  });

  const budget = spaceData?.budget ?? null;
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', userId],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id,name').eq('user_id', userId).order('created_at');
      return data ?? [];
    },
    enabled: !!userId,
  });

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['all']));
  const isAllCategories = selectedCategories.has('all');
  const isExpenseSpace = (spaceData?.space_type ?? 'expense') === 'expense';

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
  }, []);

  useFocusEffect(useCallback(() => {
    if (!spaceId) return;
    queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
    if (pendingFocusDate) {
      const parts = pendingFocusDate.split('-');
      setSelectedDate(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      setPendingFocusDate(null);
    }
  }, [spaceId]));

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  const confirmDelete = async () => {
    await supabase.from('recordings').delete().eq('id', pendingDeleteId);
    queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
    setConfirmModal(false);
  };

  const isAll = selectedTabs.has('all');
  const currentTypes = isAll
    ? ['income','return','savings','expense','payment','transfer','payable','receivable']
    : ACTIVITY_TABS.filter(t => t.key !== 'all' && selectedTabs.has(t.key)).flatMap(t => [...t.types]);

  const filtered = recordings.filter(r => {
    if (!currentTypes.includes(r.type)) return false;
    if (!isAllCategories && !selectedCategories.has(r.category_id)) return false;
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date < range.from) return false;
    const to = new Date(range.to); to.setHours(23, 59, 59);
    return date <= to;
  });

  // Group by date
  const grouped: { key: string; label: string; date: Date; items: any[] }[] = [];
  filtered.forEach(r => {
    const parts = r.transaction_date.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const k = dateKey(d);
    const existing = grouped.find(g => g.key === k);
    if (existing) existing.items.push(r);
    else grouped.push({
      key: k,
      label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      date: d,
      items: [r],
    });
  });
  grouped.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Stats
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
  const isEdge = (day: number) => { const d = new Date(pickerYear, pickerMonth, day); return isSameDay(d, customFrom) || isSameDay(d, customTo); };
  const handleDayPress = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    if (pickingDate === 'from') { setCustomFrom(d); setCustomTo(d); setPickingDate('to'); }
    else { if (d < customFrom) { setCustomFrom(d); } else { setCustomTo(d); setActivePreset('custom'); } setPickingDate('from'); }
  };

  const moneyIn  = recordings.filter(r => ['income','savings','return'].includes(r.type)).reduce((s, r) => s + Number(r.amount), 0);
  const moneyOut = recordings.filter(r => ['expense','payment','transfer'].includes(r.type)).reduce((s, r) => s + Number(r.amount), 0);
  const mainValue = isExpenseSpace ? moneyOut : moneyIn;
  const pct = budget ? Math.min(mainValue / budget, 1) : 0;
  const overBudget = isExpenseSpace && budget ? mainValue > budget : false;

  const navigateRange = (dir: 1 | -1) => {
    if (activePreset === 'custom') {
      const days = Math.round((customTo.getTime() - customFrom.getTime()) / 86400000) + 1;
      const newFrom = new Date(customFrom); newFrom.setDate(newFrom.getDate() + dir * days);
      const newTo   = new Date(customTo);   newTo.setDate(newTo.getDate() + dir * days);
      setCustomFrom(newFrom); setCustomTo(newTo); setActivePreset('custom');
    } else {
      setRangeOffset(o => o + dir);
    }
  };

  const applyPreset = (key: Preset) => {
    setRangeOffset(0);
    setActivePreset(key);
    if (key === 'custom') setPickingDate('from');
  };

  const fmtAbbr = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

    ? fmtFull(range.from)
    : `${fmtShort(range.from)} – ${fmtFull(range.to)}`;

  // Calendar helpers
  const handleDayPress = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    if (pickingDate === 'from') { setCustomFrom(d); setCustomTo(d); setPickingDate('to'); }
    else { if (d < customFrom) { setCustomFrom(d); } else { setCustomTo(d); setActivePreset('custom'); } setPickingDate('from'); }
  };

  const loansActive = recordings.filter(r => r.type === 'payable' && r.status !== 'paid').length;
  const receivablesPending = recordings.filter(r => r.type === 'receivable' && r.status !== 'received').length;

  const tabValue = (key: string) => {
    if (key === 'all')          return fmtAbbr(moneyIn + moneyOut);
    if (key === 'money-in')    return fmtAbbr(moneyIn);
    if (key === 'money-out')   return fmtAbbr(moneyOut);
    if (key === 'loans')       return String(loansActive);
    if (key === 'receivables') return String(receivablesPending);
    return '';
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
              onPress={() => router.push({ pathname: '/(app)/add-recording', params: { spaceId, spaceName: name, defaultDate: selectedDate.toISOString().split('T')[0] } } as any)}
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
              <Text style={s.statValue}>{fmt(moneyIn)}</Text>
              <Text style={s.statLabel}>Money In</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={[s.statValue, { color: PEACH }]}>{fmt(moneyOut)}</Text>
              <Text style={s.statLabel}>Money Out</Text>
            </View>
            {budget && (
              <>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: overBudget ? PEACH : TEAL }]}>{fmt(Math.abs(budget - mainValue))}</Text>
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

        {/* Sheet: sticky menu floats over list */}
        <View style={{ flex: 1 }}>

          {/* Sticky floating menu */}
          <Animated.View style={[s.menuCard, {
            opacity: menuAnim,
            transform: [{ translateY: menuAnim.interpolate({ inputRange: [0,1], outputRange: [-220, 0] }) }],
          }]}>
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
                <Ionicons name="options-outline" size={13} color={SEC} />
                <Text style={s.filterBtnText}>Filter</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Recordings */}
          {isLoading ? (
            <ActivityIndicator color={TEAL} style={{ marginTop: 48 }} />
          ) : filtered.length === 0 ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="receipt-outline" size={28} color={TEXT} />
              </View>
              <Text style={s.emptyTitle}>nothing here</Text>
              <Text style={s.emptyText}>no recordings found{`\n`}for this period</Text>
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
                    const tl = typeLabel(item.type, item.status);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={s.row}
                        activeOpacity={0.85}
                        onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                        onLongPress={() => { setPendingDeleteId(item.id); setPendingDeleteName(item.name); setConfirmModal(true); }}
                      >
                        <View style={s.rowIcon}>
                          <Ionicons name={(item.categories?.icon ?? 'ellipse-outline') as any} size={18} color={TEALD} />
                        </View>
                        <View style={s.rowMid}>
                          <Text style={s.rowType}>{tl.label}</Text>
                          <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                          {item.space?.name ? <Text style={s.rowSpace}>{item.space.name}</Text> : null}
                        </View>
                        <Text style={[s.rowAmount, { color: tl.color }]}>
                          {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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


      {/* ── Date modal ── */}
      <BottomSheet visible={showDateModal} onClose={() => setShowDateModal(false)} title="date range" height="50%">
        <View style={s.modalPresetRow}>
          {PRESETS.map(p => {
            const active = p.key === activePreset;
            return (
              <TouchableOpacity
                key={p.key}
                style={[s.modalChip, active && s.modalChipActive]}
                onPress={() => applyPreset(p.key)}
                activeOpacity={0.75}
              >
                <Ionicons name={p.icon as any} size={13} color={active ? TEXT : SEC} />
                <Text style={[s.modalChipText, active && s.modalChipTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {activePreset === 'cutoff' && (
          <View style={{ marginBottom: 16 }}>
            <Text style={s.modalLabel}>billing cycle starts on day</Text>
            <View style={s.modalChipRow}>
              {[1,5,10,15,20,25,28].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.modalChip, parseInt(cutoffInput) === d && s.modalChipActive]}
                  onPress={() => { setCutoffInput(String(d)); setCutoffDay(d); setActivePreset('cutoff'); }}
                >
                  <Text style={[s.modalChipText, parseInt(cutoffInput) === d && s.modalChipTextActive]}>{d}</Text>
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
      <BottomSheet visible={showFilterModal} onClose={() => setShowFilterModal(false)} title="filter" height="50%">
        <TouchableOpacity
          style={s.clearBtn}
          onPress={() => { setSelectedCategories(new Set(['all'])); }}
          activeOpacity={0.75}
        >
          <Text style={s.clearBtnText}>Clear Filters</Text>
        </TouchableOpacity>
        <Text style={s.filterSectionLabel}>Categories</Text>
        <View style={s.chipRow}>
          <TouchableOpacity style={[s.modalChip, isAllCategories && s.modalChipActive]} onPress={() => setSelectedCategories(new Set(['all']))} activeOpacity={0.75}>
            <Text style={[s.modalChipText, isAllCategories && s.modalChipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat: any) => {
            const active = selectedCategories.has(cat.id);
            return (
              <TouchableOpacity key={cat.id} style={[s.modalChip, active && s.modalChipActive]} onPress={() => {
                setSelectedCategories(prev => {
                  const next = new Set(prev); next.delete('all');
                  if (next.has(cat.id)) { next.delete(cat.id); if (next.size === 0) return new Set(['all']); }
                  else next.add(cat.id);
                  return next;
                });
              }} activeOpacity={0.75}>
                <Text style={[s.modalChipText, active && s.modalChipTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

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
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  title:   { flex: 1, fontFamily: B, fontSize: 28, color: TEXT, letterSpacing: -0.8 },
  addBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },

  statsCard: { marginHorizontal: 16, backgroundColor: CARD, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 20, marginBottom: 10, gap: 12 },
  statsRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statItem:  { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: TEXT, letterSpacing: -0.4 },
  statLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, color: SEC, letterSpacing: 0.2 },
  statDivider: { width: 1, height: 28, backgroundColor: '#ECECEC' },
  budgetTrack: { height: 4, backgroundColor: '#ECECEC', borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  budgetFill:  { height: 4, borderRadius: 2 },

  tabRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 4 },
  tabWrap: { flex: 1, alignItems: 'center' },
  tabCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: TEALL, gap: 2 },
  tabCircleActive:      { backgroundColor: TEAL },
  tabCircleValue:       { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: SEC, letterSpacing: -0.3 },
  tabCircleValueActive: { color: '#FFFFFF' },
  tabLabel:       { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9, color: SEC, marginTop: 5, letterSpacing: 0.2 },
  tabLabelActive: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 9, color: TEAL },
  filterRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  dateNavRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateNavArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: TEALL },
  filterBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: CARD, borderWidth: 1, borderColor: BOR },
  filterBtnText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: TEXT },
  modalPresetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  modalChipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#F7F8FA' },
  modalChipActive: { backgroundColor: TEAL },
  modalChipText:  { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: SEC },
  modalChipTextActive: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: TEXT },
  modalLabel:     { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: SEC, marginBottom: 10 },
  calWrap:    { width: '100%' },
  calHint:    { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: TEALD, marginBottom: 10 },
  pickerNav:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4, marginBottom: 10 },
  pickerMonthText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: TEXT },
  calDay:     { flex: 1, textAlign: 'center', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, color: SEC },
  calCell:    { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  calCellRange: { backgroundColor: TEAL + '55', borderRadius: 0 },
  calCellEdge:  { backgroundColor: TEAL },
  calCellToday: { backgroundColor: '#F7F8FA' },
  calCellText:  { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: TEXT },
  calCellTextActive: { fontFamily: 'PlusJakartaSans_600SemiBold', color: TEXT },
  filterSectionLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: SEC, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 16 },
  clearBtn:   { alignSelf: 'flex-end', marginBottom: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: TEALL },
  clearBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: TEALD },
  menuCard: {
    position: 'absolute', top: 0, left: 16, right: 16, zIndex: 10,
    backgroundColor: CARD, borderRadius: 20,
    paddingTop: 12, paddingBottom: 10, gap: 8,
  },
  modeRow:  { flexDirection: 'row', gap: 8 },
  modeBtn:  { flex: 1, paddingVertical: 8, borderRadius: 999, backgroundColor: CARD, alignItems: 'center' },
  modeBtnActive:    { backgroundColor: TEAL },
  modeBtnText:      { fontFamily: M,  fontSize: 12, color: SEC  },
  modeBtnTextActive: { fontFamily: SB, fontSize: 12, color: '#fff' },
  dateNav:      { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 16, paddingVertical: 10 },
  navArrow:     { paddingHorizontal: 14 },
  dateNavLabel: { flex: 1, textAlign: 'center', fontFamily: SB, fontSize: 13, color: TEXT },

  emptyWrap:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingBottom: 80 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  emptyTitle:    { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 16, color: TEXT },
  emptyText:  { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: SEC, textAlign: 'center', lineHeight: 21, letterSpacing: 0.2 },

  list: { paddingHorizontal: 16, paddingTop: 210, gap: 8 },
  dateHeaderRow:  { paddingTop: 16, paddingBottom: 8, borderTopWidth: 1, borderTopColor: BOR, marginTop: 8 },
  dateHeaderText: { fontFamily: SB, fontSize: 10, color: SEC, letterSpacing: 1.2, textTransform: 'uppercase' },

  row:      { backgroundColor: CARD, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon:  { width: 46, height: 46, borderRadius: 23, backgroundColor: TEALL, alignItems: 'center', justifyContent: 'center' },
  rowMid:   { flex: 1, gap: 2 },
  rowType:  { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 10, color: SEC, letterSpacing: 0.4, textTransform: 'uppercase' },
  rowName:  { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: TEXT, letterSpacing: 0.1, lineHeight: 20 },
  rowSpace: { fontFamily: R,  fontSize: 11, color: SEC },
  rowAmount: { fontFamily: B, fontSize: 15, letterSpacing: -0.4 },
});
