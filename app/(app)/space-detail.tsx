import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import ConfirmModal from '@/components/ui/ConfirmModal';
import pageStyles from '@/components/ui/pageStyles';
import { Colors, Fonts, Radius, Shadow, Spacing } from '@/components/ui/theme';

// Module-level store for cross-screen date focus signal
export let pendingFocusDate: string | null = null;
export function setPendingFocusDate(date: string | null) { pendingFocusDate = date; }

const { width } = Dimensions.get('window');
type ViewMode = 'daily' | 'weekly' | 'monthly';
const MODES: ViewMode[] = ['daily', 'weekly', 'monthly'];
const DOODLE_W = 90;



function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function dateKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

function getNavLabel(viewMode: ViewMode, selectedDate: Date) {
  if (viewMode === 'daily') {
    return selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (viewMode === 'weekly') {
    const start = addDays(selectedDate, -selectedDate.getDay());
    const end = addDays(start, 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} - ${fmt(end)}`;
  }
  return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getDailyMonthLabel(selectedDate: Date) {
  const start = addDays(selectedDate, -3);
  const end = addDays(selectedDate, 3);
  const sm = start.toLocaleDateString('en-US', { month: 'long' });
  const em = end.toLocaleDateString('en-US', { month: 'long' });
  return sm === em ? sm : `${sm} to ${em}`;
}

function recordingColor(type: string, status: string): string {
  if (type === 'expense') return Colors.expense;
  if (type === 'income' || type === 'savings') return Colors.cyan;
  if (type === 'payable') return status === 'paid' ? Colors.paid : Colors.pending;
  if (type === 'receivable') {
    if (status === 'received') return Colors.paid;
    return Colors.pending;
  }
  return Colors.cyan;
}

function recordingBg(type: string, status: string): string {
  if (type === 'expense') return '#fdeded';
  if (type === 'income' || type === 'savings') return '#f6fded';
  if (type === 'payable' || type === 'receivable') {
    if (status === 'paid' || status === 'received') return '#f8f8f8';
    return '#f8edfd';
  }
  return '#f6fded';
}

export default function SpaceDetailScreen() {
  const { spaceId, name } = useLocalSearchParams<{ spaceId: string; name: string; color: string }>();
  const router = useRouter();

  const slideAnim = useRef(new Animated.Value(width)).current;
  const circleAnim = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(0)).current;

  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [viewLayout, setViewLayout] = useState<'list' | 'grid' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [pendingDeleteName, setPendingDeleteName] = useState('');
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [spaceBudget, setSpaceBudget] = useState<number | null>(null);
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerDay, setPickerDay] = useState<number | null>(null);

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const openPicker = () => {
    setPickerMonth(selectedDate.getMonth());
    setPickerYear(selectedDate.getFullYear());
    setPickerDay(viewMode === 'daily' ? selectedDate.getDate() : null);
    setShowPicker(true);
  };

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
  }, []);

  useEffect(() => { if (spaceId) loadRecordings(); }, [spaceId]);

  useFocusEffect(useCallback(() => {
    if (!spaceId) return;
    loadRecordings();
    if (pendingFocusDate) {
      const parts = pendingFocusDate.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      setSelectedDate(d);
      setPendingFocusDate(null);
    }
  }, [spaceId]));

  useEffect(() => {
    if (tabLayouts.filter(Boolean).length < 3) return;
    const idx = MODES.indexOf(viewMode);
    const layout = tabLayouts[idx];
    if (!layout) return;
    Animated.spring(circleAnim, {
      toValue: layout.x + layout.width / 2 - DOODLE_W / 2,
      useNativeDriver: false, tension: 70, friction: 12,
    }).start();
  }, [viewMode, tabLayouts]);

  const switchMode = (next: ViewMode) => {
    if (next === viewMode) return;
    const goLeft = MODES.indexOf(next) > MODES.indexOf(viewMode);
    Animated.timing(contentSlide, { toValue: goLeft ? -width : width, duration: 220, useNativeDriver: false }).start(() => {
      setViewMode(next);
      contentSlide.setValue(goLeft ? width : -width);
      Animated.timing(contentSlide, { toValue: 0, duration: 220, useNativeDriver: false }).start();
    });
  };

  const switchLayout = (layout: 'list' | 'grid' | 'calendar') => {
    setViewLayout(layout);
    if (layout === 'calendar') switchMode('monthly');
  };

  const loadRecordings = async () => {
    setLoading(true);
    const query = supabase.from('recordings')
      .select('*, categories:category_id(name, color, icon), account:account_id(account_name, bank, color)');
    if (spaceId === 'all') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await query.eq('user_id', user.id).order('transaction_date', { ascending: false });
        if (data) setRecordings(data);
      }
    } else {
      const { data } = await query.eq('space_id', spaceId).order('transaction_date', { ascending: false });
      if (data) setRecordings(data);
      // Load budget
      const { data: space } = await supabase.from('spaces').select('budget').eq('id', spaceId).single();
      if (space) setSpaceBudget(space.budget ?? null);
    }
    setLoading(false);
  };

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  const confirmDelete = async () => {
    await supabase.from('recordings').delete().eq('id', pendingDeleteId);
    setRecordings(prev => prev.filter(r => r.id !== pendingDeleteId));
    setConfirmModal(false);
  };

  const weekStart = addDays(selectedDate, -selectedDate.getDay());

  const filteredRecordings = recordings.filter(r => {
    const parts = r.transaction_date.split('-');
    const rDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (activeFilter.length > 0 && !activeFilter.includes(r.type)) return false;
    if (viewMode === 'daily') return isSameDay(rDate, selectedDate);
    if (viewMode === 'weekly') { const end = addDays(weekStart, 6); return rDate >= weekStart && rDate <= end; }
    return rDate.getMonth() === selectedDate.getMonth() && rDate.getFullYear() === selectedDate.getFullYear();
  });

  // Group recordings by date
  const grouped: { dateLabel: string; dateObj: Date; items: any[] }[] = [];
  filteredRecordings.forEach(r => {
    const parts = r.transaction_date.split('-');
    const rDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const key = dateKey(rDate);
    const existing = grouped.find(g => dateKey(g.dateObj) === key);
    if (existing) { existing.items.push(r); }
    else {
      grouped.push({
        dateLabel: rDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        dateObj: rDate,
        items: [r],
      });
    }
  });
  grouped.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

  // Stats (all recordings in space, not filtered)
  const totalExpenses = recordings.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
  const totalIncomeSavings = recordings.filter(r => r.type === 'income' || r.type === 'savings').reduce((s, r) => s + Number(r.amount), 0);
  const countPayables = recordings.filter(r => r.type === 'payable' && r.status !== 'paid').length;
  const countReceivables = recordings.filter(r => r.type === 'receivable' && r.status === 'pending').length;

  // Budget bar uses monthly expenses for the selected month
  const monthlyExpenses = recordings.filter(r => {
    if (r.type !== 'expense') return false;
    const parts = r.transaction_date.split('-');
    const rDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return rDate.getMonth() === selectedDate.getMonth() && rDate.getFullYear() === selectedDate.getFullYear();
  }).reduce((s, r) => s + Number(r.amount), 0);

  const shortAmount = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toFixed(0);
  };

  const shortAmt = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return Math.round(n).toString();
  };

  // Set of dateKeys that have recordings (for dots)
  const recordingDates = new Set(recordings.map(r => {
    const parts = r.transaction_date.split('-');
    return dateKey(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  }));

  return (
    <Animated.View style={[pageStyles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={pageStyles.inner}>

        <TouchableOpacity onPress={handleBack} style={pageStyles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.muted} />
        </TouchableOpacity>

        <View style={[s.spaceHeader, { paddingHorizontal: Spacing.page }]}>
          <Text style={s.spaceName}>{(name ?? '').toLowerCase()}</Text>
        </View>

        {/* Stats row — 4 columns 1 row */}
        <View style={[s.statsGrid, { marginHorizontal: Spacing.page, marginBottom: 16 }]}>
          {[
            { key: 'expense', label: 'expenses', value: shortAmount(totalExpenses), color: Colors.expense },
            { key: 'income', label: 'income', value: shortAmount(totalIncomeSavings), color: Colors.income },
            { key: 'payable', label: 'payables', value: String(countPayables), color: Colors.muted },
            { key: 'receivable', label: 'receivables', value: String(countReceivables), color: Colors.muted },
          ].map((stat, i) => {
            const isActive = activeFilter.includes(stat.key);
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                style={[s.statCard, isActive && { borderColor: Colors.cyan, backgroundColor: Colors.cyan + '22' }]}
                onPress={() => setActiveFilter(prev => isActive ? prev.filter(k => k !== stat.key) : [...prev, stat.key])}
              >
                <Text style={[s.statValue, { color: isActive ? Colors.cyan : stat.color }]}>{stat.value}</Text>
                <Text style={[s.statLabel, isActive && { color: Colors.cyan }]}>{stat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Budget bar */}
        {spaceId !== 'all' && (
          <View style={[s.budgetWrap, { marginHorizontal: Spacing.page, marginBottom: 12 }]}>
            {(() => {
              const pct = spaceBudget ? Math.min(monthlyExpenses / spaceBudget, 1) : 0;
              const overBudget = spaceBudget ? monthlyExpenses > spaceBudget : false;
              const barColor = !spaceBudget ? Colors.borderMid : overBudget ? Colors.expense : pct >= 0.8 ? Colors.pending : Colors.income;
              return (
                <>
                  <View style={s.budgetLabelRow}>
                    <Text style={s.budgetLabel}>budget</Text>
                    <Text style={[s.budgetValue, overBudget && { color: Colors.expense }]}>
                      {shortAmount(monthlyExpenses)} / {spaceBudget ? shortAmount(spaceBudget) : '∞'}
                    </Text>
                  </View>
                  <View style={s.budgetTrack}>
                    {spaceBudget ? (
                      <View style={[s.budgetFill, { width: `${pct * 100}%` as any, backgroundColor: barColor }]} />
                    ) : (
                      <View style={[s.budgetFill, { width: '100%', backgroundColor: Colors.borderMid, opacity: 0.4 }]} />
                    )}
                  </View>
                  {overBudget && <Text style={s.budgetOver}>over budget by {shortAmount(monthlyExpenses - spaceBudget!)}</Text>}
                </>
              );
            })()}
          </View>
        )}

        {/* Recordings header */}
        <View style={s.recordingsHeader}>
          <Text style={[pageStyles.sectionHeader, { marginBottom: 0, marginTop: 0, fontFamily: Fonts.calSans }]}>recordings</Text>
          {spaceId !== 'all' && (
            <TouchableOpacity
              style={s.addRecordBtn}
              onPress={() => router.push({ pathname: '/(app)/add-recording', params: { spaceId, spaceName: name, defaultDate: selectedDate.toISOString().split('T')[0] } } as any)}
              activeOpacity={0.85}
            >
              <Text style={s.modeBtnText}>add record</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Layout toggle */}
        <View style={s.layoutRow}>
          {([['list', 'list-outline'], ['grid', 'grid-outline'], ['calendar', 'calendar-outline']] as const).map(([layout, icon]) => (
            <TouchableOpacity
              key={layout}
              style={[s.layoutBtn, viewLayout === layout && s.layoutBtnActive]}
              onPress={() => switchLayout(layout)}
              activeOpacity={0.7}
            >
              <Ionicons name={icon as any} size={16} color={viewLayout === layout ? Colors.cyan : Colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Date nav */}
        <View style={s.modeRow}>
          {MODES.map(mode => (
            <TouchableOpacity
              key={mode}
              style={[s.modeBtn, viewMode === mode && s.modeBtnActive]}
              onPress={() => switchMode(mode)}
              activeOpacity={0.7}
            >
              <Text style={[s.modeBtnText, viewMode === mode && s.modeBtnTextActive]}>
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.dateNavRow}>
          <TouchableOpacity onPress={() => {
            if (viewMode === 'daily') setSelectedDate(d => addDays(d, -1));
            else if (viewMode === 'weekly') setSelectedDate(d => addDays(d, -7));
            else setSelectedDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; });
          }} style={s.dateNavArrow}>
            <Ionicons name="chevron-back" size={18} color={Colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openPicker} style={s.dateNavCenter}>
            <Text style={s.dateNavLabel}>{getNavLabel(viewMode, selectedDate).toLowerCase()}</Text>
            <Ionicons name="calendar-outline" size={12} color={Colors.faint} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            if (viewMode === 'daily') setSelectedDate(d => addDays(d, 1));
            else if (viewMode === 'weekly') setSelectedDate(d => addDays(d, 7));
            else setSelectedDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; });
          }} style={s.dateNavArrow}>
            <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
          </TouchableOpacity>
        </View>

        <Animated.View style={[s.contentArea, { transform: [{ translateX: contentSlide }] }]}>

          {/* Daily date chips */}
          {viewMode === 'daily' && (
            <View style={s.dateChipsRow}>
              {Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i - 3)).map((date, i) => {
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, new Date());
                return (
                  <TouchableOpacity key={i} style={[s.dateChip, isSelected && s.dateChipSelected]} onPress={() => setSelectedDate(date)}>
                    <Text style={[s.dateChipDay, isSelected && s.dateChipTextSelected]}>{date.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                    <Text style={[s.dateChipNum, isSelected && s.dateChipTextSelected]}>{date.getDate()}</Text>
                    {isToday && <View style={[s.dot, isSelected && s.dotSelected]} />}
                    {!isToday && recordingDates.has(dateKey(date)) && <View style={s.dot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Weekly date chips */}
          {viewMode === 'weekly' && (
            <View style={s.dateChipsRow}>
              {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((date, i) => {
                const isToday = isSameDay(date, new Date());
                return (
                  <View key={i} style={[s.dateChip, isToday && s.dateChipSelected]}>
                    <Text style={[s.dateChipDay, isToday && s.dateChipTextSelected]}>{date.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
                    <Text style={[s.dateChipNum, isToday && s.dateChipTextSelected]}>{date.getDate()}</Text>
                    {isToday ? <View style={[s.dot, s.dotSelected]} /> : recordingDates.has(dateKey(date)) && <View style={s.dot} />}
                  </View>
                );
              })}
            </View>
          )}

          
          {loading ? (
            <ActivityIndicator color={Colors.income} style={{ marginTop: 40 }} />
          ) : viewLayout === 'calendar' ? (
            <ScrollView contentContainerStyle={s.calendarGrid} showsVerticalScrollIndicator={false}>
              {(() => {
                const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
                const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
                const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
                return (
                  <>
                    {/* Day headers */}
                    {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                      <View key={d} style={s.calHeaderCell}>
                        <Text style={s.calHeaderText}>{d}</Text>
                      </View>
                    ))}
                    {cells.map((day, i) => {
                      if (!day) return <View key={`e${i}`} style={s.calDayCell} />;
                      const cellDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                      const key = dateKey(cellDate);
                      const dayRecordings = filteredRecordings.filter(r => {
                        const parts = r.transaction_date.split('-');
                        return dateKey(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))) === key;
                      });
                      const isToday = isSameDay(cellDate, new Date());
                      const visible = dayRecordings.slice(0, 3);
                      const extra = dayRecordings.length - 3;
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[s.calDayCell, isToday && s.calDayCellToday]}
                          activeOpacity={0.7}
                          onPress={() => {
                            setSelectedDate(cellDate);
                            setViewLayout('list');
                            switchMode('daily');
                          }}
                        >
                          <Text style={[s.calDayNum, isToday && { color: Colors.cyan }]}>{day}</Text>
                          {visible.map((r, ri) => (
                            <View key={ri} style={s.calItem}>
                              <Ionicons name={r.categories?.icon ?? 'ellipse-outline'} size={10} color={recordingColor(r.type, r.status)} />
                              <Text style={s.calItemText} numberOfLines={1}>{shortAmt(Number(r.amount))}</Text>
                            </View>
                          ))}
                          {extra > 0 && <Text style={s.calItemMore}>+{extra} more</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </>
                );
              })()}
            </ScrollView>
          ) : grouped.length === 0 ? (
            <View style={[pageStyles.emptyBox, { borderWidth: 0, backgroundColor: 'transparent', paddingTop: 60 }]}>
              <Ionicons name="receipt-outline" size={40} color={Colors.borderMid} />
              <Text style={pageStyles.emptyText}>no recordings</Text>
            </View>
          ) : viewLayout === 'grid' ? (
            <ScrollView contentContainerStyle={[s.list, { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }]} showsVerticalScrollIndicator={false}>
              {filteredRecordings.map(item => {
                const amountColor = recordingColor(item.type, item.status);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[s.gridCard, { backgroundColor: recordingBg(item.type, item.status) }]}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                  >
                    <Ionicons name={item.categories?.icon ?? 'ellipse-outline'} size={18} color={amountColor} />
                    <Text style={s.gridName} numberOfLines={2}>{item.name}</Text>
                    <Text style={s.gridAmount}>{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                    <Text style={s.gridDate}>{new Date(item.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
              {grouped.map(group => (
                <View key={group.dateLabel}>
                  <View style={s.dateGroupRow}>
                    <View style={s.dateGroupLine} />
                    <Text style={s.dateGroupLabel}>{group.dateLabel}</Text>
                    <View style={s.dateGroupLine} />
                  </View>
                  <View style={{ gap: 10 }}>
                    {group.items.map(item => {
                      const amountColor = recordingColor(item.type, item.status);
                      const statusLabel = item.type === 'payable'
                        ? (item.status === 'paid' ? 'Paid' : item.status === 'partial' ? 'Partial' : 'Unpaid')
                        : item.type === 'receivable'
                          ? (item.status === 'received' ? 'Received' : item.status === 'partial' ? 'Partial' : 'Pending')
                          : '';
                      const verbMap: Record<string, string> = {
                        expense: 'Paid from', income: 'Received on', savings: 'Saved to',
                        receivable: item.status === 'received' ? 'Received on' : 'Expecting to',
                        payable: item.status === 'paid' ? 'Paid from' : 'Paying from',
                      };
                      const showPartial = (item.type === 'receivable' || item.type === 'payable') && item.status === 'partial' && item.paid_amount;
                      return (
                        <TouchableOpacity key={item.id} style={[s.recordingCard, { backgroundColor: recordingBg(item.type, item.status) }]} activeOpacity={0.85}
                          onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}>
                          <Ionicons name={item.categories?.icon ?? 'ellipse-outline'} size={22} color={amountColor} style={{ flexShrink: 0 }} />
                          <View style={s.recordingMiddle}>
                            <Text style={s.recordingName} numberOfLines={1}>{item.name}</Text>
                            <View style={{ flexDirection: 'row', gap: 3 }}>
                              <Text style={[s.recordingMeta, { fontFamily: Fonts.monoBold }]} numberOfLines={1}>
                                {statusLabel || item.categories?.name || '—'}
                              </Text>
                            </View>
                            {(item.account?.account_name || item.person_name) && (
                              <View style={{ flexDirection: 'row', gap: 3 }}>
                                <Text style={s.recordingMeta} numberOfLines={1}>{verbMap[item.type] ?? 'Via'}:</Text>
                                <Text style={[s.recordingMeta, { fontFamily: Fonts.monoBold }]} numberOfLines={1}>{item.person_name ?? item.account?.account_name}</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                            <Text style={s.recordingAmount}>
                              {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Text>
                            {showPartial && (
                              <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint }}>
                                / {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </Text>
                            )}
                            {(item.type === 'payable' && item.status === 'paid' || item.type === 'receivable' && item.status === 'received') && item.paid_amount && (
                              <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: amountColor }}>
                                ({Number(item.paid_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} paid)
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Animated.View>

      </SafeAreaView>

      {/* Filter Modal */}
      <ConfirmModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        title="filter by"
        actions={[
          { label: 'clear', onPress: () => { setActiveFilter([]); setShowFilter(false); }, muted: true },
          { label: 'done', onPress: () => setShowFilter(false) },
        ]}
      >
        {[
          { key: 'expense', label: 'expense', color: Colors.expense },
          { key: 'income', label: 'income', color: Colors.income },
          { key: 'savings', label: 'savings', color: Colors.income },
          { key: 'payable', label: 'payable', color: Colors.muted },
          { key: 'receivable', label: 'receivable', color: Colors.muted },
        ].map(f => {
          const isActive = activeFilter.includes(f.key);
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.filterOption, isActive && { borderColor: f.color, backgroundColor: f.color + '18' }]}
              onPress={() => setActiveFilter(prev =>
                isActive ? prev.filter(k => k !== f.key) : [...prev, f.key]
              )}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: f.color }} />
              <Text style={[s.filterOptionText, isActive && { color: f.color, fontFamily: Fonts.monoBold }]}>{f.label}</Text>
              <Ionicons
                name={isActive ? 'checkbox' : 'square-outline'}
                size={16}
                color={isActive ? f.color : Colors.faint}
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>
          );
        })}
      </ConfirmModal>

      {/* Date Picker Modal */}
      <ConfirmModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        title="jump to"
        actions={[{
          label: 'go',
          onPress: () => {
            const d = new Date(pickerYear, pickerMonth, viewMode === 'daily' && pickerDay ? pickerDay : 1);
            setSelectedDate(d);
            setShowPicker(false);
          },
        }]}
      >
        <View style={s.datePickerYearRow}>
          <TouchableOpacity onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); }}>
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={{ fontFamily: Fonts.display, fontSize: 17, color: Colors.text }}>{MONTHS[pickerMonth].toLowerCase()} {pickerYear}</Text>
          <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}>
            <Ionicons name="chevron-forward" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
        {viewMode !== 'monthly' && (() => {
          const firstDay = new Date(pickerYear, pickerMonth, 1).getDay();
          const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
          const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
          const selWeekStart = addDays(selectedDate, -selectedDate.getDay());
          const selWeekEnd = addDays(selWeekStart, 6);
          return (
            <View style={{ width: '100%' }}>
              <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                {['su','mo','tu','we','th','fr','sa'].map(d => (
                  <Text key={d} style={{ flex: 1, textAlign: 'center', fontFamily: Fonts.sans, fontSize: 11, color: Colors.faint }}>{d}</Text>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {cells.map((day, i) => {
                  if (!day) return <View key={`e${i}`} style={s.calCell} />;
                  const cellDate = new Date(pickerYear, pickerMonth, day);
                  const isHighlighted = (viewMode === 'daily' && day === pickerDay) || (viewMode === 'weekly' && cellDate >= selWeekStart && cellDate <= selWeekEnd);
                  const isToday = isSameDay(cellDate, new Date());
                  return (
                    <TouchableOpacity key={day} style={[s.calCell, isHighlighted && s.calCellSelected, !isHighlighted && isToday && s.calCellToday]}
                      onPress={() => viewMode === 'daily' ? setPickerDay(day) : setSelectedDate(cellDate)}>
                      <Text style={[s.calCellText, (isHighlighted || isToday) && s.calCellTextActive]}>{day}</Text>
                      {recordingDates.has(dateKey(cellDate)) && <View style={[s.calDot, isHighlighted && { backgroundColor: Colors.white }]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })()}
        {viewMode === 'monthly' && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' }}>
            {MONTHS.map((m, i) => {
              const isActive = i === pickerMonth;
              return (
                <TouchableOpacity key={m} style={[s.monthBtn, isActive && s.monthBtnActive]} onPress={() => setPickerMonth(i)}>
                  <Text style={[s.monthBtnText, isActive && { color: Colors.white }]}>{m.slice(0, 3).toLowerCase()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ConfirmModal>

      {/* Delete confirm */}
      <ConfirmModal
        visible={confirmModal}
        onClose={() => setConfirmModal(false)}
        title="delete recording"
        message={`Delete "${pendingDeleteName}"? This cannot be undone.`}
        actions={[
          { label: 'cancel', onPress: () => setConfirmModal(false), muted: true },
          { label: 'delete', onPress: confirmDelete, destructive: true },
        ]}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // Budget bar
  budgetWrap: { gap: 6 },
  budgetLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetLabel: { fontFamily: 'ChillaxRegular', fontSize: 11, color: Colors.muted, letterSpacing: 0.3 },
  budgetValue: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.text, letterSpacing: 0.2 },
  budgetTrack: { height: 6, backgroundColor: Colors.border, borderRadius: Radius.pill, overflow: 'hidden' },
  budgetFill: { height: '100%', borderRadius: Radius.pill },
  budgetOver: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.expense, letterSpacing: 0.2 },

  // Layout toggle
  layoutRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: Spacing.page, marginBottom: 10 },
  layoutBtn: { width: 36, height: 36, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  layoutBtnActive: { borderColor: Colors.cyan, backgroundColor: Colors.cyan + '18' },

  // Grid view
  gridCard: { width: '47%', borderRadius: Radius.lg, padding: 12, gap: 6 },
  gridName: { fontFamily: 'ChillaxMedium', fontSize: 13, color: '#292929' },
  gridAmount: { fontFamily: Fonts.monoBold, fontSize: 14, color: '#292929' },
  gridDate: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },

  // Calendar grid
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.page, paddingBottom: 100 },
  calHeaderCell: { width: '14.28%', alignItems: 'center', paddingVertical: 6 },
  calHeaderText: { fontFamily: 'ChillaxMedium', fontSize: 11, color: Colors.muted },
  calDayCell: { width: '14.28%', minHeight: 64, padding: 4, borderWidth: 0.5, borderColor: Colors.border, gap: 2 },
  calDayCellToday: { backgroundColor: Colors.cyan + '11' },
  calDayNum: { fontFamily: 'ChillaxMedium', fontSize: 12, color: '#292929', marginBottom: 2 },
  calItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  calItemText: { fontFamily: Fonts.mono, fontSize: 9, color: '#292929', flex: 1 },
  calItemMore: { fontFamily: Fonts.mono, fontSize: 8, color: Colors.muted },

  // Date nav
  addRecordBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface, alignItems: 'center', alignSelf: 'flex-start' },
  modeRow: { flexDirection: 'row', paddingHorizontal: Spacing.page, gap: 8, marginBottom: 10 },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface, alignItems: 'center' },
  modeBtnActive: { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  modeBtnText: { fontFamily: 'ChillaxMedium', fontSize: 12, color: Colors.muted },
  modeBtnTextActive: { fontFamily: 'ChillaxMedium', color: Colors.white },
  dateNavRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.page, marginBottom: 8 },
  dateNavArrow: { padding: 8 },
  dateNavCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dateNavLabel: { fontFamily: 'ChillaxMedium', fontSize: 13, color: Colors.text },
  recordingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.page, marginBottom: 8, gap: 12 },
  contentArea: { flex: 1 },
  spaceHeader: { marginTop: 4, marginBottom: 12 },
  spaceName: { fontFamily: Fonts.calSans, fontSize: 32, color: '#425252', letterSpacing: -0.5 },

  // Date chips
  dateChipsRow: { flexDirection: 'row', paddingHorizontal: Spacing.page, marginBottom: 8, marginTop: 6, gap: 6, justifyContent: 'center' },
  dateChip: { flex: 1, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 2, borderRadius: Radius.md, backgroundColor: Colors.surface, minHeight: 42, borderWidth: 1, borderColor: Colors.border },
  dateChipSelected: { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  dateChipDay: { fontFamily: Fonts.mono, fontSize: 8, color: Colors.muted },
  dateChipNum: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text, marginTop: 2 },
  dateChipTextSelected: { color: Colors.white },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.cyan, marginTop: 3 },
  dotSelected: { backgroundColor: Colors.white },


  // Recording list
  list: { paddingHorizontal: Spacing.page, paddingBottom: 100, gap: 16, paddingTop: 16 },
  dateGroupRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 16 },
  dateGroupLine: { flex: 1, height: 1, backgroundColor: Colors.borderMid },
  dateGroupLabel: { fontFamily: Fonts.calSans, fontSize: 11, color: '#555555', textAlign: 'center' },
  recordingCard: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.pill, paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  recordingMiddle: { flex: 1, gap: 2, overflow: 'hidden' },
  recordingName: { fontFamily: 'ChillaxMedium', fontSize: 13, color: '#292929' },
  recordingMeta: { fontFamily: Fonts.mono, fontSize: 10, color: '#292929' },
  recordingAmount: { fontFamily: Fonts.monoBold, fontSize: 14, color: '#292929' },

  // Stats
  statsGrid: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statValue: { fontFamily: 'ChillaxMedium', fontSize: 13, marginBottom: 2 },
  statLabel: { fontFamily: 'ChillaxLight', fontSize: 9, color: Colors.muted, textAlign: 'center' },

  // Filter
  filterOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid },
  filterOptionText: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted },

  // Date picker
  datePickerYearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4 },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellSelected: { backgroundColor: Colors.cyan },
  calCellToday: { backgroundColor: Colors.border },
  calCellText: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text },
  calCellTextActive: { fontFamily: Fonts.sansSemiBold, color: Colors.white },
  calDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.cyan, marginTop: 1 },
  monthBtn: { width: '30%', paddingVertical: 10, borderRadius: Radius.pill, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderMid },
  monthBtnActive: { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  monthBtnText: { fontFamily: Fonts.display, fontSize: 14, color: Colors.text },
});






