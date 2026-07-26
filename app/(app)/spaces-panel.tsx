import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, RefreshControl, Alert, TextInput, ActivityIndicator,
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
import { useExchangeRates } from '../../src/lib/useExchangeRates';
import GooeyLoader from '@/components/ui/GooeyLoader';
import { BlurView } from 'expo-blur';
import BottomSheet from '@/components/ui/BottomSheet';

const TEAL = '#9cd7d2';
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props { onClose: () => void; }

export default function SpacesPanel({ onClose }: Props) {
  const { userId, defaultCurrency } = useUser();
  const { openRecordingsPanel, openSpace, switchTab } = useNav();
  const { convert } = useExchangeRates();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive'>('active');

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

  const { from, to, label } = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const to   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return { from, to, label: `${months[d.getMonth()]} ${d.getFullYear()}` };
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
      const savedAllTimeMap: Record<string, number> = {};
      (allTimeSums ?? []).forEach((r: any) => { savedAllTimeMap[r.space_id] = Number(r.income_total ?? 0) - Number(r.expense_total ?? 0); });
      (recs ?? []).forEach((r: any) => { if (r.type === 'expense' || r.type === 'debt') spentMap[r.space_id] = (spentMap[r.space_id] ?? 0) + Number(r.amount); });
      return data.map((s: any) => ({ ...s, spent: spentMap[s.id] ?? 0, savedAllTime: savedAllTimeMap[s.id] ?? 0 }));
    },
    enabled: !!userId,
  });

  const { data: sharedSpaces = [] } = useQuery({
    queryKey: ['shared-spaces-panel', userId, from],
    queryFn: async () => {
      const { data: members } = await supabase.from('space_members').select('space_id, role').eq('user_id', userId).eq('status', 'accepted');
      if (!members || members.length === 0) return [];
      const spaceIds = members.map((m: any) => m.space_id);
      const { data: spaceRows } = await supabase.from('spaces').select('id, name, budget, budget_currency, space_type, is_active, user_id').in('id', spaceIds);
      if (!spaceRows) return [];
      const ownerIds = [...new Set(spaceRows.map((s: any) => s.user_id))];
      const ownerNames = await Promise.all(ownerIds.map((id: string) => supabase.rpc('get_user_display_name', { user_id: id }).then(({ data }) => ({ id, name: data ?? 'unknown' }))));
      const { data: recs } = await supabase.from('recordings').select('space_id, amount, type').in('space_id', spaceIds).gte('transaction_date', from).lte('transaction_date', to);
      const spentMap: Record<string, number> = {};
      (recs ?? []).forEach((r: any) => { if (r.type === 'expense' || r.type === 'debt') spentMap[r.space_id] = (spentMap[r.space_id] ?? 0) + Number(r.amount); });
      return spaceRows.map((sp: any) => ({ ...sp, spent: spentMap[sp.id] ?? 0, ownerName: ownerNames.find((o: any) => o.id === sp.user_id)?.name ?? 'unknown', role: members.find((m: any) => m.space_id === sp.id)?.role ?? 'viewer' }));
    },
    enabled: !!userId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['spaces-panel', userId, from] });
    queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
  };

  const onRefresh = async () => { setRefreshing(true); await invalidate(); setRefreshing(false); };

  const [spaceChoice, setSpaceChoice] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ['spaces-panel', userId] });
      queryClient.invalidateQueries({ queryKey: ['shared-spaces-panel', userId] });
      queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
    };
    const channel = supabase
      .channel(`spaces-panel-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces', filter: `user_id=eq.${userId}` }, () => invalidateAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const expenseActive   = spaces.filter((s: any) => (s.space_type ?? 'expense') === 'expense' && s.is_active !== false);
  const savingsActive   = spaces.filter((s: any) => s.space_type === 'savings' && s.is_active !== false);
  const expenseInactive = spaces.filter((s: any) => (s.space_type ?? 'expense') === 'expense' && s.is_active === false);
  const savingsInactive = spaces.filter((s: any) => s.space_type === 'savings' && s.is_active === false);

  const renderSpaceRow = (sp: any, i: number, arr: any[], isShared = false) => {
    const isExpense = (sp.space_type ?? 'expense') === 'expense';
    const value = isExpense ? (sp.spent ?? 0) : (sp.savedAllTime ?? 0);
    const budget = sp.budget ? convert(sp.budget, sp.budget_currency ?? 'PHP', defaultCurrency) : 0;
    const over = isExpense && budget > 0 && value > budget;
    const isLast = i === arr.length - 1;
    return (
      <TouchableOpacity key={sp.id} style={[st.row, isLast && st.rowLast]} activeOpacity={0.7} onPress={() => setSpaceChoice({ id: sp.id, name: sp.name })}>
        <View style={{ flex: 1 }}>
          <Text style={st.rowName} numberOfLines={1}>{sp.name}</Text>
          {isShared && <Text style={st.rowSub}>{sp.ownerName} · {sp.role}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end', flex: 1 }}>
          <Text style={[st.rowValue, over && { color: '#FF5757' }]}>{fmt(value)}</Text>
          {budget > 0 && <Text style={st.rowSub}>{fmt(budget)}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const doDeleteSpace = async (sp: { id: string; name: string }) => {
    setSpaceChoice(null);
    try {
      const recordingIds = await supabase.from('recordings').select('id').eq('space_id', sp.id);
      const ids = (recordingIds.data ?? []).map((r: any) => r.id);
      if (ids.length > 0) {
        await supabase.from('recording_breakdowns').delete().in('recording_id', ids);
      }
      const { error: recErr } = await supabase.from('recordings').delete().eq('space_id', sp.id);
      if (recErr) { Alert.alert('Delete failed', recErr.message); return; }
      const { error } = await supabase.from('spaces').delete().eq('id', sp.id);
      if (error) { Alert.alert('Delete failed', error.message); return; }
      await invalidate();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to delete space');
    }
  };

  const handleDeleteSpace = (sp: { id: string; name: string }) => {
    Alert.alert(
      `Delete "${sp.name}"?`,
      'This will permanently delete the space and all recordings under it. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { doDeleteSpace(sp); } },
      ]
    );
  };

  return (
    <SafeAreaView style={st.root}>
      <PageHeader title="Spaces" onBack={onClose} titleColor={TEAL} />

      <View style={st.controlRow}>
        <View style={[st.monthNav, { flex: 1 }]}>
          <TouchableOpacity onPress={() => setMonthOffset(o => o - 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={13} color={DC.pageActionText} />
          </TouchableOpacity>
          <Text style={st.monthLabel}>{label}</Text>
          <TouchableOpacity onPress={() => setMonthOffset(o => o + 1)} disabled={monthOffset >= 0} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={13} color={monthOffset >= 0 ? Colors.faint : DC.pageActionText} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[st.filterBtn, activeFilter === 'active' && st.filterBtnActive]} onPress={() => setActiveFilter('active')} activeOpacity={0.7}>
          <Text style={[st.filterBtnText, activeFilter === 'active' && st.filterBtnTextActive]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.filterBtn, activeFilter === 'inactive' && st.filterBtnActive]} onPress={() => setActiveFilter('inactive')} activeOpacity={0.7}>
          <Text style={[st.filterBtnText, activeFilter === 'inactive' && st.filterBtnTextActive]}>Inactive</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.filterBtn, { paddingHorizontal: 8 }]} onPress={openCreate} activeOpacity={0.7}>
          <Ionicons name="add-outline" size={18} color={DC.pageActionText} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}><GooeyLoader /></BlurView>
      ) : (
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

          {activeFilter === 'active' && expenseActive.length > 0 && (
            <><Text style={st.sectionTitle}>Expense Tracker</Text><Text style={st.sectionDesc}>track your spending against a budget</Text><View style={st.list}>{expenseActive.map((sp, i) => renderSpaceRow(sp, i, expenseActive))}</View></>
          )}
          {activeFilter === 'active' && savingsActive.length > 0 && (
            <><Text style={st.sectionTitle}>Savings Tracker</Text><Text style={st.sectionDesc}>monitor progress toward your savings goals</Text><View style={st.list}>{savingsActive.map((sp, i) => renderSpaceRow(sp, i, savingsActive))}</View></>
          )}
          {activeFilter === 'active' && sharedSpaces.length > 0 && (
            <><Text style={st.sectionTitle}>Shared Spaces</Text><Text style={st.sectionDesc}>spaces shared with you by other users</Text><View style={st.list}>{sharedSpaces.map((sp: any, i: number) => renderSpaceRow(sp, i, sharedSpaces, true))}</View></>
          )}
          {activeFilter === 'inactive' && expenseInactive.length > 0 && (
            <><Text style={st.sectionTitle}>Expense Tracker</Text><Text style={st.sectionDesc}>track your spending against a budget</Text><View style={st.list}>{expenseInactive.map((sp, i) => renderSpaceRow(sp, i, expenseInactive))}</View></>
          )}
          {activeFilter === 'inactive' && savingsInactive.length > 0 && (
            <><Text style={st.sectionTitle}>Savings Tracker</Text><Text style={st.sectionDesc}>monitor progress toward your savings goals</Text><View style={st.list}>{savingsInactive.map((sp, i) => renderSpaceRow(sp, i, savingsInactive))}</View></>
          )}
          {activeFilter === 'active' && expenseActive.length === 0 && savingsActive.length === 0 && sharedSpaces.length === 0 && (
            <View style={st.empty}><Text style={st.emptyText}>no active spaces</Text></View>
          )}
          {activeFilter === 'inactive' && expenseInactive.length === 0 && savingsInactive.length === 0 && (
            <View style={st.empty}><Text style={st.emptyText}>no inactive spaces</Text></View>
          )}
        </ScrollView>
      )}


      <BottomSheet visible={!!spaceChoice} onClose={() => setSpaceChoice(null)} title={spaceChoice?.name ?? ''}>
        <TouchableOpacity style={st.choiceRow} activeOpacity={0.8} onPress={() => { const sp = spaceChoice; setSpaceChoice(null); openRecordingsPanel({ spaceId: sp!.id, spaceName: sp!.name }); }}>
          <View style={{ flex: 1 }}>
            <Text style={st.choiceTitle}>View Recordings</Text>
            <Text style={st.choiceSub}>browse this space's recordings</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={st.choiceRow} activeOpacity={0.8} onPress={() => { const sp = spaceChoice; setSpaceChoice(null); openSpace(sp!.id, sp!.name, true); }}>
          <View style={{ flex: 1 }}>
            <Text style={st.choiceTitle}>Edit Space</Text>
            <Text style={st.choiceSub}>rename or archive</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={[st.choiceRow, { borderBottomWidth: 0 }]} activeOpacity={0.8} onPress={() => { const sp = spaceChoice!; handleDeleteSpace(sp); }}>
          <View style={{ flex: 1 }}>
            <Text style={[st.choiceTitle, { color: '#FF5757' }]}>Delete Space</Text>
            <Text style={st.choiceSub}>permanently deletes space and all recordings</Text>
          </View>
          <Ionicons name="trash-outline" size={14} color="#FF5757" />
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
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: DC.pagePadding, paddingBottom: 80 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: DC.pagePadding, paddingVertical: 8 },
  monthNav:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pageActionPaddingH, paddingVertical: DC.pageActionPaddingV, backgroundColor: DC.pageActionBg, borderRadius: DC.pageActionRadius },
  monthLabel: { fontFamily: AppFont.regular, fontSize: DC.dropdownFontSize, color: DC.pageActionText },
  filterBtn:          { paddingHorizontal: DC.pageActionPaddingH, paddingVertical: DC.pageActionPaddingV, borderRadius: DC.pageActionRadius, backgroundColor: DC.pageActionBg },
  filterBtnActive:    { backgroundColor: '#111111' },
  filterBtnText:      { fontFamily: AppFont.regular, fontSize: DC.dropdownFontSize, color: DC.pageActionText },
  filterBtnTextActive:{ fontFamily: AppFont.semiBold, fontSize: DC.dropdownFontSize, color: '#ffffff' },
  sectionTitle: { fontFamily: AppFont.bold, fontSize: 13, color: '#111111', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 24, marginBottom: 2 },
  sectionDesc:  { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginBottom: 8 },
  list:    { gap: 0 },
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  rowLast: { borderBottomWidth: 0 },
  rowName: { fontFamily: AppFont.regular, fontSize: 14, color: '#111111' },
  rowSub:  { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, fontStyle: 'italic' },
  rowValue:{ fontFamily: AppFont.bold, fontSize: 13, color: '#111111' },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },
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
