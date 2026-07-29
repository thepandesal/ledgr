import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  ActivityIndicator, TouchableOpacity, RefreshControl, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { AppFont } from '../../src/lib/fonts';
import { DC } from '../../src/lib/design';
import PageHeader from '@/components/ui/PageHeader';
import { useNav } from '../../src/lib/NavContext';
import ActivityTabs, { ACTIVITY_TABS, type ActivityTab } from '@/components/ui/ActivityTabs';
import GooeyLoader from '@/components/ui/GooeyLoader';
import { BlurView } from 'expo-blur';
import BottomSheet from '@/components/ui/BottomSheet';
import AddRecordingScreen from './add-recording';
import AnimatedIcon from '@/components/ui/AnimatedIcon';

const BADGE_COLOR = '#9cd7d2';
const PEACH       = '#FFAB91';

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  expense:  { label: 'expense',  color: PEACH },
  income:   { label: 'income',   color: BADGE_COLOR },
  debt:     { label: 'loan',     color: PEACH },
  due:      { label: 'due',      color: BADGE_COLOR },
  return:   { label: 'return',   color: BADGE_COLOR },
  payment:  { label: 'payment',  color: PEACH },
  savings:  { label: 'savings',  color: BADGE_COLOR },
};

const ALL_TYPES = ['expense','income','debt','due','return','payment','savings'];
const AMOUNT_SORTS = [
  { key: 'none', label: 'Default' },
  { key: 'high', label: 'High → Low' },
  { key: 'low',  label: 'Low → High' },
] as const;

interface Props {
  onClose: () => void;
  categoryId?: string;
  categoryName?: string;
  spaceId?: string;
  spaceName?: string;
}

