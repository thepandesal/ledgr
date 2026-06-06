import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
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

interface Space { id: string; name: string; color: string; icon: string; default_category_id?: string; }
interface Category { id: string; name: string; color: string; icon: string; }

export default function SpacesScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [userId, setUserId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [createModal, setCreateModal] = useState(false);
  const [spaceName, setSpaceName] = useState('');
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserName(user.user_metadata?.full_name ?? ''); setUserId(user.id); loadSpaces(user.id); loadCategories(user.id); }
    });
  }, []);

  const loadSpaces = async (uid: string) => {
    const { data } = await supabase.from('spaces').select().eq('user_id', uid).order('created_at');
    if (data) setSpaces(data);
  };

  const loadCategories = async (uid: string) => {
    const { data } = await supabase.from('categories').select().eq('user_id', uid).order('name');
    if (data) setCategories(data);
  };

  const openCreate = () => {
    setSpaceName(''); setSelectedColor(PASTEL_COLORS[0]); setSelectedIcon(ICONS[0]);
    setError(''); setUseDefaultCategory(false); setSelectedCategory(null); setCategoryInput('');
    setCreateModal(true);
  };

  const handleCategoryInput = (val: string) => {
    setCategoryInput(val); setSelectedCategory(null);
    setCategorySuggestions(val.trim() ? categories.filter(c => c.name.toLowerCase().includes(val.toLowerCase())) : []);
  };

  const handleCreate = async () => {
    if (!spaceName.trim()) { setError('Name is required.'); return; }
    setLoading(true);
    const { data, error: err } = await supabase.from('spaces').insert({
      user_id: userId, name: spaceName.trim(), color: selectedColor, icon: selectedIcon,
      default_category_id: useDefaultCategory && selectedCategory ? selectedCategory.id : null,
    }).select().single();
    if (err) { setError(err.message); setLoading(false); return; }
    setSpaces(prev => [...prev, data]); setLoading(false); setCreateModal(false);
  };

  const openMenu = (space: Space) => { setSelectedSpace(space); setMenuModal(true); };
  const closeMenu = () => setMenuModal(false);

  const handleDeleteSpace = () => {
    closeMenu();
    Alert.alert('Delete Space', `Delete "${selectedSpace?.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('spaces').delete().eq('id', selectedSpace!.id);
        setSpaces(prev => prev.filter(s => s.id !== selectedSpace!.id));
      }},
    ]);
  };

  return (
    <SafeAreaView style={s.container}>

      {/* Header */}
      <View style={s.header}>
        <View style={s.avatarFallback}>
          <Ionicons name="person" size={16} color={Colors.faint} />
        </View>
        <Text style={s.greeting}>
          Hey, <Text style={s.greetingName}>{userName}!</Text>
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Section title */}
        <Text style={s.sectionTitle}>spaces</Text>

        <View style={s.grid}>

          {/* All spaces */}
          <TouchableOpacity
            style={s.allSpacesCard}
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: 'all', name: 'all spaces' } })}>
            <Text style={s.allSpacesText}>all spaces</Text>
          </TouchableOpacity>

          {/* Space cards */}
          {spaces.map(space => (
            <View key={space.id} style={s.spaceCard}>
              <TouchableOpacity style={s.spaceCardMain} activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}>
                <Text style={s.spaceCardText} numberOfLines={1}>{space.name.toLowerCase()}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openMenu(space)} style={s.spaceMenuBtn}>
                <Ionicons name="ellipsis-vertical" size={14} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add a space */}
          <TouchableOpacity style={s.addCard} activeOpacity={0.8} onPress={openCreate}>
            <Ionicons name="add" size={14} color={Colors.text} />
            <Text style={s.addCardText}>add a space</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>

      {/* Create space sheet */}
      <BottomSheet visible={createModal} onClose={() => setCreateModal(false)} sub="spaces" title="new space">
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

        <Text style={formStyles.sectionLabel}>color</Text>
        <View style={s.colorRow}>
          {PASTEL_COLORS.map(c => (
            <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, selectedColor === c && s.colorDotSelected]} onPress={() => setSelectedColor(c)} />
          ))}
        </View>

        <Text style={formStyles.sectionLabel}>icon</Text>
        <View style={s.iconRow}>
          {ICONS.map(i => (
            <TouchableOpacity key={i} style={[s.iconBtn, selectedIcon === i && s.iconBtnSelected]} onPress={() => setSelectedIcon(i)}>
              <Ionicons name={i as any} size={20} color={selectedIcon === i ? Colors.white : Colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={formStyles.sectionLabel}>preview</Text>
        <View style={[s.preview, { backgroundColor: selectedColor }]}>
          <Ionicons name={selectedIcon as any} size={16} color={Colors.text} />
          <Text style={s.previewText}>{spaceName || 'my space'}</Text>
        </View>

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
            {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={formStyles.primaryBtnText}>create space</Text>}
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
          { label: 'delete', onPress: handleDeleteSpace, destructive: true },
        ]}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: PAGE_PAD, paddingTop: 32, paddingBottom: 16 },
  avatarFallback: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.borderMid, justifyContent: 'center', alignItems: 'center' },
  greeting: { fontFamily: 'MuseoModerno_Regular', fontSize: 16, color: Colors.muted },
  greetingName: { fontFamily: 'MuseoModerno_Regular', color: Colors.text },
  scroll: { paddingHorizontal: PAGE_PAD, paddingBottom: 40, paddingTop: 8 },
  sectionTitle: { fontFamily: 'MuseoModerno_Medium', fontSize: 36, color: Colors.text, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // All spaces — dotted border, #ed6a6a text, no bg
  allSpacesCard: {
    width: '100%',
    borderRadius: Radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 3,
    borderStyle: 'dotted',
    borderColor: Colors.expense,
    backgroundColor: 'transparent',
  },
  allSpacesText: { fontFamily: 'ChillaxMedium', fontSize: 15, color: Colors.expense },

  // Space cards — #7fd8cd bg, no icon
  spaceCard: { width: '47%', borderRadius: Radius.pill, paddingVertical: 12, paddingLeft: 16, paddingRight: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#7fd8cd' },
  spaceCardMain: { flex: 1 },
  spaceCardText: { fontFamily: 'ChillaxMedium', fontSize: 15, color: Colors.white },
  spaceMenuBtn: { padding: 6 },

  // Add a space button
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.surface,
  },
  addCardText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.text },

  // Form
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotSelected: { borderWidth: 3, borderColor: Colors.text },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.input, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.borderMid },
  iconBtnSelected: { backgroundColor: Colors.text, borderColor: Colors.text },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.pill, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4 },
  previewText: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  toggleLabel: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.muted },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.input },
  toggleBtnActive: { backgroundColor: Colors.income, borderColor: Colors.income },
  toggleBtnText: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: Colors.faint },
  toggleBtnTextActive: { color: Colors.white },
  badgeRow: { flexDirection: 'row', marginTop: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.pill, paddingVertical: 8, paddingHorizontal: 14, gap: 6 },
  badgeText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.text },
  suggestions: { backgroundColor: Colors.input, borderRadius: Radius.md, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderMid },
  catDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});

