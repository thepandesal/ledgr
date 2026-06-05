import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { supabase } from '../../../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import BottomSheet from '@/components/ui/BottomSheet';
import formStyles from '@/components/ui/formStyles';
import { compressImage, uploadReceiptPhoto } from '../../../src/lib/receiptUpload';

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
  const [addStep, setAddStep] = useState<'name' | 'photos'>('name');
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

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
    if (!error && entry) {
      setActiveEntryId(entry.id);
      setAddStep('photos');
    }
  };

  const closeAddModal = () => {
    setAddModal(false);
    setAddStep('name');
    setFolderName('');
    setActiveEntryId(null);
    loadEntries();
  };

  const addFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0] && activeEntryId) {
      const compressed = await compressImage(result.assets[0].uri);
      await uploadReceiptPhoto(compressed, activeEntryId);
    }
  };

  const addFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1 });
    if (!result.canceled && activeEntryId) {
      for (const asset of result.assets) {
        const compressed = await compressImage(asset.uri);
        await uploadReceiptPhoto(compressed, activeEntryId);
      }
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

      <BottomSheet visible={addModal} onClose={closeAddModal} sub="receipts" title={addStep === 'name' ? 'new receipt' : 'add photos'}>
        {addStep === 'name' ? (
          <>
            <TextInput
              style={formStyles.input}
              placeholder="folder name (optional)"
              placeholderTextColor="#c0c0c0"
              value={folderName}
              onChangeText={setFolderName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={createEntry}
            />
            <Text style={formStyles.hintMuted}>leave empty to use current time</Text>
            <View style={formStyles.actions}>
              <TouchableOpacity style={formStyles.cancelBtn} onPress={closeAddModal}>
                <Text style={formStyles.cancelBtnText}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[formStyles.primaryBtn, creating && { opacity: 0.6 }]} onPress={createEntry} disabled={creating}>
                <Text style={formStyles.primaryBtnText}>{creating ? 'creating...' : 'create'}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={s.photoButtons}>
              <TouchableOpacity style={s.photoBtn} onPress={addFromCamera}>
                <Ionicons name="camera-outline" size={28} color="#0ccfcf" />
                <Text style={s.photoBtnText}>camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.photoBtn} onPress={addFromGallery}>
                <Ionicons name="images-outline" size={28} color="#425252" />
                <Text style={[s.photoBtnText, { color: '#425252' }]}>gallery</Text>
              </TouchableOpacity>
            </View>
            <View style={formStyles.actions}>
              <TouchableOpacity style={formStyles.primaryBtn} onPress={closeAddModal}>
                <Text style={formStyles.primaryBtnText}>done</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </BottomSheet>
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
  photoButtons: { flexDirection: 'row', gap: 12, marginVertical: 16 },
  photoBtn: { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: '#f0f0f0', borderStyle: 'dashed', paddingVertical: 28, alignItems: 'center', gap: 8, backgroundColor: '#fafafa' },
  photoBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#0ccfcf' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, width: 300, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 10 },
});
