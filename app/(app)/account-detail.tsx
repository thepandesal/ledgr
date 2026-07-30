import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase';
import { useSlideScreen } from '../../src/hooks/useSlideScreen';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors, Fonts, Radius } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';

const { width } = Dimensions.get('window');
const PAGE = 25;
const ACCENT      = Brand.color.accent;
const ACCENT_DARK = Brand.color.accentDark;
const PEACH       = '#FFAB91';

function recordingColor(type: string): string {
  if (type === 'expense' || type === 'payable') return PEACH;
  return ACCENT_DARK;
}

function dateKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type Preset = 'this-month' | 'last-30' | 'cutoff' | 'custom';
const PRESETS: { key: Preset; label: string; icon: string }[] = [
  { key: 'this-month', label: 'This Month', icon: 'calendar-outline' },
  { key: 'last-30',    label: 'Last 30d',   icon: 'time-outline'     },
  { key: 'cutoff',     label: 'Cutoff',     icon: 'cut-outline'      },
  { key: 'custom',     label: 'Custom',     icon: 'options-outline'  },
];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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

export default function AccountDetailScreen() {
  const { accountId, accountName, bankName } = useLocalSearchParams<{ accountId: string; accountName: string; bankName: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { slideAnim, handleBack } = useSlideScreen();

  // Date filter state
  const [activePreset, setActivePreset] = useState<Preset>('this-month');
  const [rangeOffset,  setRangeOffset]  = useState(0);
  const [cutoffDay,    setCutoffDay]    = useState(25);
  const [cutoffInput,  setCutoffInput]  = useState('25');
  const [customFrom,   setCustomFrom]   = useState<Date>(new Date());
  const [customTo,     setCustomTo]     = useState<Date>(new Date());
  const [showDateModal, setShowDateModal] = useState(false);
  const [pickingDate, setPickingDate] = useState<'from' | 'to'>('from');
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear,  setPickerYear]  = useState(new Date().getFullYear());

  // Pagination state
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Load default settings from spaces page
  const { data: spacesSettings } = useQuery({
    queryKey: ['spaces-settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('user_settings')
        .select('spaces_date_mode, spaces_week_start, spaces_date_offset, spaces_cutoff_day, spaces_use_cutoff')
        .eq('user_id', user.id)
        .maybeSingle();
      return data ?? null;
    },
  });

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['account-recordings', accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('*, categories:category_id(name, color, icon)')
        .eq('account_id', accountId)
        .order('transaction_date', { ascending: false });
      return (data ?? []).map((r: any) => ({
        ...r,
        categories: Array.isArray(r.categories) ? r.categories[0] : r.categories,
      }));
    },
    enabled: !!accountId,
  });

  // Initialize from spaces settings
  useEffect(() => {
    if (!spacesSettings) return;
    
    const dateMode = spacesSettings.spaces_date_mode || 'monthly';
    const offset = Number(spacesSettings.spaces_date_offset ?? 0);
    const useCutoff = Boolean(spacesSettings.spaces_use_cutoff);
    const cutoff = Number(spacesSettings.spaces_cutoff_day ?? 25);
    
    setCutoffDay(cutoff);
    setCutoffInput(String(cutoff));
    
    if (dateMode === 'monthly') {
      if (useCutoff) {
        setActivePreset('cutoff');
      } else {
        setActivePreset('this-month');
      }
      setRangeOffset(offset);
    } else {
      setActivePreset('this-month');
      setRangeOffset(0);
    }
  }, [spacesSettings]);

  useFocusEffect(useCallback(() => {
    if (!accountId) return;
    queryClient.invalidateQueries({ queryKey: ['account-recordings', accountId] });
    queryClient.invalidateQueries({ queryKey: ['spaces-settings'] });
    setDisplayCount(10);
  }, [accountId]));

  const range = activePreset === 'custom'
    ? { from: customFrom, to: customTo }
    : getRangeForPreset(activePreset, cutoffDay, rangeOffset);

  const filtered = recordings.filter(r => {
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date < range.from) return false;
    const to = new Date(range.to); to.setHours(23, 59, 59);
    return date <= to;
  });

  const totalExpenses    = filtered.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
  const totalIncome      = filtered.filter(r => r.type === 'income' || r.type === 'savings').reduce((s, r) => s + Number(r.amount), 0);
  const countPayables    = filtered.filter(r => r.type === 'payable' && r.status !== 'paid').length;
  const countReceivables = filtered.filter(r => r.type === 'receivable' && r.status === 'pending').length;

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const fmtAbbr = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return n.toFixed(0);
  };

  const grouped: { dateLabel: string; dateObj: Date; items: any[] }[] = [];
  filtered.forEach(r => {
    const parts = r.transaction_date.split('-');
    const rDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const key = dateKey(rDate);
    const existing = grouped.find(g => dateKey(g.dateObj) === key);
    if (existing) existing.items.push(r);
    else grouped.push({ dateLabel: rDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), dateObj: rDate, items: [r] });
  });
  grouped.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

  const paginatedGroups = grouped.slice(0, displayCount);
  const hasMore = displayCount < grouped.length;

  const navigateRange = (dir: 1 | -1) => {
    setDisplayCount(10);
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
    setDisplayCount(10);
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

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isCloseToBottom && hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayCount(prev => prev + 10);
        setIsLoadingMore(false);
      }, 300);
    }
  };

  const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtFull  = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rangeLabel = isSameDay(range.from, range.to)
    ? fmtFull(range.from)
    : `${fmtShort(range.from)} – ${fmtFull(range.to)}`;

  const firstDay    = new Date(pickerYear, pickerMonth, 1).getDay();
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  const isInRange = (day: number) => { const d = new Date(pickerYear, pickerMonth, day); return d > customFrom && d < customTo; };
  const isEdge    = (day: number) => { const d = new Date(pickerYear, pickerMonth, day); return isSameDay(d, customFrom) || isSameDay(d, customTo); };

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: Colors.white }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>

          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{(accountName ?? '').toLowerCase()}</Text>
            <Text style={s.subtitle}>{(bankName ?? '').toLowerCase()}</Text>
          </View>
        </View>

        {/* Date filter row */}
        <View style={s.filterRow}>
          <View style={s.dateNavRow}>

            <TouchableOpacity style={s.filterBtn} onPress={() => setShowDateModal(true)} activeOpacity={0.75}>
              <Text style={s.filterBtnText}>{rangeLabel}</Text>
            </TouchableOpacity>

          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { label: 'expenses',    value: fmtAbbr(totalExpenses),    color: PEACH       },
            { label: 'income',      value: fmtAbbr(totalIncome),      color: ACCENT_DARK },
            { label: 'payables',    value: String(countPayables),     color: Colors.muted },
            { label: 'receivables', value: String(countReceivables),  color: Colors.muted },
          ].map((st, i) => (
            <View key={i} style={s.statCard}>
              <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Recordings */}
        {isLoading ? (
          <ActivityIndicator color={ACCENT_DARK} style={{ marginTop: 40 }} />
        ) : grouped.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60, gap: 8 }}>
            <Text style={Brand.type.emptyText}>no recordings for this period</Text>
          </View>
        ) : (
          <ScrollView 
            contentContainerStyle={s.list} 
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={400}
          >
            {paginatedGroups.map(group => (
              <View key={group.dateLabel}>
                <View style={s.dateRow}>
                  <View style={s.dateLine} />
                  <Text style={s.dateLabel}>{group.dateLabel}</Text>
                  <View style={s.dateLine} />
                </View>
                {group.items.map(item => {
                  const color = recordingColor(item.type);
                  const statusLabel = item.type === 'payable'
                    ? (item.status === 'paid' ? 'paid' : item.status === 'partial' ? 'partial' : 'unpaid')
                    : item.type === 'receivable'
                      ? (item.status === 'received' ? 'received' : item.status === 'partial' ? 'partial' : 'pending')
                      : '';
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={s.row}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                    >

                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                        <Text style={s.rowMeta}>{statusLabel || item.categories?.name || item.type}</Text>
                      </View>
                      <Text style={[s.rowAmount, { color }]}>{fmt(Number(item.amount))}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            {hasMore && (
              <View style={s.loadMoreWrap}>
                {isLoadingMore ? (
                  <ActivityIndicator color={ACCENT_DARK} size="small" />
                ) : (
                  <Text style={s.loadMoreText}>scroll for more</Text>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Date modal */}
      <BottomSheet visible={showDateModal} onClose={() => setShowDateModal(false)} title="date range" height="50%">
        <View style={s.chipRow}>
          {PRESETS.map(p => {
            const active = p.key === activePreset;
            return (
              <TouchableOpacity key={p.key} style={[s.chip, active && s.chipActive]} onPress={() => applyPreset(p.key)} activeOpacity={0.75}>
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

              <Text style={s.pickerMonthText}>{MONTHS[pickerMonth].toLowerCase()} {pickerYear}</Text>

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
    </Animated.View>
  );
}

const s = StyleSheet.create({
  header:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAGE, paddingTop: 16, paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  title:    { fontFamily: Brand.font.display, fontSize: 22, color: Colors.text, letterSpacing: -0.3 },
  subtitle: { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginTop: 1 },

  filterRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dateNavRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateNavArrow:  { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  filterBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderMid },
  filterBtnText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.text },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: PAGE, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statValue:{ fontFamily: Brand.font.monoBold, fontSize: 13, marginBottom: 2 },
  statLabel:{ fontFamily: Brand.font.mono, fontSize: 9, color: Colors.muted, textAlign: 'center' },

  list:     { paddingHorizontal: PAGE, paddingBottom: 100, paddingTop: 8 },

  dateRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10 },
  dateLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dateLabel:{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' },

  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIconWrap:{ width: 36, height: 36, borderRadius: 18, backgroundColor: ACCENT + '44', alignItems: 'center', justifyContent: 'center' },
  rowName:    { ...Brand.type.cardTitle },
  rowMeta:    { ...Brand.type.cardMeta },
  rowAmount:  { fontFamily: Brand.font.monoBold, fontSize: 14, letterSpacing: -0.3 },

  loadMoreWrap: { alignItems: 'center', paddingVertical: 20 },
  loadMoreText: { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted },

  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  chipActive:     { backgroundColor: ACCENT_DARK },
  chipText:       { fontFamily: Fonts.mono,     fontSize: 12, color: Colors.muted },
  chipTextActive: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.white },
  modalLabel:     { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, marginBottom: 10 },

  calWrap:         { width: '100%' },
  calHint:         { fontFamily: Fonts.mono, fontSize: 11, color: ACCENT_DARK, marginBottom: 10 },
  pickerNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4, marginBottom: 10 },
  pickerMonthText: { fontFamily: Fonts.monoBold, fontSize: 15, color: Colors.text },
  calDay:          { flex: 1, textAlign: 'center', fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  calCell:         { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellRange:    { backgroundColor: ACCENT_DARK + '55', borderRadius: 0 },
  calCellEdge:     { backgroundColor: ACCENT_DARK },
  calCellToday:    { backgroundColor: Colors.surface },
  calCellText:     { fontFamily: Fonts.mono,     fontSize: 13, color: Colors.text },
  calCellTextActive: { fontFamily: Fonts.monoBold, color: Colors.text },
});
