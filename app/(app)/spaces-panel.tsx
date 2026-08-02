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
import { SvgXml } from 'react-native-svg';

const SVG_BACK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path fill="currentColor" d="M10.5 6a.75.75 0 0 0-.75-.75H3.81l1.97-1.97a.75.75 0 0 0-1.06-1.06L1.47 5.47a.75.75 0 0 0 0 1.06l3.25 3.25a.75.75 0 0 0 1.06-1.06L3.81 6.75h5.94A.75.75 0 0 0 10.5 6" /></svg>`;
const SVG_ADD  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10s10-4.477 10-10S17.523 2 12 2m5 11h-4v4h-2v-4H7v-2h4V7h2v4h4z" /></svg>`;

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

  const doDeleteSpace = async (sp: { id: string; name: string }) => {
    setSpaceChoice(null);
    try {
      const recordingIds = await supabase.from('recordings').select('id').eq('space_id', sp.id);
      const ids = (recordingIds.data ?? []).map((r: any) => r.id);
      if (ids.length > 0) await supabase.from('recording_breakdowns').delete().in('recording_id', ids);
      await supabase.from('recordings').delete().eq('space_id', sp.id);
      await supabase.from('spaces').delete().eq('id', sp.id);
      await invalidate();
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed to delete space'); }
  };

  const handleDeleteSpace = (sp: { id: string; name: string }) => {
    Alert.alert(`Delete "${sp.name}"?`, 'This will permanently delete the space and all recordings under it.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => doDeleteSpace(sp) }]
    );
  };

  return (
    <SafeAreaView style={st.root}>
      {/* ── Frozen header ── */}
      <View style={st.frozen}>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ marginBottom: 12 }}>
          <SvgXml xml={SVG_BACK} width={14} height={14} color="#666" />
        </TouchableOpacity>
        <View style={st.titleRow}>
          <Text style={st.title}>FOLDERS</Text>
          <TouchableOpacity onPress={openCreate} activeOpacity={0.7}>
            <SvgXml xml={SVG_ADD} width={26} height={26} color="#373737" />
          </TouchableOpacity>
        </View>
        <View style={st.divider} />
      </View>

      {isLoading ? (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}><GooeyLoader /></BlurView>
      ) : (
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

          {/* Uncategorized */}
          <TouchableOpacity
            style={st.card}
            activeOpacity={0.7}
            onPress={() => openRecordingsPanel({ categoryName: 'Uncategorized' })}
          >
            <Text style={st.cardName}>Uncategorized</Text>
            <Text style={st.cardCount}>{uncategorizedCount} transaction{uncategorizedCount !== 1 ? 's' : ''}</Text>
          </TouchableOpacity>

          {/* Expense Tracker */}
          {expenseSpaces.length > 0 && (
            <>
              <Text style={st.sectionHeader}>Expense Tracker</Text>
              {expenseSpaces.map((sp: any, i: number) => {
                const budget = sp.budget ? convert(sp.budget, sp.budget_currency ?? 'PHP', defaultCurrency) : 0;
                const over = budget > 0 && sp.spent > budget;
                return (
                  <TouchableOpacity key={sp.id} style={st.card} activeOpacity={0.7} onPress={() => setSpaceChoice({ id: sp.id, name: sp.name })}>
                    <Text style={st.cardName} numberOfLines={1}>{sp.name}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      {budget > 0 ? (
                        <Text style={st.cardValue}>
                          <Text style={over ? st.cardValueOver : st.cardValueBold}>{fmt(sp.spent)}</Text>
                          <Text style={st.cardValueMuted}> / {fmt(budget)}</Text>
                        </Text>
                      ) : (
                        <Text style={st.cardValueBold}>{fmt(sp.spent)}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Savings Tracker */}
          {savingsSpaces.length > 0 && (
            <>
              <Text style={st.sectionHeader}>Savings Tracker</Text>
              {savingsSpaces.map((sp: any) => {
                const goal = sp.budget ? convert(sp.budget, sp.budget_currency ?? 'PHP', defaultCurrency) : 0;
                return (
                  <TouchableOpacity key={sp.id} style={[st.card, { flexDirection: 'column', alignItems: 'flex-start' }]} activeOpacity={0.7} onPress={() => setSpaceChoice({ id: sp.id, name: sp.name })}>
                    <Text style={st.cardName} numberOfLines={1}>{sp.name}</Text>
                    <View style={st.savingsRows}>
                      <View style={st.savingsRow}>
                        <Text style={st.savingsLabel}>This month's savings:</Text>
                        <Text style={st.savingsValue}>{fmt(sp.savedMonth)}</Text>
                      </View>
                      <View style={st.savingsRow}>
                        <Text style={st.savingsLabel}>Savings up to date:</Text>
                        <Text style={st.savingsValue}>{fmt(sp.savedAllTime)}</Text>
                      </View>
                      {goal > 0 && (
                        <View style={st.savingsRow}>
                          <Text style={st.savingsLabel}>Goal:</Text>
                          <Text style={st.savingsValue}>{fmt(goal)}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {expenseSpaces.length === 0 && savingsSpaces.length === 0 && uncategorizedCount === 0 && (
            <View style={st.empty}><Text style={st.emptyText}>no spaces yet</Text></View>
          )}
        </ScrollView>
      )}

      {/* Space action sheet */}
      <BottomSheet visible={!!spaceChoice} onClose={() => setSpaceChoice(null)} title={spaceChoice?.name ?? ''}>
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
        <TouchableOpacity style={[st.choiceRow, { borderBottomWidth: 0 }]} activeOpacity={0.8} onPress={() => { const sp = spaceChoice!; handleDeleteSpace(sp); }}>
          <View style={{ flex: 1 }}>
            <Text style={[st.choiceTitle, { color: '#FF5757' }]}>Delete Space</Text>
            <Text style={st.choiceSub}>permanently deletes space and all recordings</Text>
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
  frozen: { paddingHorizontal: DC.pagePadding, paddingTop: 28, backgroundColor: '#fff' },
  divider: { height: 1, backgroundColor: '#d2d2d2', marginTop: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:    { ...DC.typography.pageTitle },

  scroll: { paddingHorizontal: DC.pagePadding, paddingTop: 20, paddingBottom: 80 },

  sectionHeader: { ...DC.typography.sectionHeader, marginTop: 24, marginBottom: 10 },

  card: {
    ...DC.dottedCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName:      { ...DC.typography.sectionBody, fontStyle: 'italic', flex: 1 },
  cardCount:     { ...DC.typography.sectionHeader },
  cardValue:     { ...DC.typography.sectionBody },
  cardValueBold: { ...DC.typography.sectionHeader },
  cardValueOver: { ...DC.typography.sectionHeader, color: '#FF5757' },
  cardValueMuted:{ ...DC.typography.sectionBody },

  savingsRows: { marginTop: 6, gap: 2 },
  savingsRow:  { flexDirection: 'row', gap: 6, alignItems: 'center' },
  savingsLabel:{ ...DC.typography.subContent, fontStyle: 'italic' },
  savingsValue:{ ...DC.typography.subContent, fontFamily: 'Poppins-Bold' as string },

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
