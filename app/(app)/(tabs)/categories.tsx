import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { useState, useMemo, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import type { Category } from '../../../src/types';
import TopHeader from '@/components/ui/TopHeader';
import BottomSheet from '@/components/ui/BottomSheet';
import NavIcon from '@/components/ui/NavIcons';
import { Colors } from '@/components/ui/theme';
import { DC } from '../../../src/lib/design';
import { useNav } from '../../../src/lib/NavContext';
import { CatIcon, catIconKeyForName } from '../../../src/lib/systemCategories';
import { dateFilter, MONTH_LABELS } from '../../../src/lib/dateFilter';

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CategoriesScreen() {
  const { userId, defaultCurrency } = useUser();
  const insets = useSafeAreaInsets();
  const { toggleNotifDropdown, openRecordingsPanel } = useNav();
  const [tab, setTab] = useState<'categories' | 'reports'>('categories');

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
  const [draftMonth, setDraftMonth] = useState(filterMonth);
  const [draftYear,  setDraftYear]  = useState(filterYear);

  const { data: categories = [], isLoading: loadingCats } = useQuery<Category[]>({
    queryKey: ['categories', userId],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select().eq('user_id', userId).order('name');
      return (data ?? []) as Category[];
    },
    enabled: !!userId,
  });

  // All-time expenses for reports
  const { data: allRecordings = [], isLoading: loadingRecs } = useQuery({
    queryKey: ['categories-all-time', userId, from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('id, name, amount, type, category_id, categories:category_id(name, color, icon)')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .neq('status', 'voided')
        .neq('is_system_generated', true)
        .not('category_id', 'is', null)
        .gte('transaction_date', from)
        .lte('transaction_date', to);
      return (data ?? []).map((r: any) => ({
        ...r,
        categories: Array.isArray(r.categories) ? r.categories[0] : r.categories,
      }));
    },
    enabled: !!userId,
  });

  const reportRows = useMemo(() => {
    const map: Record<string, { name: string; color: string; icon: string; total: number; count: number }> = {};
    allRecordings.forEach((r: any) => {
      const cid = r.category_id;
      if (!map[cid]) {
        map[cid] = {
          name:  r.categories?.name  ?? 'Unknown',
          color: r.categories?.color ?? '#ccc',
          icon:  r.categories?.icon  ?? '',
          total: 0,
          count: 0,
        };
      }
      map[cid].total += Number(r.amount);
      map[cid].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [allRecordings]);

  const maxTotal = reportRows[0]?.total ?? 1;

  return (
    <View style={s.root}>
      <TopHeader
        title="Categories"
        subtitle={dateLabel}
        onSubtitlePress={() => { setDraftMonth(filterMonth); setDraftYear(filterYear); setShowDateSheet(true); }}
        centered
        variant="blue"
        topInset={insets.top}
        right={
          <TouchableOpacity onPress={toggleNotifDropdown} activeOpacity={0.7}>
            <NavIcon name="notifications" size={22} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      {/* Segment toggle */}
      <View style={s.segmentWrap}>
        <View style={s.segmentOuter}>
          {(['categories', 'reports'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.segmentBtn, tab === t && s.segmentBtnActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
            >
              <Text style={[s.segmentText, tab === t && s.segmentTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'categories' ? (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {loadingCats ? (
            <ActivityIndicator color={DC.headerBlueBg} style={{ marginTop: 40 }} />
          ) : categories.length === 0 ? (
            <Text style={s.empty}>no categories yet</Text>
          ) : (
            <View style={s.grid}>
              {categories.map(cat => {
                const iconKey = catIconKeyForName(cat.name) ?? 'shopping';
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={s.gridItem}
                    activeOpacity={0.75}
                    onPress={() => openRecordingsPanel({ categoryId: cat.id, categoryName: cat.name })}
                  >
                    <View style={s.iconCircle}>
                      <CatIcon name={iconKey} color={DC.pageTextMuted} size={26} />
                    </View>
                    <Text style={s.gridLabel} numberOfLines={2}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {loadingRecs ? (
            <ActivityIndicator color={DC.headerBlueBg} style={{ marginTop: 40 }} />
          ) : reportRows.length === 0 ? (
            <Text style={s.empty}>no expense data yet</Text>
          ) : (
            <View style={s.reportList}>
              {reportRows.map((row, i) => {
                const iconKey = catIconKeyForName(row.name) ?? 'shopping';
                const barWidth = (row.total / maxTotal) * 100;
                return (
                  <View key={row.name} style={s.reportRow}>
                    <View style={s.reportRank}>
                      <Text style={s.reportRankText}>{i + 1}</Text>
                    </View>
                    <View style={s.reportIconCircle}>
                      <CatIcon name={iconKey} color={DC.pageTextMuted} size={20} />
                    </View>
                    <View style={s.reportBody}>
                      <View style={s.reportTopRow}>
                        <Text style={s.reportName} numberOfLines={1}>{row.name}</Text>
                        <Text style={s.reportAmount}>{fmt(row.total)}</Text>
                      </View>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { width: `${barWidth}%` as any }]} />
                      </View>
                      <Text style={s.reportCount}>{row.count} recording{row.count !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
      {/* Date picker sheet */}
      <BottomSheet visible={showDateSheet} onClose={() => setShowDateSheet(false)} title="select month">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => setDraftYear(y => y - 1)} activeOpacity={0.7} style={s.yearNavBtn}>
            <Text style={s.yearNavArrow}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={s.yearNavLabel}>{draftYear}</Text>
          <TouchableOpacity onPress={() => setDraftYear(y => y + 1)} activeOpacity={0.7} style={s.yearNavBtn}>
            <Text style={s.yearNavArrow}>{'›'}</Text>
          </TouchableOpacity>
        </View>
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
  root: { flex: 1, backgroundColor: Colors.white },

  // segment
  segmentWrap:  { paddingHorizontal: DC.pagePadding, paddingTop: 14, paddingBottom: 10 },
  segmentOuter: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder, overflow: 'hidden', alignSelf: 'flex-start' },
  segmentBtn:   { paddingHorizontal: 20, paddingVertical: 8, justifyContent: 'center', alignItems: 'center' },
  segmentBtnActive:   { backgroundColor: DC.headerBlueBg },
  segmentText:        { fontFamily: 'Poppins-Regular', fontSize: 12, color: DC.pageTextMuted },
  segmentTextActive:  { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: '#fff' },

  scroll: { paddingHorizontal: DC.pagePadding, paddingTop: 8, paddingBottom: 80 },
  empty:  { fontFamily: 'Poppins-Regular', fontSize: 13, color: DC.pageTextMuted, textAlign: 'center', marginTop: 48 },

  // 3-col grid
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: {
    width: '30%', flexGrow: 1,
    alignItems: 'center', gap: 8,
    paddingVertical: 16, paddingHorizontal: 8,
    borderRadius: 14, borderWidth: 1, borderColor: DC.controlBorder,
    backgroundColor: Colors.white,
  },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: DC.cardBg },
  gridLabel:  { fontFamily: 'Poppins-SemiBold', fontSize: 11, color: DC.pageText, textAlign: 'center' },

  // reports list
  reportList: { gap: 16 },
  reportRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportRank: { width: 22, alignItems: 'center' },
  reportRankText: { fontFamily: 'Poppins-Bold', fontSize: 12, color: DC.pageTextMuted },
  reportIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: DC.cardBg },
  reportBody: { flex: 1, gap: 4 },
  reportTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportName:   { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: DC.pageText, flex: 1 },
  reportAmount: { fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText },
  reportCount:  { fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageTextMuted },
  barTrack: { height: 4, backgroundColor: DC.controlBorder, borderRadius: 2, overflow: 'hidden' },
  // date picker styles
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
});
