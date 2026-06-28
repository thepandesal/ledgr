import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useUser } from '../../../src/hooks/useUser';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Fonts, Radius } from '@/components/ui/theme';
import pageStyles from '@/components/ui/pageStyles';

const PEACH = '#FFAB91';

interface SpaceData {
  id: string; name: string; color: string; icon: string;
  budget?: number | null; spent?: number; saved?: number; count?: number;
  space_type?: string; savings_target_date?: string | null;
}

export default function SpacesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useUser();
  const [createModal, setCreateModal] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceBudget, setSpaceBudget] = useState('');
  const [spaceType, setSpaceType] = useState<'expense' | 'savings'>('expense');
  const [spaceTargetDate, setSpaceTargetDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuModal, setMenuModal] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<SpaceData | null>(null);
  const [editMode, setEditMode] = useState(false);

  const { data: spaces = [] } = useQuery<SpaceData[]>({
    queryKey: ['spaces', userId],
    queryFn: async () => {
      const { data } = await supabase.from('spaces').select().eq('user_id', userId).order('created_at');
      if (!data) return [];
      const { data: expRecs } = await supabase.from('recordings').select('space_id, amount').eq('user_id', userId).in('type', ['expense','payment','transfer']);
      const spentMap: Record<string, number> = {};
      const countMap: Record<string, number> = {};
      (expRecs ?? []).forEach((r: any) => { spentMap[r.space_id] = (spentMap[r.space_id] || 0) + Number(r.amount); countMap[r.space_id] = (countMap[r.space_id] || 0) + 1; });
      const { data: savRecs } = await supabase.from('recordings').select('space_id, amount').eq('user_id', userId).in('type', ['income','savings','return']);
      const savedMap: Record<string, number> = {};
      (savRecs ?? []).forEach((r: any) => { savedMap[r.space_id] = (savedMap[r.space_id] || 0) + Number(r.amount); countMap[r.space_id] = (countMap[r.space_id] || 0) + 1; });
      return data.map((s: any) => ({ ...s, spent: spentMap[s.id] ?? 0, saved: savedMap[s.id] ?? 0, count: countMap[s.id] ?? 0 })) as SpaceData[];
    },
    enabled: !!userId,
  });

  const openCreate = () => {
    setSpaceName(''); setError(''); setSpaceBudget('');
    setSpaceType('expense'); setSpaceTargetDate(''); setEditMode(false); setCreateModal(true);
  };

  const handleCreate = async () => {
    if (!spaceName.trim()) { setError('Name is required.'); return; }
    setLoading(true);
    if (editMode && selectedSpace) {
      const { error: err } = await supabase.from('spaces').update({
        name: spaceName.trim(),
        budget: spaceBudget.trim() ? parseFloat(spaceBudget) : null,
        space_type: spaceType,
        savings_target_date: spaceType === 'savings' && spaceTargetDate.trim() ? spaceTargetDate.trim() : null,
      }).eq('id', selectedSpace.id);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from('spaces').insert({
        user_id: userId, name: spaceName.trim(), color: Colors.cyan, icon: 'grid',
        budget: spaceBudget.trim() ? parseFloat(spaceBudget) : null,
        space_type: spaceType,
        savings_target_date: spaceType === 'savings' && spaceTargetDate.trim() ? spaceTargetDate.trim() : null,
      }).select().single();
      if (err) { setError(err.message); setLoading(false); return; }
    }
    queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
    setLoading(false); setCreateModal(false); setEditMode(false);
  };

  const handleEditSpace = () => {
    if (!selectedSpace) return;
    setMenuModal(false);
    setEditMode(true);
    setSpaceName(selectedSpace.name);
    setSpaceType((selectedSpace.space_type as any) ?? 'expense');
    setSpaceTargetDate(selectedSpace.savings_target_date ?? '');
    setSpaceBudget('');
    supabase.from('spaces').select('budget').eq('id', selectedSpace.id).single()
      .then(({ data }) => { if (data?.budget) setSpaceBudget(String(data.budget)); });
    setError(''); setCreateModal(true);
  };

  const handleDeleteSpace = async () => {
    setMenuModal(false);
    await supabase.from('spaces').delete().eq('id', selectedSpace!.id);
    queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.title}>Spaces</Text>
          <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* All spaces shortcut */}
        <TouchableOpacity
          style={[pageStyles.infoBlock, s.allCard]}
          activeOpacity={0.8}
          onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: 'all', name: 'all spaces' } })}
        >
          <Ionicons name="layers-outline" size={16} color={Colors.cyan} />
          <Text style={s.allCardText}>View all spaces</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.muted} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Space cards */}
        <View style={s.list}>
          {spaces.length === 0 && (
            <View style={pageStyles.emptyBox}>
              <Text style={pageStyles.emptyText}>no spaces yet — tap + to create one</Text>
            </View>
          )}

          {/* Expense spaces */}
          {spaces.filter(sp => (sp.space_type ?? 'expense') === 'expense').length > 0 && (
            <>
              <View style={s.dateHeaderRow}><Text style={s.dateHeaderText}>Expense Trackers</Text></View>
              {spaces.filter(sp => (sp.space_type ?? 'expense') === 'expense').map(space => {
                const value = space.spent ?? 0;
                const budget = space.budget ?? 0;
                const overBudget = budget > 0 && value > budget;
                return (
                  <TouchableOpacity
                    key={space.id}
                    style={s.card}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
                  >
                    <View style={s.cardIconWrap}>
                      <Ionicons name="wallet-outline" size={18} color={Colors.cyan} />
                    </View>
                    <View style={s.cardMid}>
                      <Text style={s.cardName} numberOfLines={1}>{space.name}</Text>
                      <Text style={s.cardCount}>{space.count ?? 0} transaction{(space.count ?? 0) !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={s.cardRight}>
                      <Text style={[s.cardAmount, overBudget && { color: PEACH }]}>{fmt(value)}</Text>
                      {budget > 0 && <Text style={s.cardSub}>budget: {fmt(budget - value)} left</Text>}
                    </View>
                    <TouchableOpacity onPress={() => { setSelectedSpace(space); setMenuModal(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
                      <Ionicons name="ellipsis-horizontal" size={15} color={Colors.muted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Savings spaces */}
          {spaces.filter(sp => sp.space_type === 'savings').length > 0 && (
            <>
              <View style={s.dateHeaderRow}><Text style={s.dateHeaderText}>Savings Trackers</Text></View>
              {spaces.filter(sp => sp.space_type === 'savings').map(space => {
                const value = space.saved ?? 0;
                const budget = space.budget ?? 0;
                return (
                  <TouchableOpacity
                    key={space.id}
                    style={s.card}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
                  >
                    <View style={s.cardIconWrap}>
                      <Ionicons name="trending-up-outline" size={18} color={Colors.cyan} />
                    </View>
                    <View style={s.cardMid}>
                      <Text style={s.cardName} numberOfLines={1}>{space.name}</Text>
                      <Text style={s.cardCount}>{space.count ?? 0} transaction{(space.count ?? 0) !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={s.cardRight}>
                      <Text style={s.cardAmount}>{fmt(value)}</Text>
                      {budget > 0 && <Text style={s.cardSub}>goal: {fmt(budget)}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => { setSelectedSpace(space); setMenuModal(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
                      <Ionicons name="ellipsis-horizontal" size={15} color={Colors.muted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>

      {/* Create/edit modal */}
      <BottomSheet visible={createModal} onClose={() => { setCreateModal(false); setEditMode(false); }} title={editMode ? 'edit space' : 'new space'} height='50%'>
        {error ? <Text style={s.qaError}>{error}</Text> : null}

        <Text style={s.qaLabel}>type</Text>
        <View style={s.typeRow}>
          {(['expense', 'savings'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.typeBtn, spaceType === t && s.typeBtnActive]} onPress={() => setSpaceType(t)} activeOpacity={0.75}>
              <Text style={[s.typeBtnText, spaceType === t && s.typeBtnTextActive]}>{t} tracker</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.qaLabel}>name</Text>
        <TextInput
          style={s.qaInput}
          placeholder="e.g. Household"
          placeholderTextColor={Colors.faint}
          value={spaceName}
          onChangeText={v => { setSpaceName(v.slice(0, 20)); setError(''); }}
          maxLength={20}
          autoFocus
        />

        <Text style={s.qaLabel}>
          {spaceType === 'expense' ? 'budget' : 'target goal'}{' '}
          <Text style={{ textTransform: 'none', color: Colors.muted }}>(optional)</Text>
        </Text>
        <TextInput
          style={s.qaInput}
          placeholder="e.g. 10000"
          placeholderTextColor={Colors.faint}
          value={spaceBudget}
          onChangeText={setSpaceBudget}
          keyboardType="decimal-pad"
        />

        {spaceType === 'savings' && (
          <>
            <Text style={s.qaLabel}>target date <Text style={{ textTransform: 'none', color: Colors.muted }}>(optional)</Text></Text>
            <TextInput
              style={s.qaInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.faint}
              value={spaceTargetDate}
              onChangeText={setSpaceTargetDate}
            />
          </>
        )}

        <TouchableOpacity
          style={[s.saveBtn, (!spaceName.trim() || loading) && { opacity: 0.4 }]}
          onPress={handleCreate}
          disabled={loading || !spaceName.trim()}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={s.saveBtnText}>{editMode ? 'save changes' : 'create space'}</Text>}
        </TouchableOpacity>
      </BottomSheet>

      <ConfirmModal
        visible={menuModal}
        onClose={() => setMenuModal(false)}
        title={selectedSpace?.name?.toLowerCase() ?? 'space'}
        actions={[
          { label: 'cancel',  onPress: () => setMenuModal(false), muted: true },
          { label: 'edit',    onPress: handleEditSpace },
          { label: 'delete',  onPress: handleDeleteSpace, destructive: true },
        ]}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll:    { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 60 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title:     { fontFamily: Fonts.display, fontSize: 28, color: Colors.text, letterSpacing: -0.8 },
  addBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.cyan, alignItems: 'center', justifyContent: 'center' },

  allCard:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingVertical: 14 },
  allCardText: { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.cyan },

  list: { gap: 8 },
  dateHeaderRow:  { marginTop: 8, marginBottom: 8, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16 },
  dateHeaderText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, letterSpacing: 1.4, textTransform: 'uppercase' },

  card: {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  cardIconWrap: { justifyContent: 'center', alignItems: 'center' },
  cardMid:      { flex: 1, gap: 2 },
  cardName:     { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.text, letterSpacing: 0.1, lineHeight: 20 },
  cardCount:    { fontFamily: Fonts.mono,     fontSize: 11, color: Colors.muted, letterSpacing: 0.2 },
  cardRight:    { alignItems: 'flex-end', gap: 2 },
  cardAmount:   { fontFamily: Fonts.monoBold, fontSize: 15, color: Colors.cyan, letterSpacing: -0.4 },
  cardSub:      { fontFamily: Fonts.mono,     fontSize: 11, color: Colors.muted, letterSpacing: 0.2 },

  typeBtn:          { paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  typeBtnActive:    { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  typeBtnText:      { fontFamily: Fonts.mono,     fontSize: 12, color: Colors.muted },
  typeBtnTextActive:{ fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.white },
  typeRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaLabel:   { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, marginBottom: 6, marginTop: 14, letterSpacing: 0.4, textTransform: 'uppercase' },
  qaInput:   { fontFamily: Fonts.monoBold, fontSize: 15, color: Colors.text, backgroundColor: Colors.white, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },
  qaError:   { fontFamily: Fonts.mono, fontSize: 12, color: PEACH, marginBottom: 8 },
  saveBtn:   { backgroundColor: Colors.cyan, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.white },
});
