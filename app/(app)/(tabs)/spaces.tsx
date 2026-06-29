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

// ── Strict B&W design tokens ──────────────────────────────────────────────────
const BLACK   = '#000000';
const NEAR_BK = '#111827';
const DARK    = '#1F2937';
const MUTED   = '#6B7280';
const BORDER  = '#E5E7EB';
const SURFACE = '#F9FAFB';
const WHITE   = '#FFFFFF';
const RED     = '#DC2626';
const FONT    = 'Outfit_400Regular';
const FONT_SB = 'Outfit_600SemiBold';
const FONT_B  = 'Outfit_700Bold';

const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};

interface SpaceData {
  id: string; name: string; color: string; icon: string;
  budget?: number | null; spent?: number; saved?: number; count?: number;
  space_type?: string; savings_target_date?: string | null;
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const firstName = userName?.split(' ')[0] || 'there';
  const expenseSpaces = spaces.filter(sp => (sp.space_type ?? 'expense') === 'expense');
  const savingsSpaces = spaces.filter(sp => sp.space_type === 'savings');

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>Hi, {firstName} 👋</Text>
            <Text style={s.date}>{todayLabel()}</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.75}>
            <Ionicons name="add" size={22} color={WHITE} />
          </TouchableOpacity>
        </View>

        {/* ── View all shortcut ── */}
        <TouchableOpacity
          style={s.allCard}
          activeOpacity={0.82}
          onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: 'all', name: 'all spaces' } })}
        >
          <View style={s.allIconWrap}>
            <Ionicons name="layers-outline" size={16} color={BLACK} />
          </View>
          <Text style={s.allCardText}>View all spaces</Text>
          <Ionicons name="chevron-forward" size={14} color={MUTED} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* ── Empty state ── */}
        {spaces.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="layers-outline" size={36} color={BORDER} />
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
                  const value   = space.spent ?? 0;
                  const budget  = space.budget ?? 0;
                  const over    = budget > 0 && value > budget;
                  const pct     = budget > 0 ? Math.min(value / budget, 1) : 0;
                  return (
                    <TouchableOpacity
                      key={space.id}
                      style={s.card}
                      activeOpacity={0.82}
                      onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
                    >
                      {/* Row 1 — title left, badge right */}
                      <View style={s.cardRow}>
                        <View style={s.cardTitleRow}>
                          <View style={s.cardIconWrap}>
                            <Ionicons name="wallet-outline" size={16} color={over ? RED : BLACK} />
                          </View>
                          <Text style={s.cardTitle} numberOfLines={1}>{space.name}</Text>
                        </View>
                        <View style={[s.badge, over && s.badgeRed]}>
                          <Text style={[s.badgeText, over && s.badgeTextRed]}>
                            {over ? 'OVER BUDGET' : 'ON TRACK'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => { setSelectedSpace(space); setMenuModal(true); }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={s.menuBtn}
                        >
                          <Ionicons name="ellipsis-vertical" size={14} color={MUTED} />
                        </TouchableOpacity>
                      </View>

                      {/* Row 2 — detail */}
                      <Text style={s.cardDetail}>{space.count ?? 0} transaction{(space.count ?? 0) !== 1 ? 's' : ''}</Text>

                      {/* Row 3 — progress bar */}
                      {budget > 0 && (
                        <View style={s.progressTrack}>
                          <View style={[s.progressFill, { width: `${pct * 100}%` as any, backgroundColor: over ? RED : BLACK }]} />
                        </View>
                      )}

                      {/* Row 4 — totals bottom-aligned */}
                      <View style={s.cardFooter}>
                        <Text style={[s.cardAmount, over && { color: RED }]}>{fmt(value)}</Text>
                        {budget > 0 && (
                          <Text style={[s.cardSub, over && { color: RED }]}>
                            {over ? `${fmt(value - budget)} over limit` : `${fmt(budget - value)} remaining`}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── Savings Trackers ── */}
            {savingsSpaces.length > 0 && (
              <View style={[s.section, { marginTop: 20 }]}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>Savings Trackers</Text>
                  <Text style={s.sectionCount}>{savingsSpaces.length} space{savingsSpaces.length !== 1 ? 's' : ''}</Text>
                </View>
                {savingsSpaces.map(space => {
                  const value  = space.saved ?? 0;
                  const budget = space.budget ?? 0;
                  const pct    = budget > 0 ? Math.min(value / budget, 1) : 0;
                  return (
                    <TouchableOpacity
                      key={space.id}
                      style={s.card}
                      activeOpacity={0.82}
                      onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
                    >
                      {/* Row 1 — title left, badge right */}
                      <View style={s.cardRow}>
                        <View style={s.cardTitleRow}>
                          <View style={s.cardIconWrap}>
                            <Ionicons name="trending-up-outline" size={16} color={BLACK} />
                          </View>
                          <Text style={s.cardTitle} numberOfLines={1}>{space.name}</Text>
                        </View>
                        {budget > 0 && (
                          <View style={s.badge}>
                            <Text style={s.badgeText}>{Math.round(pct * 100)}% SAVED</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={() => { setSelectedSpace(space); setMenuModal(true); }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={s.menuBtn}
                        >
                          <Ionicons name="ellipsis-vertical" size={14} color={MUTED} />
                        </TouchableOpacity>
                      </View>

                      {/* Row 2 — goal detail */}
                      <Text style={s.cardDetail}>
                        {budget > 0 ? `Goal: ${fmt(budget)}` : `${space.count ?? 0} transaction${(space.count ?? 0) !== 1 ? 's' : ''}`}
                      </Text>

                      {/* Row 3 — progress bar */}
                      {budget > 0 && (
                        <View style={s.progressTrack}>
                          <View style={[s.progressFill, { width: `${pct * 100}%` as any, backgroundColor: BLACK }]} />
                        </View>
                      )}

                      {/* Row 4 — totals bottom-aligned */}
                      <View style={s.cardFooter}>
                        <Text style={s.cardGoalAmount}>{fmt(value)}</Text>
                        {budget > 0 && (
                          <Text style={s.cardSub}>{fmt(budget - value > 0 ? budget - value : 0)} to go</Text>
                        )}
                      </View>
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
        <TouchableOpacity style={[s.saveBtn, (!spaceName.trim() || loading) && { opacity: 0.4 }]} onPress={handleCreate} disabled={loading || !spaceName.trim()} activeOpacity={0.75}>
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
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 80 },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 16, gap: 12,
  },
  greeting: { fontFamily: FONT_B,  fontSize: 13, color: BLACK, letterSpacing: -0.2 },
  date:     { fontFamily: FONT,    fontSize: 10, color: DARK,  marginTop: 2 },
  addBtn:   {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: BLACK, alignItems: 'center', justifyContent: 'center',
    marginTop: 2, ...SHADOW,
  },

  // ── All card ────────────────────────────────────────────────────────────
  allCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: WHITE, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 24, ...SHADOW,
  },
  allIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: SURFACE, justifyContent: 'center', alignItems: 'center',
  },
  allCardText: { fontFamily: FONT_SB, fontSize: 10, color: BLACK },

  // ── Empty ───────────────────────────────────────────────────────────────
  emptyWrap: { alignItems: 'center', gap: 12, paddingVertical: 72 },
  emptyText: { fontFamily: FONT, fontSize: 10, color: MUTED },

  // ── Section ─────────────────────────────────────────────────────────────
  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  sectionTitle: { fontFamily: FONT_SB, fontSize: 11, color: BLACK },
  sectionCount: { fontFamily: FONT,    fontSize: 9,  color: MUTED },

  // ── Card ────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1, borderColor: BORDER,
    padding: 16,
    marginBottom: 16, ...SHADOW,
  },

  // Row 1: title + badge + menu
  cardRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardIconWrap:{ width: 28, height: 28, borderRadius: 6, backgroundColor: SURFACE, justifyContent: 'center', alignItems: 'center' },
  cardTitle:   { fontFamily: FONT_SB, fontSize: 11, color: BLACK, flex: 1 },

  // Badge top-right
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER },
  badgeRed:     { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  badgeText:    { fontFamily: FONT_B, fontSize: 8,  color: DARK,  letterSpacing: 0.4 },
  badgeTextRed: { color: RED },

  menuBtn: { padding: 4 },

  // Row 2: detail
  cardDetail: { fontFamily: FONT, fontSize: 9,  color: DARK, marginBottom: 8 },

  // Row 3: progress bar
  progressTrack: { height: 6, backgroundColor: BORDER, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressFill:  { height: 6, borderRadius: 3 },

  // Row 4: footer totals
  cardFooter:    { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardAmount:    { fontFamily: FONT_B,  fontSize: 13, color: BLACK, letterSpacing: -0.3 },
  cardGoalAmount:{ fontFamily: FONT_B,  fontSize: 13, color: BLACK, letterSpacing: -0.3 },
  cardSub:       { fontFamily: FONT,    fontSize: 9,  color: MUTED },

  // ── Modal ────────────────────────────────────────────────────────────────
  typeRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn:           { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: BORDER, backgroundColor: WHITE },
  typeBtnActive:     { backgroundColor: BLACK, borderColor: BLACK },
  typeBtnText:       { fontFamily: FONT,   fontSize: 10, color: MUTED },
  typeBtnTextActive: { fontFamily: FONT_B, fontSize: 10, color: WHITE },

  qaLabel: {
    fontFamily: FONT_B, fontSize: 9, color: BLACK,
    letterSpacing: 0.5, textTransform: 'uppercase',
    marginBottom: 4, marginTop: 12,
  },
  qaInput: {
    fontFamily: FONT, fontSize: 11, color: BLACK,
    backgroundColor: WHITE, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  qaError: { fontFamily: FONT, fontSize: 9, color: RED, marginBottom: 6 },

  saveBtn:     { backgroundColor: BLACK, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { fontFamily: FONT_B, fontSize: 11, color: WHITE, letterSpacing: 0.2 },
});
