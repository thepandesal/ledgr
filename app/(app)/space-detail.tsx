import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';

const { width } = Dimensions.get('window');
type ViewMode = 'daily' | 'weekly' | 'monthly';
const MODES: ViewMode[] = ['daily', 'weekly', 'monthly'];
const DOODLE_W = 90;



function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function dateKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

function getNavLabel(viewMode: ViewMode, selectedDate: Date) {
  if (viewMode === 'weekly') {
    const start = addDays(selectedDate, -selectedDate.getDay());
    const end = addDays(start, 6);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(start)} to ${fmt(end)}`;
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

export default function SpaceDetailScreen() {
  const { spaceId, name } = useLocalSearchParams<{ spaceId: string; name: string; color: string }>();
  const router = useRouter();

  const slideAnim = useRef(new Animated.Value(width)).current;
  const circleAnim = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(0)).current;

  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [recordings, setRecordings] = useState<any[]>([]);
  const [splitIds, setSplitIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [pendingDeleteName, setPendingDeleteName] = useState('');
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
  }, []);

  useEffect(() => { if (spaceId) loadRecordings(); }, [spaceId]);

  useEffect(() => {
    if (tabLayouts.filter(Boolean).length < 3) return;
    const idx = MODES.indexOf(viewMode);
    const layout = tabLayouts[idx];
    if (!layout) return;
    Animated.spring(circleAnim, {
      toValue: layout.x + layout.width / 2 - DOODLE_W / 2,
      useNativeDriver: true, tension: 70, friction: 12,
    }).start();
  }, [viewMode, tabLayouts]);

  const switchMode = (next: ViewMode) => {
    if (next === viewMode) return;
    const goLeft = MODES.indexOf(next) > MODES.indexOf(viewMode);
    Animated.timing(contentSlide, { toValue: goLeft ? -width : width, duration: 220, useNativeDriver: true }).start(() => {
      setViewMode(next);
      contentSlide.setValue(goLeft ? width : -width);
      Animated.timing(contentSlide, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    });
  };

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

  const confirmDelete = async () => {
    await supabase.from('recordings').delete().eq('id', pendingDeleteId);
    setRecordings(prev => prev.filter(r => r.id !== pendingDeleteId));
    setConfirmModal(false);
  };

  const weekStart = addDays(selectedDate, -selectedDate.getDay());

  const filteredRecordings = recordings.filter(r => {
    const parts = r.transaction_date.split('-');
    const rDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
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

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>

        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#8a8a8a" />
        </TouchableOpacity>

        <View style={styles.titleBlock}>
          <Text style={styles.spacesLabel}>spaces</Text>
          <Text style={styles.spaceName}>{(name ?? '').toLowerCase()}</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabsWrapper}>
          <View style={styles.tabs}>
            {MODES.map((mode, idx) => (
              <TouchableOpacity
                key={mode}
                style={styles.tabItem}
                onPress={() => switchMode(mode)}
                onLayout={e => {
                  const { x, width: w } = e.nativeEvent.layout;
                  setTabLayouts(prev => { const next = [...prev]; next[idx] = { x, width: w }; return next; });
                }}
              >
                <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            {tabLayouts.filter(Boolean).length === 3 && (
              <Animated.Image
                source={require('../../assets/circle-doodle.png')}
                style={[styles.circleDoodle, { transform: [{ translateX: circleAnim }] }]}
                resizeMode="contain"
                pointerEvents="none"
              />
            )}
          </View>
        </View>

        {/* Animated content area */}
        <Animated.View style={[styles.contentArea, { transform: [{ translateX: contentSlide }] }]}>

          {/* Daily: plain month label centered */}
          {viewMode === 'daily' && (
            <Text style={styles.dateRangeLabel}>{getDailyMonthLabel(selectedDate).toLowerCase()}</Text>
          )}

          {/* Weekly / Monthly: arrows flanking the label */}
          {viewMode !== 'daily' && (
            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => {
                if (viewMode === 'weekly') setSelectedDate(d => addDays(d, -7));
                else setSelectedDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; });
              }}>
                <Ionicons name="chevron-back" size={22} color="#8a8a8a" />
              </TouchableOpacity>
              <Text style={styles.dateRangeLabel}>{getNavLabel(viewMode, selectedDate).toLowerCase()}</Text>
              <TouchableOpacity onPress={() => {
                if (viewMode === 'weekly') setSelectedDate(d => addDays(d, 7));
                else setSelectedDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; });
              }}>
                <Ionicons name="chevron-forward" size={22} color="#8a8a8a" />
              </TouchableOpacity>
            </View>
          )}

          {/* Daily date chips */}
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

          {/* Weekly date chips */}
          {viewMode === 'weekly' && (
            <View style={styles.dateChipsRow}>
              {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((date, i) => {
                const isToday = isSameDay(date, new Date());
                return (
                  <View key={i} style={[styles.dateChip, isToday && styles.dateChipSelected]}>
                    <Text style={[styles.dateChipDay, isToday && styles.dateChipTextSelected]}>
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                    <Text style={[styles.dateChipNum, isToday && styles.dateChipTextSelected]}>{date.getDate()}</Text>
                    {isToday && <View style={[styles.todayDot, styles.todayDotSelected]} />}
                  </View>
                );
              })}
            </View>
          )}

          {/* Grouped recordings list */}
          {loading ? (
            <ActivityIndicator color="#00bf63" style={{ marginTop: 40 }} />
          ) : grouped.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={40} color="#e8e8e8" />
              <Text style={styles.emptyText}>no recordings</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {grouped.map(group => (
                <View key={group.dateLabel}>
                  <Text style={styles.dateGroupLabel}>{group.dateLabel}</Text>
                  <View style={styles.dateGroupItems}>
                    {group.items.map(item => {
                      let amountColor = '#2ab671';
                      let statusLabel = '';
                      if (item.type === 'payable') {
                        amountColor = '#425252';
                        statusLabel = item.status === 'paid' ? 'Paid' : item.status === 'partial' ? 'Partial' : 'Unpaid';
                      } else if (item.type === 'receivable') {
                        if (item.status === 'received') { amountColor = '#2ab671'; statusLabel = 'Received'; }
                        else if (item.status === 'partial') { amountColor = '#f0ff97'; statusLabel = 'Partial'; }
                        else { amountColor = '#425252'; statusLabel = 'Pending'; }
                      } else if (item.type === 'expense') {
                        amountColor = '#ed6a6a';
                      }

                      // Row 3: verb + account
                      const verbMap: Record<string, string> = {
                        expense: 'Paid from',
                        income: 'Received on',
                        savings: 'Saved to',
                        receivable: item.status === 'received' ? 'Received on' : 'Expecting to',
                        payable: item.status === 'paid' ? 'Paid from' : 'Paying from',
                      };
                      const verb = verbMap[item.type] ?? 'Via';
                      const accountName = item.account?.account_name ?? null;

                      // show paid_amount / amount for partial
                      const showPartial = (item.type === 'receivable' || item.type === 'payable') && item.status === 'partial' && item.paid_amount;

                      return (
                        <View key={item.id} style={styles.recordingCard}>
                          {/* Left: category icon */}
                          <View style={[styles.catDot, { backgroundColor: item.categories?.color ?? '#e8e8e8' }]}>
                            <Ionicons name={item.categories?.icon ?? 'ellipse-outline'} size={14} color="#1c1d1d" />
                          </View>

                          {/* Middle: 3 rows */}
                          <View style={styles.recordingMiddle}>
                            <Text style={styles.recordingName} numberOfLines={1}>{item.name}</Text>
                            <View style={styles.recordingRow2}>
                              <Text style={styles.recordingLabel}>
                                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}:
                              </Text>
                              {statusLabel ? (
                                <Text style={[styles.recordingValue, { color: amountColor }]}>{statusLabel}</Text>
                              ) : (
                                <Text style={styles.recordingValue}>{item.categories?.name ?? '—'}</Text>
                              )}
                            </View>
                            {(accountName || item.person_name) && (
                              <View style={styles.recordingRow3}>
                                <Text style={styles.recordingLabel}>{verb}:</Text>
                                <Text style={styles.recordingValue}>{item.person_name ?? accountName}</Text>
                              </View>
                            )}
                          </View>

                          {/* Right: amount + actions */}
                          <View style={styles.recordingRight}>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={[styles.recordingAmount, { color: amountColor }]}>
                                {showPartial
                                  ? Number(item.paid_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })
                                  : Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })
                                }
                              </Text>
                              {showPartial && (
                                <Text style={{ fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#b0b0b0' }}>
                                  / {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </Text>
                              )}
                            </View>
                            <View style={styles.recordingActions}>
                              <TouchableOpacity onPress={() => router.push({ pathname: '/(app)/split-bill', params: { recordingId: item.id, recordingName: item.name, amount: item.amount } } as any)} style={styles.actionBtn}>
                                <Ionicons name="people-outline" size={14} color={splitIds.has(item.id) ? '#00bf63' : '#b0b0b0'} />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => router.push({ pathname: '/(app)/add-recording', params: { spaceId, spaceName: name, defaultDate: selectedDate.toISOString().split('T')[0], editId: item.id } } as any)} style={styles.actionBtn}>
                                <Ionicons name="pencil-outline" size={14} color="#8a8a8a" />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => { setPendingDeleteId(item.id); setPendingDeleteName(item.name); setConfirmModal(true); }} style={styles.actionBtn}>
                                <Ionicons name="trash-outline" size={14} color="#e74c3c" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Animated.View>

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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  backBtn: { paddingHorizontal: 40, paddingTop: 14, paddingBottom: 4 },
  titleBlock: { paddingHorizontal: 48, marginTop: 8, marginBottom: 25, alignItems: 'center' },
  spacesLabel: { fontFamily: 'Avenelle', fontSize: 23, color: '#929090' },
  spaceName: { fontFamily: 'Avenelle', fontSize: 40, color: '#0ccfcf', lineHeight: 48, textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  tabsWrapper: { paddingHorizontal: 48, marginBottom: 5, alignItems: 'center' },
  tabs: { flexDirection: 'row', gap: 30 },
  tabItem: { paddingVertical: 8 },
  tabText: { fontFamily: 'DMSans_400Regular', fontSize: 19, color: '#425252' },
  tabTextActive: { fontFamily: 'DMSans_600SemiBold', color: '#425252' },
  circleDoodle: { position: 'absolute', width: DOODLE_W, height: 54, top: -6, pointerEvents: 'none' },
  contentArea: { flex: 1 },
  dateRangeLabel: { fontFamily: 'Avenelle', fontSize: 19, color: '#545454', paddingHorizontal: 12, marginBottom: 18, marginTop: 28, textAlign: 'center', flexShrink: 1 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40, marginBottom: 14 },
  dateChipsRow: { flexDirection: 'row', paddingHorizontal: 48, marginBottom: 14, gap: 8, justifyContent: 'center' },
  dateChip: { flex: 1, alignItems: 'center', paddingVertical: 15, paddingHorizontal: 4, borderRadius: 18, backgroundColor: '#ffffff', minHeight: 75, borderWidth: 1.5, borderColor: '#929090' },
  dateChipSelected: { backgroundColor: '#0ccfcf', borderColor: '#0ccfcf' },
  dateChipDay: { fontFamily: 'DMSans_700Bold', fontSize: 11, color: '#b0b0b0' },
  dateChipNum: { fontFamily: 'DMSans_700Bold', fontSize: 20, color: '#1c1d1d', marginTop: 5 },
  dateChipTextSelected: { color: '#fff' },
  todayDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#0ccfcf', marginTop: 3 },
  todayDotSelected: { backgroundColor: '#fff' },
  list: { paddingHorizontal: 48, paddingBottom: 100, gap: 20 },
  dateGroupLabel: { fontFamily: 'Avenelle', fontSize: 19, color: '#545454', marginBottom: 10 },
  dateGroupItems: { gap: 10 },
  recordingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  catDot: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  recordingMiddle: { flex: 1, gap: 2 },
  recordingName: { fontFamily: 'RobotoMono_700Bold', fontSize: 19.8, color: '#1c1d1d' },
  recordingRow2: { flexDirection: 'row', gap: 4 },
  recordingRow3: { flexDirection: 'row', gap: 4 },
  recordingLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 15.3, color: '#8a8a8a' },
  recordingValue: { fontFamily: 'RobotoMono_700Bold', fontSize: 15.3, color: '#1c1d1d' },
  recordingRight: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  recordingAmount: { fontFamily: 'RobotoMono_700Bold', fontSize: 24 },
  recordingActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionBtn: { padding: 2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#b0b0b0' },
  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#00bf63', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#fff' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  pickerBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, width: '80%', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  pickerTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#1c1d1d', marginBottom: 4 },
  pickerBtn: { backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  pickerBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#fff' },
});
