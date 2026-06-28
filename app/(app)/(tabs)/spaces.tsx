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
import type { Category } from '../../../src/types';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Radius } from '@/components/ui/theme';

const T = '#4ECDC4';
const TL = '#E0F5F4';
const BG = '#F7F8FA';
const CARD = '#FFFFFF';
const BORDER = '#ECECEC';
const TEXT = '#1A1A2E';
const SEC = '#9A9DB0';
const R = 'PlusJakartaSans_400Regular';
const M = 'PlusJakartaSans_500Medium';
const SB = 'PlusJakartaSans_600SemiBold';
const B = 'PlusJakartaSans_700Bold';

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
        user_id: userId, name: spaceName.trim(), color: T, icon: 'grid',
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

  const fmt = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.title}>Spaces</Text>
          <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* All spaces shortcut */}
        <TouchableOpacity
          style={s.allCard}
          activeOpacity={0.8}
          onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: 'all', name: 'all spaces' } })}
        >
          <Ionicons name="layers-outline" size={16} color={T} />
          <Text style={s.allCardText}>View all spaces</Text>
          <Ionicons name="chevron-forward" size={14} color={SEC} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Space cards */}
        <View style={s.list}>
          {spaces.length === 0 && (
            <View style={s.emptyWrap}>
              <Ionicons name="grid-outline" size={32} color={SEC} />
              <Text style={s.emptyText}>No spaces yet</Text>
              <Text style={s.emptyHint}>Tap + to create your first space</Text>
            </View>
          )}

          {/* Expense spaces */}
          {spaces.filter(sp => (sp.space_type ?? 'expense') === 'expense').length > 0 && (
            <>
              <View style={s.dateHeaderRow}><Text style={s.dateHeaderText}>Expense Trackers</Text></View>
              {spaces.filter(sp => (sp.space_type ?? 'expense') === 'expense').map(space => {
            const isExpense = (space.space_type ?? 'expense') === 'expense';
            const value = isExpense ? (space.spent ?? 0) : (space.saved ?? 0);
            const budget = space.budget ?? 0;
            const pct = budget > 0 ? Math.min(value / budget, 1) : 0;
            const overBudget = isExpense && budget > 0 && value > budget;
            return (
              <TouchableOpacity
                key={space.id}
                style={s.card}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName} numberOfLines={1}>{space.name}</Text>
                  <Text style={s.cardCount}>{space.count ?? 0} transaction{(space.count ?? 0) !== 1 ? 's' : ''}</Text>
                </View>
                <View style={s.cardRight}>
                  <Text style={[s.cardAmount, overBudget && { color: '#FFAB91' }]}>{fmt(value)}</Text>
                  {budget > 0 && (
                    <Text style={s.cardSub}>budget: {fmt(budget - value)} left</Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => { setSelectedSpace(space); setMenuModal(true); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={15} color={SEC} />
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
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardName} numberOfLines={1}>{space.name}</Text>
                      <Text style={s.cardCount}>{space.count ?? 0} transaction{(space.count ?? 0) !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={s.cardRight}>
                      <Text style={s.cardAmount}>{fmt(value)}</Text>
                      {budget > 0 && (
                        <Text style={s.cardSub}>goal: {fmt(budget)}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => { setSelectedSpace(space); setMenuModal(true); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="ellipsis-horizontal" size={15} color={SEC} />
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
          placeholderTextColor={SEC}
          value={spaceName}
          onChangeText={v => { setSpaceName(v.slice(0, 20)); setError(''); }}
          maxLength={20}
          autoFocus
        />

        <Text style={s.qaLabel}>
          {spaceType === 'expense' ? 'budget' : 'target goal'}{' '}
          <Text style={{ textTransform: 'none', color: SEC }}>(optional)</Text>
        </Text>
        <TextInput
          style={s.qaInput}
          placeholder="e.g. 10000"
          placeholderTextColor={SEC}
          value={spaceBudget}
          onChangeText={setSpaceBudget}
          keyboardType="decimal-pad"
        />

        {spaceType === 'savings' && (
          <>
            <Text style={s.qaLabel}>target date <Text style={{ textTransform: 'none', color: SEC }}>(optional)</Text></Text>
            <TextInput
              style={s.qaInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={SEC}
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
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{editMode ? 'save changes' : 'create space'}</Text>}
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
  container: { flex: 1, backgroundColor: BG },
  scroll:    { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 60 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title:     { fontFamily: B, fontSize: 28, color: TEXT, letterSpacing: -0.8 },
  addBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: T, alignItems: 'center', justifyContent: 'center' },

  allCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 16,
  },
  allCardText: { fontFamily: SB, fontSize: 14, color: T },

  list: { gap: 8 },
  dateHeaderRow:  { marginTop: 8, marginBottom: 8, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: '#ECECEC', paddingTop: 16 },
  dateHeaderText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10, color: '#9A9DB0', letterSpacing: 1.4, textTransform: 'uppercase' },

  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontFamily: SB, fontSize: 16, color: TEXT },
  emptyHint: { fontFamily: R,  fontSize: 13, color: SEC },

  card: {
    backgroundColor: CARD, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  cardName:     { fontFamily: SB, fontSize: 14, color: TEXT, letterSpacing: 0.1, lineHeight: 20 },
  cardCount:    { fontFamily: R,  fontSize: 11, color: SEC,  letterSpacing: 0.2 },
  cardRight:    { alignItems: 'flex-end', gap: 2 },
  cardAmount:   { fontFamily: B,  fontSize: 15, color: TEXT, letterSpacing: -0.4 },
  cardSub:      { fontFamily: R,  fontSize: 11, color: SEC,  letterSpacing: 0.2 },

  typeBtn:         { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: BG },
  typeBtnActive:   { backgroundColor: T, borderColor: T },
  typeBtnText:     { fontFamily: M,  fontSize: 12, color: SEC },
  typeBtnTextActive: { fontFamily: SB, color: '#fff' },
  typeRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qaLabel:   { fontFamily: SB, fontSize: 11, color: SEC, marginBottom: 6, marginTop: 14, letterSpacing: 0.4, textTransform: 'uppercase' },
  qaInput:   { fontFamily: B, fontSize: 15, color: TEXT, backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: BORDER },
  qaError:   { fontFamily: M, fontSize: 12, color: '#FFAB91', marginBottom: 8 },
  saveBtn:   { backgroundColor: T, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { fontFamily: SB, fontSize: 14, color: '#FFFFFF' },
});

