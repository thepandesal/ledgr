import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Radius, Spacing } from '@/components/ui/theme';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const TABS = [
  { key: 'money-in',    label: 'Money In',    icon: 'arrow-down-circle-outline',  types: ['income', 'savings'],   color: Colors.income },
  { key: 'money-out',   label: 'Money Out',   icon: 'arrow-up-circle-outline',    types: ['expense'],             color: Colors.expense },
  { key: 'loans',       label: 'Loans',       icon: 'cash-outline',               types: ['payable'],             color: Colors.pending },
  { key: 'receivables', label: 'Receivables', icon: 'arrow-undo-outline',         types: ['receivable'],          color: Colors.paid },
] as const;

type TabKey = typeof TABS[number]['key'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDefaultRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  return { from, to: now };
}

export default function DashboardScreen() {
  const router = useRouter();
  const { userId } = useUser();

  const defaultRange = getDefaultRange();
  const [dateFrom, setDateFrom] = useState<Date>(defaultRange.from);
  const [dateTo, setDateTo]     = useState<Date>(defaultRange.to);
  const [activeTab, setActiveTab] = useState<TabKey>('money-in');

  const [showPicker, setShowPicker]   = useState(false);
  const [pickingDate, setPickingDate] = useState<'from' | 'to'>('from');
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear]   = useState(new Date().getFullYear());

  const tabScrollRef = useRef<ScrollView>(null);

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['dashboard-activities', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('*, categories:category_id(name, color, icon)')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const currentTypes = TABS.find(t => t.key === activeTab)!.types as string[];

  const filtered = recordings.filter(r => {
    if (!currentTypes.includes(r.type)) return false;
    const parts = r.transaction_date.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (d < dateFrom) return false;
    const to = new Date(dateTo); to.setHours(23, 59, 59);
    if (d > to) return false;
    return true;
  });

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);

  const handleDayPress = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    if (pickingDate === 'from') {
      setDateFrom(d);
      setDateTo(d);
      setPickingDate('to');
    } else {
      if (d < dateFrom) {
        setDateFrom(d);
        setPickingDate('to');
      } else {
        setDateTo(d);
        setShowPicker(false);
        setPickingDate('from');
      }
    }
  };

  const isInRange = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    return d > dateFrom && d < dateTo;
  };

  const isRangeEdge = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    return isSameDay(d, dateFrom) || isSameDay(d, dateTo);
  };

  const dateLabel = () => {
    const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fmtFull  = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (isSameDay(dateFrom, dateTo)) return fmtFull(dateFrom);
    return `${fmtShort(dateFrom)} – ${fmtFull(dateTo)}`;
  };

  const firstDay   = new Date(pickerYear, pickerMonth, 1).getDay();
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const activeTabData = TABS.find(t => t.key === activeTab)!;

  const statusLabel = (r: any) => {
    if (activeTab === 'loans')       return r.status === 'paid'     ? 'paid'     : r.status === 'partial' ? 'partial' : 'unpaid';
    if (activeTab === 'receivables') return r.status === 'received' ? 'received' : r.status === 'partial' ? 'partial' : 'pending';
    return null;
  };

  const statusColor = (r: any) => {
    const s = r.status;
    if (s === 'paid' || s === 'received') return Colors.income;
    if (s === 'partial') return Colors.cyan;
    return Colors.pending;
  };

  return (
    <SafeAreaView style={s.container}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>activities</Text>
          <Text style={s.sub}>your financial overview</Text>
        </View>

        {/* Date range pill */}
        <TouchableOpacity
          style={s.datePill}
          onPress={() => { setPickingDate('from'); setShowPicker(true); }}
          activeOpacity={0.75}
        >
          <Ionicons name="calendar-outline" size={13} color={Colors.cyan} />
          <Text style={s.datePillText}>{dateLabel()}</Text>
          <Ionicons name="chevron-down" size={11} color={Colors.muted} />
        </TouchableOpacity>
      </View>

      {/* ── Summary card ── */}
      <View style={s.summaryCard}>
        <View style={s.summaryLeft}>
          <View style={[s.summaryIconWrap, { backgroundColor: activeTabData.color + '18' }]}>
            <Ionicons name={activeTabData.icon as any} size={20} color={activeTabData.color} />
          </View>
          <View>
            <Text style={s.summaryLabel}>{activeTabData.label}</Text>
            <Text style={s.summaryCount}>{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</Text>
          </View>
        </View>
        <Text style={[s.summaryAmount, { color: activeTabData.color }]}>
          {total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
      </View>

      {/* ── Tab nav ── */}
      <ScrollView
        ref={tabScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabRow}
        style={s.tabScroll}
      >
        {TABS.map(tab => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabChip, isActive && { backgroundColor: tab.color, borderColor: tab.color }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={tab.icon as any}
                size={13}
                color={isActive ? '#fff' : Colors.muted}
              />
              <Text style={[s.tabChipText, isActive && s.tabChipTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── List ── */}
      {isLoading ? (
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name={activeTabData.icon as any} size={38} color={Colors.border} />
          <Text style={s.emptyText}>no {activeTabData.label.toLowerCase()} in this period</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((item, idx) => {
            const prevItem = filtered[idx - 1];
            const currDate = item.transaction_date;
            const prevDate = prevItem?.transaction_date;
            const showDate = currDate !== prevDate;

            const dateStr = new Date(item.transaction_date + 'T00:00:00')
              .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            const sl = statusLabel(item);
            const sc = statusColor(item);

            return (
              <View key={item.id}>
                {showDate && (
                  <Text style={s.dateHeader}>{dateStr}</Text>
                )}
                <TouchableOpacity
                  style={s.row}
                  activeOpacity={0.8}
                  onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                >
                  {/* Icon */}
                  <View style={[s.rowIcon, { backgroundColor: activeTabData.color + '15' }]}>
                    <Ionicons
                      name={(item.categories?.icon ?? activeTabData.icon) as any}
                      size={16}
                      color={activeTabData.color}
                    />
                  </View>

                  {/* Middle */}
                  <View style={s.rowMid}>
                    <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                    {item.categories?.name && (
                      <Text style={s.rowMeta}>{item.categories.name}</Text>
                    )}
                  </View>

                  {/* Right */}
                  <View style={s.rowRight}>
                    <Text style={[s.rowAmount, { color: activeTabData.color }]}>
                      {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    {sl && (
                      <Text style={[s.rowStatus, { color: sc }]}>{sl}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ── Date picker modal ── */}
      <ConfirmModal
        visible={showPicker}
        onClose={() => { setShowPicker(false); setPickingDate('from'); }}
        title={pickingDate === 'from' ? 'select start date' : 'select end date'}
        actions={[
          { label: 'reset', onPress: () => { const r = getDefaultRange(); setDateFrom(r.from); setDateTo(r.to); setShowPicker(false); setPickingDate('from'); }, muted: true },
          { label: 'done',  onPress: () => { setShowPicker(false); setPickingDate('from'); } },
        ]}
      >
        <View style={s.pickerNav}>
          <TouchableOpacity onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); }}>
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={s.pickerMonthLabel}>{MONTHS[pickerMonth].toLowerCase()} {pickerYear}</Text>
          <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}>
            <Ionicons name="chevron-forward" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={s.pickerHint}>
          {pickingDate === 'from' ? 'tap to set start date' : 'tap to set end date'}
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          {['su','mo','tu','we','th','fr','sa'].map(d => (
            <Text key={d} style={s.calWeekday}>{d}</Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
          {cells.map((day, i) => {
            if (!day) return <View key={`e${i}`} style={s.calCell} />;
            const inRange = isInRange(day);
            const isEdge  = isRangeEdge(day);
            const isToday = isSameDay(new Date(pickerYear, pickerMonth, day), new Date());
            return (
              <TouchableOpacity
                key={day}
                style={[s.calCell, inRange && s.calCellRange, isEdge && s.calCellEdge, !inRange && !isEdge && isToday && s.calCellToday]}
                onPress={() => handleDayPress(day)}
              >
                <Text style={[s.calCellText, (isEdge || isToday) && s.calCellTextActive]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ConfirmModal>

    </SafeAreaView>
  );
}

const INTER_REGULAR = 'Inter_400Regular';
const INTER_MEDIUM  = 'Inter_500Medium';
const INTER_SEMI    = 'Inter_600SemiBold';
const INTER_BOLD    = 'Inter_700Bold';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.page,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  greeting: { fontFamily: INTER_BOLD, fontSize: 26, color: Colors.text, letterSpacing: -0.5 },
  sub:      { fontFamily: INTER_REGULAR, fontSize: 12, color: Colors.muted, marginTop: 2 },

  // Date pill
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  datePillText: { fontFamily: INTER_MEDIUM, fontSize: 11, color: Colors.text },

  // Summary card
  summaryCard: {
    marginHorizontal: Spacing.page,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryIconWrap: { width: 40, height: 40, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  summaryLabel: { fontFamily: INTER_SEMI, fontSize: 13, color: Colors.text },
  summaryCount: { fontFamily: INTER_REGULAR, fontSize: 11, color: Colors.muted, marginTop: 2 },
  summaryAmount: { fontFamily: INTER_BOLD, fontSize: 20, letterSpacing: -0.5 },

  // Tabs
  tabScroll: { flexGrow: 0, marginBottom: Spacing.md },
  tabRow: { paddingHorizontal: Spacing.page, gap: 8, alignItems: 'center' },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.surface,
  },
  tabChipText: { fontFamily: INTER_MEDIUM, fontSize: 12, color: Colors.muted },
  tabChipTextActive: { color: '#fff' },

  // Empty
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingBottom: 60 },
  emptyText: { fontFamily: INTER_REGULAR, fontSize: 13, color: Colors.muted },

  // List
  list: { paddingHorizontal: Spacing.page, paddingTop: 4 },
  dateHeader: {
    fontFamily: INTER_SEMI,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowIcon: { width: 36, height: 36, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  rowMid: { flex: 1 },
  rowName: { fontFamily: INTER_MEDIUM, fontSize: 13, color: Colors.text },
  rowMeta: { fontFamily: INTER_REGULAR, fontSize: 11, color: Colors.muted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowAmount: { fontFamily: INTER_BOLD, fontSize: 14 },
  rowStatus: { fontFamily: INTER_MEDIUM, fontSize: 10 },

  // Calendar picker
  pickerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  pickerMonthLabel: { fontFamily: INTER_SEMI, fontSize: 15, color: Colors.text },
  pickerHint: { fontFamily: INTER_REGULAR, fontSize: 10, color: Colors.cyan, marginBottom: 8 },
  calWeekday: { flex: 1, textAlign: 'center', fontFamily: INTER_MEDIUM, fontSize: 10, color: Colors.faint },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellRange: { backgroundColor: Colors.cyan + '22', borderRadius: 0 },
  calCellEdge:  { backgroundColor: Colors.cyan },
  calCellToday: { backgroundColor: Colors.border },
  calCellText:  { fontFamily: INTER_REGULAR, fontSize: 13, color: Colors.text },
  calCellTextActive: { fontFamily: INTER_SEMI, color: Colors.white },
});
