import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, RefreshControl, TextInput,
} from 'react-native';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { AppFont } from '../../src/lib/fonts';
import { DC } from '../../src/lib/design';
import PageHeader from '@/components/ui/PageHeader';
import BottomSheet from '@/components/ui/BottomSheet';
import GooeyLoader from '@/components/ui/GooeyLoader';
import { BlurView } from 'expo-blur';

const TEAL = '#9cd7d2';

interface Props { onClose: () => void; }

export default function ContactsPanel({ onClose }: Props) {
  const { userId } = useUser();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const { data: contacts = [], isLoading } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['contacts', userId],
    queryFn: async () => {
      const { data } = await supabase.from('contacts').select('id, name').eq('user_id', userId).order('name');
      return data ?? [];
    },
    enabled: !!userId,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
    setRefreshing(false);
  };

  const handleDelete = async () => {
    if (!selected) return;
    await supabase.from('contacts').delete().eq('id', selected.id);
    queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
    setSelected(null);
  };

  const handleRename = async () => {
    if (!selected || !renameValue.trim()) return;
    setRenaming(true);
    await supabase.from('contacts').update({ name: renameValue.trim() }).eq('id', selected.id);
    queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
    setRenaming(false);
    setShowRename(false);
    setSelected(null);
  };

  const filtered = contacts.filter(c =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={st.root}>
      <PageHeader title="Contacts" onBack={onClose} titleColor={TEAL} />

      <View style={st.searchWrap}>
        <TextInput
          style={st.searchInput}
          placeholder="search contacts..."
          placeholderTextColor={Colors.faint}
          value={search}
          onChangeText={setSearch}
        />

      </View>

      {isLoading ? (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}><GooeyLoader /></BlurView>
      ) : (
        <ScrollView
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={st.sectionTitle}>Manual Contacts</Text>
          <Text style={st.sectionDesc}>people added via split bill or manually</Text>

          {filtered.length === 0 ? (
            <View style={st.empty}>
              <Text style={st.emptyText}>{contacts.length === 0 ? 'no contacts yet' : 'no contacts match your search'}</Text>
            </View>
          ) : (
            <View style={st.list}>
              {filtered.map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  style={[st.row, i === filtered.length - 1 && st.rowLast]}
                  activeOpacity={0.7}
                  onPress={() => setSelected(c)}
                >
                  <View style={st.avatar}>
                    <Text style={st.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={st.rowName}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Actions sheet */}
      <BottomSheet visible={!!selected && !showRename} onClose={() => setSelected(null)} title={selected?.name?.toLowerCase() ?? 'contact'}>
        <TouchableOpacity
          style={st.actionRow}
          activeOpacity={0.7}
          onPress={() => { setRenameValue(selected?.name ?? ''); setShowRename(true); }}
        >
          <Text style={st.actionText}>Rename</Text>
          <Text style={st.actionSub}>change this contact's name</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.actionRow, { borderBottomWidth: 0 }]} onPress={handleDelete} activeOpacity={0.7}>
          <Text style={[st.actionText, { color: '#FF5757' }]}>Remove</Text>
          <Text style={st.actionSub}>remove from your contacts list</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Rename sheet */}
      <BottomSheet visible={showRename} onClose={() => setShowRename(false)} title="rename contact">
        <TextInput
          style={st.renameInput}
          value={renameValue}
          onChangeText={setRenameValue}
          placeholder="contact name"
          placeholderTextColor={Colors.faint}
          autoFocus
        />
        <TouchableOpacity
          style={[st.saveBtn, (!renameValue.trim() || renaming) && { opacity: 0.4 }]}
          onPress={handleRename}
          disabled={!renameValue.trim() || renaming}
          activeOpacity={0.8}
        >
          <Text style={st.saveBtnText}>{renaming ? 'saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </BottomSheet>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: DC.pagePadding, paddingBottom: 80 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: DC.pagePadding, marginVertical: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 99, borderWidth: 1, borderColor: DC.cardBorder, backgroundColor: DC.cardBg },
  searchInput: { flex: 1, fontFamily: AppFont.regular, fontSize: 13, color: DC.pageText, padding: 0 },
  sectionTitle: { fontFamily: AppFont.bold, fontSize: 13, color: '#111111', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 2 },
  sectionDesc:  { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginBottom: 8 },
  list:    { gap: 0 },
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  rowLast: { borderBottomWidth: 0 },
  avatar:  { width: 34, height: 34, borderRadius: 17, backgroundColor: TEAL + '33', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: AppFont.bold, fontSize: 13, color: TEAL },
  rowName: { fontFamily: AppFont.regular, fontSize: 14, color: '#111111', flex: 1 },
  empty:     { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },
  actionRow:  { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  actionText: { fontFamily: AppFont.semiBold, fontSize: 15, color: '#111111' },
  actionSub:  { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginTop: 2 },
  renameInput: { fontFamily: AppFont.regular, fontSize: 16, color: DC.pageText, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 16 },
  saveBtn:     { backgroundColor: DC.btnBg, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center' as const },
  saveBtnText: { fontFamily: AppFont.semiBold, fontSize: 15, color: DC.btnText },
  modalHint:     { fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted, marginBottom: 16 },
  deleteBtn:     { backgroundColor: '#FF575718', borderRadius: 99, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FF575766' },
  deleteBtnText: { fontFamily: AppFont.semiBold, fontSize: 14, color: '#FF5757' },
});
