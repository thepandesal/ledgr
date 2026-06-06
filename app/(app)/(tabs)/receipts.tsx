import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { supabase } from '../../../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import BottomSheet from '@/components/ui/BottomSheet';
import formStyles from '@/components/ui/formStyles';
import accountStyles from '@/components/ui/accountStyles';
import pageStyles from '@/components/ui/pageStyles';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
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

  const typeColor = (type: string) => type === 'expense' ? Colors.expense : type === 'income' ? Colors.income : Colors.text;

  return (
    <SafeAreaView style={pageStyles.container}>
      <View style={s.header}>
        <View>
          <Text style={pageStyles.pageLabel}>your</Text>
          <Text style={[pageStyles.pageName, { fontSize: 32, lineHeight: 36, letterSpacing: -1 }]}>receipts</Text>
        </View>
        <TouchableOpacity style={pageStyles.actionBtn} onPress={() => setAddModal(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={14} color={Colors.text} />
          <Text style={pageStyles.actionBtnText}>add receipt</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.cyan} /></View>
      ) : entries.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="receipt-outline" size={40} color={Colors.borderMid} />
          <Text style={pageStyles.emptyText}>no receipts yet</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => setAddModal(true)}>
            <Text style={s.emptyBtnText}>add your first receipt</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {entries.map(entry => (
            <TouchableOpacity key={entry.id} style={s.folderCard} activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/(app)/receipt-detail', params: { receiptId: entry.id } } as any)}>
              {entry.firstPhoto ? (
                <Image source={{ uri: entry.firstPhoto }} style={s.folderThumb} resizeMode="cover" />
              ) : (
                <View style={s.folderThumbEmpty}>
                  <Ionicons name="image-outline" size={22} color={Colors.faint} />
                </View>
              )}
              <View style={s.folderInfo}>
                <Text style={s.folderDate}>{formatDate(entry.created_at)}</Text>
                <Text style={s.folderName} numberOfLines={1}>{entry.note ?? formatDate(entry.created_at)}</Text>
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
              <Ionicons name="chevron-forward" size={16} color={Colors.faint} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <BottomSheet visible={addModal} onClose={closeAddModal} sub="receipts" title={addStep === 'name' ? 'new receipt' : 'add photos'}>
        {addStep === 'name' ? (
          <>
            <TextInput style={formStyles.input} placeholder="folder name (optional)" placeholderTextColor={Colors.faint} value={folderName} onChangeText={setFolderName} autoFocus returnKeyType="done" onSubmitEditing={createEntry} />
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
            <View style={accountStyles.photoButtons}>
              <TouchableOpacity style={accountStyles.photoBtn} onPress={addFromCamera}>
                <Ionicons name="camera-outline" size={28} color={Colors.cyan} />
                <Text style={accountStyles.photoBtnText}>camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={accountStyles.photoBtn} onPress={addFromGallery}>
                <Ionicons name="images-outline" size={28} color={Colors.text} />
                <Text style={[accountStyles.photoBtnText, { color: Colors.text }]}>gallery</Text>
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
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: Spacing.page, paddingTop: 52, paddingBottom: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyBtn: { backgroundColor: Colors.text, borderRadius: Radius.pill, paddingVertical: 10, paddingHorizontal: 20, marginTop: 8 },
  emptyBtnText: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.white },
  list: { paddingHorizontal: Spacing.page, paddingBottom: 60, gap: 12 },
  folderCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12, borderWidth: 1, borderColor: Colors.border },
  folderThumb: { width: 60, height: 60, borderRadius: Radius.md, flexShrink: 0 },
  folderThumbEmpty: { width: 60, height: 60, borderRadius: Radius.md, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  folderInfo: { flex: 1, gap: 2 },
  folderDate: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  folderName: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.text },
  folderCount: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint },
  linkedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  linkedDot: { width: 6, height: 6, borderRadius: 3 },
  linkedText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.text, maxWidth: 140 },
  unlinkedText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint, marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 20, width: 300, gap: 10 },
});

