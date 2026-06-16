import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useUser } from '../../../src/hooks/useUser';
import type { Space, Category } from '../../../src/types';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import formStyles from '@/components/ui/formStyles';
import pageStyles from '@/components/ui/pageStyles';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';

const PASTEL_COLORS = [
  '#FFB3B3', '#FFD9B3', '#FFFAB3', '#B3FFB3', '#B3FFE0',
  '#B3F0FF', '#B3C6FF', '#D9B3FF', '#FFB3F0', '#FFB3C6',
];

const ICONS = [
  'home-outline', 'briefcase-outline', 'airplane-outline', 'cart-outline',
  'heart-outline', 'star-outline', 'leaf-outline', 'cafe-outline',
  'car-outline', 'musical-notes-outline',
];

const PAGE_PAD = 32;

interface Space { id: string; name: string; color: string; icon: string; default_category_id?: string; budget?: number | null; spent?: number; pendingTasks?: number; }

export default function SpacesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId, userName } = useUser();
  const [createModal, setCreateModal] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceBudget, setSpaceBudget] = useState('');
  const [selectedColor, setSelectedColor] = useState(PASTEL_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [useDefaultCategory, setUseDefaultCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categorySuggestions, setCategorySuggestions] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuModal, setMenuModal] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [editMode, setEditMode] = useState(false);

  const { data: spaces = [] } = useQuery<Space[]>({
    queryKey: ['spaces', userId],
    queryFn: async () => {
      const { data } = await supabase.from('spaces').select().eq('user_id', userId).order('created_at');
      if (!data) return [];
      const { data: recs } = await supabase.from('recordings').select('space_id, amount').eq('user_id', userId).eq('type', 'expense');
      const spentMap: Record<string, number> = {};
      (recs ?? []).forEach((r: any) => { spentMap[r.space_id] = (spentMap[r.space_id] || 0) + Number(r.amount); });
      const { data: memoData } = await supabase.from('memos').select('space_id, is_done').eq('user_id', userId).eq('is_done', false);
      const memoMap: Record<string, number> = {};
      (memoData ?? []).forEach((m: any) => { memoMap[m.space_id] = (memoMap[m.space_id] || 0) + 1; });
      return data.map((s: any) => ({ ...s, spent: spentMap[s.id] ?? 0, pendingTasks: memoMap[s.id] ?? 0 })) as Space[];
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
    setSpaceName(''); setSelectedColor(PASTEL_COLORS[0]); setSelectedIcon(ICONS[0]);
    setError(''); setUseDefaultCategory(false); setSelectedCategory(null); setCategoryInput('');
    setSpaceBudget('');
    setEditMode(false);
    setCreateModal(true);
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
        name: spaceName.trim(), color: selectedColor, icon: selectedIcon,
        budget: spaceBudget.trim() ? parseFloat(spaceBudget) : null,
      }).eq('id', selectedSpace.id);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from('spaces').insert({
        user_id: userId, name: spaceName.trim(), color: selectedColor, icon: selectedIcon,
        default_category_id: useDefaultCategory && selectedCategory ? selectedCategory.id : null,
        budget: spaceBudget.trim() ? parseFloat(spaceBudget) : null,
      }).select().single();
      if (err) { setError(err.message); setLoading(false); return; }
    }
    queryClient.invalidateQueries({ queryKey: ['spaces', userId] });
    setLoading(false); setCreateModal(false); setEditMode(false);
  };

  const openMenu = (space: Space) => { setSelectedSpace(space); setMenuModal(true); };
  const closeMenu = () => setMenuModal(false);

  const handleEditSpace = () => {
    if (!selectedSpace) return;
    closeMenu();
    setEditMode(true);
    setSpaceName(selectedSpace.name);
    setSelectedColor(selectedSpace.color);
    setSelectedIcon(selectedSpace.icon);
    setSpaceBudget('');
    // Load budget for this space
    supabase.from('spaces').select('budget').eq('id', selectedSpace.id).single()
      .then(({ data }) => { if (data?.budget) setSpaceBudget(String(data.budget)); });
    setError('');
    setUseDefaultCategory(false);
    setSelectedCategory(null);
    setCategoryInput('');
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

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Top margin box */}
        <View style={s.topMargin} />

        {/* Header row: title + description + add button */}
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

        {/* Bottom margin box */}
        <View style={s.bottomMargin} />

        {/* All spaces */}
        <TouchableOpacity
          style={s.allSpacesCard}
          activeOpacity={0.8}
          onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: 'all', name: 'all spaces' } })}>
          <Text style={s.allSpacesText}>all spaces</Text>
          <Ionicons name="chevron-forward" size={14} color="#80b0dd" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Space cards */}
        <View style={s.grid}>
          {spaces.map(space => {
            const spent = space.spent ?? 0;
            const budget = space.budget ?? 0;
            const pct = budget > 0 ? Math.min(spent / budget, 1) : 0;
            const remaining = Math.max(0, budget - spent);
            // This month's recordings count
            const now = new Date();
            return (
              <View key={space.id} style={s.spaceCard}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
                >
                  {/* Space name + menu */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={s.spaceCardText} numberOfLines={1}>
                      {space.name.charAt(0).toUpperCase() + space.name.slice(1)}
                    </Text>
                    <TouchableOpacity onPress={() => openMenu(space)} style={{ padding: 4 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="ellipsis-horizontal" size={14} color="#80b0dd" />
                    </TouchableOpacity>
                  </View>

                  {/* Budget row */}
                  {budget > 0 && (
                    <View style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Text style={s.budgetLabel}>budget</Text>
                        <View style={s.budgetDots} />
                        <View style={s.progressPill}>
                          <View style={[s.progressConsumed, { flex: pct }]} />
                          <View style={[s.progressRemaining, { flex: 1 - pct }]} />
                        </View>
                      </View>
                    </View>
                  )}

                  {/* This month's events */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.eventsLabel}>this month's events</Text>
                    <View style={s.eventsDots} />
                    <View style={s.eventsBadge}>
                      <Text style={s.eventsBadgeText}>
                        {(space.pendingTasks ?? 0)} task{(space.pendingTasks ?? 0) !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Create space sheet */}
      <BottomSheet visible={createModal} onClose={() => { setCreateModal(false); setEditMode(false); }} sub="spaces" title={editMode ? 'edit space' : 'new space'}>
        {error ? <Text style={formStyles.errorText}>{error}</Text> : null}
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

        <Text style={formStyles.sectionLabel}>default category</Text>
        <View style={s.toggleRow}>
          <Text style={s.toggleLabel}>use a default category?</Text>
          <TouchableOpacity
            style={[s.toggleBtn, useDefaultCategory && s.toggleBtnActive]}
            onPress={() => { setUseDefaultCategory(!useDefaultCategory); setSelectedCategory(null); setCategoryInput(''); }}>
            <Text style={[s.toggleBtnText, useDefaultCategory && s.toggleBtnTextActive]}>
              {useDefaultCategory ? 'yes' : 'no'}
            </Text>
          </TouchableOpacity>
        </View>

        {useDefaultCategory && (
          selectedCategory ? (
            <View style={s.badgeRow}>
              <View style={[s.badge, { backgroundColor: selectedCategory.color }]}>
                <Ionicons name={selectedCategory.icon as any} size={14} color={Colors.text} />
                <Text style={s.badgeText}>{selectedCategory.name}</Text>
                <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                  <Ionicons name="close" size={14} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <TextInput
                style={[formStyles.input, { marginTop: 8 }]}
                placeholder="search categories..."
                placeholderTextColor={Colors.faint}
                value={categoryInput}
                onChangeText={handleCategoryInput}
              />
              {categorySuggestions.length > 0 && (
                <View style={s.suggestions}>
                  {categorySuggestions.map(c => (
                    <TouchableOpacity key={c.id} style={formStyles.listItem} onPress={() => { setSelectedCategory(c); setCategoryInput(''); setCategorySuggestions([]); }}>
                      <View style={[s.catDot, { backgroundColor: c.color }]}>
                        <Ionicons name={c.icon as any} size={12} color={Colors.text} />
                      </View>
                      <Text style={formStyles.listItemText}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {categoryInput.trim() !== '' && categorySuggestions.length === 0 && (
                <Text style={formStyles.listEmpty}>no categories found</Text>
              )}
            </>
          )
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
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  scroll: { paddingHorizontal: PAGE_PAD, paddingBottom: 60 },

  // Margin boxes
  topMargin: { height: 32 },
  bottomMargin: { height: 20 },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { fontFamily: Fonts.calSans, fontSize: 32, color: '#494a51', letterSpacing: -0.5 },
  sectionSubtitle: { fontFamily: 'GlacialIndifference', fontSize: 13, color: '#8a8f9e', marginTop: 3 },
  addBtn: {
    backgroundColor: '#ffffff',
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'stretch',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  addBtnText: { fontFamily: 'GlacialIndifference', fontSize: 12, color: '#ffffff' },

  // All spaces card
  allSpacesCard: {
    width: '100%',
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  allSpacesText: { fontFamily: Fonts.calSans, fontSize: 15, color: '#4a7ff7' },

  // Grid
  grid: { flexDirection: 'column', gap: 12 },

  // Space card
  spaceCard: {
    width: '100%',
    borderRadius: Radius.lg,
    padding: 18,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  spaceCardText: { fontFamily: Fonts.calSans, fontSize: 17, color: '#4a7ff7', flex: 1 },

  // Budget
  budgetLabel: { fontFamily: 'GlacialIndifference', fontSize: 11, color: '#80b0dd' },
  budgetDots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: '#80b0dd' },
  budgetValue: { fontFamily: 'GlacialIndifference', fontSize: 11, color: '#80b0dd' },
  // Single pill: consumed (#80b0dd) + remaining (#d1e9ff)
  progressPill: { flexDirection: 'row', height: 22, borderRadius: Radius.pill, overflow: 'hidden', backgroundColor: '#d1e9ff' },
  progressConsumed: { backgroundColor: '#80b0dd', justifyContent: 'center', alignItems: 'center', minWidth: 2 },
  progressConsumedText: { fontFamily: 'GlacialIndifference', fontSize: 9, color: '#d1e9ff', paddingHorizontal: 4 },
  progressRemaining: { backgroundColor: '#d1e9ff', justifyContent: 'center', alignItems: 'center', minWidth: 2 },
  progressRemainingText: { fontFamily: 'GlacialIndifference', fontSize: 9, color: '#80b0dd', paddingHorizontal: 4 },

  // Events
  eventsLabel: { fontFamily: 'GlacialIndifference', fontSize: 11, color: '#80b0dd' },
  eventsDots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: '#80b0dd' },
  eventsBadge: { backgroundColor: '#80b0dd', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  eventsBadgeText: { fontFamily: 'GlacialIndifference', fontSize: 10, color: '#ffffff' },

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
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotSelected: { borderWidth: 3, borderColor: Colors.text },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.input, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.borderMid },
  iconBtnSelected: { backgroundColor: Colors.text, borderColor: Colors.text },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.pill, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4 },
  previewText: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.text },
});
