import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  ActivityIndicator, TouchableOpacity, RefreshControl, TextInput, Image, Modal, Animated,
} from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { DC } from '../../src/lib/design';
import { useNav } from '../../src/lib/NavContext';
import AddExpenseScreen from './add-expense';
import { FACE_IMAGES } from '../../src/lib/faceImages';
const BORDER      = '#d2d2d2';
const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'money-in', label: 'Money In' },
  { key: 'money-out', label: 'Money Out' },
  { key: 'owes-you', label: 'Owes You' },
  { key: 'you-owe', label: 'You Owe' },
] as const;
const FILTER_TYPE_MAP: Record<string, string[]> = {
  'all': ['expense','income','debt','due','return','payment','savings'],
  'money-in': ['income','due','return'],
  'money-out': ['expense','debt','payment'],
  'owes-you': ['due'],
  'you-owe': ['debt'],
};
interface Props {
  onClose: () => void;
  categoryId?: string;
  categoryName?: string;
  spaceId?: string;
  spaceName?: string;
}
export default function RecordingsPanel({ onClose, categoryId, categoryName, spaceId: propSpaceId, spaceName }: Props) {
  const { userId, defaultCurrency, userName, user } = useUser();
  const { openRecording } = useNav();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'date' | 'category'>('date');
  const [filterOption, setFilterOption] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseFormType, setExpenseFormType] = useState<'expense' | 'income'>('expense');
  const [showTypeChoice, setShowTypeChoice] = useState(false);
  const activeTypes = useMemo(() => FILTER_TYPE_MAP[filterOption], [filterOption]);
  const { from, to, label } = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return { from: f, to: t, label: `${months[d.getMonth()]} ${d.getFullYear()}` };
  }, []);
  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['recordings-panel', userId, from, categoryId, propSpaceId],
    queryFn: async () => {
      let query = supabase
        .from('recordings')
        .select('id, name, type, amount, transaction_date, created_at, currency, space_id, spaces:space_id(name), category_id, categories:category_id(icon), is_due, paid_amount, status, linked_recording_id')
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
    if (search.trim()) result = result.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    // Hide individual return payments; adjust parent recording amount to remaining balance
    const parentIds = new Set(
      recordings.filter(r => r.type === 'return' && r.linked_recording_id).map(r => r.linked_recording_id)
    );
    if (parentIds.size > 0) {
      result = result
        .filter(r => r.type !== 'return')
        .map(r => {
          if (parentIds.has(r.id)) {
            const remaining = Number(r.amount) - Number(r.paid_amount ?? 0);
            return { ...r, _displayAmount: remaining > 0 ? remaining : 0 };
          }
          return r;
        });
    }
    return result;
  }, [recordings, activeTypes, search]);
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const grouped = useMemo(() => {
    if (viewMode === 'category') {
      const map: Record<string, typeof filtered> = {};
      filtered.forEach(r => {
        const cat = r.space?.name || 'Other';
        if (!map[cat]) map[cat] = [];
        map[cat].push(r);
      });
      const entries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
      return { type: 'category', entries } as const;
    }
    const map: Record<string, typeof filtered> = {};
    filtered.forEach(r => {
      if (!map[r.transaction_date]) map[r.transaction_date] = [];
      map[r.transaction_date].push(r);
    });
    const entries = Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
    return { type: 'date', entries } as const;
  }, [filtered, viewMode]);
  const formatDate = (d: string) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };
  const currentFilterLabel = FILTER_OPTIONS.find(o => o.key === filterOption)?.label || 'All';
  return (
    <SafeAreaView style={s.root}>
      {/* Header — matches home panel exactly */}
      <View style={s.waveBg}>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={s.goBackRow}>
          <Text style={s.goBackText}>go back</Text>
        </TouchableOpacity>
        <View style={s.headerRow}>
          <View style={s.faceCircle}>
            <Image source={FACE_IMAGES[user?.user_metadata?.avatar_index ?? 0]} style={{ width: 48, height: 48, borderRadius: 24 }} />
          </View>
          <View style={s.headerTextCol}>
            <Text style={s.headerGreeting}>Hello, <Text style={s.headerName}>{userName?.split(' ')[0]?.charAt(0).toUpperCase() + userName?.split(' ')[0]?.slice(1) || 'There'}</Text></Text>
            <TouchableOpacity activeOpacity={0.7} style={s.headerDateRow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.headerDateValue}>{label.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity activeOpacity={0.7} style={{ marginLeft: 'auto' }}>
          </TouchableOpacity>
        </View>
      </View>
      {/* Recordings title + add */}
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>Recordings</Text>
        <TouchableOpacity onPress={() => setShowTypeChoice(true)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        </TouchableOpacity>
      </View>
      {/* Toggle pills + Generate Statement */}
      <View style={s.toggleRow}>
        <View style={s.toggleGroup}>
          <TouchableOpacity
            style={[s.togglePill, viewMode === 'date' && s.togglePillActive]}
            onPress={() => setViewMode('date')}
            activeOpacity={0.7}
          >
            <Text style={[s.togglePillText, viewMode === 'date' && s.togglePillTextActive]}>Date</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.togglePill, viewMode === 'category' && s.togglePillActive]}
            onPress={() => setViewMode('category')}
            activeOpacity={0.7}
          >
            <Text style={[s.togglePillText, viewMode === 'category' && s.togglePillTextActive]}>Category</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.genStmtBtn} activeOpacity={0.7}>
          <Text style={s.genStmtBtnText}>Generate Statement</Text>
        </TouchableOpacity>
      </View>
      {/* Search + Dropdown — same row, same height */}
      <View style={s.filterRow}>
        <View style={s.searchRow}>
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
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={s.dropdownBtn}
          onPress={() => setShowFilterDropdown(p => !p)}
          activeOpacity={0.7}
        >
          <Text style={s.dropdownBtnText}>{currentFilterLabel}</Text>
        </TouchableOpacity>
        {showFilterDropdown && (
          <View style={s.dropdownList}>
            {FILTER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[s.dropdownItem, filterOption === opt.key && s.dropdownItemActive]}
                onPress={() => { setFilterOption(opt.key); setShowFilterDropdown(false); }}
                activeOpacity={0.7}
              >
                <Text style={[s.dropdownItemText, filterOption === opt.key && s.dropdownItemTextActive]}>{opt.label}</Text>

              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      {/* List */}
      {isLoading ? (
        <View style={s.empty}>
          <ActivityIndicator color={Colors.muted} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>no recordings for this period</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {grouped.entries.map(([sectionKey, items]) => (
            <View key={sectionKey}>
              <Text style={viewMode === 'category' ? s.sectionCategoryHeader : s.sectionDateHeader}>
                {viewMode === 'category' ? sectionKey : formatDate(sectionKey)}
              </Text>
              {items.map((r, i) => {
                const sign = r.type === 'expense' ? '- ' : '';
                const nameStr = r.name.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[s.row, i === items.length - 1 && s.rowLast]}
                    activeOpacity={0.7}
                    onPress={() => openRecording(r.id)}
                  >
                    <View style={s.recIconCircle}>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.rowName} numberOfLines={1}>{nameStr}</Text>
                      <Text style={s.rowSpace}>{r.space?.name || ''}</Text>
                    </View>
                    <Text style={s.rowAmount}>{sign}{r.currency ?? defaultCurrency} {fmt(Number(r._displayAmount ?? r.amount))}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
      {/* Type choice modal */}
      <Modal visible={showTypeChoice} transparent animationType="fade" onRequestClose={() => setShowTypeChoice(false)}>
        <View style={s.choiceOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowTypeChoice(false)} />
          <Animated.View style={s.choiceCard}>
            <Text style={s.choiceTitle}>New Record</Text>
            <View style={s.choiceGrid}>
              <TouchableOpacity
                style={s.choicePill}
                activeOpacity={0.8}
                onPress={() => { setShowTypeChoice(false); setShowAddExpense(true); setExpenseFormType('income'); }}
              >
                <Text style={s.choicePillText}>Money In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.choicePill}
                activeOpacity={0.8}
                onPress={() => { setShowTypeChoice(false); setShowAddExpense(true); setExpenseFormType('expense'); }}
              >
                <Text style={s.choicePillText}>Money Out</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
      {showAddExpense && (
        <AddExpenseScreen
          type={expenseFormType}
          onClose={() => {
            setShowAddExpense(false);
            queryClient.invalidateQueries({ queryKey: ['recordings-panel', userId, from] });
          }}
          userId={userId}
          defaultCurrency={defaultCurrency}
          spaceId={propSpaceId}
          spaceName={spaceName}
        />
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  // ── Header
  waveBg: {
    backgroundColor: Colors.white,
    paddingHorizontal: DC.pagePadding,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginTop: 4 },
  faceCircle:    { width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: '#c9c7c3', alignItems: 'center', justifyContent: 'center' },
  headerTextCol: { flex: 1, justifyContent: 'center' },
  headerGreeting: { fontFamily: 'Aujournuit-Regular', fontSize: 22, color: '#000000' },
  headerName:    { fontFamily: 'Aujournuit-Regular', fontSize: 22, color: '#000000' },
  headerDateRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  headerDateValue: { fontFamily: 'Inter-Bold', fontSize: 10, color: '#b5b4a4', letterSpacing: 1.5 },
  // ── Section title
  goBackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    marginBottom: 4,
  },
  goBackText: { fontFamily: 'InclusiveSans-Regular', fontSize: 11, color: '#464646' },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: DC.pagePadding, paddingTop: 20, paddingBottom: 20,
  },
  sectionTitle: { fontFamily: 'Aujournuit-Regular', fontSize: 17, color: '#000000', letterSpacing: 0.4 },
  // ── Toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: DC.pagePadding, paddingBottom: 10,
  },
  toggleGroup:   { flexDirection: 'row', gap: 0, borderWidth: 1, borderColor: BORDER, borderRadius: Radius.pill, overflow: 'hidden', height: 36 },
  togglePill:    { paddingHorizontal: 16, justifyContent: 'center', height: 36 },
  togglePillActive: { backgroundColor: '#464646' },
  togglePillText:     { fontFamily: 'InclusiveSans-Regular', fontSize: 12, color: '#464646' },
  togglePillTextActive: { fontFamily: 'InclusiveSans-SemiBold', fontSize: 12, color: '#ffffff' },
  genStmtBtn: {
    flex: 1, height: 36, justifyContent: 'center', alignItems: 'center',
    borderRadius: Radius.pill, borderWidth: 1, borderColor: BORDER,
    position: 'relative',
  },
  genStmtBtnText: { fontFamily: 'InclusiveSans-Regular', fontSize: 12, color: '#464646' },
  // ── Type choice modal
  choiceOverlay: {
    flex: 1, backgroundColor: 'transparent',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32,
  },
  choiceCard: {
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20,
    borderWidth: 1, borderColor: '#d0d0d0',
    padding: 20, width: '100%', maxWidth: 320,
  },
  choiceTitle: { fontFamily: 'Aujournuit-Regular', fontSize: 17, color: '#000000', letterSpacing: 0.4, marginBottom: 16 },
  choiceGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  choicePill: {
    backgroundColor: '#3a3a34', borderRadius: 999,
    paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', width: '48%', flexGrow: 1,
  },
  choicePillText: { fontFamily: 'InclusiveSans-Medium', fontSize: 12, color: '#ffffff' },
  // ── Filter row (search + dropdown, same height)
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: DC.pagePadding, marginBottom: 8,
    position: 'relative', zIndex: 10,
  },
  searchRow: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  searchInput: { flex: 1, fontFamily: 'InclusiveSans-Regular', fontSize: 16, color: Colors.text, paddingVertical: 0, paddingHorizontal: 0, textAlignVertical: 'center' },
  dropdownBtn: {
    height: 36, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 14, minWidth: 130,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: BORDER,
    position: 'relative',
  },
  dropdownBtnText: { fontFamily: 'InclusiveSans-Regular', fontSize: 12, color: '#464646' },
  dropdownArrow: { position: 'absolute', right: 12, top: 12 },
  dropdownList: {
    position: 'absolute', top: 44, right: 0, minWidth: 160,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: BORDER,
    backgroundColor: Colors.white, overflow: 'hidden', zIndex: 20,
    elevation: 6,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  dropdownItemActive: { backgroundColor: Colors.surface },
  dropdownItemText:     { fontFamily: 'InclusiveSans-Regular', fontSize: 13, color: Colors.text },
  dropdownItemTextActive: { fontFamily: 'InclusiveSans-SemiBold', fontSize: 13, color: '#464646' },
  // ── List
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyText: { fontFamily: 'InclusiveSans-Regular', fontSize: 13, color: Colors.muted },
  scroll: { paddingHorizontal: DC.pagePadding, paddingBottom: 80 },
  sectionDateHeader: { fontFamily: 'Inter-SemiBold', fontSize: 10, color: '#3a3a34', letterSpacing: 1, marginTop: 16, marginBottom: 10 },
  sectionCategoryHeader: { fontFamily: 'InclusiveSans-SemiBold', fontSize: 11, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#d2d2d2', borderStyle: 'dotted',
  },
  rowLast: { borderBottomWidth: 0 },
  recIconCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#c9c7c3', alignItems: 'center', justifyContent: 'center' },
  rowName: { fontFamily: 'InclusiveSans-Medium', fontSize: 12, color: '#3a3a34', letterSpacing: 0.5, textTransform: 'capitalize' },
  rowSpace:{ fontFamily: 'Inter-Regular', fontSize: 12, color: '#b5b4a4', marginTop: 1, letterSpacing: 0.5 },
  rowAmount: { fontFamily: 'Inter-Regular', fontSize: 11, color: '#3a3a34', letterSpacing: 0.3 },
});

