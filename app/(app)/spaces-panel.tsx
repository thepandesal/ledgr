import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, RefreshControl, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { AppFont } from '../../src/lib/fonts';
import { DC } from '../../src/lib/design';
import { useNav } from '../../src/lib/NavContext';
import { useExchangeRates } from '../../src/lib/useExchangeRates';
import GooeyLoader from '@/components/ui/GooeyLoader';
import { BlurView } from 'expo-blur';
import BottomSheet from '@/components/ui/BottomSheet';
import TopHeader from '@/components/ui/TopHeader';


const TEAL = '#9cd7d2';
const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface Props { onClose: () => void; }

export default function SpacesPanel({ onClose }: Props) {
  const { userId, defaultCurrency } = useUser();
  const { openRecordingsPanel, openSpace } = useNav();
  const { convert } = useExchangeRates();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [monthOffset] = useState(0);
  const [createModal, setCreateModal] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceBudget, setSpaceBudget] = useState('');
  const [spaceBudgetCurrency, setSpaceBudgetCurrency] = useState(defaultCurrency);
  const [spaceType, setSpaceType] = useState<'expense' | 'savings'>('expense');
  const [spaceTargetDate, setSpaceTargetDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const openCreate = () => {
    setSpaceName(''); setCreateError(''); setSpaceBudget('');
    setSpaceBudgetCurrency(defaultCurrency);
    setSpaceType('expense'); setSpaceTargetDate('');
    setCreateModal(true);
  };

  const handleCreateSpace = async () => {
    if (!spaceName.trim()) { setCreateError('name is required.'); return; }
    setCreating(true);
    const { error } = await supabase.from('spaces').insert({
      user_id: userId, name: spaceName.trim(), color: TEAL, icon: 'grid',
      budget: spaceBudget.trim() ? parseFloat(spaceBudget) : null,
      budget_currency: spaceBudgetCurrency,
      space_type: spaceType,
      savings_target_date: spaceType === 'savings' && spaceTargetDate.trim() ? spaceTargetDate.trim() : null,
    });
    if (error) { setCreateError(error.message); setCreating(false); return; }
    setCreating(false);
    setCreateModal(false);
    queryClient.invalidateQueries({ queryKey: ['spaces-panel', userId] });
    queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
  };

  const { from, to } = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const to   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
    return { from, to };
  }, [monthOffset]);

  const { data: spaces = [], isLoading } = useQuery({
    queryKey: ['spaces-panel', userId, from],
    queryFn: async () => {
      const { data } = await supabase
        .from('spaces').select('id, name, budget, budget_currency, space_type, is_active')
        .eq('user_id', userId).order('sort_order', { ascending: true, nullsFirst: false });
      if (!data) return [];
      const ids = data.map((s: any) => s.id);
      const [{ data: recs }, { data: allTimeSums }] = await Promise.all([
        supabase.from('recordings').select('space_id, amount, type')
          .in('space_id', ids).neq('status', 'voided')
          .gte('transaction_date', from).lte('transaction_date', to),
        supabase.rpc('get_space_all_time_totals', { p_user_id: userId }),
      ]);
      const spentMap: Record<string, number> = {};
      const savedMonthMap: Record<string, number> = {};
      const savedAllTimeMap: Record<string, number> = {};
      (allTimeSums ?? []).forEach((r: any) => {
        savedAllTimeMap[r.space_id] = Number(r.income_total ?? 0) - Number(r.expense_total ?? 0);
      });
      (recs ?? []).forEach((r: any) => {
        if (r.type === 'expense' || r.type === 'debt') spentMap[r.space_id] = (spentMap[r.space_id] ?? 0) + Number(r.amount);
        if (r.type === 'income') savedMonthMap[r.space_id] = (savedMonthMap[r.space_id] ?? 0) + Number(r.amount);
      });
      return data.map((s: any) => ({
        ...s,
        spent: spentMap[s.id] ?? 0,
        savedMonth: savedMonthMap[s.id] ?? 0,
        savedAllTime: savedAllTimeMap[s.id] ?? 0,
      }));
    },
    enabled: !!userId,
  });

  // Uncategorized count
  const { data: uncategorizedCount = 0 } = useQuery({
    queryKey: ['uncategorized-count', userId, from],
    queryFn: async () => {
      const { count } = await supabase.from('recordings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId).is('space_id', null)
        .neq('status', 'voided')
        .gte('transaction_date', from).lte('transaction_date', to);
      return count ?? 0;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ['spaces-panel', userId] });
      queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
    };
    const channel = supabase
      .channel(`spaces-panel-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['spaces-panel', userId, from] });
    queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
  };
  const onRefresh = async () => { setRefreshing(true); await invalidate(); setRefreshing(false); };

  const expenseSpaces = spaces.filter((s: any) => (s.space_type ?? 'expense') === 'expense' && s.is_active !== false);
  const savingsSpaces = spaces.filter((s: any) => s.space_type === 'savings' && s.is_active !== false);

  const [spaceChoice, setSpaceChoice] = useState<{ id: string; name: string } | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const doDeleteSpace = async (sp: { id: string; name: string }) => {
    setSpaceChoice(null);
    setConfirmDelete(false);
    try {
      const recordingIds = await supabase.from('recordings').select('id').eq('space_id', sp.id);
      const ids = (recordingIds.data ?? []).map((r: any) => r.id);
      if (ids.length > 0) await supabase.from('recording_breakdowns').delete().in('recording_id', ids);
      await supabase.from('recordings').delete().eq('space_id', sp.id);
      await supabase.from('spaces').delete().eq('id', sp.id);
      await invalidate();
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to delete space'); }
  };

  return (
    <SafeAreaView style={st.root}>
      <TopHeader title="Folders" onBack={onClose} centered />

      {isLoading ? (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}><GooeyLoader /></BlurView>
      ) : (
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

          <TouchableOpacity onPress={openCreate} activeOpacity={0.7} style={st.addBtn}>
            <Text style={st.addBtnText}>+ New Folder</Text>
          </TouchableOpacity>

          {/* Uncategorized */}
          <Text style={st.sectionHeader}>Uncategorized</Text>
          <View style={st.timelineWrap}>
            <View style={st.timelineCol}>
              <View style={st.tlDotWrap}>
                <View style={st.tlLineHidden} />
                <View style={st.tlDot} />
                <View style={st.tlLineHidden} />
              </View>
            </View>
            <View style={st.cardsCol}>
              <TouchableOpacity style={st.card} activeOpacity={0.7} onPress={() => openRecordingsPanel({ categoryName: 'Uncategorized' })}>
                <View style={st.cardLeft}>
                  <Text style={st.cardName} numberOfLines={2} ellipsizeMode="tail">Uncategorized</Text>
                </View>
                <View style={st.cardDivider} />
                <View style={st.cardRight}>
                  <Text style={st.cardLabel}>Transactions</Text>
                  <Text style={st.cardValue}>{uncategorizedCount} transaction{uncategorizedCount !== 1 ? 's' : ''}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Savings */}
          {savingsSpaces.length > 0 && (
            <>
              <Text style={[st.sectionHeader, { marginTop: 28 }]}>Savings</Text>
              <View style={st.timelineWrap}>
                <View style={st.timelineCol}>
                  {savingsSpaces.map((sp: any, i: number) => {
                    const count = savingsSpaces.length;
                    const isFirst = i === 0; const isLast = i === count - 1;
                    const showDot = count > 1 && (isFirst || isLast);
                    const showLine = count > 1 && !isFirst && !isLast;
                    return (
                      <View key={sp.id} style={st.tlDotWrap}>
                        {showDot && (<><View style={isFirst ? st.tlLineHidden : st.tlLine} /><View style={st.tlDot} /><View style={isLast ? st.tlLineHidden : st.tlLine} /></>)}
                        {showLine && <View style={[st.tlLine, { flex: 1 }]} />}
                        {count === 1 && (<><View style={st.tlLineHidden} /><View style={st.tlDot} /><View style={st.tlLineHidden} /></>)}
                      </View>
                    );
                  })}
                </View>
                <View style={st.cardsCol}>
                  {savingsSpaces.map((sp: any) => {
                    const goal = sp.budget ? convert(sp.budget, sp.budget_currency ?? 'PHP', defaultCurrency) : 0;
                    return (
                      <TouchableOpacity key={sp.id} style={st.card} activeOpacity={0.7} onPress={() => setSpaceChoice({ id: sp.id, name: sp.name })}>
                        <View style={st.cardLeft}>
                          <Text style={st.cardName} numberOfLines={2} ellipsizeMode="tail">{sp.name}</Text>
                        </View>
                        <View style={st.cardDivider} />
                        <View style={st.cardRight}>
                          <Text style={st.cardLabel}>Your all time savings</Text>
                          <Text style={st.cardValue}>
                            <Text style={{ color: '#e6a817' }}>{fmt(sp.savedAllTime)}</Text>
                            {goal > 0 ? <Text style={st.cardValueMuted}> / {fmt(goal)}</Text> : null}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* Expenses */}
          {expenseSpaces.length > 0 && (
            <>
              <Text style={[st.sectionHeader, { marginTop: 28 }]}>Expenses</Text>
              <View style={st.timelineWrap}>
                <View style={st.timelineCol}>
                  {expenseSpaces.map((sp: any, i: number) => {
                    const count = expenseSpaces.length;
                    const isFirst = i === 0; const isLast = i === count - 1;
                    const showDot = count > 1 && (isFirst || isLast);
                    const showLine = count > 1 && !isFirst && !isLast;
                    return (
                      <View key={sp.id} style={st.tlDotWrap}>
                        {showDot && (<><View style={isFirst ? st.tlLineHidden : st.tlLine} /><View style={st.tlDot} /><View style={isLast ? st.tlLineHidden : st.tlLine} /></>)}
                        {showLine && <View style={[st.tlLine, { flex: 1 }]} />}
                        {count === 1 && (<><View style={st.tlLineHidden} /><View style={st.tlDot} /><View style={st.tlLineHidden} /></>)}
                      </View>
                    );
                  })}
                </View>
                <View style={st.cardsCol}>
                  {expenseSpaces.map((sp: any) => {
                    const budget = sp.budget ? convert(sp.budget, sp.budget_currency ?? 'PHP', defaultCurrency) : 0;
                    const over = budget > 0 && sp.spent > budget;
                    return (
                      <TouchableOpacity key={sp.id} style={st.card} activeOpacity={0.7} onPress={() => setSpaceChoice({ id: sp.id, name: sp.name })}>
                        <View style={st.cardLeft}>
                          <Text style={st.cardName} numberOfLines={2} ellipsizeMode="tail">{sp.name}</Text>
                        </View>
                        <View style={st.cardDivider} />
                        <View style={st.cardRight}>
                          <Text style={st.cardLabel}>This month's spending</Text>
                          <Text style={st.cardValue}>
                            <Text style={over ? { color: '#FF5757' } : {}}>{fmt(sp.spent)}</Text>
                            {budget > 0 ? <Text style={st.cardValueMuted}> / {fmt(budget)}</Text> : null}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {expenseSpaces.length === 0 && savingsSpaces.length === 0 && uncategorizedCount === 0 && (
            <View style={st.empty}><Text style={st.emptyText}>no spaces yet</Text></View>
          )}
        </ScrollView>
      )}

      {/* Space action sheet */}
      <BottomSheet visible={!!spaceChoice} onClose={() => { setSpaceChoice(null); setConfirmDelete(false); }} title={spaceChoice?.name ?? ''}>
        <TouchableOpacity style={st.choiceRow} activeOpacity={0.8} onPress={() => { const sp = spaceChoice; setSpaceChoice(null); openRecordingsPanel({ spaceId: sp!.id, spaceName: sp!.name }); }}>
          <View style={{ flex: 1 }}>
            <Text style={st.choiceTitle}>View Recordings</Text>
            <Text style={st.choiceSub}>browse this space's recordings</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={st.choiceRow} activeOpacity={0.8} onPress={() => { const sp = spaceChoice; setSpaceChoice(null); openSpace(sp!.id, sp!.name, true); }}>
          <View style={{ flex: 1 }}>
            <Text style={st.choiceTitle}>Edit Space</Text>
            <Text style={st.choiceSub}>rename or archive</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[st.choiceRow, { borderBottomWidth: 0 }]} activeOpacity={0.8} onPress={() => setConfirmDelete(true)}>
          <View style={{ flex: 1 }}>
            {confirmDelete ? (
              <>
                <Text style={[st.choiceTitle, { color: '#FF5757' }]}>Are you sure?</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity onPress={() => setConfirmDelete(false)} style={{ flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#d2d2d2', alignItems: 'center' }}>
                    <Text style={{ fontFamily: AppFont.semiBold, fontSize: 12, color: '#111' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => doDeleteSpace(spaceChoice!)} style={{ flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: '#FF5757', alignItems: 'center' }}>
                    <Text style={{ fontFamily: AppFont.semiBold, fontSize: 12, color: '#fff' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[st.choiceTitle, { color: '#FF5757' }]}>Delete Space</Text>
                <Text style={st.choiceSub}>permanently deletes space and all recordings</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </BottomSheet>

      {/* Create space modal */}
      <BottomSheet visible={createModal} onClose={() => setCreateModal(false)} title="new space" height="50%">
        {createError ? <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: '#FF5757', marginBottom: 8 }}>{createError}</Text> : null}
        <Text style={st.label}>type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {(['expense', 'savings'] as const).map(t => (
            <TouchableOpacity key={t} style={[st.typeBtn, spaceType === t && st.typeBtnActive]} onPress={() => setSpaceType(t)} activeOpacity={0.75}>
              <Text style={[st.typeBtnText, spaceType === t && st.typeBtnTextActive]}>{t} tracker</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={st.label}>name</Text>
        <TextInput style={st.input} placeholder="e.g. household" placeholderTextColor={Colors.faint} value={spaceName} onChangeText={v => { setSpaceName(v.slice(0, 20)); setCreateError(''); }} maxLength={20} autoFocus />
        <Text style={st.label}>{spaceType === 'expense' ? 'budget' : 'target goal'} <Text style={{ color: Colors.muted }}>(optional)</Text></Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <TextInput style={[st.input, { flex: 1 }]} placeholder="e.g. 10000" placeholderTextColor={Colors.faint} value={spaceBudget} onChangeText={setSpaceBudget} keyboardType="decimal-pad" />
          <View style={{ paddingHorizontal: 12, paddingVertical: 12, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMid }}>
            <Text style={{ fontFamily: AppFont.bold, fontSize: 13, color: Colors.text }}>{spaceBudgetCurrency}</Text>
          </View>
        </View>
        {spaceType === 'savings' && (
          <>
            <Text style={st.label}>target date <Text style={{ color: Colors.muted }}>(optional)</Text></Text>
            <TextInput style={st.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.faint} value={spaceTargetDate} onChangeText={setSpaceTargetDate} />
          </>
        )}
        <TouchableOpacity style={[st.saveBtn, (!spaceName.trim() || creating) && { opacity: 0.4 }]} onPress={handleCreateSpace} disabled={creating || !spaceName.trim()} activeOpacity={0.8}>
          {creating ? <ActivityIndicator color={Colors.white} /> : <Text style={st.saveBtnText}>create space</Text>}
        </TouchableOpacity>
      </BottomSheet>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingHorizontal: DC.pagePadding, paddingTop: 20, paddingBottom: 80 },

  addBtn:     { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: '#111111', marginBottom: 20 },
  addBtnText: { fontFamily: AppFont.semiBold, fontSize: 12, color: '#ffffff' },

  sectionHeader: { fontFamily: 'Poppins-Bold', fontSize: 17, color: '#111111', marginBottom: 16 },

  // Timeline
  timelineWrap: { flexDirection: 'row', gap: 10 },
  timelineCol:  { width: 12, alignItems: 'flex-start' },
  tlDotWrap:    { flex: 1, alignItems: 'flex-start', justifyContent: 'center', minHeight: 100 },
  tlDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d2d2d2', zIndex: 1, marginLeft: -4.25 },
  tlLine:       { flex: 1, width: 1.5, backgroundColor: '#d2d2d2', minHeight: 10 },
  tlLineHidden: { flex: 1, width: 1.5, backgroundColor: 'transparent' },
  cardsCol:     { flex: 1, gap: 10 },

  // Card
  card:         { flexDirection: 'row', alignItems: 'stretch', borderWidth: 1.5, borderColor: '#d2d2d2', borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden' },
  cardLeft:     { width: 90, height: 90, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  cardName:     { fontFamily: 'Poppins-Bold', fontSize: 11, color: '#111111', textAlign: 'center' },
  cardDivider:  { width: 0.5, backgroundColor: '#d2d2d2' },
  cardRight:    { flex: 1, paddingVertical: 14, paddingHorizontal: 14, justifyContent: 'center' },
  cardLabel:    { fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageTextMuted, marginBottom: 2 },
  cardValue:    { fontFamily: 'Poppins-Bold', fontSize: 11, color: '#111111' },
  cardValueMuted:{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { ...DC.typography.muted },

  choiceRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  choiceTitle:{ fontFamily: AppFont.semiBold, fontSize: 14, color: '#111111' },
  choiceSub:  { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginTop: 2 },

  label:      { fontFamily: AppFont.semiBold, fontSize: 11, color: DC.pageTextMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  typeBtn:       { flex: 1, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#111111', borderColor: '#111111' },
  typeBtnText:   { fontFamily: AppFont.semiBold, fontSize: 12, color: Colors.muted },
  typeBtnTextActive: { color: Colors.white },
  input:      { fontFamily: AppFont.regular, fontSize: 16, color: DC.pageText, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 16 },
  saveBtn:    { paddingVertical: 14, borderRadius: Radius.pill, backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveBtnText:{ fontFamily: AppFont.semiBold, fontSize: 14, color: Colors.white },
});
