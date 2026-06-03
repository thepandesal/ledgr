import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Modal, TextInput, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';

const PASTEL_COLORS = [
  '#FFB3B3', '#FFD9B3', '#FFFAB3', '#B3FFB3', '#B3FFE0',
  '#B3F0FF', '#B3C6FF', '#D9B3FF', '#FFB3F0', '#FFB3C6',
];

const ICONS = [
  'home-outline', 'briefcase-outline', 'airplane-outline', 'cart-outline',
  'heart-outline', 'star-outline', 'leaf-outline', 'cafe-outline',
  'car-outline', 'musical-notes-outline',
];

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
  const menuFade = useRef(new Animated.Value(0)).current;

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

  const openMenu = (space: Space) => {
    setSelectedSpace(space); setMenuModal(true);
    Animated.timing(menuFade, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };

  const closeMenu = (cb?: () => void) => {
    Animated.timing(menuFade, { toValue: 0, duration: 150, useNativeDriver: false }).start(() => { setMenuModal(false); cb?.(); });
  };

  const handleDeleteSpace = () => {
    closeMenu(() => {
      Alert.alert('Delete Space', `Delete "${selectedSpace?.name}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('spaces').delete().eq('id', selectedSpace!.id);
          setSpaces(prev => prev.filter(s => s.id !== selectedSpace!.id));
        }},
      ]);
    });
  };

  const firstName = userName.split(' ')[0];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.titleBlock}>
          <Text style={styles.greetingLabel}>hey, {firstName.toLowerCase()}!</Text>
          <Text style={styles.pageTitle}>your spaces</Text>
        </View>

        {/* Spaces section header */}
        <Text style={styles.sectionHeader}>spaces</Text>

        {/* Space cards */}
        <View style={styles.spaceList}>
          {spaces.map(space => (
            <TouchableOpacity
              key={space.id}
              style={styles.spaceCard}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/(app)/space-detail', params: { spaceId: space.id, name: space.name, color: space.color } })}
            >
              <View style={[styles.spaceIconWrap, { backgroundColor: space.color + '33' }]}>
                <Ionicons name={space.icon as any} size={20} color={space.color} />
              </View>
              <Text style={styles.spaceCardName} numberOfLines={1}>{space.name.toLowerCase()}</Text>
              <TouchableOpacity onPress={() => openMenu(space)} style={styles.spaceMenuBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="ellipsis-horizontal" size={16} color="#929090" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add space button */}
        <TouchableOpacity style={styles.addSpaceBtn} onPress={openCreate} activeOpacity={0.8}>
          <Ionicons name="add" size={14} color="#425252" />
          <Text style={styles.addSpaceBtnText}>add a space</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Create space modal */}
      <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>new space</Text>
                <TouchableOpacity onPress={() => setCreateModal(false)}>
                  <Ionicons name="close" size={22} color="#b0b0b0" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>name</Text>
              <TextInput style={[styles.input, error ? styles.inputError : null]} placeholder="e.g. Household"
                placeholderTextColor="#b0b0b0" value={spaceName}
                onChangeText={v => { setSpaceName(v.slice(0, 15)); setError(''); }} maxLength={15} autoFocus />
              <Text style={styles.charCount}>{spaceName.length}/15</Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Text style={styles.label}>color</Text>
              <View style={styles.colorRow}>
                {PASTEL_COLORS.map(c => (
                  <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }, selectedColor === c && styles.colorDotSelected]} onPress={() => setSelectedColor(c)} />
                ))}
              </View>

              <Text style={styles.label}>icon</Text>
              <View style={styles.iconRow}>
                {ICONS.map(i => (
                  <TouchableOpacity key={i} style={[styles.iconBtn, selectedIcon === i && styles.iconBtnSelected]} onPress={() => setSelectedIcon(i)}>
                    <Ionicons name={i as any} size={20} color={selectedIcon === i ? '#ffffff' : '#8a8a8a'} />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>preview</Text>
              <View style={[styles.preview, { backgroundColor: selectedColor + '33' }]}>
                <Ionicons name={selectedIcon as any} size={18} color={selectedColor} />
                <Text style={[styles.previewText, { color: selectedColor }]}>{spaceName.toLowerCase() || 'my space'}</Text>
              </View>

              <Text style={styles.label}>default category</Text>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>use a default category?</Text>
                <TouchableOpacity style={[styles.toggleBtn, useDefaultCategory && styles.toggleBtnActive]}
                  onPress={() => { setUseDefaultCategory(!useDefaultCategory); setSelectedCategory(null); setCategoryInput(''); }}>
                  <Text style={[styles.toggleBtnText, useDefaultCategory && styles.toggleBtnTextActive]}>
                    {useDefaultCategory ? 'yes' : 'no'}
                  </Text>
                </TouchableOpacity>
              </View>

              {useDefaultCategory && (
                selectedCategory ? (
                  <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: selectedCategory.color }]}>
                      <Ionicons name={selectedCategory.icon as any} size={14} color="#1c1d1d" />
                      <Text style={styles.badgeText}>{selectedCategory.name}</Text>
                      <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                        <Ionicons name="close" size={14} color="#1c1d1d" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="search categories..."
                      placeholderTextColor="#b0b0b0" value={categoryInput} onChangeText={handleCategoryInput} />
                    {categorySuggestions.length > 0 && (
                      <View style={styles.suggestions}>
                        {categorySuggestions.map(c => (
                          <TouchableOpacity key={c.id} style={styles.suggestion} onPress={() => { setSelectedCategory(c); setCategoryInput(''); setCategorySuggestions([]); }}>
                            <View style={[styles.catDot, { backgroundColor: c.color }]}>
                              <Ionicons name={c.icon as any} size={12} color="#1c1d1d" />
                            </View>
                            <Text style={styles.suggestionText}>{c.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {categoryInput.trim() !== '' && categorySuggestions.length === 0 && (
                      <Text style={styles.noResults}>no categories found</Text>
                    )}
                  </>
                )
              )}

              <TouchableOpacity style={[styles.createBtn, !spaceName.trim() && styles.createBtnDisabled]}
                onPress={handleCreate} disabled={loading || !spaceName.trim()} activeOpacity={0.8}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>create space</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Space menu modal */}
      <Modal visible={menuModal} transparent animationType="none" onRequestClose={() => closeMenu()}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => closeMenu()}>
            <Animated.View style={[styles.menuContent, { opacity: menuFade }]}>
              <TouchableOpacity style={styles.menuItem} onPress={() => closeMenu()}>
                <Ionicons name="pencil-outline" size={16} color="#425252" />
                <Text style={styles.menuItemText}>edit</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={handleDeleteSpace}>
                <Ionicons name="trash-outline" size={16} color="#ed6a6a" />
                <Text style={[styles.menuItemText, { color: '#ed6a6a' }]}>delete</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { paddingHorizontal: 32, paddingBottom: 60, paddingTop: 52 },
  titleBlock: { marginBottom: 20 },
  greetingLabel: { fontFamily: 'ChillaxMedium', fontSize: 11, color: '#929090', marginBottom: 2 },
  pageTitle: { fontFamily: 'Avenelle', fontSize: 32, color: '#425252', lineHeight: 36, letterSpacing: -1, textShadowColor: 'rgba(0,0,0,0.12)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  sectionHeader: { fontFamily: 'ChillaxMedium', fontSize: 15, color: '#0ccfcf', letterSpacing: -0.5, marginBottom: 12 },
  spaceList: { gap: 10, marginBottom: 16 },
  spaceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fafafa', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  spaceIconWrap: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  spaceCardName: { flex: 1, fontFamily: 'Avenelle', fontSize: 18, color: '#425252', letterSpacing: -0.5 },
  spaceMenuBtn: { padding: 4 },
  addSpaceBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', backgroundColor: '#ffffff', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: '#929090', shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  addSpaceBtnText: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#425252' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  modalScroll: { justifyContent: 'flex-end', flexGrow: 1 },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'ChillaxMedium', fontSize: 18, color: '#425252' },
  label: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontFamily: 'DMSans_400Regular', fontSize: 16, color: '#1c1d1d', borderWidth: 1, borderColor: '#e8e8e8' },
  inputError: { borderColor: '#ed6a6a' },
  charCount: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#b0b0b0', textAlign: 'right', marginTop: 4 },
  errorText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#ed6a6a', marginTop: 4 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotSelected: { borderWidth: 3, borderColor: '#1c1d1d' },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e8e8e8' },
  iconBtnSelected: { backgroundColor: '#425252', borderColor: '#425252' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4 },
  previewText: { fontFamily: 'Avenelle', fontSize: 18, letterSpacing: -0.5 },
  createBtn: { backgroundColor: '#425252', borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { fontFamily: 'RobotoMono_700Bold', fontSize: 14, color: '#ffffff' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  toggleLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#8a8a8a' },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#f5f5f5' },
  toggleBtnActive: { backgroundColor: '#0ccfcf', borderColor: '#0ccfcf' },
  toggleBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#b0b0b0' },
  toggleBtnTextActive: { color: '#ffffff' },
  badgeRow: { flexDirection: 'row', marginTop: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, gap: 6 },
  badgeText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#1c1d1d' },
  suggestions: { backgroundColor: '#f5f5f5', borderRadius: 12, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#e8e8e8' },
  suggestion: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e8e8e8', flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestionText: { fontFamily: 'RobotoMono_400Regular', fontSize: 13, color: '#1c1d1d' },
  catDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  noResults: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#b0b0b0', marginTop: 8, textAlign: 'center' },
  menuOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  menuContent: { backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  menuItemText: { fontFamily: 'RobotoMono_400Regular', fontSize: 14, color: '#425252' },
  menuDivider: { height: 1, backgroundColor: '#f0f0f0' },
});
