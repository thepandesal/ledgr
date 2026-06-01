import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  SafeAreaView, Animated, Dimensions, FlatList, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';

const { width } = Dimensions.get('window');

type ViewMode = 'daily' | 'weekly' | 'monthly';

const TYPE_CONFIG: Record<string, { color: string; sign: string; label: string }> = {
  expense:    { color: '#e74c3c', sign: '-', label: 'Expense' },
  income:     { color: '#00bf63', sign: '+', label: 'Income' },
  savings:    { color: '#3498db', sign: '+', label: 'Savings' },
  receivable: { color: '#00bf63', sign: '+', label: 'Receivable' },
  payable:    { color: '#8a8a8a', sign: '⋯', label: 'Payable' },
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export default function SpaceDetailScreen() {
  const { spaceId, name, color } = useLocalSearchParams<{ spaceId: string; name: string; color: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateInputVal, setDateInputVal] = useState('');

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
  }, []);

  useEffect(() => {
    if (spaceId) loadRecordings();
  }, [spaceId]);

  const loadRecordings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('recordings')
      .select('*, categories(name, color, icon)')
      .eq('space_id', spaceId)
      .order('transaction_date', { ascending: false });
    if (data) setRecordings(data);
    setLoading(false);
  };

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  const handleDateInputSubmit = () => {
    const parsed = new Date(dateInputVal);
    if (!isNaN(parsed.getTime())) {
      setSelectedDate(parsed);
      setShowDatePicker(false);
      setDateInputVal('');
    }
  };

  const filteredRecordings = recordings.filter(r => {
    const rDate = new Date(r.transaction_date);
    if (viewMode === 'daily') return isSameDay(rDate, selectedDate);
    if (viewMode === 'weekly') {
      const start = addDays(selectedDate, -selectedDate.getDay());
      const end = addDays(start, 6);
      return rDate >= start && rDate <= end;
    }
    if (viewMode === 'monthly') {
      return rDate.getMonth() === selectedDate.getMonth() && rDate.getFullYear() === selectedDate.getFullYear();
    }
    return true;
  });

  const totalIncome = filteredRecordings.filter(r => ['income', 'receivable', 'savings'].includes(r.type)).reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = filteredRecordings.filter(r => ['expense'].includes(r.type)).reduce((s, r) => s + Number(r.amount), 0);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <View style={[styles.spaceTag, { backgroundColor: color ?? '#FFB3B3' }]}>
            <Text style={styles.spaceTagText}>{name}</Text>
          </View>
          <TouchableOpacity onPress={() => { setDateInputVal(''); setShowDatePicker(true); }} style={styles.calendarBtn}>
            <Ionicons name="calendar-outline" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>in</Text>
            <Text style={[styles.summaryAmount, { color: '#00bf63' }]}>+{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>out</Text>
            <Text style={[styles.summaryAmount, { color: '#e74c3c' }]}>-{totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>net</Text>
            <Text style={[styles.summaryAmount, { color: totalIncome - totalExpense >= 0 ? '#00bf63' : '#e74c3c' }]}>
              {totalIncome - totalExpense >= 0 ? '+' : ''}{(totalIncome - totalExpense).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* View Mode Tabs */}
        <View style={styles.viewTabs}>
          {(['daily', 'weekly', 'monthly'] as ViewMode[]).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[styles.viewTab, viewMode === mode && styles.viewTabActive]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.viewTabText, viewMode === mode && styles.viewTabTextActive]}>{mode}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Daily Date Chips */}
        {viewMode === 'daily' && (
          <View style={styles.dateChipsRow}>
            {Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i - 3)).map((date, i) => {
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, new Date());
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text style={[styles.dateChipDay, isSelected && styles.dateChipTextSelected]}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dateChipNum, isSelected && styles.dateChipTextSelected]}>
                    {date.getDate()}
                  </Text>
                  {isToday && <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Weekly/Monthly Nav */}
        {viewMode !== 'daily' && (
          <View style={styles.navRow}>
            <TouchableOpacity onPress={() => {
              const d = new Date(selectedDate);
              if (viewMode === 'weekly') d.setDate(d.getDate() - 7);
              else d.setMonth(d.getMonth() - 1);
              setSelectedDate(d);
            }}>
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <Text style={styles.navLabel}>
              {viewMode === 'weekly'
                ? `Week of ${addDays(selectedDate, -selectedDate.getDay()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => {
              const d = new Date(selectedDate);
              if (viewMode === 'weekly') d.setDate(d.getDate() + 7);
              else d.setMonth(d.getMonth() + 1);
              setSelectedDate(d);
            }}>
              <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
        )}

        {/* Recordings List */}
        {loading ? (
          <ActivityIndicator color="#00bf63" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filteredRecordings}
            keyExtractor={r => r.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const cfg = TYPE_CONFIG[item.type] ?? { color: '#fff', sign: '', label: item.type };
              return (
                <View style={styles.recordingCard}>
                  <View style={styles.recordingLeft}>
                    {item.categories && (
                      <View style={[styles.catDot, { backgroundColor: item.categories.color }]}>
                        <Ionicons name={item.categories.icon} size={12} color="#1c1d1d" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordingName}>{item.name}</Text>
                      <Text style={styles.recordingMeta}>
                        {cfg.label} · {new Date(item.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {item.status === 'settled' ? ' · settled' : ''}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.recordingAmount, { color: cfg.color }]}>
                    {cfg.sign}{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={40} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyText}>no recordings</Text>
              </View>
            }
          />
        )}

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push({ pathname: '/(app)/add-recording', params: { spaceId, spaceName: name } } as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabText}>add recording</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>jump to date</Text>
            <TextInput
              style={styles.pickerInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={dateInputVal}
              onChangeText={setDateInputVal}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleDateInputSubmit}
            />
            <TouchableOpacity style={styles.pickerBtn} onPress={handleDateInputSubmit}>
              <Text style={styles.pickerBtnText}>go</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c1d1d', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 32 },
  calendarBtn: { width: 32, alignItems: 'flex-end' },
  spaceTag: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  spaceTagText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#1c1d1d' },
  summary: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#242525', borderRadius: 16, padding: 16, marginBottom: 16 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryLabel: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryAmount: { fontFamily: 'DMSans_700Bold', fontSize: 16 },
  summaryDivider: { width: 1, backgroundColor: '#3a3b3b' },
  viewTabs: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#242525', borderRadius: 12, padding: 4, marginBottom: 12 },
  viewTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  viewTabActive: { backgroundColor: '#00bf63' },
  viewTabText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  viewTabTextActive: { fontFamily: 'DMSans_600SemiBold', color: '#fff' },
  dateChipsRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 12, gap: 4 },
  dateChip: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10, backgroundColor: '#242525' },
  dateChipSelected: { backgroundColor: '#00bf63' },
  dateChipDay: { fontFamily: 'DMSans_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.5)' },
  dateChipNum: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#fff' },
  dateChipTextSelected: { color: '#fff' },
  todayDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#00bf63', marginTop: 1 },
  todayDotSelected: { backgroundColor: '#fff' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  navLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#fff' },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 8 },
  recordingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#242525', borderRadius: 14, padding: 14 },
  recordingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  catDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  recordingName: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#fff' },
  recordingMeta: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  recordingAmount: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.3)' },
  fab: { position: 'absolute', bottom: 24, right: 20, backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#fff' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  pickerBox: { backgroundColor: '#242525', borderRadius: 20, padding: 24, width: '80%', gap: 12 },
  pickerTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff', marginBottom: 4 },
  pickerInput: { backgroundColor: '#2a2b2b', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#fff', borderWidth: 1, borderColor: '#3a3b3b' },
  pickerBtn: { backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  pickerBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#fff' },
});
