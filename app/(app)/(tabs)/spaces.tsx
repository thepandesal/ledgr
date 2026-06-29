import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useUser } from '../../../src/hooks/useUser';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Fonts, Radius, Shadow } from '@/components/ui/theme';

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG_TOP    = '#eaf6f4';
const BG_BOT    = '#f7fbfa';
const CARD_BG   = '#ffffff';
const DARK      = '#2d3a3a';
const ACCENT    = '#7fd8cd';
const PEACH     = '#ffab91';
const SOFT_GREY = '#9eafaf';

interface SpaceData {
  id: string; name: string; color: string; icon: string;
  budget?: number | null; spent?: number; saved?: number; count?: number;
  space_type?: string; savings_target_date?: string | null;
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
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
        user_id: userId, name: spaceName.trim(), color: ACCENT, icon: 'grid',
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
          <View style={s.headerLeft}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{getInitials(userName || firstName)}</Text>
            </View>
            <View>
              <Text style={s.greeting}>Hi {firstName} 👋</Text>
              <Text style={s.subGreeting}>Manage your spaces & finances</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.dateText}>{todayLabel()}</Text>
            <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.8}>
              <Ionicons name="add" size={18} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── All spaces shortcut ── */}
        <TouchableOpacity
          style={s.allCard}
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: 'all', name: 'all spaces' } })}
        >
          <View style={s.allCardIcon}>
            <Ionicons name="layers" size={16} color={ACCENT} />
          </View>
          <Text style={s.allCardText}>View all spaces</Text>
          <Ionicons name="chevron-forward" size={14} color={SOFT_GREY} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* ── Main content card ── */}
        {spaces.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="layers-outline" size={32} color={SOFT_GREY} />
            <Text style={s.emptyText}>no spaces yet — tap + to create one</Text>
          </View>
        ) : (
          <View style={s.mainCard}>

            {/* Expense Trackers */}
            {expenseSpaces.length > 0 && (
              <>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>Expense Trackers</Text>
                  <Text style={s.sectionCount}>{expenseSpaces.length} space{expenseSpaces.length !== 1 ? 's' : ''}</Text>
                </View>
                {expenseSpaces.map((space, idx) => {
                  const value = space.spent ?? 0;
                  const budget = space.budget ?? 0;
                  const overBudget = budget > 0 && value > budget;
                  const pct = budget > 0 ? Math.min(value / budget, 1) : 0;
                  return (
                    <TouchableOpacity
                      key={space.id}
                      style={[s.spaceCard, idx < expenseSpaces.length - 1 && s.spaceCardBorder]}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
                    >
                      <View style={[s.colorStrip, { backgroundColor: overBudget ? PEACH : ACCENT }]} />
                      <View style={s.spaceIconWrap}>
                        <Ionicons name="wallet" size={18} color={overBudget ? PEACH : ACCENT} />
                      </View>
                      <View style={s.spaceMid}>
                        <Text style={s.spaceName} numberOfLines={1}>{space.name}</Text>
                        <Text style={s.spaceCount}>{space.count ?? 0} transaction{(space.count ?? 0) !== 1 ? 's' : ''}</Text>
                        {budget > 0 && (
                          <View style={s.progressWrap}>
                            <View style={[s.progressTrack]}>
                              <View style={[s.progressFill, { width: `${pct * 100}%` as any, backgroundColor: overBudget ? PEACH : ACCENT }]} />
                            </View>
                          </View>
                        )}
                      </View>
                      <View style={s.spaceRight}>
                        <Text style={[s.spaceAmount, { color: overBudget ? PEACH : DARK }]}>{fmt(value)}</Text>
                        {budget > 0 && (
                          <Text style={[s.spaceSub, overBudget && { color: PEACH }]}>
                            {overBudget ? `${fmt(value - budget)} over` : `${fmt(budget - value)} left`}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => { setSelectedSpace(space); setMenuModal(true); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={s.menuBtn}
                      >
                        <Ionicons name="ellipsis-vertical" size={14} color={SOFT_GREY} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* Divider between sections */}
            {expenseSpaces.length > 0 && savingsSpaces.length > 0 && (
              <View style={s.sectionDivider} />
            )}

            {/* Savings Trackers */}
            {savingsSpaces.length > 0 && (
              <>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>Savings Trackers</Text>
                  <Text style={s.sectionCount}>{savingsSpaces.length} space{savingsSpaces.length !== 1 ? 's' : ''}</Text>
                </View>
                {savingsSpaces.map((space, idx) => {
                  const value = space.saved ?? 0;
                  const budget = space.budget ?? 0;
                  const pct = budget > 0 ? Math.min(value / budget, 1) : 0;
                  return (
                    <TouchableOpacity
                      key={space.id}
                      style={[s.spaceCard, idx < savingsSpaces.length - 1 && s.spaceCardBorder]}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
                    >
                      <View style={[s.colorStrip, { backgroundColor: ACCENT }]} />
                      <View style={s.spaceIconWrap}>
                        <Ionicons name="trending-up" size={18} color={ACCENT} />
                      </View>
                      <View style={s.spaceMid}>
                        <Text style={s.spaceName} numberOfLines={1}>{space.name}</Text>
                        <Text style={s.spaceCount}>{space.count ?? 0} transaction{(space.count ?? 0) !== 1 ? 's' : ''}</Text>
                        {budget > 0 && (
                          <View style={s.progressWrap}>
                            <View style={s.progressTrack}>
                              <View style={[s.progressFill, { width: `${pct * 100}%` as any, backgroundColor: ACCENT }]} />
                            </View>
                          </View>
                        )}
                      </View>
                      <View style={s.spaceRight}>
                        <Text style={[s.spaceAmount, { color: DARK }]}>{fmt(value)}</Text>
                        {budget > 0 && (
                          <Text style={s.spaceSub}>goal: {fmt(budget)}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => { setSelectedSpace(space); setMenuModal(true); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={s.menuBtn}
                      >
                        <Ionicons name="ellipsis-vertical" size={14} color={SOFT_GREY} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>
        )}

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
        <TextInput style={s.qaInput} placeholder="e.g. Household" placeholderTextColor={Colors.faint} value={spaceName} onChangeText={v => { setSpaceName(v.slice(0, 20)); setError(''); }} maxLength={20} autoFocus />
        <Text style={s.qaLabel}>{spaceType === 'expense' ? 'budget' : 'target goal'} <Text style={{ textTransform: 'none', color: Colors.muted }}>(optional)</Text></Text>
        <TextInput style={s.qaInput} placeholder="e.g. 10000" placeholderTextColor={Colors.faint} value={spaceBudget} onChangeText={setSpaceBudget} keyboardType="decimal-pad" />
        {spaceType === 'savings' && (
          <>
            <Text style={s.qaLabel}>target date <Text style={{ textTransform: 'none', color: Colors.muted }}>(optional)</Text></Text>
            <TextInput style={s.qaInput} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.faint} value={spaceTargetDate} onChangeText={setSpaceTargetDate} />
          </>
        )}
        <TouchableOpacity style={[s.saveBtn, (!spaceName.trim() || loading) && { opacity: 0.4 }]} onPress={handleCreate} disabled={loading || !spaceName.trim()} activeOpacity={0.8}>
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
  root: { flex: 1, backgroundColor: BG_TOP },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 80 },

  // ── Header ──────────────────────────────────────────────────────────────
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { alignItems: 'flex-end', gap: 8 },

  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center',
    ...Shadow.card,
  },
  avatarText: { fontFamily: Fonts.sansBold, fontSize: 15, color: Colors.white },

  greeting:    { fontFamily: Fonts.sansSemiBold, fontSize: 18, color: DARK, letterSpacing: -0.3 },
  subGreeting: { fontFamily: Fonts.sans, fontSize: 12, color: SOFT_GREY, marginTop: 1 },

  dateText: { fontFamily: Fonts.sansMedium, fontSize: 12, color: DARK, opacity: 0.6 },
  addBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', ...Shadow.card },

  // ── All spaces shortcut ─────────────────────────────────────────────────
  allCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD_BG, borderRadius: Radius.lg,
    paddingHorizontal: 16, paddingVertical: 13,
    marginBottom: 16,
    ...Shadow.card,
  },
  allCardIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: ACCENT + '22', justifyContent: 'center', alignItems: 'center' },
  allCardText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: DARK },

  // ── Main card ───────────────────────────────────────────────────────────
  mainCard: {
    backgroundColor: CARD_BG,
    borderRadius: Radius.xxl,
    paddingVertical: 8,
    ...Shadow.card,
    overflow: 'hidden',
  },
  emptyWrap: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  emptyText: { fontFamily: Fonts.sans, fontSize: 13, color: SOFT_GREY },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  sectionTitle: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: DARK },
  sectionCount: { fontFamily: Fonts.sans, fontSize: 11, color: SOFT_GREY },
  sectionDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 20, marginVertical: 4 },

  // ── Space card (row inside main card) ───────────────────────────────────
  spaceCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 10,
  },
  spaceCardBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },

  colorStrip: { width: 3, height: 36, borderRadius: 2 },

  spaceIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },

  spaceMid:  { flex: 1, gap: 2 },
  spaceName: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: DARK, letterSpacing: -0.1 },
  spaceCount:{ fontFamily: Fonts.sans, fontSize: 11, color: SOFT_GREY },

  progressWrap:  { marginTop: 4 },
  progressTrack: { height: 3, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 3, borderRadius: 2 },

  spaceRight:  { alignItems: 'flex-end', gap: 2 },
  spaceAmount: { fontFamily: Fonts.sansBold, fontSize: 15, letterSpacing: -0.5 },
  spaceSub:    { fontFamily: Fonts.sans, fontSize: 10, color: SOFT_GREY },

  menuBtn: { padding: 4 },

  // ── Modal ───────────────────────────────────────────────────────────────
  typeRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn:          { paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  typeBtnActive:    { backgroundColor: ACCENT, borderColor: ACCENT },
  typeBtnText:      { fontFamily: Fonts.sans,     fontSize: 12, color: Colors.muted },
  typeBtnTextActive:{ fontFamily: Fonts.sansBold, fontSize: 12, color: Colors.white },
  qaLabel:          { fontFamily: Fonts.sansSemiBold, fontSize: 11, color: Colors.muted, marginBottom: 6, marginTop: 14, letterSpacing: 0.4, textTransform: 'uppercase' },
  qaInput:          { fontFamily: Fonts.sansMedium, fontSize: 15, color: Colors.text, backgroundColor: Colors.white, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },
  qaError:          { fontFamily: Fonts.sans, fontSize: 12, color: PEACH, marginBottom: 8 },
  saveBtn:          { backgroundColor: ACCENT, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText:      { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.white },
});
