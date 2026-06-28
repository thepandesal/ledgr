import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import ConfirmModal from '@/components/ui/ConfirmModal';

export let pendingFocusDate: string | null = null;
export function setPendingFocusDate(date: string | null) { pendingFocusDate = date; }

const { width } = Dimensions.get('window');

const BG    = '#F7F8FA';
const CARD  = '#FFFFFF';
const TEAL  = '#4ECDC4';
const TEALL = '#E0F5F4';
const PEACH = '#FFAB91';
const TEXT  = '#1A1A2E';
const SEC   = '#9A9DB0';
const BOR   = '#ECECEC';
const R  = 'PlusJakartaSans_400Regular';
const M  = 'PlusJakartaSans_500Medium';
const SB = 'PlusJakartaSans_600SemiBold';
const B  = 'PlusJakartaSans_700Bold';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
type ViewMode = 'daily' | 'weekly' | 'monthly';
const MODES: ViewMode[] = ['daily', 'weekly', 'monthly'];

function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function dateKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

function typeLabel(type: string, status: string) {
  if (type === 'income')     return { label: 'income',    color: TEAL  };
  if (type === 'savings')    return { label: 'savings',   color: TEAL  };
  if (type === 'return')     return { label: 'return',    color: TEAL  };
  if (type === 'expense')    return { label: 'expense',   color: PEACH };
  if (type === 'payment')    return { label: 'payment',   color: PEACH };
  if (type === 'transfer')   return { label: 'transfer',  color: PEACH };
  if (type === 'payable')    return status === 'paid'
    ? { label: 'loan · paid',    color: TEAL  }
    : { label: 'loan',           color: PEACH };
  if (type === 'receivable') return status === 'received'
    ? { label: 'receivable · received', color: TEAL  }
    : { label: 'receivable',            color: TEAL  };
  return { label: type, color: SEC };
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function SpaceDetailScreen() {
  const { spaceId, name } = useLocalSearchParams<{ spaceId: string; name: string; color: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;
  const queryClient = useQueryClient();
  const { userId } = useUser();

  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [confirmModal, setConfirmModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [pendingDeleteName, setPendingDeleteName] = useState('');
  const menuAnim   = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const MENU_HEIGHT = 110;

  const onScroll = (e: any) => {
    const y    = e.nativeEvent.contentOffset.y;
    const diff = y - lastScrollY.current;
    if (diff > 6 && y > 30)
      Animated.timing(menuAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    else if (diff < -6)
      Animated.timing(menuAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    lastScrollY.current = y;
  };

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['recordings', spaceId, userId],
    queryFn: async () => {
      const query = supabase.from('recordings')
        .select('*, categories:category_id(name,color,icon)');
      if (spaceId === 'all') {
        if (!userId) return [];
        const { data } = await query.eq('user_id', userId).order('transaction_date', { ascending: false });
        return data ?? [];
      }
      const { data } = await query.eq('space_id', spaceId).order('transaction_date', { ascending: false });
      return data ?? [];
    },
    enabled: !!spaceId && (spaceId !== 'all' || !!userId),
  });

  const { data: spaceData } = useQuery({
    queryKey: ['space-budget', spaceId],
    queryFn: async () => {
      const { data } = await supabase.from('spaces').select('budget, space_type').eq('id', spaceId).single();
      return data;
    },
    enabled: !!spaceId && spaceId !== 'all',
  });

  const budget = spaceData?.budget ?? null;
  const isExpenseSpace = (spaceData?.space_type ?? 'expense') === 'expense';

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
  }, []);

  useFocusEffect(useCallback(() => {
    if (!spaceId) return;
    queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
    if (pendingFocusDate) {
      const parts = pendingFocusDate.split('-');
      setSelectedDate(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      setPendingFocusDate(null);
    }
  }, [spaceId]));

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  const confirmDelete = async () => {
    await supabase.from('recordings').delete().eq('id', pendingDeleteId);
    queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
    setConfirmModal(false);
  };

  const weekStart = addDays(selectedDate, -selectedDate.getDay());

  const filtered = recordings.filter(r => {
    const parts = r.transaction_date.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (viewMode === 'daily')   return isSameDay(d, selectedDate);
    if (viewMode === 'weekly')  return d >= weekStart && d <= addDays(weekStart, 6);
    return d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
  });

  // Group by date
  const grouped: { key: string; label: string; date: Date; items: any[] }[] = [];
  filtered.forEach(r => {
    const parts = r.transaction_date.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const k = dateKey(d);
    const existing = grouped.find(g => g.key === k);
    if (existing) existing.items.push(r);
    else grouped.push({
      key: k,
      label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      date: d,
      items: [r],
    });
  });
  grouped.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Stats
  const moneyIn  = recordings.filter(r => ['income','savings','return'].includes(r.type)).reduce((s, r) => s + Number(r.amount), 0);
  const moneyOut = recordings.filter(r => ['expense','payment','transfer'].includes(r.type)).reduce((s, r) => s + Number(r.amount), 0);
  const mainValue = isExpenseSpace ? moneyOut : moneyIn;
  const pct = budget ? Math.min(mainValue / budget, 1) : 0;
  const overBudget = isExpenseSpace && budget ? mainValue > budget : false;

  const navLabel = () => {
    if (viewMode === 'daily') return selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (viewMode === 'weekly') {
      const e = addDays(weekStart, 6);
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigate = (dir: 1 | -1) => {
    setSelectedDate(prev => {
      if (viewMode === 'daily')  return addDays(prev, dir);
      if (viewMode === 'weekly') return addDays(prev, dir * 7);
      const n = new Date(prev); n.setMonth(n.getMonth() + dir); return n;
    });
  };

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: BG }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color={SEC} />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{name}</Text>
          {spaceId !== 'all' && (
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => router.push({ pathname: '/(app)/add-recording', params: { spaceId, spaceName: name, defaultDate: selectedDate.toISOString().split('T')[0] } } as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats card */}
        <View style={s.statsCard}>
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statValue}>{fmt(moneyIn)}</Text>
              <Text style={s.statLabel}>Money In</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={[s.statValue, { color: PEACH }]}>{fmt(moneyOut)}</Text>
              <Text style={s.statLabel}>Money Out</Text>
            </View>
            {budget && (
              <>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: overBudget ? PEACH : TEAL }]}>{fmt(Math.abs(budget - mainValue))}</Text>
                  <Text style={s.statLabel}>{overBudget ? 'Over' : 'Left'}</Text>
                </View>
              </>
            )}
          </View>
          {budget && (
            <View style={s.budgetTrack}>
              <View style={[s.budgetFill, { width: `${pct * 100}%` as any, backgroundColor: overBudget ? PEACH : TEAL }]} />
            </View>
          )}
        </View>

        {/* Sheet: sticky menu floats over list */}
        <View style={{ flex: 1 }}>

          {/* Sticky floating menu */}
          <Animated.View style={[s.menuCard, {
            opacity: menuAnim,
            transform: [{ translateY: menuAnim.interpolate({ inputRange: [0,1], outputRange: [-MENU_HEIGHT, 0] }) }],
          }]}>
            <View style={s.modeRow}>
              {MODES.map(m => (
                <TouchableOpacity key={m} style={[s.modeBtn, viewMode === m && s.modeBtnActive]} onPress={() => setViewMode(m)} activeOpacity={0.75}>
                  <Text style={[s.modeBtnText, viewMode === m && s.modeBtnTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.dateNav}>
              <TouchableOpacity onPress={() => navigate(-1)} style={s.navArrow}>
                <Ionicons name="chevron-back" size={16} color={SEC} />
              </TouchableOpacity>
              <Text style={s.dateNavLabel}>{navLabel()}</Text>
              <TouchableOpacity onPress={() => navigate(1)} style={s.navArrow}>
                <Ionicons name="chevron-forward" size={16} color={SEC} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Recordings */}
          {isLoading ? (
            <ActivityIndicator color={TEAL} style={{ marginTop: 48 }} />
          ) : filtered.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="receipt-outline" size={32} color={SEC} />
              <Text style={s.emptyText}>no recordings</Text>
              <Text style={s.emptyHint}>for this {viewMode} period</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
            >
              {grouped.map(group => (
                <View key={group.key}>
                  <View style={s.dateHeaderRow}>
                    <Text style={s.dateHeaderText}>{group.label}</Text>
                  </View>
                  {group.items.map(item => {
                    const tl = typeLabel(item.type, item.status);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={s.row}
                        activeOpacity={0.85}
                        onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                        onLongPress={() => { setPendingDeleteId(item.id); setPendingDeleteName(item.name); setConfirmModal(true); }}
                      >
                        <View style={s.rowIcon}>
                          <Ionicons name={(item.categories?.icon ?? 'ellipse-outline') as any} size={16} color={TEXT} />
                        </View>
                        <View style={s.rowMid}>
                          <Text style={s.rowType}>{tl.label}</Text>
                          <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                          {item.space?.name ? <Text style={s.rowSpace}>{item.space.name}</Text> : null}
                        </View>
                        <Text style={[s.rowAmount, { color: tl.color }]}>
                          {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
              <View style={{ height: 80 }} />
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      <ConfirmModal
        visible={confirmModal}
        onClose={() => setConfirmModal(false)}
        title="delete recording"
        message={`Delete "${pendingDeleteName}"?`}
        actions={[
          { label: 'cancel', onPress: () => setConfirmModal(false), muted: true },
          { label: 'delete', onPress: confirmDelete, destructive: true },
        ]}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  title:   { flex: 1, fontFamily: B, fontSize: 28, color: TEXT, letterSpacing: -0.8 },
  addBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },

  statsCard: { marginHorizontal: 16, backgroundColor: CARD, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 20, marginBottom: 12, gap: 12 },
  statsRow:  { flexDirection: 'row', alignItems: 'center' },
  statItem:  { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontFamily: B,  fontSize: 17, color: TEXT, letterSpacing: -0.4 },
  statLabel: { fontFamily: R,  fontSize: 10, color: SEC,  letterSpacing: 0.2 },
  statDivider: { width: 1, height: 28, backgroundColor: BOR },
  budgetTrack: { height: 4, backgroundColor: BOR, borderRadius: 2, overflow: 'hidden' },
  budgetFill:  { height: 4, borderRadius: 2 },

  menuCard: {
    position: 'absolute', top: 0, left: 16, right: 16, zIndex: 10,
    backgroundColor: CARD, borderRadius: 20,
    paddingTop: 12, paddingBottom: 10, gap: 8,
  },
  modeRow:  { flexDirection: 'row', gap: 8 },
  modeBtn:  { flex: 1, paddingVertical: 8, borderRadius: 999, backgroundColor: CARD, alignItems: 'center' },
  modeBtnActive:    { backgroundColor: TEAL },
  modeBtnText:      { fontFamily: M,  fontSize: 12, color: SEC  },
  modeBtnTextActive: { fontFamily: SB, fontSize: 12, color: '#fff' },
  dateNav:      { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 16, paddingVertical: 10 },
  navArrow:     { paddingHorizontal: 14 },
  dateNavLabel: { flex: 1, textAlign: 'center', fontFamily: SB, fontSize: 13, color: TEXT },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontFamily: SB, fontSize: 16, color: TEXT },
  emptyHint: { fontFamily: R,  fontSize: 13, color: SEC  },

  list: { paddingHorizontal: 16, paddingTop: 120, gap: 8 },
  dateHeaderRow:  { paddingTop: 16, paddingBottom: 8, borderTopWidth: 1, borderTopColor: BOR, marginTop: 8 },
  dateHeaderText: { fontFamily: SB, fontSize: 10, color: SEC, letterSpacing: 1.2, textTransform: 'uppercase' },

  row:      { backgroundColor: CARD, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  rowIcon:  { width: 40, height: 40, borderRadius: 20, backgroundColor: TEALL, alignItems: 'center', justifyContent: 'center' },
  rowMid:   { flex: 1, gap: 2 },
  rowType:  { fontFamily: M,  fontSize: 10, color: SEC,  letterSpacing: 0.3, textTransform: 'uppercase' },
  rowName:  { fontFamily: SB, fontSize: 14, color: TEXT, lineHeight: 20 },
  rowSpace: { fontFamily: R,  fontSize: 11, color: SEC },
  rowAmount: { fontFamily: B, fontSize: 15, letterSpacing: -0.4 },
});
