import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { supabase } from '../../../src/lib/supabase';
import { BlurView } from 'expo-blur';

interface Entry {
  id: string;
  note: string | null;
  created_at: string;
  recording_id: string | null;
  recording?: { name: string; type: string } | null;
  firstPhoto?: string;
  photoCount: number;
}

export default function ReceiptsScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  useFocusEffect(useCallback(() => { loadEntries(); }, []));

  const loadEntries = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('receipt_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const full: Entry[] = await Promise.all(data.map(async (e: any) => {
      const { data: photos, count } = await supabase
        .from('receipt_photos')
        .select('storage_path', { count: 'exact' })
        .eq('entry_id', e.id)
        .order('created_at')
        .limit(1);

      let firstPhoto = '';
      if (photos && photos.length > 0) {
        const { data: signed } = await supabase.storage.from('receipts').createSignedUrl(photos[0].storage_path, 3600);
        firstPhoto = signed?.signedUrl ?? '';
      }

      let recording = null;
      if (e.recording_id) {
        const { data: rec } = await supabase.from('recordings').select('name, type').eq('id', e.recording_id).single();
        recording = rec;
      }

      return { ...e, firstPhoto, photoCount: count ?? 0, recording };
    }));

    setEntries(full);
    setLoading(false);
  };

  const createEntry = async () => {
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const note = folderName.trim() || timeStr;
    const { data: entry, error } = await supabase.from('receipt_entries').insert({ user_id: user.id, note }).select().single();
    setCreating(false);
    setAddModal(false);
    setFolderName('');
    if (!error && entry) {
      router.push({ pathname: '/(app)/receipt-detail', params: { receiptId: entry.id } } as any);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const typeColor = (type: string) => type === 'expense' ? '#ed6a6a' : type === 'income' ? '#2ab671' : '#425252';

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>your</Text>
          <Text style={s.headerTitle}>receipts</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setAddModal(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={14} color="#425252" />
          <Text style={s.addBtnText}>add receipt</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#0ccfcf" /></View>
      ) : entries.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="receipt-outline" size={40} color="#e8e8e8" />
          <Text style={s.emptyText}>no receipts yet</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => setAddModal(true)}>
            <Text style={s.emptyBtnText}>add your first receipt</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {entries.map(entry => (
            <TouchableOpacity
              key={entry.id}
              style={s.folderCard}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/(app)/receipt-detail', params: { receiptId: entry.id } } as any)}
            >
              {/* Folder thumbnail */}
              {entry.firstPhoto ? (
                <Image source={{ uri: entry.firstPhoto }} style={s.folderThumb} resizeMode="cover" />
              ) : (
                <View style={s.folderThumbEmpty}>
                  <Ionicons name="image-outline" size={22} color="#c0c0c0" />
                </View>
              )}

              {/* Info */}
              <View style={s.folderInfo}>
                <Text style={s.folderDate}>{formatDate(entry.created_at)}</Text>
                <Text style={s.folderName} numberOfLines={1}>
                  {entry.note ?? formatDate(entry.created_at)}
                </Text>
                <Text style={s.folderCount}>{entry.photoCount} photo{entry.photoCount !== 1 ? 's' : ''}</Text>
                {entry.recording ? (
                  <View style={s.linkedBadge}>
                    <View style={[s.linkedDot, { backgroundColor: typeColor(entry.recording.type) }]} />
                    <Text style={s.linkedText} numberOfLines={1}>{entry.recording.name.toLowerCase()}</Text>
                  </View>
                ) : (
                  <Text style={s.unlinkedText}>no recording linked</Text>
                )}
              </View>

              <Ionicons name="chevron-forward" size={16} color="#c0c0c0" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Add folder modal */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => { setAddModal(false); setFolderName(''); }}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { setAddModal(false); setFolderName(''); }} />
          <View style={s.sheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <View>
                <Text style={s.sheetSub}>receipts</Text>
                <Text style={s.sheetTitle}>new receipt</Text>
              </View>
              <TouchableOpacity onPress={() => { setAddModal(false); setFolderName(''); }}>
                <Ionicons name="close" size={22} color="#929090" />
              </TouchableOpacity>
            </View>
            <View style={s.modalInputBlock}>
              <TextInput
                style={s.modalInput}
                placeholder="folder name (optional)"
                placeholderTextColor="#c0c0c0"
                value={folderName}
                onChangeText={setFolderName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={createEntry}
              />
            </View>
            <Text style={s.modalHint}>leave empty to use current time</Text>
            <View style={[s.modalBtns, { marginTop: 16 }]}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => { setAddModal(false); setFolderName(''); }}>
                <Text style={s.modalCancelText}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalSaveBtn, creating && { opacity: 0.6 }]} onPress={createEntry} disabled={creating}>
                <Text style={s.modalSaveText}>{creating ? 'creating...' : 'create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 32, paddingTop: 52, paddingBottom: 16 },
  headerSub: { fontFamily: 'ChillaxMedium', fontSize: 11, color: '#929090' },
  headerTitle: { fontFamily: 'Avenelle', fontSize: 32, color: '#425252', lineHeight: 36, letterSpacing: -1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fafafa', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e8e8e8' },
  addBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#425252' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontFamily: 'RobotoMono_400Regular', fontSize: 13, color: '#929090' },
  emptyBtn: { backgroundColor: '#425252', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, marginTop: 8 },
  emptyBtnText: { fontFamily: 'RobotoMono_700Bold', fontSize: 12, color: '#fff' },
  list: { paddingHorizontal: 32, paddingBottom: 60, gap: 12 },
  folderCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fafafa', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  folderThumb: { width: 60, height: 60, borderRadius: 10, flexShrink: 0 },
  folderThumbEmpty: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  folderInfo: { flex: 1, gap: 2 },
  folderDate: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090' },
  folderName: { fontFamily: 'ChillaxMedium', fontSize: 14, color: '#425252' },
  folderCount: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#c0c0c0' },
  linkedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  linkedDot: { width: 6, height: 6, borderRadius: 3 },
  linkedText: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#425252', maxWidth: 140 },
  unlinkedText: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#c0c0c0', marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, width: 300, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 10 },
  sheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48 },
  sheetTitle: { fontFamily: 'Avenelle', fontSize: 26, color: '#425252', letterSpacing: -0.5, lineHeight: 30, marginBottom: 4 },
  sheetSub: { fontFamily: 'ChillaxMedium', fontSize: 11, color: '#929090' },
  modalTitle: { fontFamily: 'ChillaxMedium', fontSize: 16, color: '#425252' },
  modalInputBlock: { backgroundColor: '#fafafa', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#f0f0f0' },
  modalInput: { fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252', paddingVertical: 12 },
  modalHint: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#c0c0c0' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  modalCancelText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#8a8a8a' },
  modalSaveBtn: { flex: 1, backgroundColor: '#425252', borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  modalSaveText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#fff' },
});