export default function RecordingsPanel({ onClose, categoryId, categoryName, spaceId: propSpaceId, spaceName }: Props) {
  const { userId, defaultCurrency } = useUser();
  const { openRecording } = useNav();
  const queryClient = useQueryClient();
  const [monthOffset, setMonthOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTabs, setSelectedTabs] = useState<Set<ActivityTab>>(new Set(['all']));

  const [search, setSearch] = useState('');

  // ── Filter state ──────────────────────────────────────────────────────
  const [showFilter, setShowFilter] = useState(false);
  const [showAddRecording, setShowAddRecording] = useState(false);
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set(['all']));
  const [filterSpaces, setFilterSpaces] = useState<Set<string>>(new Set(['all']));
  const [amountSort, setAmountSort] = useState<'none' | 'high' | 'low'>('none');

  const hasActiveFilter = !filterTypes.has('all') || !filterSpaces.has('all') || amountSort !== 'none';

  const handleTabToggle = (key: ActivityTab) => {
    setSelectedTabs(new Set([key]));
  };

  const activeTypes = useMemo(() => {
    if (selectedTabs.has('all')) return ALL_TYPES;
    return ACTIVITY_TABS.filter(t => t.key !== 'all' && selectedTabs.has(t.key)).flatMap(t => [...t.types]);
  }, [selectedTabs]);

  const { from, to, label } = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const to   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return { from, to, label: `${months[d.getMonth()]} ${d.getFullYear()}` };
  }, [monthOffset]);

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['recordings-panel', userId, from, categoryId, propSpaceId],
    queryFn: async () => {
      let query = supabase
        .from('recordings')
        .select('id, name, type, amount, transaction_date, created_at, currency, space_id, spaces:space_id(name), is_due, paid_amount, status')
        .eq('user_id', userId)
        .neq('status', 'voided')
        .neq('is_tagged', true)
        .neq('is_system_generated', true)
        .gte('transaction_date', from)
        .lte('transaction_date', to)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (categoryId) query = query.eq('category_id', categoryId);
      else if (categoryName === 'Uncategorized') query = query.is('category_id', null);
      if (propSpaceId) query = query.eq('space_id', propSpaceId);
      const { data } = await query;
      return (data ?? []).map((r: any) => ({
        ...r,
        space: Array.isArray(r.spaces) ? r.spaces[0] : r.spaces,
      }));
    },
    enabled: !!userId,
  });

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces-list', userId],
    queryFn: async () => {
      const { data } = await supabase.from('spaces').select('id, name').eq('user_id', userId).order('name');
      return data ?? [];
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`recordings-panel-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings', filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['recordings-panel', userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['recordings-panel', userId, from] });
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    let result = recordings.filter(r => activeTypes.includes(r.type));
    if (!filterTypes.has('all')) result = result.filter(r => filterTypes.has(r.type));
    if (!filterSpaces.has('all')) result = result.filter(r => filterSpaces.has(r.space_id));
    if (search.trim()) result = result.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    if (amountSort === 'high') result = [...result].sort((a, b) => Number(b.amount) - Number(a.amount));
    if (amountSort === 'low')  result = [...result].sort((a, b) => Number(a.amount) - Number(b.amount));
    return result;
  }, [recordings, activeTypes, filterTypes, filterSpaces, amountSort, search]);

  const tabValue = (key: string) => {
    if (key === 'all')          return String(recordings.length);
    if (key === 'money-in')    return String(recordings.filter(r => ['income','due','return'].includes(r.type)).length);
    if (key === 'money-out')   return String(recordings.filter(r => ['expense','debt','payment'].includes(r.type)).length);
    if (key === 'loans')       return String(recordings.filter(r => r.type === 'debt').length);
    if (key === 'receivables') return String(recordings.filter(r => r.type === 'due').length);
    return '';
  };

  const activeTab = useMemo(() => {
    if (selectedTabs.has('all')) return 'all';
    return [...selectedTabs][0];
  }, [selectedTabs]);

  const isStatusGrouped = activeTab === 'loans' || activeTab === 'receivables';

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const grouped = useMemo(() => {
    if (isStatusGrouped) {
      const pending: typeof filtered = [];
      const completed: typeof filtered = [];
      filtered.forEach(r => {
        const isDebtDue = r.type === 'debt' || r.type === 'due' || (r.type === 'expense' && r.is_due);
        if (isDebtDue) {
          const paid = Number(r.paid_amount ?? 0);
          const total = Number(r.amount ?? 0);
          if (paid >= total - 0.01 && total > 0) completed.push(r);
          else pending.push(r);
        } else {
          completed.push(r);
        }
      });
      return { type: 'status', pending, completed } as const;
    }
    const map: Record<string, typeof filtered> = {};
    filtered.forEach(r => {
      if (!map[r.transaction_date]) map[r.transaction_date] = [];
      map[r.transaction_date].push(r);
    });
    const entries = Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
    return { type: 'date', entries } as const;
  }, [filtered, isStatusGrouped]);

  const formatDate = (d: string) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const toggleSet = (set: Set<string>, key: string, setFn: (s: Set<string>) => void) => {
    if (key === 'all') { setFn(new Set(['all'])); return; }
    const next = new Set(set);
    next.delete('all');
    if (next.has(key)) { next.delete(key); if (next.size === 0) { setFn(new Set(['all'])); return; } }
    else next.add(key);
    setFn(next);
  };

  return (
    <SafeAreaView style={s.root}>
      <PageHeader title={categoryName ?? spaceName ?? 'RECORDINGS'} onBack={onClose} titleColor="#9cd7d2" />

      {/* Activity tabs */}
      <View style={s.tabsWrap}>
        <ActivityTabs
          selectedTabs={selectedTabs}
          onToggle={handleTabToggle}
          tabValue={tabValue}
          activeColor="#ebf7f6"
          activeTextColor="#4f9289"
        />
      </View>

      {/* Month nav + Filter + Add */}
      <View style={s.controlRow}>
        <View style={[s.actionBtn, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
          <TouchableOpacity onPress={() => setMonthOffset(o => o - 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={13} color={DC.pageActionText} />
          </TouchableOpacity>
          <Text style={[s.actionBtnText, { flex: 1, textAlign: 'center', fontSize: 11 }]} numberOfLines={1}>{label}</Text>
          <TouchableOpacity onPress={() => setMonthOffset(o => o + 1)} disabled={monthOffset >= 0} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={13} color={monthOffset >= 0 ? Colors.faint : DC.pageActionText} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[s.actionBtn, s.iconBtn, hasActiveFilter && s.actionBtnActive]}
          activeOpacity={0.7}
          onPress={() => setShowFilter(true)}
        >
          <AnimatedIcon set="basil" icon="filter-solid" size={18} color={hasActiveFilter ? '#4f9289' : DC.pageActionText} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.actionBtn, s.iconBtn]}
          activeOpacity={0.7}
          onPress={() => setShowAddRecording(true)}
        >
          <AnimatedIcon set="basil" icon="plus-solid" size={18} color={DC.pageActionText} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={14} color={Colors.faint} />
        <TextInput
          style={s.searchInput}
          placeholder="search recordings..."
          placeholderTextColor={Colors.faint}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={14} color={Colors.faint} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <GooeyLoader />
        </BlurView>
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>no recordings for {label}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {grouped.type === 'status' ? (
            <>
              {grouped.pending.length > 0 && (
                <View>
                  <Text style={s.sectionHeader}>Ongoing</Text>
                  {grouped.pending.map((r, i) => {
                    const badge = TYPE_BADGE[r.type] ?? { label: r.type, color: BADGE_COLOR };
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[s.row, i === grouped.pending.length - 1 && grouped.completed.length === 0 && s.rowLast]}
                        activeOpacity={0.7}
                        onPress={() => openRecording(r.id)}
                      >
                        <View style={s.rowLeft}>
                          <Text style={s.rowName} numberOfLines={1}>{r.name}</Text>
                          <Text style={s.rowDate}>{formatDate(r.transaction_date)}</Text>
                        </View>
                        <View style={s.rowRight}>
                          <Text style={s.rowAmount}>{r.currency ?? defaultCurrency} {fmt(Number(r.amount))}</Text>
                          <View style={[s.badge, { backgroundColor: badge.color + '22', alignSelf: 'flex-end' }]}>
                            <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {grouped.completed.length > 0 && (
                <View>
                  <Text style={s.sectionHeader}>Completed</Text>
                  {grouped.completed.map((r, i) => {
                    const badge = TYPE_BADGE[r.type] ?? { label: r.type, color: BADGE_COLOR };
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[s.row, i === grouped.completed.length - 1 && s.rowLast]}
                        activeOpacity={0.7}
                        onPress={() => openRecording(r.id)}
                      >
                        <View style={s.rowLeft}>
                          <Text style={s.rowName} numberOfLines={1}>{r.name}</Text>
                          <Text style={s.rowDate}>{formatDate(r.transaction_date)}</Text>
                        </View>
                        <View style={s.rowRight}>
                          <Text style={s.rowAmount}>{r.currency ?? defaultCurrency} {fmt(Number(r.amount))}</Text>
                          <View style={[s.badge, { backgroundColor: badge.color + '22', alignSelf: 'flex-end' }]}>
                            <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          ) : (
            grouped.entries.map(([date, items]) => (
              <View key={date}>
                <Text style={s.sectionHeader}>
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                {items.map((r, i) => {
                  const badge = TYPE_BADGE[r.type] ?? { label: r.type, color: BADGE_COLOR };
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[s.row, i === items.length - 1 && s.rowLast]}
                      activeOpacity={0.7}
                      onPress={() => openRecording(r.id)}
                    >
                      <View style={s.rowLeft}>
                        <Text style={s.rowName} numberOfLines={1}>{r.name}</Text>
                        {r.space?.name && (
                          <Text style={s.rowCat} numberOfLines={1}>{r.space.name}</Text>
                        )}
                      </View>
                      <View style={s.rowRight}>
                        <Text style={s.rowAmount}>{r.currency ?? defaultCurrency} {fmt(Number(r.amount))}</Text>
                        <View style={[s.badge, { backgroundColor: badge.color + '22', alignSelf: 'flex-end' }]}>
                          <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {showAddRecording && (
        <AddRecordingScreen
          inlineProps={{
            spaceId: propSpaceId,
            spaceName: spaceName,
            categoryId,
            categoryName,
            defaultDate: new Date().toISOString().split('T')[0],
            onClose: () => {
              setShowAddRecording(false);
              queryClient.invalidateQueries({ queryKey: ['recordings-panel', userId, from] });
            },
          }}
        />
      )}

      {/* ── Filter modal ── */}
      <BottomSheet visible={showFilter} onClose={() => setShowFilter(false)} title="filter">

        {/* Clear */}
        <TouchableOpacity
          style={s.clearBtn}
          onPress={() => { setFilterTypes(new Set(['all'])); setFilterSpaces(new Set(['all'])); setAmountSort('none'); }}
          activeOpacity={0.7}
        >
          <Text style={s.clearBtnText}>Clear All</Text>
        </TouchableOpacity>

        {/* Type */}
        <Text style={s.filterLabel}>Recording Type</Text>
        <View style={s.chips}>
          <TouchableOpacity style={[s.chip, filterTypes.has('all') && s.chipActive]} onPress={() => setFilterTypes(new Set(['all']))} activeOpacity={0.7}>
            <Text style={[s.chipText, filterTypes.has('all') && s.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {ALL_TYPES.map(t => (
            <TouchableOpacity key={t} style={[s.chip, filterTypes.has(t) && s.chipActive]} onPress={() => toggleSet(filterTypes, t, setFilterTypes)} activeOpacity={0.7}>
              <Text style={[s.chipText, filterTypes.has(t) && s.chipTextActive]}>{TYPE_BADGE[t]?.label ?? t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Space */}
        <Text style={s.filterLabel}>Space</Text>
        <View style={s.chips}>
          <TouchableOpacity style={[s.chip, filterSpaces.has('all') && s.chipActive]} onPress={() => setFilterSpaces(new Set(['all']))} activeOpacity={0.7}>
            <Text style={[s.chipText, filterSpaces.has('all') && s.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {(spaces as any[]).map((sp: any) => (
            <TouchableOpacity key={sp.id} style={[s.chip, filterSpaces.has(sp.id) && s.chipActive]} onPress={() => toggleSet(filterSpaces, sp.id, setFilterSpaces)} activeOpacity={0.7}>
              <Text style={[s.chipText, filterSpaces.has(sp.id) && s.chipTextActive]}>{sp.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount sort */}
        <Text style={s.filterLabel}>Sort by Amount</Text>
        <View style={s.chips}>
          {AMOUNT_SORTS.map(opt => (
            <TouchableOpacity key={opt.key} style={[s.chip, amountSort === opt.key && s.chipActive]} onPress={() => setAmountSort(opt.key)} activeOpacity={0.7}>
              <Text style={[s.chipText, amountSort === opt.key && s.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </BottomSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: DC.pagePadding, paddingBottom: 80 },

  tabsWrap:   { paddingHorizontal: DC.pagePadding, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },

  controlRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: DC.pagePadding, paddingVertical: 10 },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: DC.pageActionPaddingH, paddingVertical: DC.pageActionPaddingV, borderRadius: DC.pageActionRadius, backgroundColor: DC.pageActionBg, borderWidth: DC.pageActionBorderWidth },
  actionBtnActive: { backgroundColor: '#ebf7f6' },
  actionBtnText: { fontFamily: AppFont.regular, fontSize: DC.dropdownFontSize, color: DC.pageActionText },
  iconBtn:       { paddingHorizontal: 14 },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },

  sectionHeader: { fontFamily: AppFont.semiBold, fontSize: 11, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  rowLast:   { borderBottomWidth: 0 },
  rowLeft:   { flex: 1, gap: 3 },
  badge:     { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  badgeText: { fontFamily: AppFont.semiBold, fontSize: 10 },
  rowName:   { fontFamily: AppFont.regular, fontSize: 14, color: '#111111' },
  rowDate:   { fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted, marginTop: 1 },
  rowCat:    { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, fontStyle: 'italic' },
  rowRight:  { alignItems: 'flex-end', gap: 4 },
  rowAmount: { fontFamily: AppFont.bold, fontSize: 13, color: '#111111' },

  searchRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: DC.pagePadding, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMid },
  searchInput:{ flex: 1, fontFamily: AppFont.regular, fontSize: 14, color: DC.pageText },

  // Filter modal
  clearBtn:     { alignSelf: 'flex-end', marginBottom: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  clearBtnText: { fontFamily: AppFont.semiBold, fontSize: 12, color: '#4f9289' },
  filterLabel:  { fontFamily: AppFont.semiBold, fontSize: 11, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  chipActive:   { backgroundColor: '#ebf7f6' },
  chipText:     { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },
  chipTextActive: { fontFamily: AppFont.semiBold, fontSize: 13, color: '#4f9289' },
});
