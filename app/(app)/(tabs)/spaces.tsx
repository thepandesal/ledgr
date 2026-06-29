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
import { Shadow } from '@/components/ui/theme';

// ── Design tokens (B&W Inter theme) ──────────────────────────────────────────
const BLACK   = '#000000';
const DARK    = '#1F2937';
const MUTED   = '#6B7280';
const BORDER  = '#E5E7EB';
const SURFACE = '#F9FAFB';
const WHITE   = '#FFFFFF';
const RED     = '#DC2626';
const FONT    = 'Inter_400Regular';
const FONT_SB = 'Inter_600SemiBold';
const FONT_B  = 'Inter_700Bold';

interface SpaceData {
  id: string; name: string; color: string; icon: string;
  budget?: number | null; spent?: number; saved?: number; count?: number;
  space_type?: string; savings_target_date?: string | null;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SpacesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId, userName } = useUser();
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
        user_id: userId, name: spaceName.trim(), color: BLACK, icon: 'grid',
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
    setMenuModal(false); setEditMode(true);
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
  const firstName = userName?.split(' ')[0] || 'there';
  const expenseSpaces = spaces.filter(sp => (sp.space_type ?? 'expense') === 'expense');
  const savingsSpaces = spaces.filter(sp => sp.space_type === 'savings');

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Hi, {firstName} 👋</Text>
            <Text style={s.date}>{todayLabel()}</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color={WHITE} />
          </TouchableOpacity>
        </View>

        {/* ── All spaces shortcut ── */}
        <TouchableOpacity
          style={s.allCard}
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: 'all', name: 'all spaces' } })}
        >
          <View style={s.allCardIconWrap}>
            <Ionicons name="layers-outline" size={16} color={BLACK} />
          </View>
          <Text style={s.allCardText}>View all spaces</Text>
          <Ionicons name="chevron-forward" size={14} color={MUTED} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* ── Empty state ── */}
        {spaces.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="layers-outline" size={32} color={BORDER} />
            <Text style={s.emptyText}>No spaces yet — tap + to create one</Text>
          </View>
        ) : (
          <>
            {/* ── Expense Trackers ── */}
            {expenseSpaces.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>Expense Trackers</Text>
                  <Text style={s.sectionCount}>{expenseSpaces.length} space{expenseSpaces.length !== 1 ? 's' : ''}</Text>
                </View>
                {expenseSpaces.map(space => {
                  const value = space.spent ?? 0;
                  const budget = space.budget ?? 0;
                  const overBudget = budget > 0 && value > budget;
                  const pct = budget > 0 ? Math.min(value / budget, 1) : 0;
                  return (
                    <TouchableOpacity
                      key={space.id}
                      style={s.card}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
                    >
                      <View style={s.cardTop}>
                        <View style={s.cardIconWrap}>
                          <Ionicons name="wallet-outline" size={18} color={overBudget ? RED : BLACK} />
                        </View>
                        <View style={s.cardMid}>
                          <Text style={s.cardTitle} numberOfLines={1}>{space.name}</Text>
                          <Text style={s.cardDetail}>{space.count ?? 0} transaction{(space.count ?? 0) !== 1 ? 's' : ''}</Text>
                        </View>
                        <View style={s.cardRight}>
                          <Text style={[s.cardAmount, overBudget && { color: RED }]}>{fmt(value)}</Text>
                          {budget > 0 && (
                            <Text style={[s.cardStatus, overBudget && s.cardStatusRed]}>
                              {overBudget ? `${fmt(value - budget)} OVER` : `${fmt(budget - value)} LEFT`}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => { setSelectedSpace(space); setMenuModal(true); }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={s.menuBtn}
                        >
                          <Ionicons name="ellipsis-vertical" size={14} color={MUTED} />
                        </TouchableOpacity>
                      </View>
                      {budget > 0 && (
                        <View style={s.progressTrack}>
                          <View style={[s.progressFill, { width: `${pct * 100}%` as any, backgroundColor: overBudget ? RED : BLACK }]} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── Savings Trackers ── */}
            {savingsSpaces.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>Savings Trackers</Text>
                  <Text style={s.sectionCount}>{savingsSpaces.length} space{savingsSpaces.length !== 1 ? 's' : ''}</Text>
                </View>
                {savingsSpaces.map(space => {
                  const value = space.saved ?? 0;
                  const budget = space.budget ?? 0;
                  const pct = budget > 0 ? Math.min(value / budget, 1) : 0;
                  return (
                    <TouchableOpacity
                      key={space.id}
                      style={s.card}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
                    >
                      <View style={s.cardTop}>
                        <View style={s.cardIconWrap}>
                          <Ionicons name="trending-up-outline" size={18} color={BLACK} />
                        </View>
                        <View style={s.cardMid}>
                          <Text style={s.cardTitle} numberOfLines={1}>{space.name}</Text>
                          <Text style={s.cardDetail}>
                            {budget > 0 ? `Goal: ${fmt(budget)}` : `${space.count ?? 0} transaction${(space.count ?? 0) !== 1 ? 's' : ''}`}
                          </Text>
                        </View>
                        <View style={s.cardRight}>
                          <Text style={s.cardAmount}>{fmt(value)}</Text>
                          {budget > 0 && (
                            <Text style={s.cardStatus}>{Math.round(pct * 100)}% OF GOAL</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => { setSelectedSpace(space); setMenuModal(true); }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={s.menuBtn}
                        >
                          <Ionicons name="ellipsis-vertical" size={14} color={MUTED} />
                        </TouchableOpacity>
                      </View>
                      {budget > 0 && (
                        <View style={s.progressTrack}>
                          <View style={[s.progressFill, { width: `${pct * 100}%` as any, backgroundColor: BLACK }]} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Create / Edit modal ── */}
      <BottomSheet visible={createModal} onClose={() => { setCreateModal(false); setEditMode(false); }} title={editMode ? 'Edit Space' : 'New Space'} height='50%'>
        {error ? <Text style={s.qaError}>{error}</Text> : null}
        <Text style={s.qaLabel}>Type</Text>
        <View style={s.typeRow}>
          {(['expense', 'savings'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.typeBtn, spaceType === t && s.typeBtnActive]} onPress={() => setSpaceType(t)} activeOpacity={0.75}>
              <Text style={[s.typeBtnText, spaceType === t && s.typeBtnTextActive]}>{t} tracker</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.qaLabel}>Name</Text>
        <TextInput style={s.qaInput} placeholder="e.g. Household" placeholderTextColor={MUTED} value={spaceName} onChangeText={v => { setSpaceName(v.slice(0, 20)); setError(''); }} maxLength={20} autoFocus />
        <Text style={s.qaLabel}>{spaceType === 'expense' ? 'Budget' : 'Target Goal'} <Text style={{ fontFamily: FONT, color: MUTED }}>(optional)</Text></Text>
        <TextInput style={s.qaInput} placeholder="e.g. 10000" placeholderTextColor={MUTED} value={spaceBudget} onChangeText={setSpaceBudget} keyboardType="decimal-pad" />
        {spaceType === 'savings' && (
          <>
            <Text style={s.qaLabel}>Target Date <Text style={{ fontFamily: FONT, color: MUTED }}>(optional)</Text></Text>
            <TextInput style={s.qaInput} placeholder="YYYY-MM-DD" placeholderTextColor={MUTED} value={spaceTargetDate} onChangeText={setSpaceTargetDate} />
          </>
        )}
        <TouchableOpacity style={[s.saveBtn, (!spaceName.trim() || loading) && { opacity: 0.4 }]} onPress={handleCreate} disabled={loading || !spaceName.trim()} activeOpacity={0.8}>
          {loading ? <ActivityIndicator color={WHITE} /> : <Text style={s.saveBtnText}>{editMode ? 'Save Changes' : 'Create Space'}</Text>}
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
  root:   { flex: 1, backgroundColor: WHITE },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 80 },

  // ── Header ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 24,
  },
  greeting: { fontFamily: FONT_B,  fontSize: 24, color: BLACK, letterSpacing: -0.4 },
  date:     { fontFamily: FONT,    fontSize: 16, color: DARK, marginTop: 2 },
  addBtn:   {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: BLACK, alignItems: 'center', justifyContent: 'center',
    ...Shadow.card,
  },

  // ── All spaces shortcut ──────────────────────────────────────────────────
  allCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: WHITE, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 24,
    ...Shadow.card,
  },
  allCardIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: SURFACE, justifyContent: 'center', alignItems: 'center',
  },
  allCardText: { fontFamily: FONT_SB, fontSize: 14, color: BLACK },

  // ── Empty ────────────────────────────────────────────────────────────────
  emptyWrap: { alignItems: 'center', gap: 12, paddingVertical: 64 },
  emptyText: { fontFamily: FONT, fontSize: 14, color: MUTED },

  // ── Section ──────────────────────────────────────────────────────────────
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: { fontFamily: FONT_SB, fontSize: 18, color: BLACK },
  sectionCount: { fontFamily: FONT,    fontSize: 12, color: MUTED },

  // ── Space card ───────────────────────────────────────────────────────────
  card: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 16,
    marginBottom: 10,
    ...Shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  cardIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: SURFACE, justifyContent: 'center', alignItems: 'center',
  },

  cardMid:    { flex: 1, gap: 2 },
  cardTitle:  { fontFamily: FONT_SB, fontSize: 18, color: BLACK },
  cardDetail: { fontFamily: FONT,    fontSize: 14, color: DARK },

  cardRight:  { alignItems: 'flex-end', gap: 3 },
  cardAmount: { fontFamily: FONT_B,  fontSize: 16, color: BLACK, letterSpacing: -0.4 },
  cardStatus: { fontFamily: FONT_B,  fontSize: 14, color: BLACK, letterSpacing: 0.2 },
  cardStatusRed: { color: RED },

  menuBtn: { padding: 4 },

  progressTrack: { height: 3, backgroundColor: BORDER, borderRadius: 2, overflow: 'hidden', marginTop: 12 },
  progressFill:  { height: 3, borderRadius: 2 },

  // ── Modal ────────────────────────────────────────────────────────────────
  typeRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn:           { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9, borderWidth: 1, borderColor: BORDER, backgroundColor: WHITE },
  typeBtnActive:     { backgroundColor: BLACK, borderColor: BLACK },
  typeBtnText:       { fontFamily: FONT,   fontSize: 14, color: MUTED },
  typeBtnTextActive: { fontFamily: FONT_B, fontSize: 14, color: WHITE },

  qaLabel: {
    fontFamily: FONT_B, fontSize: 14, color: BLACK,
    letterSpacing: 0.4, textTransform: 'uppercase',
    marginBottom: 6, marginTop: 16,
  },
  qaInput: {
    fontFamily: FONT, fontSize: 15, color: BLACK,
    backgroundColor: WHITE, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  qaError: { fontFamily: FONT, fontSize: 12, color: RED, marginBottom: 8 },

  saveBtn:     { backgroundColor: BLACK, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontFamily: FONT_B, fontSize: 16, color: WHITE },
});
