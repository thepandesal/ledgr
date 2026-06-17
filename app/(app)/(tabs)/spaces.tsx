import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator, Alert, Svg,
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
import formStyles from '@/components/ui/formStyles';
import { Colors, Fonts, Radius } from '@/components/ui/theme';

// ─── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  vividBlue:    '#4a7ff7',
  lightBlue:    '#b4d7ff',
  darkVividBlue:'#1f5eeb',
  lightTurq:    '#cefaf4',
  lightRed:     '#ffe0df',
  grayCyan:     '#425252',
  gray:         '#929090',
  pastelAzure:  '#bec6c9',
};

const PAGE_PAD = 24;

interface SpaceData {
  id: string; name: string; color: string; icon: string;
  budget?: number | null; spent?: number; saved?: number;
  upcomingTasks?: number; space_type?: string; savings_target_date?: string | null;
}

// ─── Circular progress ────────────────────────────────────────────────────────
function CircularProgress({ pct, size = 60 }: { pct: number; size?: number }) {
  const stroke = 15;
  const half = size / 2;
  const deg = Math.min(pct, 1) * 360;
  const rotate1 = deg > 180 ? 180 : deg;
  const rotate2 = deg > 180 ? deg - 180 : 0;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Track */}
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: half, borderWidth: stroke, borderColor: C.lightBlue,
      }} />

      {/* Left half clip */}
      <View style={{
        position: 'absolute', width: half, height: size,
        left: 0, overflow: 'hidden',
      }}>
        <View style={{
          position: 'absolute', width: size, height: size,
          borderRadius: half, borderWidth: stroke,
          borderColor: rotate1 > 0 ? C.vividBlue : 'transparent',
          transform: [{ rotate: `${-90 + rotate1}deg` }],
        }} />
      </View>

      {/* Right half clip */}
      {deg > 180 && (
        <View style={{
          position: 'absolute', width: half, height: size,
          right: 0, overflow: 'hidden',
        }}>
          <View style={{
            position: 'absolute', right: 0, width: size, height: size,
            borderRadius: half, borderWidth: stroke,
            borderColor: C.vividBlue,
            transform: [{ rotate: `${-90 + rotate2}deg` }],
          }} />
        </View>
      )}

      <Text style={{ fontFamily: Fonts.monoBold, fontSize: 10, color: C.vividBlue }}>
        {Math.round(pct * 100)}%
      </Text>
    </View>
  );
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
  const [useDefaultCategory, setUseDefaultCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categorySuggestions, setCategorySuggestions] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuModal, setMenuModal] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<SpaceData | null>(null);
  const [editMode, setEditMode] = useState(false);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: spaces = [] } = useQuery<SpaceData[]>({
    queryKey: ['spaces', userId],
    queryFn: async () => {
      const { data } = await supabase.from('spaces').select().eq('user_id', userId).order('created_at');
      if (!data) return [];

      const { data: expRecs } = await supabase.from('recordings').select('space_id, amount').eq('user_id', userId).eq('type', 'expense');
      const spentMap: Record<string, number> = {};
      (expRecs ?? []).forEach((r: any) => { spentMap[r.space_id] = (spentMap[r.space_id] || 0) + Number(r.amount); });

      const { data: savRecs } = await supabase.from('recordings').select('space_id, amount').eq('user_id', userId).in('type', ['income', 'savings']);
      const savedMap: Record<string, number> = {};
      (savRecs ?? []).forEach((r: any) => { savedMap[r.space_id] = (savedMap[r.space_id] || 0) + Number(r.amount); });

      const { data: memoData } = await supabase.from('memos').select('space_id').eq('user_id', userId).eq('is_done', false).gte('due_date', monthStart).lte('due_date', monthEnd);
      const memoMap: Record<string, number> = {};
      (memoData ?? []).forEach((m: any) => { memoMap[m.space_id] = (memoMap[m.space_id] || 0) + 1; });

      return data.map((s: any) => ({
        ...s,
        spent: spentMap[s.id] ?? 0,
        saved: savedMap[s.id] ?? 0,
        upcomingTasks: memoMap[s.id] ?? 0,
      })) as SpaceData[];
    },
    enabled: !!userId,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories', userId],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select().eq('user_id', userId).order('name');
      return (data ?? []) as Category[];
    },
    enabled: !!userId,
  });

  const openCreate = () => {
    setSpaceName(''); setError(''); setUseDefaultCategory(false);
    setSelectedCategory(null); setCategoryInput(''); setSpaceBudget('');
    setSpaceType('expense'); setSpaceTargetDate(''); setEditMode(false); setCreateModal(true);
  };

  const handleCategoryInput = (val: string) => {
    setCategoryInput(val); setSelectedCategory(null);
    setCategorySuggestions(val.trim() ? categories.filter(c => c.name.toLowerCase().includes(val.toLowerCase())) : []);
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
        user_id: userId, name: spaceName.trim(), color: '#4a7ff7', icon: 'grid',
        default_category_id: useDefaultCategory && selectedCategory ? selectedCategory.id : null,
        budget: spaceBudget.trim() ? parseFloat(spaceBudget) : null,
        space_type: spaceType,
        savings_target_date: spaceType === 'savings' && spaceTargetDate.trim() ? spaceTargetDate.trim() : null,
      }).select().single();
      if (err) { setError(err.message); setLoading(false); return; }
    }
    queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
    setLoading(false); setCreateModal(false); setEditMode(false);
  };

  const openMenu = (space: SpaceData) => { setSelectedSpace(space); setMenuModal(true); };
  const closeMenu = () => setMenuModal(false);

  const handleEditSpace = () => {
    if (!selectedSpace) return;
    closeMenu();
    setEditMode(true);
    setSpaceName(selectedSpace.name);
    setSpaceType((selectedSpace.space_type as any) ?? 'expense');
    setSpaceTargetDate(selectedSpace.savings_target_date ?? '');
    setSpaceBudget('');
    supabase.from('spaces').select('budget').eq('id', selectedSpace.id).single()
      .then(({ data }) => { if (data?.budget) setSpaceBudget(String(data.budget)); });
    setError(''); setUseDefaultCategory(false); setSelectedCategory(null); setCategoryInput('');
    setCreateModal(true);
  };

  const handleDeleteSpace = () => {
    closeMenu();
    Alert.alert('Delete Space', `Delete "${selectedSpace?.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('spaces').delete().eq('id', selectedSpace!.id);
        queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
      }},
    ]);
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.topMargin} />

        {/* Header */}
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.sectionTitle}>spaces</Text>
            <Text style={s.sectionSubtitle}>your money, grouped your way.</Text>
          </View>
          <TouchableOpacity style={s.addBtn} activeOpacity={0.85} onPress={openCreate}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={s.addBtnText}>add a space</Text>
          </TouchableOpacity>
        </View>

        <View style={s.bottomMargin} />

        {/* All spaces */}
        <TouchableOpacity
          style={s.allSpacesCard}
          activeOpacity={0.8}
          onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: 'all', name: 'all spaces' } })}>
          <Text style={s.allSpacesText}>all spaces</Text>
          <Ionicons name="chevron-forward" size={14} color={C.pastelAzure} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Space cards */}
        <View style={s.grid}>
          {spaces.map(space => {
            const isExpense = (space.space_type ?? 'expense') === 'expense';
            const spent = space.spent ?? 0;
            const saved = space.saved ?? 0;
            const budget = space.budget ?? 0;
            const pct = budget > 0 ? Math.min((isExpense ? spent : saved) / budget, 1) : 0;
            const remaining = Math.max(0, budget - spent);
            const upcoming = space.upcomingTasks ?? 0;
            const name = space.name.charAt(0).toUpperCase() + space.name.slice(1);

            return (
              <View key={space.id} style={s.spaceCard}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
                >
                  {/* Name row + type badge + menu */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Text style={s.spaceCardText} numberOfLines={1}>{name}</Text>
                    <View style={[s.typeBadge, { backgroundColor: isExpense ? C.lightRed : C.lightTurq }]}>
                      <Text style={s.typeBadgeText}>{isExpense ? 'expense tracker' : 'savings tracker'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => openMenu(space)} style={{ marginLeft: 'auto', padding: 4 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="ellipsis-horizontal" size={14} color={C.pastelAzure} />
                    </TouchableOpacity>
                  </View>

                  {isExpense ? (
                    /* ── Expense layout ── */
                    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                      {/* Circular progress */}
                      <CircularProgress pct={pct} size={60} />

                      {/* Three info rows */}
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={s.infoRow}>
                          <Text style={s.infoLabel}>expense</Text>
                          <View style={s.infoDots} />
                          <Text style={s.infoValue}>{fmt(spent)}</Text>
                        </View>
                        <View style={s.infoRow}>
                          <Text style={s.infoLabel}>remaining budget</Text>
                          <View style={s.infoDots} />
                          <Text style={s.infoValue}>{budget > 0 ? fmt(remaining) : '—'}</Text>
                        </View>
                        <View style={s.infoRow}>
                          <Text style={s.infoLabel}>upcoming events</Text>
                          <View style={s.infoDots} />
                          <Text style={s.infoValue}>{upcoming}</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    /* ── Savings layout ── */
                    <View style={{ gap: 10 }}>
                      {/* Savings pill progress */}
                      <View style={s.savingsPill}>
                        <View style={[s.savingsConsumed, { flex: pct, minWidth: pct > 0 ? 8 : 0 }]}>
                          {pct > 0.2 && <Text style={s.savingsConsumedText}>{fmt(saved)}</Text>}
                        </View>
                        <View style={[s.savingsRemaining, { flex: 1 - pct, minWidth: (1 - pct) > 0 ? 8 : 0 }]}>
                          {(1 - pct) > 0.2 && <Text style={s.savingsRemainingText}>{budget > 0 ? fmt(Math.max(0, budget - saved)) : '—'}</Text>}
                        </View>
                      </View>

                      {/* Info rows */}
                      <View style={s.infoRow}>
                        <Text style={s.infoLabel}>saved</Text>
                        <View style={s.infoDots} />
                        <Text style={s.infoValue}>{fmt(saved)}</Text>
                      </View>
                      <View style={s.infoRow}>
                        <Text style={s.infoLabel}>target goal</Text>
                        <View style={s.infoDots} />
                        <Text style={s.infoValue}>{budget > 0 ? fmt(budget) : '—'}</Text>
                      </View>
                      {(space as any).savings_target_date && (
                        <View style={s.infoRow}>
                          <Text style={s.infoLabel}>target date</Text>
                          <View style={s.infoDots} />
                          <Text style={s.infoValue}>
                            {new Date((space as any).savings_target_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </Text>
                        </View>
                      )}
                      <View style={s.infoRow}>
                        <Text style={s.infoLabel}>upcoming events</Text>
                        <View style={s.infoDots} />
                        <Text style={s.infoValue}>{upcoming}</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Create/edit space sheet */}
      <BottomSheet visible={createModal} onClose={() => { setCreateModal(false); setEditMode(false); }} sub="spaces" title={editMode ? 'edit space' : 'new space'}>
        {error ? <Text style={formStyles.errorText}>{error}</Text> : null}

        {/* Type selector */}
        <Text style={formStyles.sectionLabel}>type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
          {(['expense', 'savings'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.typeBtn, spaceType === t && s.typeBtnActive]}
              onPress={() => setSpaceType(t)}
            >
              <Text style={[s.typeBtnText, spaceType === t && s.typeBtnTextActive]}>{t} tracker</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={formStyles.sectionLabel}>name</Text>
        <TextInput
          style={[formStyles.input, error ? { borderColor: Colors.danger } : null]}
          placeholder="e.g. Household"
          placeholderTextColor={Colors.faint}
          value={spaceName}
          onChangeText={v => { setSpaceName(v.slice(0, 15)); setError(''); }}
          maxLength={15}
          autoFocus
        />
        <Text style={[formStyles.hintMuted, { alignSelf: 'flex-end' }]}>{spaceName.length}/15</Text>

        {spaceType === 'expense' ? (
          <>
            <Text style={formStyles.sectionLabel}>budget <Text style={{ textTransform: 'none' }}>(optional)</Text></Text>
            <TextInput
              style={formStyles.input}
              placeholder="e.g. 10000"
              placeholderTextColor={Colors.faint}
              value={spaceBudget}
              onChangeText={setSpaceBudget}
              keyboardType="decimal-pad"
            />
            <Text style={formStyles.hintMuted}>leave empty for no budget limit</Text>
          </>
        ) : (
          <>
            <Text style={formStyles.sectionLabel}>target goal <Text style={{ textTransform: 'none' }}>(optional)</Text></Text>
            <TextInput
              style={formStyles.input}
              placeholder="e.g. 50000"
              placeholderTextColor={Colors.faint}
              value={spaceBudget}
              onChangeText={setSpaceBudget}
              keyboardType="decimal-pad"
            />
            <Text style={formStyles.hintMuted}>how much do you want to save?</Text>
            <Text style={formStyles.sectionLabel}>target date <Text style={{ textTransform: 'none' }}>(optional)</Text></Text>
            <TextInput
              style={formStyles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.faint}
              value={spaceTargetDate}
              onChangeText={setSpaceTargetDate}
            />
            <Text style={formStyles.hintMuted}>when do you want to reach your goal?</Text>
          </>
        )}

        <View style={formStyles.actions}>
          <TouchableOpacity style={formStyles.cancelBtn} onPress={() => setCreateModal(false)}>
            <Text style={formStyles.cancelBtnText}>cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[formStyles.primaryBtn, (!spaceName.trim() || loading) && { opacity: 0.4 }]}
            onPress={handleCreate}
            disabled={loading || !spaceName.trim()}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={formStyles.primaryBtnText}>{editMode ? 'save changes' : 'create space'}</Text>}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Space menu */}
      <ConfirmModal
        visible={menuModal}
        onClose={() => closeMenu()}
        title={selectedSpace?.name?.toLowerCase() ?? 'space'}
        actions={[
          { label: 'cancel', onPress: () => closeMenu(), muted: true },
          { label: 'edit', onPress: handleEditSpace },
          { label: 'delete', onPress: handleDeleteSpace, destructive: true },
        ]}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { paddingHorizontal: 32, paddingBottom: 60 },
  topMargin: { height: 32 },
  bottomMargin: { height: 40 },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { fontFamily: Fonts.calSans, fontSize: 32, color: '#494a51', letterSpacing: -0.5 },
  sectionSubtitle: { fontFamily: 'GlacialIndifference', fontSize: 13, color: C.gray, marginTop: 3 },
  addBtn: {
    backgroundColor: C.darkVividBlue,
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  addBtnText: { fontFamily: 'GlacialIndifference', fontSize: 12, color: '#ffffff' },

  // All spaces
  allSpacesCard: {
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  allSpacesText: { fontFamily: Fonts.calSans, fontSize: 15, color: C.vividBlue },

  grid: { flexDirection: 'column', gap: 14 },

  // Space card
  spaceCard: {
    borderRadius: Radius.lg,
    padding: 18,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  spaceCardText: { fontFamily: Fonts.calSans, fontSize: 17, color: C.vividBlue, flexShrink: 1 },

  // Type badge
  typeBadge: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  typeBadgeText: { fontFamily: 'GlacialIndifference', fontSize: 10, color: C.grayCyan },

  // Info rows
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { fontFamily: 'GlacialIndifference', fontSize: 11, color: C.gray, flexShrink: 0 },
  infoDots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: C.pastelAzure },
  infoValue: { fontFamily: 'GlacialIndifferenceBold', fontSize: 11, color: C.vividBlue, flexShrink: 0 },

  // Savings pill
  savingsPill: {
    height: 24,
    borderRadius: Radius.pill,
    overflow: 'visible',
    backgroundColor: C.lightBlue,
    flexDirection: 'row',
    borderRadius: Radius.pill,
  },
  savingsConsumed: {
    backgroundColor: C.darkVividBlue,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.pill,
  },
  savingsConsumedText: { fontFamily: 'GlacialIndifference', fontSize: 9, color: C.lightBlue, paddingHorizontal: 6 },
  savingsRemaining: {
    backgroundColor: C.lightBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingsRemainingText: { fontFamily: 'GlacialIndifference', fontSize: 9, color: C.darkVividBlue, paddingHorizontal: 6 },

  // Type selector in form
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.borderMid,
    backgroundColor: Colors.surface, alignItems: 'center',
  },
  typeBtnActive: { backgroundColor: C.vividBlue, borderColor: C.vividBlue },
  typeBtnText: { fontFamily: 'GlacialIndifference', fontSize: 12, color: C.gray },
  typeBtnTextActive: { color: '#ffffff' },

  // Form
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  toggleLabel: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.muted },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.input },
  toggleBtnActive: { backgroundColor: Colors.income, borderColor: Colors.income },
  toggleBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: Colors.faint },
  toggleBtnTextActive: { color: Colors.white },
  badgeRow: { flexDirection: 'row', marginTop: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.pill, paddingVertical: 8, paddingHorizontal: 14, gap: 6 },
  badgeText: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.text },
  suggestions: { backgroundColor: Colors.input, borderRadius: Radius.md, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderMid },
  catDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
