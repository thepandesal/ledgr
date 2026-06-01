import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  Modal, TextInput, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';

const PASTEL_COLORS = [
  '#FFB3B3', '#FFD9B3', '#FFFAB3', '#B3FFB3', '#B3FFE0',
  '#B3F0FF', '#B3C6FF', '#D9B3FF', '#FFB3F0', '#FFB3C6',
];

const SUGGESTED_ICONS = [
  'fast-food-outline', 'car-outline', 'flash-outline', 'home-outline',
  'musical-notes-outline', 'heart-outline', 'cart-outline', 'save-outline',
  'airplane-outline', 'briefcase-outline', 'cafe-outline', 'fitness-outline',
  'gift-outline', 'school-outline', 'phone-portrait-outline', 'ellipsis-horizontal-outline',
];

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_default: boolean;
}

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [userId, setUserId] = useState('');
  const [modal, setModal] = useState(false);
  const [menuModal, setMenuModal] = useState(false);
  const [selected, setSelected] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PASTEL_COLORS[0]);
  const [icon, setIcon] = useState(SUGGESTED_ICONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const menuFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); load(user.id); }
    });
  }, []);

  const load = async (uid: string) => {
    const { data } = await supabase.from('categories').select().eq('user_id', uid).order('created_at');
    if (data) setCategories(data);
  };

  const openAdd = () => {
    setName(''); setColor(PASTEL_COLORS[0]); setIcon(SUGGESTED_ICONS[0]); setError('');
    setModal(true);
  };

  const openMenu = (cat: Category) => {
    setSelected(cat);
    setMenuModal(true);
    Animated.timing(menuFade, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };

  const closeMenu = (cb?: () => void) => {
    Animated.timing(menuFade, { toValue: 0, duration: 150, useNativeDriver: false }).start(() => {
      setMenuModal(false);
      cb?.();
    });
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setLoading(true);
    const { error: err } = await supabase.from('categories').insert({
      user_id: userId, name: name.trim(), color, icon, is_default: false,
    });
    if (err) { setError(err.message); setLoading(false); return; }
    await load(userId);
    setLoading(false);
    setModal(false);
  };

  const handleDelete = () => {
    closeMenu(() => {
      Alert.alert(
        'Delete Category',
        'This will also remove this category from any spaces using it as default. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete', style: 'destructive', onPress: async () => {
              await supabase.from('categories').delete().eq('id', selected!.id);
              await load(userId);
            },
          },
        ]
      );
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.list}>
          {categories.map(cat => (
            <View key={cat.id} style={[styles.catBtn, { backgroundColor: cat.color }]}>
              <Ionicons name={cat.icon as any} size={16} color="#1c1d1d" />
              <Text style={styles.catName}>{cat.name}</Text>
              {cat.is_default && <Text style={styles.defaultBadge}>default</Text>}
              <TouchableOpacity onPress={() => openMenu(cat)} style={styles.menuBtn}>
                <Ionicons name="ellipsis-vertical" size={15} color="#1c1d1d" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color="rgba(255,255,255,0.4)" />
            <Text style={styles.addBtnText}>add a category</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>new category</Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Text style={styles.label}>category name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Groceries"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={name}
                onChangeText={v => { setName(v); setError(''); }}
                autoFocus
              />

              <Text style={styles.label}>color</Text>
              <View style={styles.colorRow}>
                {PASTEL_COLORS.map(c => (
                  <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSelected]} onPress={() => setColor(c)} />
                ))}
              </View>

              <Text style={styles.label}>icon</Text>
              <View style={styles.iconRow}>
                {SUGGESTED_ICONS.map(i => (
                  <TouchableOpacity key={i} style={[styles.iconBtn, icon === i && styles.iconBtnSelected]} onPress={() => setIcon(i)}>
                    <Ionicons name={i as any} size={20} color={icon === i ? '#1c1d1d' : 'rgba(255,255,255,0.6)'} />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>preview</Text>
              <View style={[styles.preview, { backgroundColor: color }]}>
                <Ionicons name={icon as any} size={16} color="#1c1d1d" />
                <Text style={styles.previewText}>{name || 'my category'}</Text>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={loading || !name.trim()}
                activeOpacity={0.8}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>add category</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Menu Modal */}
      <Modal visible={menuModal} transparent animationType="none" onRequestClose={() => closeMenu()}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => closeMenu()}>
          <Animated.View style={[styles.menuContent, { opacity: menuFade }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color="#e74c3c" />
              <Text style={[styles.menuItemText, { color: '#e74c3c' }]}>delete</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c1d1d' },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 22, color: '#ffffff' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  list: { gap: 10 },
  catBtn: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  catName: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#1c1d1d', flex: 1 },
  defaultBadge: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: 'rgba(0,0,0,0.4)', backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  menuBtn: { padding: 4 },
  addBtn: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a2b2b', borderWidth: 1, borderColor: '#3a3b3b', gap: 6 },
  addBtnText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#242525', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'DMSans_700Bold', fontSize: 18, color: '#ffffff' },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16 },
  input: { backgroundColor: '#2a2b2b', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#ffffff', borderWidth: 1, borderColor: '#3a3b3b' },
  error: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#e74c3c', marginBottom: 4 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotSelected: { borderWidth: 3, borderColor: '#ffffff' },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#2a2b2b', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3a3b3b' },
  iconBtnSelected: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4 },
  previewText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#1c1d1d' },
  saveBtn: { backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 20, marginBottom: 10 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#ffffff' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  menuContent: { backgroundColor: '#2a2b2b', borderRadius: 16, overflow: 'hidden', minWidth: 160 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  menuItemText: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#ffffff' },
});
