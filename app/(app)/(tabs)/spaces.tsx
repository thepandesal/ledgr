import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator, useWindowDimensions, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useContext, useEffect } from 'react';
import { useUser } from '../../../src/hooks/useUser';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../../src/lib/brand';
import { BlurContext } from '../../../src/lib/BlurContext';

interface SpaceData {
  id: string; name: string; color: string; icon: string;
  budget?: number | null; spent?: number; saved?: number; count?: number;
  space_type?: string; savings_target_date?: string | null; is_active?: boolean;
}

const ACCENT      = '#B6E1DE'; // light mint — backgrounds only
const ACCENT_TEXT = '#101514'; // dark text ON accent bg
const ACCENT_DARK = Brand.color.accentDark; // dark teal — text/icons on white bg

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MOTIVATIONS = [
  'Every peso saved is a step forward.',
  'Small habits build big wealth.',
  'Track today, thrive tomorrow.',
  'You\'re in control of your finances.',
  'Consistency beats perfection.',
];

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
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { width: W } = useWindowDimensions();

  const switchTab = (tab: 'active' | 'inactive') => {
    Animated.timing(slideAnim, {
      toValue: tab === 'inactive' ? -W : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
    setActiveTab(tab);
  };

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

  const { setBlur, registerAdd, unregisterAdd } = useContext(BlurContext);

  const openCreate = () => {
    setSpaceName(''); setError(''); setSpaceBudget('');
    setSpaceType('expense'); setSpaceTargetDate(''); setEditMode(false);
    setCreateModal(true); setBlur(true);
  };

  useEffect(() => {
    registerAdd('spaces', openCreate);
    return () => unregisterAdd('spaces');
  }, []);

  const handleCreate = async () => {
    if (!spaceName.trim()) { setError('name is required.'); return; }
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
    setLoading(false); setCreateModal(false); setEditMode(false); setBlur(false);
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

  const handleToggleActive = async () => {
    if (!selectedSpace) return;
    setMenuModal(false);
    await supabase.from('spaces').update({ is_active: !selectedSpace.is_active }).eq('id', selectedSpace.id);
    queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
  };

  const renderExpenseCard = (space: SpaceData) => {
    const value       = space.spent ?? 0;
    const budget      = space.budget ?? 0;
    const over        = budget > 0 && value > budget;
    const remaining   = budget - value;
    const statusColor = over ? Colors.expense : budget > 0 && remaining / budget < 0.2 ? '#F97316' : ACCENT_DARK;
    return (
      <TouchableOpacity key={space.id} style={s.card} activeOpacity={0.85} onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}>
        <View style={s.cardLeft}>
          <Text style={s.cardName}>{String(space.name).toLowerCase()}</Text>
          <Text style={s.cardMeta}>{space.count ?? 0} transaction{(space.count ?? 0) !== 1 ? 's' : ''}</Text>
        </View>
        <View style={s.cardRight}>
          <View style={s.cardRow}><Text style={s.cardRowLabel}>spend</Text><Text style={[s.cardRowValue, over && { color: Colors.expense }]}>{fmt(value)}</Text></View>
          {budget > 0 && (<>
            <View style={s.cardRow}><Text style={s.cardRowLabel}>budget</Text><Text style={s.cardRowValue}>{fmt(budget)}</Text></View>
            <View style={s.cardRow}><Text style={s.cardRowLabel}>usable</Text><Text style={[s.cardRowValue, { color: statusColor }]}>{fmt(Math.max(remaining, 0))}</Text></View>
          </>)}
        </View>
        <TouchableOpacity onPress={() => { setSelectedSpace(space); setMenuModal(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={14} color={Colors.muted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderSavingsCard = (space: SpaceData) => {
    const value       = space.saved ?? 0;
    const budget      = space.budget ?? 0;
    const pct         = budget > 0 ? Math.min(value / budget, 1) : 0;
    const statusColor = pct >= 1 ? ACCENT_DARK : '#F97316';
    return (
      <TouchableOpacity key={space.id} style={s.card} activeOpacity={0.85} onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}>
        <View style={s.cardLeft}>
          <Text style={s.cardName}>{String(space.name).toLowerCase()}</Text>
          <Text style={s.cardMeta}>{space.count ?? 0} transaction{(space.count ?? 0) !== 1 ? 's' : ''}</Text>
        </View>
        <View style={s.cardRight}>
          <View style={s.cardRow}><Text style={s.cardRowLabel}>saved</Text><Text style={[s.cardRowValue, { color: ACCENT }]}>{fmt(value)}</Text></View>
          {budget > 0 && (<>
            <View style={s.cardRow}><Text style={s.cardRowLabel}>goal</Text><Text style={s.cardRowValue}>{fmt(budget)}</Text></View>
            <View style={s.cardRow}><Text style={s.cardRowLabel}>remaining</Text><Text style={[s.cardRowValue, { color: statusColor }]}>{fmt(Math.max(budget - value, 0))}</Text></View>
          </>)}
        </View>
        <TouchableOpacity onPress={() => { setSelectedSpace(space); setMenuModal(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={14} color={Colors.muted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const firstName = userName?.split(' ')[0] || 'there';
  const expenseActive   = spaces.filter(sp => (sp.space_type ?? 'expense') === 'expense' && sp.is_active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const savingsActive   = spaces.filter(sp => sp.space_type === 'savings'  && sp.is_active !== false).sort((a, b) => a.name.localeCompare(b.name));
  const expenseInactive = spaces.filter(sp => (sp.space_type ?? 'expense') === 'expense' && sp.is_active === false).sort((a, b) => a.name.localeCompare(b.name));
  const savingsInactive = spaces.filter(sp => sp.space_type === 'savings'  && sp.is_active === false).sort((a, b) => a.name.localeCompare(b.name));
  const expenseSpaces   = activeTab === 'active' ? expenseActive : expenseInactive;
  const savingsSpaces   = activeTab === 'active' ? savingsActive : savingsInactive;
  const motivation = MOTIVATIONS[new Date().getDay() % MOTIVATIONS.length];

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Active / Inactive toggle */}
        <View style={s.actionRow}>
          <View style={s.tabToggle}>
            <TouchableOpacity
              style={[s.tabBtn, activeTab === 'active' && s.tabBtnActive]}
              onPress={() => switchTab('active')}
              activeOpacity={0.8}
            >
              <Text style={[s.tabBtnText, activeTab === 'active' && s.tabBtnTextActive]}>active</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tabBtn, activeTab === 'inactive' && s.tabBtnActive]}
              onPress={() => switchTab('inactive')}
              activeOpacity={0.8}
            >
              <Text style={[s.tabBtnText, activeTab === 'inactive' && s.tabBtnTextActive]}>inactive</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Empty ── */}
        {spaces.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>no spaces yet — tap + to create one</Text>
          </View>
        ) : (
          <View style={s.slideOuter}>
            <Animated.View style={[s.slidePair, { width: W * 2, transform: [{ translateX: slideAnim }] }]}>

              {/* ── Panel 1: Active ── */}
              <View style={{ width: W }}>
                {expenseActive.length === 0 && savingsActive.length === 0 && (
                  <View style={s.emptyWrap}><Text style={s.emptyText}>no active spaces</Text></View>
                )}
                {expenseActive.length > 0 && (
                  <>
                    <Text style={s.sectionHeader}>expense trackers</Text>
                    <View style={s.list}>{expenseActive.map(space => renderExpenseCard(space))}</View>
                  </>
                )}
                {savingsActive.length > 0 && (
                  <>
                    <Text style={s.sectionHeader}>savings trackers</Text>
                    <View style={s.list}>{savingsActive.map(space => renderSavingsCard(space))}</View>
                  </>
                )}
              </View>

              {/* ── Panel 2: Inactive ── */}
              <View style={{ width: W }}>
                {expenseInactive.length === 0 && savingsInactive.length === 0 && (
                  <View style={s.emptyWrap}><Text style={s.emptyText}>no inactive spaces</Text></View>
                )}
                {expenseInactive.length > 0 && (
                  <>
                    <Text style={s.sectionHeader}>expense trackers</Text>
                    <View style={s.list}>{expenseInactive.map(space => renderExpenseCard(space))}</View>
                  </>
                )}
                {savingsInactive.length > 0 && (
                  <>
                    <Text style={s.sectionHeader}>savings trackers</Text>
                    <View style={s.list}>{savingsInactive.map(space => renderSavingsCard(space))}</View>
                  </>
                )}
              </View>

            </Animated.View>
          </View>
        )}

        <Text style={s.footer}>managed by LEDGR</Text>
      </ScrollView>

      {/* ── Create / Edit modal ── */}
      <BottomSheet visible={createModal} onClose={() => { setCreateModal(false); setEditMode(false); setBlur(false); }} title={editMode ? 'edit space' : 'new space'} height='50%'>
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Text style={s.label}>type</Text>
        <View style={s.typeRow}>
          {(['expense', 'savings'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.typeBtn, spaceType === t && s.typeBtnActive]} onPress={() => setSpaceType(t)} activeOpacity={0.75}>
              <Text style={[s.typeBtnText, spaceType === t && s.typeBtnTextActive]}>{t} tracker</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.label}>name</Text>
        <TextInput style={s.input} placeholder="e.g. household" placeholderTextColor={Colors.faint} value={spaceName} onChangeText={v => { setSpaceName(v.slice(0, 20)); setError(''); }} maxLength={20} autoFocus />
        <Text style={s.label}>{spaceType === 'expense' ? 'budget' : 'target goal'} <Text style={{ color: Colors.muted }}>(optional)</Text></Text>
        <TextInput style={s.input} placeholder="e.g. 10000" placeholderTextColor={Colors.faint} value={spaceBudget} onChangeText={setSpaceBudget} keyboardType="decimal-pad" />
        {spaceType === 'savings' && (
          <>
            <Text style={s.label}>target date <Text style={{ color: Colors.muted }}>(optional)</Text></Text>
            <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.faint} value={spaceTargetDate} onChangeText={setSpaceTargetDate} />
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
          { label: 'cancel',                                          onPress: () => setMenuModal(false), muted: true },
          { label: 'edit',                                            onPress: handleEditSpace },
          { label: selectedSpace?.is_active !== false ? 'mark inactive' : 'mark active', onPress: handleToggleActive },
          { label: 'delete',                                          onPress: handleDeleteSpace, destructive: true },
        ]}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingBottom: 60 },

  // ── Header ──────────────────────────────────────────────────────────────
  actionRow:   { alignItems: 'center', paddingHorizontal: Spacing.page, marginTop: 20, marginBottom: 8 },
  tabToggle:       { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.pill, padding: 3, borderWidth: 1, borderColor: Colors.border },
  tabBtn:          { paddingHorizontal: 18, paddingVertical: 6, borderRadius: Radius.pill },
  tabBtnActive:    { backgroundColor: ACCENT },
  tabBtnText:      { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  tabBtnTextActive:{ fontFamily: Fonts.monoBold, fontSize: 11, color: ACCENT_TEXT },

  slideOuter: { overflow: 'hidden' },
  slidePair:  { flexDirection: 'row' },

  // ── Empty ────────────────────────────────────────────────────────────────
  emptyWrap: { paddingVertical: 48, alignItems: 'center', paddingHorizontal: Spacing.page },
  emptyText: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted },

  // ── Section ──────────────────────────────────────────────────────────────
  sectionHeader: { ...Brand.type.sectionHeader, marginBottom: 8, marginTop: Brand.spacing.section, paddingHorizontal: Spacing.page },
  list: { marginBottom: 8, paddingHorizontal: Spacing.page },

  // ── Card ─────────────────────────────────────────────────────────────────
  card:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cardLeft:     { flex: 1, gap: 4 },
  cardName:     { fontFamily: 'ChillaxMedium', fontSize: 14, color: Colors.text },
  cardMeta:     { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  cardRight:    { alignItems: 'flex-end', gap: 3 },
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cardRowLabel: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, letterSpacing: 0.3 },
  cardRowValue: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text, letterSpacing: -0.2 },

  // ── Modal ─────────────────────────────────────────────────────────────────
  error:   { fontFamily: Fonts.mono, fontSize: 12, color: Colors.expense, marginBottom: 8 },
  label:   { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, marginBottom: 6, marginTop: 14, letterSpacing: 0.4, textTransform: 'uppercase' },
  input:   { fontFamily: Fonts.monoBold, fontSize: 15, color: Colors.text, backgroundColor: Colors.white, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },

  typeRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  typeBtnActive:     { backgroundColor: ACCENT, borderColor: ACCENT },
  typeBtnText:       { fontFamily: Fonts.mono,     fontSize: 12, color: Colors.muted },
  typeBtnTextActive: { fontFamily: Fonts.monoBold, fontSize: 12, color: ACCENT_TEXT },

  saveBtn:     { backgroundColor: ACCENT, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { fontFamily: Fonts.monoBold, fontSize: 14, color: ACCENT_TEXT },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint, textAlign: 'center', marginTop: 32, paddingHorizontal: Spacing.page },
});
