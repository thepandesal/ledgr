import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';

const ACCENT      = Brand.color.accent;
const ACCENT_DARK = Brand.color.accentDark;
const ACCENT_TEXT = Brand.color.accentText;
const PEACH       = '#FFAB91';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const fmt  = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtC = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return fmt(n);
};

export default function LoansScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useUser();
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').width)).current;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
  }, []);

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: Dimensions.get('window').width, duration: 250, useNativeDriver: true }).start(() => router.back());
  };

  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');
  const [showPicker, setShowPicker] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo,   setDateTo]   = useState<Date | null>(null);
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear,  setPickerYear]  = useState(new Date().getFullYear());
  const [pickingDate, setPickingDate] = useState<'from' | 'to'>('from');

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['loans', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('*, categories:category_id(name, color, icon), account:account_id(account_name, bank)')
        .eq('user_id', userId)
        .eq('type', 'debt')
        .order('transaction_date', { ascending: false });
      return (data ?? []).map((r: any) => ({
        ...r,
        categories: Array.isArray(r.categories) ? r.categories[0] : r.categories,
        account:    Array.isArray(r.account)     ? r.account[0]     : r.account,
      }));
    },
    enabled: !!userId,
  });

  const filtered = loans.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (dateFrom || dateTo) {
      const [y, m, d] = r.transaction_date.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      if (dateFrom && date < dateFrom) return false;
      if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59); if (date > to) return false; }
    }
    return true;
  });

  const totalUnpaid  = loans.filter(r => r.status !== 'paid').reduce((s, r) => s + Number(r.amount), 0);
  const totalPaid    = loans.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0);
  const countOngoing = loans.filter(r => r.status !== 'paid').length;

  const handleDayPress = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    if (pickingDate === 'from') { setDateFrom(d); setDateTo(null); setPickingDate('to'); }
    else {
      if (dateFrom && d < dateFrom) { setDateFrom(d); setPickingDate('to'); }
      else { setDateTo(d); setShowPicker(false); setPickingDate('from'); }
    }
  };

  const clearDates = () => { setDateFrom(null); setDateTo(null); setPickingDate('from'); };

  const isInRange   = (day: number) => { if (!dateFrom || !dateTo) return false; const d = new Date(pickerYear, pickerMonth, day); return d >= dateFrom && d <= dateTo; };
  const isRangeEdge = (day: number) => { const d = new Date(pickerYear, pickerMonth, day); return !!(dateFrom && isSameDay(d, dateFrom)) || !!(dateTo && isSameDay(d, dateTo)); };

  const dateLabel = !dateFrom && !dateTo
    ? 'all time'
    : dateFrom && !dateTo
      ? `from ${dateFrom.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : `${dateFrom!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${dateTo!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const firstDay    = new Date(pickerYear, pickerMonth, 1).getDay();
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const cells       = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  // Group filtered by date
  const grouped: { label: string; items: any[] }[] = [];
  filtered.forEach(r => {
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const existing = grouped.find(g => g.label === label);
    if (existing) existing.items.push(r);
    else grouped.push({ label, items: [r] });
  });

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: Colors.white }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color="#B6E1DE" />
          </TouchableOpacity>
          <Text style={s.title}>loans</Text>
          <TouchableOpacity style={s.headerBtn} onPress={() => { setPickingDate('from'); setShowPicker(true); }} activeOpacity={0.8}>
            <Ionicons name="calendar-outline" size={16} color="#B6E1DE" />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          {[
            { key: 'all',     label: 'all',     value: String(loans.length),  color: Colors.text },
            { key: 'unpaid',  label: 'unpaid',  value: fmtC(totalUnpaid),     color: PEACH },
            { key: 'partial', label: 'partial', value: String(loans.filter(r => r.status === 'partial').length), color: ACCENT_DARK },
            { key: 'paid',    label: 'paid',    value: fmtC(totalPaid),       color: ACCENT_DARK },
          ].map(st => {
            const active = statusFilter === st.key;
            return (
              <TouchableOpacity
                key={st.key}
                style={[s.statCard, active && s.statCardActive]}
                onPress={() => setStatusFilter(st.key as any)}
                activeOpacity={0.75}
              >
                <Text style={[s.statValue, { color: active ? ACCENT_DARK : st.color }]}>{st.value}</Text>
                <Text style={[s.statLabel, active && { color: ACCENT_DARK }]}>{st.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date range label */}
        {(dateFrom || dateTo) && (
          <View style={s.dateRow}>
            <Ionicons name="calendar-outline" size={12} color={ACCENT_DARK} />
            <Text style={s.dateRowText}>{dateLabel}</Text>
            <TouchableOpacity onPress={clearDates} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={13} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator color={ACCENT_DARK} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="cash-outline" size={32} color={Colors.faint} />
            <Text style={s.emptyText}>no loans found</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {grouped.map(group => (
              <View key={group.label}>
                <View style={s.dateHeaderRow}>
                  <Text style={s.dateHeaderText}>{group.label}</Text>
                </View>
                {group.items.map(item => {
                  const isPaid    = item.status === 'paid';
                  const isPartial = item.status === 'partial';
                  const remaining = Number(item.amount) - Number(item.paid_amount ?? 0);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={s.row}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                    >
                      <View style={s.rowIconWrap}>
                        <Ionicons name={(item.categories?.icon ?? 'cash-outline') as any} size={18} color={isPaid ? ACCENT_DARK : PEACH} />
                      </View>
                      <View style={s.rowMid}>
                        <Text style={s.rowType}>
                          {isPaid ? 'paid' : isPartial ? 'partial' : 'unpaid'}
                          {item.account ? ` · ${item.account.bank ?? item.account.account_name}` : ''}
                        </Text>
                        <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                        {isPartial && (
                          <Text style={s.rowSub}>{fmt(Number(item.paid_amount ?? 0))} paid · {fmt(remaining)} left</Text>
                        )}
                      </View>
                      <Text style={[s.rowAmount, { color: isPaid ? ACCENT_DARK : PEACH }]}>
                        {fmt(Number(item.amount))}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <Text style={s.footer}>managed by LEDGR</Text>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Date picker */}
      <BottomSheet visible={showPicker} onClose={() => { setShowPicker(false); setPickingDate('from'); }} title={pickingDate === 'from' ? 'start date' : 'end date'} height="55%">
        <View style={s.pickerNav}>
          <TouchableOpacity onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); }}>
            <Ionicons name="chevron-back" size={18} color={Colors.text} />
          </TouchableOpacity>
          <Text style={s.pickerMonthText}>{MONTHS[pickerMonth].toLowerCase()} {pickerYear}</Text>
          <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}>
            <Ionicons name="chevron-forward" size={18} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: ACCENT_DARK, marginBottom: 8 }}>
          {pickingDate === 'from' ? 'tap start date' : 'tap end date'}
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {['su','mo','tu','we','th','fr','sa'].map(d => (
            <Text key={d} style={s.calDay}>{d}</Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
          {cells.map((day, i) => {
            if (!day) return <View key={`e${i}`} style={s.calCell} />;
            const inRange = isInRange(day);
            const edge    = isRangeEdge(day);
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
        <TouchableOpacity style={s.clearBtn} onPress={() => { clearDates(); setShowPicker(false); }}>
          <Text style={s.clearBtnText}>clear dates</Text>
        </TouchableOpacity>
      </BottomSheet>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // Header
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 16, paddingBottom: 16, gap: 10, backgroundColor: Colors.headerBg, borderBottomWidth: 1, borderBottomColor: Colors.borderMid },
  backBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.color.accent + '22', alignItems: 'center', justifyContent: 'center' },
  title:     { flex: 1, fontFamily: Brand.font.display, fontSize: 20, color: Brand.color.accent, letterSpacing: -0.3, textAlign: 'center' },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.color.accent + '22', alignItems: 'center', justifyContent: 'center' },

  // Stats
  statsRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.page, paddingVertical: 14 },
  statCard:    { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  statCardActive: { backgroundColor: ACCENT + '44', borderColor: ACCENT },
  statValue:   { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text, marginBottom: 2 },
  statLabel:   { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, textAlign: 'center', letterSpacing: 0.3 },

  // Date row
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.page, paddingBottom: 10 },
  dateRowText: { fontFamily: Fonts.mono, fontSize: 11, color: ACCENT_DARK, flex: 1 },

  // List
  scroll:        { paddingHorizontal: Spacing.page, paddingBottom: 80 },
  emptyWrap:     { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyText:     { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted },
  dateHeaderRow: { marginTop: 12, marginBottom: 6, paddingTop: 12 },
  dateHeaderText:{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, letterSpacing: 1.4, textTransform: 'uppercase' },

  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIconWrap: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  rowMid:      { flex: 1, gap: 2 },
  rowType:     { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, letterSpacing: 0.4, textTransform: 'uppercase' },
  rowName:     { ...Brand.type.cardTitle },
  rowSub:      { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  rowAmount:   { fontFamily: Fonts.monoBold, fontSize: 14, letterSpacing: -0.3 },

  footer: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint, textAlign: 'center', marginTop: 32 },

  // Calendar
  pickerNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4, marginBottom: 10 },
  pickerMonthText: { fontFamily: Fonts.monoBold, fontSize: 15, color: Colors.text },
  calDay:          { flex: 1, textAlign: 'center', fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  calCell:         { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellRange:    { backgroundColor: ACCENT + '55', borderRadius: 0 },
  calCellEdge:     { backgroundColor: ACCENT },
  calCellToday:    { backgroundColor: Colors.surface },
  calCellText:     { fontFamily: Fonts.mono, fontSize: 13, color: Colors.text },
  calCellTextActive: { fontFamily: Fonts.monoBold, color: Colors.white },
  clearBtn:        { alignSelf: 'center', marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  clearBtnText:    { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
});
