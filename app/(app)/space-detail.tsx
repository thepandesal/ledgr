import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { BlurView } from 'expo-blur';

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

export default function SpaceDetailScreen() {
  const { spaceId, name } = useLocalSearchParams<{ spaceId: string; name: string; color: string }>();
  const router = useRouter();

  const slideAnim = useRef(new Animated.Value(width)).current;
  const circleAnim = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(0)).current;

  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [pendingDeleteName, setPendingDeleteName] = useState('');
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
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
    if (data) setRecordings(data);
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
    if (activeFilter && r.type !== activeFilter) return false;
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
  const countReceivables = recordings.filter(r => r.type === 'receivable' && r.status !== 'received').length;

  const shortAmount = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toFixed(0);
  };

  // Set of dateKeys that have recordings (for dots)
  const recordingDates = new Set(recordings.map(r => {
    const parts = r.transaction_date.split('-');
    return dateKey(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
  }));

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

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>expenses</Text>
            <Text style={[styles.statValue, { color: '#ed6a6a' }]}>{shortAmount(totalExpenses)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>income/savings</Text>
            <Text style={[styles.statValue, { color: '#00bf63' }]}>{shortAmount(totalIncomeSavings)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>payables</Text>
            <Text style={[styles.statValue, { color: '#929090' }]}>{countPayables}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>receivables</Text>
            <Text style={[styles.statValue, { color: '#929090' }]}>{countReceivables}</Text>
          </View>
        </View>

        {/* Recordings header */}
        <View style={styles.recordingsHeader}>
          <Text style={styles.recordingsTitle}>recordings</Text>
          <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilter(true)}>
            <Ionicons name="options-outline" size={18} color={activeFilter ? '#0ccfcf' : '#929090'} />
          </TouchableOpacity>
        </View>

        {/* Nav row: date range left, tabs right */}
        <View style={styles.topNavRow}>
          <TouchableOpacity style={styles.dateNavLeft} onPress={openPicker}>
            <TouchableOpacity onPress={() => {
              if (viewMode === 'daily') setSelectedDate(d => addDays(d, -1));
              else if (viewMode === 'weekly') setSelectedDate(d => addDays(d, -7));
              else setSelectedDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; });
            }}>
              <Ionicons name="chevron-back" size={16} color="#929090" />
            </TouchableOpacity>
            <Text style={styles.dateNavLabel}>{getNavLabel(viewMode, selectedDate).toLowerCase()}</Text>
            <TouchableOpacity onPress={() => {
              if (viewMode === 'daily') setSelectedDate(d => addDays(d, 1));
              else if (viewMode === 'weekly') setSelectedDate(d => addDays(d, 7));
              else setSelectedDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; });
            }}>
              <Ionicons name="chevron-forward" size={16} color="#929090" />
            </TouchableOpacity>
          </TouchableOpacity>
          <View style={styles.tabsInline}>
            {MODES.map((mode, idx) => (
              <TouchableOpacity
                key={mode}
                style={styles.tabItemInline}
                onPress={() => switchMode(mode)}
                onLayout={e => {
                  const { x, width: w } = e.nativeEvent.layout;
                  setTabLayouts(prev => { const next = [...prev]; next[idx] = { x, width: w }; return next; });
                }}
              >
                <Text style={[styles.tabTextInline, viewMode === mode && styles.tabTextInlineActive]}>
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
                    {!isToday && recordingDates.has(dateKey(date)) && <View style={styles.entryDot} />}
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
                    {isToday
                      ? <View style={[styles.todayDot, styles.todayDotSelected]} />
                      : recordingDates.has(dateKey(date)) && <View style={styles.entryDot} />}
                  </View>
                );
              })}
            </View>
          )}

          {/* Add recording button */}
          <View style={styles.addRecordingRow}>
            <TouchableOpacity
              style={styles.addRecordingBtn}
              onPress={() => router.push({ pathname: '/(app)/add-recording', params: { spaceId, spaceName: name, defaultDate: selectedDate.toISOString().split('T')[0] } } as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={14} color="#425252" />
              <Text style={styles.addRecordingText}>add recording</Text>
            </TouchableOpacity>
          </View>

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
                        <TouchableOpacity key={item.id} style={[styles.recordingCard, { backgroundColor: amountColor }]} activeOpacity={0.85}
                          onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}>
                          <View style={styles.catIcon}>
                            <Ionicons name={item.categories?.icon ?? 'ellipse-outline'} size={24} color="#fff" />
                          </View>
                          <View style={styles.recordingMiddle}>
                            <Text style={styles.recordingName} numberOfLines={1} ellipsizeMode="tail">{item.name}</Text>
                            <View style={styles.recordingRow2}>
                              <Text style={styles.recordingLabel} numberOfLines={1}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}:</Text>
                              {statusLabel
                                ? <Text style={styles.recordingValue} numberOfLines={1}>{statusLabel}</Text>
                                : <Text style={styles.recordingValue} numberOfLines={1}>{item.categories?.name ?? '—'}</Text>}
                            </View>
                            {(accountName || item.person_name) && (
                              <View style={styles.recordingRow3}>
                                <Text style={styles.recordingLabel} numberOfLines={1}>{verb}:</Text>
                                <Text style={styles.recordingValue} numberOfLines={1}>{item.person_name ?? accountName}</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.recordingRight}>
                            <Text style={styles.recordingAmount}>
                              {showPartial
                                ? Number(item.paid_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })
                                : Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </Text>
                            {showPartial && (
                              <Text style={{ fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                                / {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
      <Modal visible={showFilter} transparent animationType="fade" onRequestClose={() => setShowFilter(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowFilter(false)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={styles.filterBox}>
                <Text style={styles.filterTitle}>filter by</Text>
                {[
                  { key: null, label: 'all' },
                  { key: 'expense', label: 'expense', color: '#ed6a6a' },
                  { key: 'income', label: 'income', color: '#00bf63' },
                  { key: 'savings', label: 'savings', color: '#00bf63' },
                  { key: 'payable', label: 'payable', color: '#929090' },
                  { key: 'receivable', label: 'receivable', color: '#929090' },
                ].map(f => {
                  const isActive = activeFilter === f.key;
                  return (
                    <TouchableOpacity
                      key={String(f.key)}
                      style={[styles.filterOption, isActive && { borderColor: f.color ?? '#0ccfcf', backgroundColor: (f.color ?? '#0ccfcf') + '18' }]}
                      onPress={() => { setActiveFilter(f.key); setShowFilter(false); }}
                    >
                      {f.color && <View style={[styles.filterDot, { backgroundColor: f.color }]} />}
                      <Text style={[styles.filterOptionText, isActive && { color: f.color ?? '#0ccfcf', fontFamily: 'RobotoMono_700Bold' }]}>
                        {f.label}
                      </Text>
                      {isActive && <Ionicons name="checkmark" size={14} color={f.color ?? '#0ccfcf'} style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* Date Picker Modal */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={styles.datePickerBox}>
                <Text style={styles.datePickerTitle}>jump to</Text>

                {/* Month + Year nav row */}
                <View style={styles.datePickerYearRow}>
                  <TouchableOpacity onPress={() => {
                    if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); }
                    else setPickerMonth(m => m - 1);
                  }}>
                    <Ionicons name="chevron-back" size={20} color="#425252" />
                  </TouchableOpacity>
                  <Text style={styles.datePickerYear}>
                    {MONTHS[pickerMonth].toLowerCase()} {pickerYear}
                  </Text>
                  <TouchableOpacity onPress={() => {
                    if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); }
                    else setPickerMonth(m => m + 1);
                  }}>
                    <Ionicons name="chevron-forward" size={20} color="#425252" />
                  </TouchableOpacity>
                </View>

                {/* Daily / Weekly: show date grid */}
                {viewMode !== 'monthly' && (() => {
                  const firstDay = new Date(pickerYear, pickerMonth, 1).getDay();
                  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
                  const cells = Array(firstDay).fill(null).concat(
                    Array.from({ length: daysInMonth }, (_, i) => i + 1)
                  );
                  return (
                    <View>
                      {/* Weekday headers */}
                      <View style={styles.calWeekRow}>
                        {['su','mo','tu','we','th','fr','sa'].map(d => (
                          <Text key={d} style={styles.calWeekDay}>{d}</Text>
                        ))}
                      </View>
                      {/* Day cells */}
                      <View style={styles.calGrid}>
                        {cells.map((day, i) => {
                          if (!day) return <View key={`e${i}`} style={styles.calCell} />;
                          const isSelected = viewMode === 'daily' && day === pickerDay;
                          const isToday = isSameDay(new Date(pickerYear, pickerMonth, day), new Date());
                          const hasEntry = recordingDates.has(dateKey(new Date(pickerYear, pickerMonth, day)));
                          return (
                            <TouchableOpacity
                              key={day}
                              style={[styles.calCell, isSelected && styles.calCellSelected, !isSelected && isToday && styles.calCellToday]}
                              onPress={() => setPickerDay(day)}
                            >
                              <Text style={[styles.calCellText, (isSelected || isToday) && styles.calCellTextActive]}>{day}</Text>
                              {hasEntry && <View style={[styles.calEntryDot, isSelected && styles.calEntryDotSelected]} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}

                {/* Monthly: show month grid */}
                {viewMode === 'monthly' && (
                  <View style={styles.datePickerMonthGrid}>
                    {MONTHS.map((m, i) => {
                      const isActive = i === pickerMonth;
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[styles.datePickerMonthBtn, isActive && styles.datePickerMonthBtnActive]}
                          onPress={() => setPickerMonth(i)}
                        >
                          <Text style={[styles.datePickerMonthText, isActive && styles.datePickerMonthTextActive]}>
                            {m.slice(0, 3).toLowerCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.datePickerConfirm}
                  onPress={() => {
                    const d = new Date(pickerYear, pickerMonth, viewMode === 'daily' && pickerDay ? pickerDay : 1);
                    setSelectedDate(d);
                    setShowPicker(false);
                  }}
                >
                  <Text style={styles.datePickerConfirmText}>go</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

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
  titleBlock: { paddingHorizontal: 48, marginTop: 8, marginBottom: 10 },
  spacesLabel: { fontFamily: 'ChillaxMedium', fontSize: 13, color: '#929090' },
  spaceName: { fontFamily: 'Avenelle', fontSize: 40, color: '#425252', lineHeight: 48, textShadowColor: 'rgba(0,0,0,0.12)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  recordingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 48, marginBottom: 12 },
  recordingsTitle: { fontFamily: 'ChillaxMedium', fontSize: 20, color: '#425252' },
  filterBtn: { padding: 6 },
  filterBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, width: 260, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 12 },
  filterTitle: { fontFamily: 'ChillaxMedium', fontSize: 16, color: '#425252', marginBottom: 4 },
  filterOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#e8e8e8' },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterOptionText: { fontFamily: 'RobotoMono_400Regular', fontSize: 13, color: '#929090' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 48, marginBottom: 24, gap: 16, justifyContent: 'flex-start' },
  statItem: { alignItems: 'flex-start', gap: 4 },
  statLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 9, color: '#929090' },
  statValue: { fontFamily: 'RobotoMono_700Bold', fontSize: 18 },
  topNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 48, marginBottom: 14 },
  dateNavLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateNavLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090' },
  tabsInline: { flexDirection: 'row', gap: 14 },
  tabItemInline: { paddingVertical: 4 },
  tabTextInline: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090' },
  tabTextInlineActive: { fontFamily: 'RobotoMono_700Bold', color: '#425252' },
  circleDoodle: { position: 'absolute', width: DOODLE_W, height: 40, top: -8, pointerEvents: 'none' },
  contentArea: { flex: 1 },
  dateChipsRow: { flexDirection: 'row', paddingHorizontal: 48, marginBottom: 14, marginTop: 8, gap: 8, justifyContent: 'center' },
  dateChip: { flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 12, backgroundColor: '#ffffff', minHeight: 52, borderWidth: 1.5, borderColor: '#929090' },
  dateChipSelected: { backgroundColor: '#0ccfcf', borderColor: '#0ccfcf' },
  dateChipDay: { fontFamily: 'DMSans_700Bold', fontSize: 9, color: '#b0b0b0' },
  dateChipNum: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: '#1c1d1d', marginTop: 3 },
  dateChipTextSelected: { color: '#fff' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#0ccfcf', marginTop: 3 },
  todayDotSelected: { backgroundColor: '#fff' },
  entryDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#0ccfcf', marginTop: 3 },
  list: { paddingHorizontal: 48, paddingBottom: 100, gap: 48 },
  dateGroupLabel: { fontFamily: 'ChillaxMedium', fontSize: 13, color: '#425252', marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.08)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  dateGroupItems: { gap: 10 },
  recordingCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, gap: 8 },
  catIcon: { flexShrink: 0 },
  recordingMiddle: { flex: 1, gap: 2, overflow: 'hidden' },
  recordingName: { fontFamily: 'RobotoMono_700Bold', fontSize: 12, color: '#fff' },
  recordingRow2: { flexDirection: 'row', gap: 3 },
  recordingRow3: { flexDirection: 'row', gap: 3 },
  recordingLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.75)' },
  recordingValue: { fontFamily: 'RobotoMono_700Bold', fontSize: 10, color: '#fff', flexShrink: 1 },
  recordingRight: { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  recordingAmount: { fontFamily: 'RobotoMono_400Regular', fontSize: 14, color: '#fff' },
  addRecordingRow: { paddingHorizontal: 48, alignItems: 'flex-end', marginBottom: 10 },
  addRecordingBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#929090', shadowColor: '#929090', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 6, elevation: 4 },
  addRecordingText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#425252' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#b0b0b0' },

  pickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, width: '80%', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  pickerTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#1c1d1d', marginBottom: 4 },
  pickerBtn: { backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  pickerBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#fff' },
  datePickerBox: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, width: 300, gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 12 },
  datePickerTitle: { fontFamily: 'Avenelle', fontSize: 22, color: '#0ccfcf', textAlign: 'center' },
  datePickerYearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  datePickerYear: { fontFamily: 'Avenelle', fontSize: 17, color: '#425252' },
  datePickerMonthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  datePickerMonthBtn: { width: '30%', paddingVertical: 10, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: '#e8e8e8' },
  datePickerMonthBtnActive: { backgroundColor: '#0ccfcf', borderColor: '#0ccfcf' },
  datePickerMonthText: { fontFamily: 'Avenelle', fontSize: 14, color: '#545454' },
  datePickerMonthTextActive: { color: '#fff' },
  datePickerConfirm: { backgroundColor: '#425252', borderRadius: 999, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  datePickerConfirmText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#fff' },
  calWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calWeekDay: { flex: 1, textAlign: 'center', fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: '#b0b0b0' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  calCellSelected: { backgroundColor: '#0ccfcf' },
  calCellToday: { backgroundColor: '#f0f0f0' },
  calCellText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#425252' },
  calCellTextActive: { fontFamily: 'DMSans_600SemiBold', color: '#fff' },
  calEntryDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#0ccfcf', marginTop: 1 },
  calEntryDotSelected: { backgroundColor: '#fff' },
});
