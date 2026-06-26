import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Radius, Spacing } from '@/components/ui/theme';
import { useRouter } from 'expo-router';

const I  = 'Inter_400Regular';
const IM = 'Inter_500Medium';
const IS = 'Inter_600SemiBold';
const IB = 'Inter_700Bold';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const ACTIVITY_TABS = [
  { key: 'money-in',    label: 'Money In',    icon: 'arrow-down-circle-outline', types: ['income','savings'], color: Colors.income },
  { key: 'money-out',   label: 'Money Out',   icon: 'arrow-up-circle-outline',   types: ['expense'],         color: Colors.expense },
  { key: 'loans',       label: 'Loans',       icon: 'cash-outline',              types: ['payable'],         color: Colors.pending },
  { key: 'receivables', label: 'Receivables', icon: 'arrow-undo-outline',        types: ['receivable'],      color: Colors.paid },
] as const;

type ActivityTab = typeof ACTIVITY_TABS[number]['key'];

type Preset = 'this-month' | 'last-30' | 'cutoff' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this-month', label: 'This Month' },
  { key: 'last-30',    label: 'Last 30d'   },
  { key: 'cutoff',     label: 'Cutoff'     },
  { key: 'custom',     label: 'Custom'     },
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

function getRangeForPreset(preset: Preset, cutoffDay: number): { from: Date; to: Date } {
  const now = new Date();
  if (preset === 'this-month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
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

export default function DashboardScreen() {
  const router    = useRouter();
  const { userId } = useUser();

  const [activePreset, setActivePreset] = useState<Preset>('this-month');
  const [activeTab,    setActiveTab]    = useState<ActivityTab>('money-in');
  const [cutoffDay,    setCutoffDay]    = useState(25);

  // custom range state
  const [customFrom, setCustomFrom] = useState<Date>(new Date());
  const [customTo,   setCustomTo]   = useState<Date>(new Date());

  // calendar picker state
  const [showPicker,   setShowPicker]   = useState(false);
  const [pickingDate,  setPickingDate]  = useState<'from' | 'to'>('from');
  const [pickerMonth,  setPickerMonth]  = useState(new Date().getMonth());
  const [pickerYear,   setPickerYear]   = useState(new Date().getFullYear());

  const range = activePreset === 'custom'
    ? { from: customFrom, to: customTo }
    : getRangeForPreset(activePreset, cutoffDay);

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['dashboard-activities', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('*, categories:category_id(name,color,icon), space:space_id(name)')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const currentTypes = ACTIVITY_TABS.find(t => t.key === activeTab)!.types as string[];

  const filtered = recordings.filter(r => {
    if (!currentTypes.includes(r.type)) return false;
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date < range.from) return false;
    const to = new Date(range.to); to.setHours(23, 59, 59);
    if (date > to) return false;
    return true;
  });

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);
  const activeTabData = ACTIVITY_TABS.find(t => t.key === activeTab)!;

  // ── date label under preset chips ──
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
      else { setCustomTo(d); setShowPicker(false); setPickingDate('from'); }
    }
  };

  const handlePreset = (key: Preset) => {
    if (key === 'custom') {
      const r = getRangeForPreset('this-month', cutoffDay);
      setCustomFrom(r.from); setCustomTo(r.to);
      setPickingDate('from'); setShowPicker(true);
    }
    setActivePreset(key);
  };

  const statusLabel = (r: any) => {
    if (activeTab === 'loans')       return r.status === 'paid'     ? 'paid'     : r.status === 'partial' ? 'partial' : 'unpaid';
    if (activeTab === 'receivables') return r.status === 'received' ? 'received' : r.status === 'partial' ? 'partial' : 'pending';
    return null;
  };
  const statusColor = (r: any) => {
    if (r.status === 'paid' || r.status === 'received') return Colors.income;
    if (r.status === 'partial') return Colors.cyan;
    return Colors.pending;
  };

  return (
    <SafeAreaView style={s.container}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Activities</Text>
          <Text style={s.subtitle}>your financial overview</Text>
        </View>
      </View>

      {/* ── Preset chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.presetRow}
        style={s.presetScroll}
      >
        {PRESETS.map(p => {
          const isActive = p.key === activePreset;
          return (
            <TouchableOpacity
              key={p.key}
              style={[s.presetChip, isActive && s.presetChipActive]}
              onPress={() => handlePreset(p.key)}
              activeOpacity={0.75}
            >
              {p.key === 'cutoff' && (
                <Ionicons name="cut-outline" size={12} color={isActive ? Colors.white : Colors.muted} />
              )}
              {p.key === 'custom' && (
                <Ionicons name="calendar-outline" size={12} color={isActive ? Colors.white : Colors.muted} />
              )}
              <Text style={[s.presetChipText, isActive && s.presetChipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Range label ── */}
      <View style={s.rangeLabelRow}>
        <Ionicons name="time-outline" size={11} color={Colors.faint} />
        <Text style={s.rangeLabel}>{rangeLabel}</Text>
        {activePreset === 'custom' && (
          <TouchableOpacity onPress={() => { setPickingDate('from'); setShowPicker(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.rangeLabelEdit}>edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Summary card ── */}
      <View style={[s.summaryCard, { borderLeftColor: activeTabData.color }]}>
        <View style={s.summaryTop}>
          <View style={[s.summaryIcon, { backgroundColor: activeTabData.color + '18' }]}>
            <Ionicons name={activeTabData.icon as any} size={18} color={activeTabData.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.summaryTabLabel}>{activeTabData.label}</Text>
            <Text style={s.summaryEntries}>{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</Text>
          </View>
          <Text style={[s.summaryTotal, { color: activeTabData.color }]}>
            {total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* ── Activity tab nav ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabRow}
        style={s.tabScroll}
      >
        {ACTIVITY_TABS.map(tab => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabChip, isActive && { backgroundColor: tab.color, borderColor: tab.color }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={tab.icon as any} size={12} color={isActive ? '#fff' : Colors.muted} />
              <Text style={[s.tabChipText, isActive && s.tabChipTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Divider ── */}
      <View style={s.divider} />

      {/* ── List ── */}
      {isLoading ? (
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 48 }} />
      ) : filtered.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIconWrap}>
            <Ionicons name={activeTabData.icon as any} size={28} color={Colors.faint} />
          </View>
          <Text style={s.emptyTitle}>nothing here</Text>
          <Text style={s.emptyText}>no {activeTabData.label.toLowerCase()} found{'\n'}for this period</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {filtered.map((item, idx) => {
            const prevDate  = filtered[idx - 1]?.transaction_date;
            const showDate  = item.transaction_date !== prevDate;
            const dateStr   = new Date(item.transaction_date + 'T00:00:00')
              .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            const sl = statusLabel(item);
            const sc = statusColor(item);

            return (
              <View key={item.id}>
                {showDate && (
                  <View style={s.dateHeaderRow}>
                    <Text style={s.dateHeaderText}>{dateStr}</Text>
                    <View style={s.dateHeaderLine} />
                  </View>
                )}
                <TouchableOpacity
                  style={s.row}
                  activeOpacity={0.7}
                  onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                >
                  <View style={[s.rowIconWrap, { backgroundColor: activeTabData.color + '12' }]}>
                    <Ionicons
                      name={(item.categories?.icon ?? activeTabData.icon) as any}
                      size={15}
                      color={activeTabData.color}
                    />
                  </View>
                  <View style={s.rowMid}>
                    <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                    {item.space?.name && (
                      <Text style={s.rowSpace} numberOfLines={1}>{item.space.name}</Text>
                    )}
                  </View>
                  <View style={s.rowRight}>
                    <Text style={[s.rowAmount, { color: activeTabData.color }]}>
                      {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    {sl && <Text style={[s.rowStatus, { color: sc }]}>{sl}</Text>}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Custom date picker modal ── */}
      <ConfirmModal
        visible={showPicker}
        onClose={() => { setShowPicker(false); setPickingDate('from'); }}
        title={pickingDate === 'from' ? 'start date' : 'end date'}
        actions={[
          { label: 'cancel', onPress: () => { setShowPicker(false); setPickingDate('from'); }, muted: true },
          { label: 'done',   onPress: () => { setShowPicker(false); setPickingDate('from'); } },
        ]}
      >
        <View style={s.pickerNav}>
          <TouchableOpacity onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); }}>
            <Ionicons name="chevron-back" size={18} color={Colors.text} />
          </TouchableOpacity>
          <Text style={s.pickerMonthText}>{MONTHS[pickerMonth].toLowerCase()} {pickerYear}</Text>
          <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}>
            <Ionicons name="chevron-forward" size={18} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={s.pickerHint}>{pickingDate === 'from' ? 'tap to set start date' : 'tap to set end date'}</Text>
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
      </ConfirmModal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  // Header
  header: {
    paddingHorizontal: Spacing.page,
    paddingTop: 28,
    paddingBottom: 20,
  },
  title:    { fontFamily: IB, fontSize: 28, color: Colors.text, letterSpacing: -0.6 },
  subtitle: { fontFamily: I,  fontSize: 12, color: Colors.muted, marginTop: 3 },

  // Preset chips
  presetScroll: { flexGrow: 0, flexShrink: 0 },
  presetRow: { paddingHorizontal: Spacing.page, gap: 8, paddingBottom: 2 },
  presetChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.pill, borderWidth: 1,
    borderColor: Colors.borderMid, backgroundColor: Colors.surface,
  },
  presetChipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  presetChipText: { fontFamily: IM, fontSize: 12, color: Colors.muted },
  presetChipTextActive: { color: Colors.white },

  // Range label
  rangeLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.page, marginTop: 10, marginBottom: 16,
  },
  rangeLabel:     { fontFamily: I, fontSize: 11, color: Colors.faint, flex: 1 },
  rangeLabelEdit: { fontFamily: IM, fontSize: 11, color: Colors.cyan },

  // Summary card
  summaryCard: {
    marginHorizontal: Spacing.page,
    marginBottom: 18,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryIcon: { width: 38, height: 38, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  summaryTabLabel: { fontFamily: IS, fontSize: 13, color: Colors.text },
  summaryEntries:  { fontFamily: I,  fontSize: 11, color: Colors.muted, marginTop: 2 },
  summaryTotal:    { fontFamily: IB, fontSize: 22, letterSpacing: -0.5 },

  // Activity tabs
  tabScroll: { flexGrow: 0, flexShrink: 0 },
  tabRow: { paddingHorizontal: Spacing.page, gap: 8, paddingVertical: 2 },
  tabChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.pill, borderWidth: 1,
    borderColor: Colors.borderMid, backgroundColor: Colors.surface,
  },
  tabChipText:       { fontFamily: IM, fontSize: 12, color: Colors.muted },
  tabChipTextActive: { color: '#fff' },

  // Divider
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.page, marginTop: 16, marginBottom: 4 },

  // Empty state
  emptyWrap:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 80 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: Radius.xl, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle:    { fontFamily: IS, fontSize: 14, color: Colors.text },
  emptyText:     { fontFamily: I,  fontSize: 12, color: Colors.muted, textAlign: 'center', lineHeight: 18 },

  // List
  list: { paddingHorizontal: Spacing.page, paddingTop: 8 },

  dateHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 8 },
  dateHeaderText: { fontFamily: IS, fontSize: 11, color: Colors.muted, letterSpacing: 0.2 },
  dateHeaderLine: { flex: 1, height: 1, backgroundColor: Colors.border },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowIconWrap: { width: 38, height: 38, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  rowMid:   { flex: 1, gap: 2 },
  rowName:  { fontFamily: IM, fontSize: 13, color: Colors.text },
  rowSpace: { fontFamily: I,  fontSize: 11, color: Colors.muted },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  rowAmount: { fontFamily: IB, fontSize: 14 },
  rowStatus: { fontFamily: IM, fontSize: 10 },

  // Calendar
  pickerNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 4, marginBottom: 10,
  },
  pickerMonthText: { fontFamily: IS, fontSize: 14, color: Colors.text },
  pickerHint:      { fontFamily: I,  fontSize: 10, color: Colors.cyan, marginBottom: 8 },
  calDay:     { flex: 1, textAlign: 'center', fontFamily: IM, fontSize: 10, color: Colors.faint },
  calCell:    { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellRange: { backgroundColor: Colors.cyan + '22', borderRadius: 0 },
  calCellEdge:  { backgroundColor: Colors.cyan },
  calCellToday: { backgroundColor: Colors.border },
  calCellText:  { fontFamily: I,  fontSize: 13, color: Colors.text },
  calCellTextActive: { fontFamily: IS, color: Colors.white },
});
