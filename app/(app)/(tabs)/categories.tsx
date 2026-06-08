import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import type { Category } from '../../../src/types';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import formStyles from '@/components/ui/formStyles';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';

const PASTEL_COLORS = ['#FFB3B3', '#FFD9B3', '#FFFAB3', '#B3FFB3', '#B3FFE0', '#B3F0FF', '#B3C6FF', '#D9B3FF', '#FFB3F0', '#FFB3C6'];
const SUGGESTED_ICONS = ['fast-food-outline', 'car-outline', 'flash-outline', 'home-outline', 'musical-notes-outline', 'heart-outline', 'cart-outline', 'save-outline', 'airplane-outline', 'briefcase-outline', 'cafe-outline', 'fitness-outline', 'gift-outline', 'school-outline', 'phone-portrait-outline', 'ellipsis-horizontal-outline'];

interface Category { id: string; name: string; color: string; icon: string; is_default: boolean; }

export default function CategoriesScreen() {
  const queryClient = useQueryClient();
  const { userId } = useUser();
  const [modal, setModal] = useState(false);
  const [menuModal, setMenuModal] = useState(false);
  const [selected, setSelected] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PASTEL_COLORS[0]);
  const [icon, setIcon] = useState(SUGGESTED_ICONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories', userId],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select().eq('user_id', userId).order('created_at');
      return (data ?? []) as Category[];
    },
    enabled: !!userId,
  });

  const openAdd = () => { setName(''); setColor(PASTEL_COLORS[0]); setIcon(SUGGESTED_ICONS[0]); setError(''); setModal(true); };

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setLoading(true);
    const { error: err } = await supabase.from('categories').insert({ user_id: userId, name: name.trim(), color, icon, is_default: false });
    if (err) { setError(err.message); setLoading(false); return; }
    queryClient.invalidateQueries({ queryKey: ['categories', userId] });
    setLoading(false); setModal(false);
  };

  const handleDelete = async () => {
    setMenuModal(false);
    await supabase.from('categories').delete().eq('id', selected!.id);
    queryClient.invalidateQueries({ queryKey: ['categories', userId] });
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>categories</Text>
        <Text style={s.subtitle}>organize your recordings.</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.list}>
          {categories.map(cat => (
            <View key={cat.id} style={s.catBtn}>
              <View style={[s.catIcon, { backgroundColor: Colors.cyan + '22' }]}>
                <Ionicons name={cat.icon as any} size={16} color={Colors.cyan} />
              </View>
              <Text style={s.catName}>{cat.name}</Text>
              {cat.is_default && <Text style={s.defaultBadge}>default</Text>}
              <TouchableOpacity onPress={() => { setSelected(cat); setMenuModal(true); }} style={s.menuBtn}>
                <Ionicons name="ellipsis-vertical" size={15} color={Colors.muted} />
              </TouchableOpacity>
            </View>
          ))}
          {categories.length === 0 && (
            <View style={s.emptyBox}>
              <Ionicons name="pricetag-outline" size={32} color={Colors.faint} />
              <Text style={s.emptyText}>no categories yet</Text>
            </View>
          )}
          <TouchableOpacity style={s.addBtn} onPress={openAdd} activeOpacity={0.8}>
            <Ionicons name="add" size={14} color={Colors.muted} />
            <Text style={s.addBtnText}>add a category</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BottomSheet visible={modal} onClose={() => setModal(false)} sub="categories" title="new category">
        {error ? <Text style={formStyles.errorText}>{error}</Text> : null}
        <Text style={formStyles.sectionLabel}>category name</Text>
        <TextInput
          style={formStyles.input}
          placeholder="e.g. Groceries"
          placeholderTextColor={Colors.faint}
          value={name}
          onChangeText={v => { setName(v); setError(''); }}
          autoFocus
        />
        <Text style={formStyles.sectionLabel}>color</Text>
        <View style={s.colorRow}>
          {PASTEL_COLORS.map(c => (
            <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, color === c && s.colorDotSelected]} onPress={() => setColor(c)} />
          ))}
        </View>
        <Text style={formStyles.sectionLabel}>icon</Text>
        <View style={s.iconRow}>
          {SUGGESTED_ICONS.map(i => (
            <TouchableOpacity key={i} style={[s.iconBtn, icon === i && s.iconBtnSelected]} onPress={() => setIcon(i)}>
              <Ionicons name={i as any} size={20} color={icon === i ? Colors.white : Colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={formStyles.sectionLabel}>preview</Text>
        <View style={[s.preview, { backgroundColor: color }]}>
          <Ionicons name={icon as any} size={16} color={Colors.text} />
          <Text style={s.previewText}>{name || 'my category'}</Text>
        </View>
        <View style={formStyles.actions}>
          <TouchableOpacity style={formStyles.cancelBtn} onPress={() => setModal(false)}>
            <Text style={formStyles.cancelBtnText}>cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[formStyles.primaryBtn, (!name.trim() || loading) && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={loading || !name.trim()}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={formStyles.primaryBtnText}>add category</Text>}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      <ConfirmModal
        visible={menuModal}
        onClose={() => setMenuModal(false)}
        title={selected?.name?.toLowerCase() ?? 'category'}
        actions={[
          { label: 'cancel', onPress: () => setMenuModal(false), muted: true },
          { label: 'delete', onPress: handleDelete, destructive: true },
        ]}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { paddingHorizontal: Spacing.page, paddingTop: 32, paddingBottom: 8 },
  title: { fontFamily: Fonts.calSans, fontSize: 36, color: '#425252', marginBottom: 4 },
  subtitle: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.muted },
  scroll: { paddingHorizontal: Spacing.page, paddingBottom: 40, paddingTop: 16 },
  list: { gap: 10 },
  catBtn: {
    borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderWidth: 1,
    borderStyle: 'dashed', borderColor: Colors.borderMid,
  },
  catIcon: { width: 32, height: 32, borderRadius: Radius.pill, justifyContent: 'center', alignItems: 'center' },
  catName: { fontFamily: 'ChillaxMedium', fontSize: 14, color: Colors.text, flex: 1 },
  defaultBadge: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, backgroundColor: Colors.input, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill },
  menuBtn: { padding: 4 },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyText: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.faint },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: Radius.pill, borderWidth: 2, borderStyle: 'dotted',
    borderColor: Colors.cyan, backgroundColor: 'transparent', alignSelf: 'flex-start',
  },
  addBtnText: { fontFamily: 'ChillaxMedium', fontSize: 13, color: Colors.muted },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotSelected: { borderWidth: 3, borderColor: Colors.text },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.input, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.borderMid },
  iconBtnSelected: { backgroundColor: Colors.text, borderColor: Colors.text },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.pill, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4 },
  previewText: { fontFamily: Fonts.sansBold, fontSize: 14, color: Colors.text },
});

