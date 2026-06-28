import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import ConfirmModal from '@/components/ui/ConfirmModal';
import pageStyles from '@/components/ui/pageStyles';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';

const { width } = Dimensions.get('window');
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function LoansScreen() {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;
  const { userId } = useUser();

  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickingDate, setPickingDate] = useState<'from' | 'to'>('from');

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
  }, []);

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['loans', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('*, categories:category_id(name, color, icon), account:account_id(account_name, bank)')
        .eq('user_id', userId)
        .eq('type', 'payable')
        .order('transaction_date', { ascending: false });
      return (data ?? []).map((r: any) => ({
        ...r,
        categories: Array.isArray(r.categories) ? r.categories[0] : r.categories,
        account: Array.isArray(r.account) ? r.account[0] : r.account,
      }));
    },
    enabled: !!userId,
  });

  const filtered = loans.filter(r => {
    if (activeFilters.length > 0) {
      const isPaid = r.status === 'paid';
      const isOngoing = r.status !== 'paid';
      const matchPaid = activeFilters.includes('paid') && isPaid;
      const matchOngoing = activeFilters.includes('ongoing') && isOngoing;
      const matchUnpaid = activeFilters.includes('unpaid') && r.status !== 'paid';
      if (!matchPaid && !matchOngoing && !matchUnpaid) return false;
    }
    if (dateFrom || dateTo) {
      const parts = r.transaction_date.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      if (dateFrom && d < dateFrom) return false;
      if (dateTo) {
        const to = new Date(dateTo); to.setHours(23, 59, 59);
        if (d > to) return false;
      }
    }
    return true;
  });

  const totalUnpaid = filtered.filter(r => r.status !== 'paid').reduce((s, r) => s + Number(r.amount), 0);
  const totalPaid = filtered.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0);
  const countOngoing = filtered.filter(r => r.status !== 'paid').length;

  const handleDayPress = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    if (pickingDate === 'from') {
      setDateFrom(d);
      setDateTo(null);
      setPickingDate('to');
    } else {
      if (dateFrom && d < dateFrom) {
        setDateFrom(d);
        setPickingDate('to');
      } else {
        setDateTo(d);
        setShowPicker(false);
        setPickingDate('from');
      }
    }
  };

  const clearDates = () => { setDateFrom(null); setDateTo(null); setPickingDate('from'); };

  const isInRange = (day: number) => {
    if (!dateFrom || !dateTo) return false;
    const d = new Date(pickerYear, pickerMonth, day);
    return d >= dateFrom && d <= dateTo;
  };

  const isRangeEdge = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    return (dateFrom && isSameDay(d, dateFrom)) || (dateTo && isSameDay(d, dateTo));
  };

  const dateLabel = () => {
    if (!dateFrom && !dateTo) return 'all time';
    if (dateFrom && !dateTo) return `from ${dateFrom.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    return `${dateFrom!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${dateTo!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const statusColor = (status: string) => {
    if (status === 'paid') return Colors.income;
    if (status === 'partial') return Colors.cyan;
    return Colors.pending;
  };

  const statusBg = (status: string) => {
    if (status === 'paid') return '#f0fff8';
    if (status === 'partial') return '#f0f8ff';
    return '#f8edfd';
  };

  const firstDay = new Date(pickerYear, pickerMonth, 1).getDay();
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  return (
    <Animated.View style={[pageStyles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={pageStyles.inner}>
        <TouchableOpacity onPress={() => {
          Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
        }} style={pageStyles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.muted} />
        </TouchableOpacity>

        {/* Header */}
        <View style={{ paddingHorizontal: Spacing.page, marginBottom: 16 }}>
          <Text style={s.pageTitle}>loans</Text>
          <Text style={s.pageSubtitle}>your payables, tracked.</Text>
        </View>

        {/* Stats as filter toggles */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: Spacing.page, marginBottom: 16 }}>
          {[
            { key: 'ongoing', label: 'ongoing', value: countOngoing, color: Colors.pending },
            { key: 'unpaid',  label: 'unpaid total', value: totalUnpaid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }), color: Colors.expense },
            { key: 'paid',    label: 'paid total', value: totalPaid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }), color: Colors.income },
          ].map((st) => {
            const isActive = activeFilters.includes(st.key);
            return (
              <TouchableOpacity
                key={st.key}
                style={[s.statCard, isActive && { borderColor: Colors.cyan, backgroundColor: Colors.cyan + '18' }]}
                onPress={() => setActiveFilters(prev => isActive ? prev.filter(k => k !== st.key) : [...prev, st.key])}
                activeOpacity={0.7}
              >
                <Text style={[s.statValue, { color: isActive ? Colors.cyan : st.color }]}>{st.value}</Text>
                <Text style={[s.statLabel, isActive && { color: Colors.cyan }]}>{st.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date range */}
        <View style={{ paddingHorizontal: Spacing.page, marginBottom: 12 }}>
          <TouchableOpacity style={s.dateRangeBtn} onPress={() => { setPickingDate('from'); setShowPicker(true); }}>
            <Ionicons name="calendar-outline" size={14} color={dateFrom ? Colors.cyan : Colors.muted} />
            <Text style={[s.dateRangeBtnText, dateFrom && { color: Colors.cyan }]}>{dateLabel()}</Text>
            {(dateFrom || dateTo) && (
              <TouchableOpacity onPress={clearDates} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={14} color={Colors.muted} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>
        {isLoading ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={[pageStyles.emptyBox, { borderWidth: 0, backgroundColor: 'transparent', marginTop: 40 }]}>
            <Ionicons name="cash-outline" size={40} color={Colors.borderMid} />
            <Text style={pageStyles.emptyText}>no loans found</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.page, paddingBottom: 120, gap: 10 }} showsVerticalScrollIndicator={false}>
            {filtered.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[s.recordingCard, { backgroundColor: statusBg(item.status) }]}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
              >
                <Ionicons name={item.categories?.icon ?? 'cash-outline'} size={22} color={statusColor(item.status)} style={{ flexShrink: 0 }} />
                <View style={s.recordingMiddle}>
                  <Text style={s.recordingName} numberOfLines={1}>{item.name}</Text>
                  <Text style={[s.recordingMeta, { fontFamily: Fonts.monoBold, color: statusColor(item.status) }]}>
                    {item.status === 'paid' ? 'paid' : item.status === 'partial' ? 'partial' : 'unpaid'}
                  </Text>
                  <Text style={s.recordingMeta}>{new Date(item.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Text style={[s.recordingAmount, { color: statusColor(item.status) }]}>
                    {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                  {item.paid_amount > 0 && item.status !== 'paid' && (
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint }}>
                      {Number(item.paid_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} paid
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Date range picker */}
      <ConfirmModal
        visible={showPicker}
        onClose={() => { setShowPicker(false); setPickingDate('from'); }}
        title={pickingDate === 'from' ? 'select start date' : 'select end date'}
        actions={[
          { label: 'clear', onPress: () => { clearDates(); setShowPicker(false); }, muted: true },
          { label: 'done', onPress: () => { setShowPicker(false); setPickingDate('from'); } },
        ]}
      >
        <View style={s.pickerYearRow}>
          <TouchableOpacity onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); }}>
            <Ionicons name="chevron-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={s.pickerYearText}>{MONTHS[pickerMonth].toLowerCase()} {pickerYear}</Text>
          <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}>
            <Ionicons name="chevron-forward" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.cyan, marginBottom: 8 }}>
          {pickingDate === 'from' ? 'tap to set start date' : 'tap to set end date'}
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          {['su','mo','tu','we','th','fr','sa'].map(d => (
            <Text key={d} style={{ flex: 1, textAlign: 'center', fontFamily: Fonts.sans, fontSize: 11, color: Colors.faint }}>{d}</Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
          {cells.map((day, i) => {
            if (!day) return <View key={`e${i}`} style={s.calCell} />;
            const inRange = isInRange(day);
            const isEdge = isRangeEdge(day);
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
    </Animated.View>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontFamily: Fonts.calSans, fontSize: 32, color: '#425252', letterSpacing: -0.5 },
  pageSubtitle: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.muted, marginTop: 2 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  statValue: { fontFamily: 'ChillaxMedium', fontSize: 13, marginBottom: 2 },
  statLabel: { fontFamily: 'ChillaxLight', fontSize: 9, color: Colors.muted, textAlign: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  filterChipActive: { backgroundColor: Colors.text, borderColor: Colors.text },
  filterChipText: { fontFamily: 'ChillaxMedium', fontSize: 12, color: Colors.muted },
  filterChipTextActive: { color: Colors.white },
  dateRangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  dateRangeBtnText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, flex: 1 },
  recordingCard: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  recordingMiddle: { flex: 1, gap: 2, overflow: 'hidden' },
  recordingName: { fontFamily: 'ChillaxMedium', fontSize: 13, color: '#292929' },
  recordingMeta: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  recordingAmount: { fontFamily: Fonts.monoBold, fontSize: 14 },
  pickerYearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4, marginBottom: 12 },
  pickerYearText: { fontFamily: Fonts.calSans, fontSize: 16, color: Colors.text },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellRange: { backgroundColor: Colors.cyan + '22', borderRadius: 0 },
  calCellEdge: { backgroundColor: Colors.cyan, borderRadius: Radius.pill },
  calCellToday: { backgroundColor: Colors.border },
  calCellText: { fontFamily: Fonts.sans, fontSize: 13, color: Colors.text },
  calCellTextActive: { fontFamily: Fonts.sansSemiBold, color: Colors.white },
});
