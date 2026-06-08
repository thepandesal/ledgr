import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const [addModal, setAddModal] = useState(false);
  const [addStep, setAddStep] = useState<'name' | 'photos'>('name');
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['receipts'] });
  }, []));

  const { data: entries = [], isLoading: loading } = useQuery({
    queryKey: ['receipts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('receipt_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!data) return [];
      const full: Entry[] = await Promise.all(data.map(async (e: any) => {
        const { data: photos, count } = await supabase.from('receipt_photos').select('storage_path, url', { count: 'exact' }).eq('entry_id', e.id).order('created_at').limit(1);
        let firstPhoto = '';
        if (photos && photos.length > 0) firstPhoto = photos[0].url ?? '';
        let recording = null;
        if (e.recording_id) {
          const { data: rec } = await supabase.from('recordings').select('name, type').eq('id', e.recording_id).single();
          recording = rec;
        }
        return { ...e, firstPhoto, photoCount: count ?? 0, recording };
      }));
      return full;
    },
  });

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
    queryClient.invalidateQueries({ queryKey: ['receipts'] });
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
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.pageTitle}>receipts</Text>
          <Text style={s.pageSubtitle}>your paper trail, digitized.</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setAddModal(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={14} color={Colors.muted} />
          <Text style={s.addBtnText}>add receipt</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.cyan} /></View>
      ) : entries.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="receipt-outline" size={40} color={Colors.borderMid} />
          <Text style={s.emptyText}>no receipts yet</Text>
          <TouchableOpacity style={s.emptyActionBtn} onPress={() => setAddModal(true)}>
            <Text style={s.emptyActionBtnText}>add your first receipt</Text>
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
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: Spacing.page, paddingTop: 32, paddingBottom: 16 },
  pageTitle: { fontFamily: Fonts.calSans, fontSize: 36, color: '#425252', marginBottom: 4 },
  pageSubtitle: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.muted },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: Radius.pill, borderWidth: 2, borderStyle: 'dotted',
    borderColor: Colors.cyan, backgroundColor: 'transparent',
  },
  addBtnText: { fontFamily: 'ChillaxMedium', fontSize: 12, color: Colors.muted },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.muted },
  emptyActionBtn: { borderRadius: Radius.pill, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 2, borderStyle: 'dotted', borderColor: Colors.cyan, marginTop: 8 },
  emptyActionBtnText: { fontFamily: 'ChillaxMedium', fontSize: 12, color: Colors.muted },
  list: { paddingHorizontal: Spacing.page, paddingBottom: 60, gap: 12, paddingTop: 8 },
  folderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: Radius.pill,
    paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderMid,
  },
  folderThumb: { width: 48, height: 48, borderRadius: Radius.md, flexShrink: 0 },
  folderThumbEmpty: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.input, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  folderInfo: { flex: 1, gap: 2 },
  folderDate: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  folderName: { fontFamily: 'ChillaxMedium', fontSize: 14, color: Colors.text },
  folderCount: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint },
  linkedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  linkedDot: { width: 6, height: 6, borderRadius: 3 },
  linkedText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.text, maxWidth: 140 },
  unlinkedText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint, marginTop: 2 },
});

