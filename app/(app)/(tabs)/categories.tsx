import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import AnimatedIcon from '@/components/ui/AnimatedIcon';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import type { Category } from '../../../src/types';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../../src/lib/brand';

const PASTEL_COLORS = ['#FFB3B3', '#FFD9B3', '#FFFAB3', '#B3FFB3', '#B3FFE0', '#B3F0FF', '#B3C6FF', '#D9B3FF', '#FFB3F0', '#FFB3C6'];
const SUGGESTED_ICONS = ['fast-food-outline', 'car-outline', 'flash-outline', 'home-outline', 'musical-notes-outline', 'heart-outline', 'cart-outline', 'save-outline', 'airplane-outline', 'briefcase-outline', 'cafe-outline', 'fitness-outline', 'gift-outline', 'school-outline', 'phone-portrait-outline', 'ellipsis-horizontal-outline'];

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
    if (selected?.name === 'Loans') return;
    await supabase.from('categories').delete().eq('id', selected!.id);
    queryClient.invalidateQueries({ queryKey: ['categories', userId] });
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.list}>
          {categories.map(cat => (
            <View key={cat.id} style={s.catRow}>
              <View style={[s.catIcon, { backgroundColor: Brand.color.headerBg }]}>
                {cat.icon === 'cart-outline'
                  ? <AnimatedIcon set="svg-spinners" icon="3-dots-bounce" size={20} color={Brand.color.headerText} />
                  : <Ionicons name={cat.icon as any} size={16} color={Brand.color.headerText} />}
              </View>
              <Text style={s.catName}>{cat.name}</Text>
              {cat.is_default && <Text style={s.defaultBadge}>default</Text>}
              <TouchableOpacity onPress={() => { setSelected(cat); setMenuModal(true); }} style={s.menuBtn}>
                <Ionicons name="ellipsis-vertical" size={15} color={Colors.muted} />
              </TouchableOpacity>
            </View>
          ))}
          {categories.length === 0 && (
            <View style={s.emptyWrap}>
              <Ionicons name="pricetag-outline" size={32} color={Colors.faint} />
              <Text style={Brand.type.emptyText}>no categories yet</Text>
            </View>
          )}
        </View>

        <Text style={[Brand.type.footer, { marginTop: 32 }]}>managed by LEDGR</Text>
      </ScrollView>

      <TouchableOpacity style={s.fab} onPress={openAdd} activeOpacity={0.8}>
        <Ionicons name="add" size={22} color={Brand.color.accentText} />
      </TouchableOpacity>

      <BottomSheet visible={modal} onClose={() => setModal(false)} title="new category">
        {error ? <Text style={s.error}>{error}</Text> : null}
        <Text style={s.label}>category name</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Groceries"
          placeholderTextColor={Colors.faint}
          value={name}
          onChangeText={v => { setName(v); setError(''); }}
          autoFocus
        />
        <Text style={s.label}>color</Text>
        <View style={s.colorRow}>
          {PASTEL_COLORS.map(c => (
            <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, color === c && s.colorDotSelected]} onPress={() => setColor(c)} />
          ))}
        </View>
        <Text style={s.label}>icon</Text>
        <View style={s.iconRow}>
          {SUGGESTED_ICONS.map(i => (
            <TouchableOpacity key={i} style={[s.iconBtn, icon === i && s.iconBtnSelected]} onPress={() => setIcon(i)}>
              <Ionicons name={i as any} size={20} color={icon === i ? Brand.color.accentText : Colors.muted} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.label}>preview</Text>
        <View style={[s.preview, { backgroundColor: color }]}>
          <Ionicons name={icon as any} size={16} color={Colors.text} />
          <Text style={s.previewText}>{name || 'my category'}</Text>
        </View>
        <TouchableOpacity
          style={[s.saveBtn, (!name.trim() || loading) && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={loading || !name.trim()}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color={Brand.color.accentText} /> : <Text style={s.saveBtnText}>add category</Text>}
        </TouchableOpacity>
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
  scroll:    { paddingHorizontal: Spacing.page, paddingTop: 20, paddingBottom: 80 },

  list:    { gap: Brand.spacing.gap },
  emptyWrap: { alignItems: 'center', gap: 12, paddingVertical: 48 },

  catRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: Brand.spacing.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  catIcon:  { width: 32, height: 32, borderRadius: Brand.radius.avatar, justifyContent: 'center', alignItems: 'center' },
  catName:  { ...Brand.type.cardTitle, flex: 1 },
  defaultBadge: { ...Brand.type.cardMeta, backgroundColor: Colors.surface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Brand.radius.btn },
  menuBtn:  { padding: 4 },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Brand.color.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  error:    { ...Brand.type.cardMeta, color: Colors.expense, marginBottom: 8 },
  label:    { ...Brand.type.modalLabel, marginBottom: 6, marginTop: 14 },
  input:    { ...Brand.type.modalInput, backgroundColor: Colors.white, borderRadius: Brand.radius.input, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },
  saveBtn:  { backgroundColor: Brand.color.accent, borderRadius: Brand.radius.btn, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { ...Brand.type.modalBtn },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotSelected: { borderWidth: 3, borderColor: Colors.text },
  iconRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  iconBtn:  { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.input, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.borderMid },
  iconBtnSelected: { backgroundColor: Brand.color.accent, borderColor: Brand.color.accent },
  preview:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Brand.radius.btn, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4 },
  previewText: { ...Brand.type.cardTitle },
});
