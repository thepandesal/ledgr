import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity, RefreshControl, TextInput, Modal, Animated,
} from 'react-native';
import TopHeader from '@/components/ui/TopHeader';
import BottomSheet from '@/components/ui/BottomSheet';
import { useState, useMemo, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import { DC } from '../../src/lib/design';
import { useNav } from '../../src/lib/NavContext';
import AddExpenseScreen from './add-expense';
import { recordDirection } from '../../src/lib/recordDirection';
import { dateFilter, MONTH_LABELS } from '../../src/lib/dateFilter';
import { useCurrencyConvert } from '../../src/lib/useCurrencyConvert';

const SVG_BACK   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path fill="currentColor" d="M10.5 6a.75.75 0 0 0-.75-.75H3.81l1.97-1.97a.75.75 0 0 0-1.06-1.06L1.47 5.47a.75.75 0 0 0 0 1.06l3.25 3.25a.75.75 0 0 0 1.06-1.06L3.81 6.75h5.94A.75.75 0 0 0 10.5 6" /></svg>`;
const SVG_ADD    = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4.75c.69 0 1.25.56 1.25 1.25v4.75H18a1.25 1.25 0 1 1 0 2.5h-4.75V18a1.25 1.25 0 1 1-2.5 0v-4.75H6a1.25 1.25 0 1 1 0-2.5h4.75V6c0-.69.56-1.25 1.25-1.25" /></svg>`;
const SVG_EDIT   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12.85 6.91L2.71 17.045l-.7 4.075a.74.74 0 0 0 .21.655c.14.14.335.22.53.22c.04 0 .085 0 .125-.01l4.075-.7l10.14-10.14l-4.24-4.24zm8.27-4.03A3 3 0 0 0 19 2c-.8 0-1.555.31-2.12.88l-2.97 2.97l4.24 4.24l2.97-2.97C21.685 6.555 22 5.8 22 5s-.31-1.555-.88-2.12"/></svg>`;
const SVG_FOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M4 20q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h6l2 2h8q.825 0 1.413.588T22 8H4v10l2.4-8h17.1l-2.575 8.575q-.2.65-.737 1.038T19 20z"/></svg>`;
const SVG_TRASH  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M20 6a1 1 0 0 1 .117 1.993L20 8h-.081L19 19a3 3 0 0 1-2.824 2.995L16 22H8c-1.598 0-2.904-1.249-2.992-2.75l-.005-.167L4.08 8H4a1 1 0 0 1-.117-1.993L4 6zm-10 4a1 1 0 0 0-1 1v6a1 1 0 0 0 2 0v-6a1 1 0 0 0-1-1m4 0a1 1 0 0 0-1 1v6a1 1 0 0 0 2 0v-6a1 1 0 0 0-1-1m0-8a2 2 0 0 1 2 2a1 1 0 0 1-1.993.117L14 4h-4l-.007.117A1 1 0 0 1 8 4a2 2 0 0 1 1.85-1.995L10 2z"/></svg>`;

const FILTER_TYPE_MAP: Record<string, string[]> = {
  'all':       ['expense','income','debt','due','return','payment','savings'],
  'money-in':  ['income','due','return'],
  'money-out': ['expense','debt','payment'],
  'owes-you':  ['due'],
  'you-owe':   ['debt'],
};

const FILTER_LABELS: Record<string, string> = {
  all: 'All', 'money-in': 'Money In', 'money-out': 'Money Out', 'owes-you': 'Owes You', 'you-owe': 'You Owe',
};

interface Props {
  onClose: () => void;
  categoryId?: string;
  categoryName?: string;
  spaceId?: string;
  spaceName?: string;
}

export default function RecordingsPanel({ onClose, categoryId, categoryName, spaceId: propSpaceId, spaceName }: Props) {
  const { userId, defaultCurrency } = useUser();
  const { toDefault } = useCurrencyConvert();
  const insets = useSafeAreaInsets();
  const { openRecording, switchTab, toggleNotifDropdown } = useNav();
  const router = useRouter();
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else onClose();
  };
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState('');
  const [viewMode, setViewMode]         = useState<'date' | 'category'>('date');
  const [filterOption, setFilterOption] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Global date filter
  const [filterMonth, setFilterMonth] = useState(dateFilter.getMonth());
  const [filterYear,  setFilterYear]  = useState(dateFilter.getYear());
  useEffect(() => dateFilter.subscribe(() => {
    setFilterMonth(dateFilter.getMonth());
    setFilterYear(dateFilter.getYear());
  }), []);
  const { from, to } = useMemo(() => dateFilter.getFromTo(), [filterMonth, filterYear]);
  const dateLabel = `${MONTH_LABELS[filterMonth]} ${filterYear}`;

  const [showDateSheet, setShowDateSheet] = useState(false);
  // draft state — only committed on Apply
  const [draftMonth, setDraftMonth] = useState(filterMonth);
  const [draftYear,  setDraftYear]  = useState(filterYear);

  const activeTypes = useMemo(() => FILTER_TYPE_MAP[filterOption], [filterOption]);

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['recordings-panel', userId, from, to, categoryId, propSpaceId],
    queryFn: async () => {
      let query = supabase
        .from('recordings')
        .select('id, name, type, amount, transaction_date, created_at, currency, space_id, spaces:space_id(name), category_id, categories:category_id(icon,color,name), is_due, paid_amount, status, linked_recording_id')
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
        space:      Array.isArray(r.spaces)     ? r.spaces[0]     : r.spaces,
        categories: Array.isArray(r.categories) ? r.categories[0] : r.categories,
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
    await queryClient.invalidateQueries({ queryKey: ['recordings-panel', userId] });
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    let result = recordings.filter(r => activeTypes.includes(r.type));
    if (search.trim()) result = result.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
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
      filtered.forEach(r => { const cat = r.space?.name || 'Other'; if (!map[cat]) map[cat] = []; map[cat].push(r); });
      return { type: 'category', entries: Object.entries(map).sort(([a],[b]) => a.localeCompare(b)) } as const;
    }
    const map: Record<string, typeof filtered> = {};
    filtered.forEach(r => { if (!map[r.transaction_date]) map[r.transaction_date] = []; map[r.transaction_date].push(r); });
    return { type: 'date', entries: Object.entries(map).sort(([a],[b]) => b.localeCompare(a)) } as const;
  }, [filtered, viewMode]);

  const formatDate = (d: string) => {
    if (!d) return '—';
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const [y,m,day] = d.split('-').map(Number);
    const date = new Date(y, m-1, day);
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    await supabase.from('recordings').delete().in('id', Array.from(selected));
    queryClient.invalidateQueries({ queryKey: ['recordings-panel', userId, from] });
    setSelected(new Set());
  };

  return (
    <View style={s.root}>
      <TopHeader
        title="Transactions"
        subtitle={dateLabel}
        onSubtitlePress={() => { setDraftMonth(filterMonth); setDraftYear(filterYear); setShowDateSheet(true); }}
        onBack={handleBack}
        centered
        variant="blue"
        topInset={insets.top}
        right={
          <TouchableOpacity onPress={toggleNotifDropdown} activeOpacity={0.7}>
            <NavIcon name="notifications" size={22} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      {/* ── Frozen controls ── */}
      <View style={s.frozen}>
        {/* segment toggle + action buttons */}
        <View style={s.pillRow}>
          <View style={s.segmentOuter}>
            <TouchableOpacity style={[s.segmentInner, viewMode === 'date' && s.segmentInnerActive]} onPress={() => setViewMode('date')} activeOpacity={0.8}>
              <Text style={[s.segmentInnerText, viewMode === 'date' && s.segmentInnerTextActive]}>Date</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.segmentInner, viewMode === 'category' && s.segmentInnerActive]} onPress={() => setViewMode('category')} activeOpacity={0.8}>
              <Text style={[s.segmentInnerText, viewMode === 'category' && s.segmentInnerTextActive]}>Category</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => { recordDirection.set('out', 'panel'); onClose(); switchTab('record'); }} activeOpacity={0.7} style={{ width: DC.circleBtn.active.width, height: DC.circleBtn.active.height, borderRadius: DC.circleBtn.active.borderRadius, backgroundColor: DC.headerBlueBg, alignItems: 'center', justifyContent: 'center' }}>
              <SvgXml xml={SVG_ADD} width={22} height={22} color={DC.btnText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2: filter button + action buttons */}
        <View style={s.filterRow}>
          <View>
            <TouchableOpacity style={[s.filterBtn, filterOption !== 'all' && s.filterBtnActive]} onPress={() => setShowFilterDropdown(v => !v)} activeOpacity={0.8}>
              <Text style={[s.filterBtnText, filterOption !== 'all' && s.filterBtnTextActive]}>
                {filterOption === 'all' ? 'Filters' : FILTER_LABELS[filterOption]}
              </Text>
              {filterOption !== 'all' && <View style={s.filterDot} />}
            </TouchableOpacity>
            {showFilterDropdown && (
              <View style={s.dropdownList}>
                {Object.keys(FILTER_TYPE_MAP).map(key => (
                  <TouchableOpacity key={key} style={[s.dropdownItem, filterOption === key && s.dropdownItemActive]} onPress={() => { setFilterOption(key); setShowFilterDropdown(false); }} activeOpacity={0.7}>
                    <Text style={[s.dropdownItemText, filterOption === key && s.dropdownItemTextActive]}>{FILTER_LABELS[key]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          {selected.size > 0 && (
            <View style={{ flexDirection: 'row', gap: 8, marginLeft: 'auto' }}>
              <TouchableOpacity style={DC.circleBtn.base} activeOpacity={0.7}>
                <SvgXml xml={SVG_FOLDER} width={22} height={22} color={DC.pageText} />
              </TouchableOpacity>
              <TouchableOpacity style={DC.circleBtn.base} onPress={handleDelete} activeOpacity={0.7}>
                <SvgXml xml={SVG_TRASH} width={22} height={22} color={DC.btnDangerBg} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={s.toolbarDivider} />

        {/* Search */}
        <View style={s.searchWrap}>
          <TextInput style={s.searchInput} placeholder="" placeholderTextColor={DC.typography.muted.color} value={search} onChangeText={setSearch} />
        </View>
      </View>

      {/* ── List ── */}
      {isLoading ? (
        <View style={s.empty}><ActivityIndicator color={DC.typography.muted.color} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.empty}><Text style={s.emptyText}>no recordings for this period</Text></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {grouped.entries.map(([sectionKey, items]) => (
            <View key={sectionKey}>
              <Text style={s.sectionHeader}>
                {viewMode === 'category' ? sectionKey : formatDate(sectionKey)}
              </Text>
              {items.map((r, i) => {
                const isOut    = ['expense','debt','payment'].includes(r.type);
                const nameStr  = r.name.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                const isSelected = selected.has(r.id);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[s.row, i === items.length - 1 && s.rowLast]}
                    activeOpacity={0.7}
                    onPress={() => openRecording(r.id)}
                  >
                    {/* Checkbox */}
                    <TouchableOpacity onPress={() => toggleSelect(r.id)} activeOpacity={0.7}>
                      <View style={[s.checkbox, isSelected && s.checkboxSelected]} />
                    </TouchableOpacity>
                    {/* Category icon */}
                    <View style={s.iconWrap}>
                      <Text style={s.iconInitial}>{(r.categories?.name ?? r.name).charAt(0).toUpperCase()}</Text>
                    </View>
                    {/* Body */}
                    <View style={s.rowBody}>
                      <Text style={s.rowName} numberOfLines={1}>{nameStr}</Text>
                      <Text style={s.rowSub} numberOfLines={1}>{r.space?.name || 'No Folder'}</Text>
                      <Text style={s.rowMetaBold} numberOfLines={1}>
                        {['due','return'].includes(r.type) ? 'Loan' : r.type.charAt(0).toUpperCase() + r.type.slice(1)}
                        {r.categories?.name ? <Text style={s.rowMetaReg}>{` - ${r.categories.name}`}</Text> : null}
                      </Text>
                    </View>
                    {/* Amount */}
                    <Text style={s.rowAmount} numberOfLines={1}>{isOut ? '- ' : ''}{fmt(toDefault(Number(r._displayAmount ?? r.amount), r.currency))}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Date picker sheet */}
      <BottomSheet visible={showDateSheet} onClose={() => setShowDateSheet(false)} title="select month">
        {/* Year row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => setDraftYear(y => y - 1)} activeOpacity={0.7} style={s.yearNavBtn}>
            <Text style={s.yearNavArrow}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={s.yearNavLabel}>{draftYear}</Text>
          <TouchableOpacity onPress={() => setDraftYear(y => y + 1)} activeOpacity={0.7} style={s.yearNavBtn}>
            <Text style={s.yearNavArrow}>{'›'}</Text>
          </TouchableOpacity>
        </View>
        {/* Month grid */}
        <View style={s.monthGrid}>
          {MONTH_LABELS.map((label, i) => (
            <TouchableOpacity
              key={label}
              style={[s.monthGridChip, draftMonth === i && s.monthGridChipActive]}
              onPress={() => setDraftMonth(i)}
              activeOpacity={0.7}
            >
              <Text style={[s.monthGridChipText, draftMonth === i && s.monthGridChipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={s.applyBtn}
          onPress={() => { dateFilter.set(draftMonth, draftYear); setShowDateSheet(false); }}
          activeOpacity={0.8}
        >
          <Text style={s.applyBtnText}>Apply</Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: DC.pageBg },
  frozen: { backgroundColor: DC.pageBg, zIndex: 10 },

  // date picker sheet
  yearNavBtn:   { padding: 8 },
  yearNavArrow: { fontFamily: 'Poppins-Regular', fontSize: 22, color: DC.pageText, lineHeight: 26 },
  yearNavLabel: { fontFamily: 'Poppins-Bold', fontSize: 16, color: DC.pageText, minWidth: 60, textAlign: 'center' },
  monthGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  monthGridChip:         { width: '22%', flexGrow: 1, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder, alignItems: 'center' },
  monthGridChipActive:   { backgroundColor: '#4394ff', borderColor: '#4394ff' },
  monthGridChipText:     { fontFamily: 'Poppins-Regular', fontSize: 12, color: DC.pageTextMuted },
  monthGridChipTextActive: { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: '#ffffff' },
  applyBtn:     { backgroundColor: '#4394ff', borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  applyBtnText: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: '#ffffff' },

  // controls row
  pillRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DC.pagePadding, paddingTop: 12, paddingBottom: 8, gap: 8 },
  segmentOuter: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder, overflow: 'hidden', height: 34 },
  segmentInner: { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  segmentInnerActive: { backgroundColor: DC.headerBlueBg },
  segmentInnerText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: DC.pageTextMuted },
  segmentInnerTextActive: { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: '#fff' },

  filterRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DC.pagePadding, paddingTop: 4, paddingBottom: 16, gap: 8 },
  filterBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder, backgroundColor: DC.pageBg },
  filterBtnActive:  { borderColor: DC.headerBlueBg, backgroundColor: '#eef4ff' },
  filterBtnText:    { fontFamily: 'Poppins-Regular', fontSize: 12, color: DC.pageTextMuted },
  filterBtnTextActive: { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: DC.headerBlueBg },
  filterDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: DC.headerBlueBg },
  dropdownList: {
    position: 'absolute', top: 40, left: 0, minWidth: 160,
    borderRadius: 12, borderWidth: 1, borderColor: DC.controlBorder,
    backgroundColor: '#fff', zIndex: 20, elevation: 6,
  },
  dropdownItem:           { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: DC.controlBorder },
  dropdownItemActive:     { backgroundColor: '#eef4ff' },
  dropdownItemText:       { fontFamily: 'Poppins-Regular', fontSize: 13, color: DC.pageText },
  dropdownItemTextActive: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: DC.headerBlueBg },

  toolbarDivider: { height: 1, backgroundColor: DC.controlBorder, marginHorizontal: DC.pagePadding },

  // search
  searchWrap:  { marginHorizontal: DC.pagePadding, marginTop: 16, marginBottom: 16, height: 38, borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder, paddingHorizontal: 14, justifyContent: 'center' },
  searchInput: { fontFamily: 'Poppins-Regular', fontSize: 14, color: DC.pageText, paddingVertical: 0 },

  // list
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'Poppins-Regular', fontSize: 13, color: DC.pageTextMuted },
  scroll:    { paddingHorizontal: DC.pagePadding, paddingTop: 8, paddingBottom: 80 },
  sectionHeader: { fontFamily: 'Poppins-SemiBold', fontSize: 11, color: DC.pageTextMuted, textTransform: 'uppercase', letterSpacing: 0.6, paddingVertical: 10 },

  row:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18, borderBottomWidth: DC.rowDivider.height, borderBottomColor: DC.rowDivider.backgroundColor },
  rowLast: { borderBottomWidth: 0 },
  checkbox:         { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: DC.controlBorder },
  checkboxSelected: { width: 20, height: 20, borderRadius: 10, backgroundColor: DC.headerBlueBg, borderColor: DC.headerBlueBg },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: DC.cardBg, alignItems: 'center', justifyContent: 'center' },
  rowBody:      { flex: 1, gap: 1 },
  rowName:      { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: DC.pageText },
  rowSub:       { fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted },
  rowMetaBold:  { fontFamily: 'Poppins-SemiBold', fontSize: 10, color: DC.pageTextMuted },
  rowMetaReg:   { fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageTextMuted },
  rowAmount:    { fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText, flexShrink: 0 },

  iconInitial: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: DC.pageTextMuted },

  // modal
  choiceOverlay:  { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, backgroundColor: 'rgba(0,0,0,0.2)' },
  choiceCard:     { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: DC.controlBorder, padding: 20, width: '100%', maxWidth: 320 },
  choiceTitle:    { fontFamily: 'Poppins-Bold', fontSize: 18, color: DC.pageText, marginBottom: 16 },
  choiceGrid:     { flexDirection: 'row', gap: 10 },
  choicePill:     { flex: 1, backgroundColor: DC.btnBg, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  choicePillText: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: '#fff' },

  // unused legacy
  header: {}, title: {}, headerDivider: {}, segmentWrap: {}, segmentActive: {}, segmentBtn: {}, segmentText: {}, segmentTextActive: {},
  toolbar: {}, editBtn: {}, addBtn: {}, addBtnText: {}, rowMeta: {},
});
