import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import type { Category } from '../../../src/types';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../../src/lib/brand';
import { AppFont } from '../../../src/lib/fonts';

const PASTEL_COLORS = ['#FFB3B3', '#FFD9B3', '#FFFAB3', '#B3FFB3', '#B3FFE0', '#B3F0FF', '#B3C6FF', '#D9B3FF', '#FFB3F0', '#FFB3C6'];
const SUGGESTED_ICONS = ['fast-food-outline', 'car-outline', 'flash-outline', 'home-outline', 'musical-notes-outline', 'heart-outline', 'cart-outline', 'save-outline', 'airplane-outline', 'briefcase-outline', 'cafe-outline', 'fitness-outline', 'gift-outline', 'school-outline', 'phone-portrait-outline', 'ellipsis-horizontal-outline'];

const PREVIEW_LIMIT = 3;

export default function CategoriesScreen() {
  const queryClient = useQueryClient();
  const { userId, defaultCurrency } = useUser();
  const [modal, setModal] = useState(false);
  const [menuModal, setMenuModal] = useState(false);
  const [selected, setSelected] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PASTEL_COLORS[0]);
  const [icon, setIcon] = useState(SUGGESTED_ICONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories', userId],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select().eq('user_id', userId).order('created_at');
      return (data ?? []) as Category[];
    },
    enabled: !!userId,
  });

  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

  const { data: recordings = [] } = useQuery({
    queryKey: ['categories-recordings', userId, from],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('id, name, type, amount, transaction_date, currency, category_id, spaces:space_id(name)')
        .eq('user_id', userId)
        .neq('status', 'voided')
        .neq('is_system_generated', true)
        .gte('transaction_date', from)
        .lte('transaction_date', to)
        .not('category_id', 'is', null)
        .order('transaction_date', { ascending: false });
      return (data ?? []).map((r: any) => ({
        ...r,
        space: Array.isArray(r.spaces) ? r.spaces[0] : r.spaces,
      }));
    },
    enabled: !!userId,
  });

  const grouped = useMemo(() => {
    const map: Record<string, typeof recordings> = {};
    recordings.forEach(r => {
      const cid = r.category_id;
      if (!map[cid]) map[cid] = [];
      map[cid].push(r);
    });
    return map;
  }, [recordings]);

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
          {categories.map(cat => {
            const catRecordings = grouped[cat.id] ?? [];
            const isExpanded = expanded.has(cat.id);
            const visible = isExpanded ? catRecordings : catRecordings.slice(0, PREVIEW_LIMIT);
            const hasMore = catRecordings.length > PREVIEW_LIMIT;
            return (
              <View key={cat.id} style={s.card}>
                {/* Card header */}
                <TouchableOpacity
                  style={s.cardHeader}
                  onPress={() => { setSelected(cat); setMenuModal(true); }}
                  activeOpacity={0.7}
                >

                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName}>{cat.name}</Text>
                    <Text style={s.cardCount}>{catRecordings.length} recording{catRecordings.length !== 1 ? 's' : ''}</Text>
                  </View>

                </TouchableOpacity>

                {/* Recordings list */}
                {visible.map((r, i) => (
                  <View key={r.id} style={[s.recRow, i === visible.length - 1 && !(hasMore && !isExpanded) && s.recRowLast]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.recName} numberOfLines={1}>{r.name}</Text>
                      {r.space?.name && <Text style={s.recSub}>{r.space.name}</Text>}
                    </View>
                    <Text style={s.recAmount}>{r.currency ?? defaultCurrency} {fmt(Number(r.amount))}</Text>
                  </View>
                ))}

                {/* Expand / collapse */}
                {hasMore && (
                  <TouchableOpacity style={s.expandBtn} onPress={() => toggleExpand(cat.id)} activeOpacity={0.7}>
                    <Text style={s.expandText}>{isExpanded ? 'show less' : `show ${catRecordings.length - PREVIEW_LIMIT} more`}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
          {categories.length === 0 && (
            <View style={s.emptyWrap}>
              <Text style={Brand.type.emptyText}>no categories yet</Text>
            </View>
          )}
        </View>

        <Text style={[Brand.type.footer, { marginTop: 32 }]}>managed by LEDGR</Text>
      </ScrollView>



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
        <Text style={s.label}>preview</Text>
        <View style={[s.preview, { backgroundColor: color }]}>
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

  list:      { gap: 12 },
  emptyWrap: { alignItems: 'center', gap: 12, paddingVertical: 48 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 14,
  },
  cardIcon:  { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  cardName:  { fontFamily: AppFont.incMedium, fontSize: 13, color: '#3a3a34', letterSpacing: 0.5 },
  cardCount: { fontFamily: AppFont.regular, fontSize: 10, color: Colors.faint, marginTop: 1 },

  recRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14, paddingLeft: 56,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  recRowLast: { borderBottomWidth: 0 },
  recName: { fontFamily: AppFont.regular, fontSize: 12, color: Colors.text },
  recSub:  { fontFamily: AppFont.regular, fontSize: 10, color: Colors.faint, marginTop: 1 },
  recAmount: { fontFamily: AppFont.bold, fontSize: 12, color: Colors.text },

  expandBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  expandText: { fontFamily: AppFont.regular, fontSize: 11, color: '#888583' },

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
