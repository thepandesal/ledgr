import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  SafeAreaView, Animated, Dimensions, FlatList, ActivityIndicator, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';

const { width } = Dimensions.get('window');
type ViewMode = 'daily' | 'weekly' | 'monthly';
const MODES: ViewMode[] = ['daily', 'weekly', 'monthly'];

const TYPE_CONFIG: Record<string, { color: string; sign: string; label: string }> = {
  expense:    { color: '#e74c3c', sign: '-', label: 'Expense' },
  income:     { color: '#00bf63', sign: '+', label: 'Income' },
  savings:    { color: '#3498db', sign: '+', label: 'Savings' },
  receivable: { color: '#00bf63', sign: '+', label: 'Receivable' },
  payable:    { color: '#8a8a8a', sign: '⋯', label: 'Payable' },
};

const ACCOUNT_VERB: Record<string, string> = {
  expense:    'Paid from',
  income:     'Received to',
  savings:    'Saved to',
  receivable: 'Lent from',
  payable:    'Paying from',
};

function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

function getDateRangeLabel(viewMode: ViewMode, selectedDate: Date) {
  if (viewMode === 'daily') {
    const start = addDays(selectedDate, -3);
    const end = addDays(selectedDate, 3);
    const sm = start.toLocaleDateString('en-US', { month: 'long' });
    const em = end.toLocaleDateString('en-US', { month: 'long' });
    return sm === em ? sm : `${sm} to ${em}`;
  }
  if (viewMode === 'weekly') {
    const start = addDays(selectedDate, -selectedDate.getDay());
    const end = addDays(start, 6);
    const sm = start.toLocaleDateString('en-US', { month: 'long' });
    const em = end.toLocaleDateString('en-US', { month: 'long' });
    return sm === em ? sm : `${sm} to ${em}`;
  }
  return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function SpaceDetailScreen() {
  const { spaceId, name, color } = useLocalSearchParams<{ spaceId: string; name: string; color: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;
  const circleAnim = useRef(new Animated.Value(0)).current;
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [recordings, setRecordings] = useState<any[]>([]);
  const [splitIds, setSplitIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateInputVal, setDateInputVal] = useState('');
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [pendingDeleteName, setPendingDeleteName] = useState('');

  // Tab widths for circle positioning
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
  }, []);

  useEffect(() => { if (spaceId) loadRecordings(); }, [spaceId]);

  useEffect(() => {
    if (tabLayouts.length === 3) {
      const idx = MODES.indexOf(viewMode);
      const target = tabLayouts[idx]?.x ?? 0;
      Animated.spring(circleAnim, { toValue: target, useNativeDriver: true, tension: 60, friction: 10 }).start();
    }
  }, [viewMode, tabLayouts]);

  const loadRecordings = async () => {
    setLoading(true);
    const { data } = await supabase.from('recordings')
      .select('*, categories:category_id(name, color, icon), account:account_id(account_name, bank, color)')
      .eq('space_id', spaceId)
      .order('transaction_date', { ascending: false });
    if (data) {
      setRecordings(data);
      const { data: splits } = await supabase.from('bill_splits').select('recording_id').in('recording_id', data.map(r => r.id));
      if (splits) setSplitIds(new Set(splits.map((s: any) => s.recording_id)));
    }
    setLoading(false);
  };

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: true }).start(() => router.back());
  };

  const handleDelete = (id: string, recName: string) => {
    setPendingDeleteId(id); setPendingDeleteName(recName); setConfirmModal(true);
  };

  const confirmDelete = async () => {
    await supabase.from('recordings').delete().eq('id', pendingDeleteId);
    setRecordings(prev => prev.filter(r => r.id !== pendingDeleteId));
    setConfirmModal(false);
  };

  const handleDateInputSubmit = () => {
    const parsed = new Date(dateInputVal);
    if (!isNaN(parsed.getTime())) { setSelectedDate(parsed); setShowDatePicker(false); setDateInputVal(''); }
  };

  const filteredRecordings = recordings.filter(r => {
    const parts = r.transaction_date.split('-');
    const rDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (viewMode === 'daily') return isSameDay(rDate, selectedDate);
    if (viewMode === 'weekly') { const start = addDays(selectedDate, -selectedDate.getDay()); const end = addDays(start, 6); return rDate >= start && rDate <= end; }
    if (viewMode === 'monthly') return rDate.getMonth() === selectedDate.getMonth() && rDate.getFullYear() === selectedDate.getFullYear();
    return true;
  });

  const totalIncome = filteredRecordings.filter(r => ['income', 'receivable', 'savings'].includes(r.type)).reduce((s, r) => s + Number(r.amount), 0);
  const totalExpense = filteredRecordings.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);

  const dateRangeLabel = getDateRangeLabel(viewMode, selectedDate);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>

        {/* Back button */}
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#8a8a8a" />
        </TouchableOpacity>

        {/* Space label + name */}
        <View style={styles.titleBlock}>
          <Text style={styles.spacesLabel}>spaces</Text>
          <Text style={styles.spaceName}>{(name ?? '').toLowerCase()}</Text>
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

        {/* View mode tabs */}
        <View style={styles.tabsWrapper}>
          <View style={styles.tabs}>
            {MODES.map((mode, idx) => (
              <TouchableOpacity
                key={mode}
                style={styles.tabItem}
                onPress={() => setViewMode(mode)}
                onLayout={e => {
                  const { x, width: w } = e.nativeEvent.layout;
                  setTabLayouts(prev => { const next = [...prev]; next[idx] = { x, width: w }; return next; });
                }}
              >
                <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>{mode}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {tabLayouts.length === 3 && (
            <Animated.Image
              source={require('../../assets/circle-doodle.png')}
              style={[styles.circleDoodle, { transform: [{ translateX: circleAnim }] }]}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Date range label */}
        <Text style={styles.dateRangeLabel}>{dateRangeLabel.toLowerCase()}</Text>

        {/* Daily date chips — portrait style */}
        {viewMode === 'daily' && (
          <View style={styles.dateChipsRow}>
            {Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i - 3)).map((date, i) => {
              const isSelected = isSameDay(date, selectedDate);
              const isToday = isSameDay(date, new Date());
              return (
                <TouchableOpacity key={i} style={[styles.dateChip, isSelected && styles.dateChipSelected]} onPress={() => setSelectedDate(date)}>
                  <Text style={[styles.dateChipDay, isSelected && styles.dateChipTextSelected]}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dateChipNum, isSelected && styles.dateChipTextSelected]}>{date.getDate()}</Text>
                  {isToday && <View style={[styles.todayDot, isSelected && styles.todayDotSelected]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Weekly / Monthly nav */}
        {viewMode !== 'daily' && (
          <View style={styles.navRow}>
            <TouchableOpacity onPress={() => {
              const d = new Date(selectedDate);
              if (viewMode === 'weekly') d.setDate(d.getDate() - 7); else d.setMonth(d.getMonth() - 1);
              setSelectedDate(d);
            }}>
              <Ionicons name="chevron-back" size={22} color="#8a8a8a" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              const d = new Date(selectedDate);
              if (viewMode === 'weekly') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1);
              setSelectedDate(d);
            }}>
              <Ionicons name="chevron-forward" size={22} color="#8a8a8a" />
            </TouchableOpacity>
          </View>
        )}

        {/* Recordings list */}
        {loading ? (
          <ActivityIndicator color="#00bf63" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filteredRecordings}
            keyExtractor={r => r.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const cfg = TYPE_CONFIG[item.type] ?? { color: '#1c1d1d', sign: '', label: item.type };
              return (
                <View style={styles.recordingCard}>
                  <View style={styles.recordingLeft}>
                    {item.categories ? (
                      <View style={[styles.catDot, { backgroundColor: item.categories.color }]}>
                        <Ionicons name={item.categories.icon} size={12} color="#1c1d1d" />
                      </View>
                    ) : (
                      <View style={[styles.catDot, { backgroundColor: '#e8e8e8' }]}>
                        <Ionicons name="ellipse-outline" size={12} color="#8a8a8a" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordingName}>{item.name}</Text>
                      <Text style={styles.recordingMeta}>
                        {cfg.label} · {new Date(item.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                      {item.account ? (
                        <Text style={styles.recordingAccount}>
                          {ACCOUNT_VERB[item.type] ?? 'Via'}: {item.account.account_name} · {item.account.bank}
                        </Text>
                      ) : null}
                      {item.notes ? <Text style={styles.recordingNotes} numberOfLines={1}>{item.notes}</Text> : null}
                      {item.status === 'settled' ? <Text style={styles.settledBadge}>✓ settled</Text> : null}
                    </View>
                  </View>
                  <View style={styles.recordingRight}>
                    <Text style={[styles.recordingAmount, { color: cfg.color }]}>
                      {cfg.sign}{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    <View style={styles.recordingActions}>
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: '/(app)/split-bill', params: { recordingId: item.id, recordingName: item.name, amount: item.amount } } as any)}
                        style={styles.actionBtn}
                      >
                        <Ionicons name="people-outline" size={14} color={splitIds.has(item.id) ? '#00bf63' : '#b0b0b0'} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: '/(app)/add-recording', params: { spaceId, spaceName: name, defaultDate: selectedDate.toISOString().split('T')[0], editId: item.id } } as any)}
                        style={styles.actionBtn}
                      >
                        <Ionicons name="pencil-outline" size={14} color="#8a8a8a" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(item.id, item.name)} style={styles.actionBtn}>
                        <Ionicons name="trash-outline" size={14} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="receipt-outline" size={40} color="#e8e8e8" />
                <Text style={styles.emptyText}>no recordings</Text>
              </View>
            }
          />
        )}

        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push({ pathname: '/(app)/add-recording', params: { spaceId, spaceName: name, defaultDate: selectedDate.toISOString().split('T')[0] } } as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabText}>add recording</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <Modal visible={confirmModal} transparent animationType="fade" onRequestClose={() => setConfirmModal(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>delete recording</Text>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#8a8a8a', marginBottom: 4 }}>
              Delete "{pendingDeleteName}"? This cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.pickerBtn, { flex: 1, backgroundColor: '#f5f5f5' }]} onPress={() => setConfirmModal(false)}>
                <Text style={[styles.pickerBtnText, { color: '#8a8a8a' }]}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerBtn, { flex: 1, backgroundColor: '#e74c3c' }]} onPress={confirmDelete}>
                <Text style={styles.pickerBtnText}>delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>jump to date</Text>
            <TextInput style={styles.pickerInput} placeholder="YYYY-MM-DD" placeholderTextColor="#b0b0b0" value={dateInputVal} onChangeText={setDateInputVal} autoFocus returnKeyType="go" onSubmitEditing={handleDateInputSubmit} />
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
  container: { flex: 1, backgroundColor: '#f5f5f5', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  backBtn: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  titleBlock: { paddingHorizontal: 24, marginTop: 8, marginBottom: 20 },
  spacesLabel: { fontFamily: 'Avenelle', fontSize: 13, color: '#929090' },
  spaceName: { fontFamily: 'Avenelle', fontSize: 40, color: '#0ccfcf', lineHeight: 46 },
  summary: { flexDirection: 'row', marginHorizontal: 24, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryLabel: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#b0b0b0', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryAmount: { fontFamily: 'DMSans_700Bold', fontSize: 16 },
  summaryDivider: { width: 1, backgroundColor: '#e8e8e8' },
  tabsWrapper: { paddingHorizontal: 24, marginBottom: 4 },
  tabs: { flexDirection: 'row', gap: 24 },
  tabItem: { paddingVertical: 6 },
  tabText: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#425252' },
  tabTextActive: { fontFamily: 'DMSans_600SemiBold', color: '#425252' },
  circleDoodle: { position: 'absolute', width: 70, height: 40, top: -2, pointerEvents: 'none' },
  dateRangeLabel: { fontFamily: 'Avenelle', fontSize: 18, color: '#1c1d1d', paddingHorizontal: 24, marginBottom: 14, marginTop: 6 },
  dateChipsRow: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16, gap: 6 },
  dateChip: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderRadius: 14, backgroundColor: '#ffffff', minHeight: 60 },
  dateChipSelected: { backgroundColor: '#0ccfcf' },
  dateChipDay: { fontFamily: 'DMSans_700Bold', fontSize: 9, color: '#b0b0b0' },
  dateChipNum: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#1c1d1d', marginTop: 4 },
  dateChipTextSelected: { color: '#fff' },
  todayDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#0ccfcf', marginTop: 3 },
  todayDotSelected: { backgroundColor: '#fff' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 12 },
  list: { paddingHorizontal: 24, paddingBottom: 100, gap: 8 },
  recordingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  recordingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  recordingRight: { alignItems: 'flex-end', gap: 4 },
  catDot: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  recordingName: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#1c1d1d' },
  recordingMeta: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#b0b0b0', marginTop: 2 },
  recordingNotes: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#8a8a8a', marginTop: 2, fontStyle: 'italic' },
  recordingAccount: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#8a8a8a', marginTop: 2 },
  settledBadge: { fontFamily: 'DMSans_600SemiBold', fontSize: 10, color: '#00bf63', marginTop: 3 },
  recordingAmount: { fontFamily: 'DMSans_700Bold', fontSize: 15 },
  recordingActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionBtn: { padding: 2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#b0b0b0' },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#00bf63', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#fff' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  pickerBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, width: '80%', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  pickerTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#1c1d1d', marginBottom: 4 },
  pickerInput: { backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#1c1d1d', borderWidth: 1, borderColor: '#e8e8e8' },
  pickerBtn: { backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  pickerBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#fff' },
});
