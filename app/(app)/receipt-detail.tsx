import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated,
  Dimensions, ScrollView, Image, ActivityIndicator, Alert, Modal, TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import formStyles from '@/components/ui/formStyles';
import pageStyles from '@/components/ui/pageStyles';
import accountStyles from '@/components/ui/accountStyles';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { compressImage, uploadReceiptPhoto } from '../../src/lib/receiptUpload';

const { width: SW, height: SH } = Dimensions.get('window');
const COLS = 5;
const GAP = 6;
const CELL = (SW - 64 - GAP * (COLS - 1)) / COLS;

interface Photo { id: string; url: string; path: string; }

export default function ReceiptDetailScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(SW)).current;

  const [entry, setEntry] = useState<any>(null);
  const [linkedRecordingName, setLinkedRecordingName] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselIdx, setCarouselIdx] = useState<number | null>(null);
  const [renameModal, setRenameModal] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [deleteEntryConfirm, setDeleteEntryConfirm] = useState(false);
  const [deletePhotoConfirm, setDeletePhotoConfirm] = useState<Photo | null>(null);
  const [linkModal, setLinkModal] = useState(false);
  const [linkDate, setLinkDate] = useState(new Date().toISOString().split('T')[0]);
  const [linkRecordings, setLinkRecordings] = useState<any[]>([]);
  const [linkSearch, setLinkSearch] = useState('');

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
    load();
  }, []);

  const load = async () => {
    const { data: e } = await supabase.from('receipt_entries').select('*').eq('id', receiptId).single();
    if (e) {
      setEntry(e);
      if (e.recording_id) {
        const { data: rec } = await supabase.from('recordings').select('name').eq('id', e.recording_id).single();
        if (rec) setLinkedRecordingName(rec.name);
      }
    }
    const { data: rows } = await supabase.from('receipt_photos').select('id, storage_path, url').eq('entry_id', receiptId).order('created_at');
    if (rows) {
      const withUrls = await Promise.all(rows.map(async (p: any) => {
        const { data } = await supabase.storage.from('receipts').createSignedUrl(p.storage_path, 3600);
        return { id: p.id, url: data?.signedUrl ?? '', path: p.storage_path };
      }));
      setPhotos(withUrls);
    }
    setLoading(false);
  };

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: SW, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  const rename = async () => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const newName = renameVal.trim() || timeStr;
    await supabase.from('receipt_entries').update({ note: newName }).eq('id', receiptId);
    setEntry((prev: any) => ({ ...prev, note: newName }));
    setRenameModal(false);
  };

  const deleteEntry = async () => {
    for (const p of photos) await supabase.storage.from('receipts').remove([p.path]);
    await supabase.from('receipt_photos').delete().eq('entry_id', receiptId);
    const recordingId = entry?.recording_id;
    await supabase.from('receipt_entries').delete().eq('id', receiptId);
    if (recordingId) {
      router.replace({ pathname: '/(app)/recording-detail', params: { recordingId } } as any);
    } else {
      handleBack();
    }
  };

  const deletePhoto = async (photo: Photo) => {
    await supabase.storage.from('receipts').remove([photo.path]);
    await supabase.from('receipt_photos').delete().eq('id', photo.id);
    const remaining = photos.filter(p => p.id !== photo.id);
    setPhotos(remaining);
    setCarouselIdx(null);
    setDeletePhotoConfirm(null);
    // If no photos left, delete the whole entry and go back to recording if linked
    if (remaining.length === 0) {
      const recordingId = entry?.recording_id;
      await supabase.from('receipt_entries').delete().eq('id', receiptId);
      if (recordingId) {
        router.replace({ pathname: '/(app)/recording-detail', params: { recordingId } } as any);
      } else {
        handleBack();
      }
    }
  };

  const addFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1 });
    if (!result.canceled) {
      for (const asset of result.assets) {
        const compressed = await compressImage(asset.uri);
        const uploaded = await uploadReceiptPhoto(compressed, receiptId);
        if (uploaded) setPhotos(prev => [...prev, uploaded]);
      }
    }
  };

  const addFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressImage(result.assets[0].uri);
      const uploaded = await uploadReceiptPhoto(compressed, receiptId);
      if (uploaded) setPhotos(prev => [...prev, uploaded]);
    }
  };

  const loadRecordingsForDate = async (date: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('recordings').select('id, name, type, amount').eq('transaction_date', date).eq('user_id', user.id).order('created_at', { ascending: false });
    setLinkRecordings(data ?? []);
  };

  const openLinkModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setLinkDate(today);
    setLinkSearch('');
    loadRecordingsForDate(today);
    setLinkModal(true);
  };

  const changeDate = (delta: number) => {
    const d = new Date(linkDate);
    d.setDate(d.getDate() + delta);
    const newDate = d.toISOString().split('T')[0];
    setLinkDate(newDate);
    loadRecordingsForDate(newDate);
  };

  const linkToRecording = async (rec: any) => {
    await supabase.from('receipt_entries').update({ recording_id: rec.id }).eq('id', receiptId);
    setEntry((prev: any) => ({ ...prev, recording_id: rec.id }));
    setLinkedRecordingName(rec.name);
    setLinkModal(false);
  };

  const unlink = async () => {
    await supabase.from('receipt_entries').update({ recording_id: null }).eq('id', receiptId);
    setEntry((prev: any) => ({ ...prev, recording_id: null }));
    setLinkedRecordingName('');
  };

  const filteredRecordings = linkSearch.trim()
    ? linkRecordings.filter(r => r.name.toLowerCase().includes(linkSearch.toLowerCase()))
    : linkRecordings;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const typeColor = (type: string) => type === 'expense' ? Colors.expense : type === 'income' ? Colors.income : Colors.text;

  if (loading) return (
    <Animated.View style={[pageStyles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.cyan} />
      </SafeAreaView>
    </Animated.View>
  );

  return (
    <Animated.View style={[pageStyles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={pageStyles.inner}>

        <TouchableOpacity onPress={handleBack} style={pageStyles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.muted} />
        </TouchableOpacity>

        <View style={[pageStyles.titleBlock, { paddingHorizontal: Spacing.page }]}>
          <Text style={pageStyles.pageLabel}>receipts</Text>
          <View style={s.titleRow}>
            <TouchableOpacity style={s.titleNameBtn} onPress={() => { setRenameVal(entry?.note ?? ''); setRenameModal(true); }}>
              <Text style={pageStyles.pageName} numberOfLines={1}>{(entry?.note ?? 'untitled').toLowerCase()}</Text>
              <Ionicons name="pencil-outline" size={12} color={Colors.faint} />
            </TouchableOpacity>
            <Text style={s.pageDate}>{formatDate(entry?.created_at ?? '')}</Text>
          </View>
        </View>

        <View style={[pageStyles.actionRow, { marginHorizontal: Spacing.page }]}>
          <TouchableOpacity style={pageStyles.actionBtn} onPress={addFromCamera}>
            <Ionicons name="camera-outline" size={15} color={Colors.text} />
            <Text style={pageStyles.actionBtnText}>camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={pageStyles.actionBtn} onPress={addFromGallery}>
            <Ionicons name="images-outline" size={15} color={Colors.text} />
            <Text style={pageStyles.actionBtnText}>photos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[pageStyles.actionBtn, pageStyles.actionBtnDanger]} onPress={() => setDeleteEntryConfirm(true)}>
            <Ionicons name="trash-outline" size={15} color={Colors.danger} />
            <Text style={[pageStyles.actionBtnText, { color: Colors.danger }]}>delete</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={pageStyles.scroll} showsVerticalScrollIndicator={false}>

          <Text style={pageStyles.sectionHeader}>photos</Text>

          {photos.length > 0 ? (
            <View style={s.grid}>
              {photos.map((p, i) => (
                <View key={p.id} style={s.cell}>
                  <TouchableOpacity onPress={() => setCarouselIdx(i)} activeOpacity={0.85} style={{ flex: 1 }}>
                    <Image source={{ uri: p.url }} style={s.cellImg} resizeMode="cover" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.cellDelete} onPress={() => setDeletePhotoConfirm(p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={[pageStyles.emptyBox, { borderWidth: 0, backgroundColor: 'transparent', marginBottom: 24 }]}>
              <Ionicons name="images-outline" size={32} color={Colors.borderMid} />
              <Text style={pageStyles.emptyText}>no photos yet</Text>
            </View>
          )}

          <Text style={pageStyles.sectionHeader}>recording</Text>

          {entry?.recording_id ? (
            <View style={s.linkedCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.linkedName} numberOfLines={1}>{linkedRecordingName.toLowerCase()}</Text>
                <TouchableOpacity onPress={unlink}>
                  <Text style={s.unlinkText}>unlink recording</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: entry.recording_id } } as any)}>
                <Ionicons name="arrow-forward" size={16} color={Colors.faint} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.recordingActions}>
              <TouchableOpacity style={s.makeRecordingBtn} onPress={() => router.push({ pathname: '/(app)/add-recording', params: { from: 'receipt', receiptId, defaultDate: new Date().toISOString().split('T')[0] } } as any)} activeOpacity={0.85}>
                <Ionicons name="add-circle-outline" size={16} color={Colors.white} />
                <Text style={s.makeRecordingText}>make a recording</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.linkBtn} onPress={openLinkModal} activeOpacity={0.85}>
                <Ionicons name="link-outline" size={16} color={Colors.text} />
                <Text style={s.linkBtnText}>link existing recording</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>

      {/* Carousel */}
      <Modal visible={carouselIdx !== null} transparent animationType="fade" onRequestClose={() => setCarouselIdx(null)}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.carouselHeader}>
              <TouchableOpacity onPress={() => setCarouselIdx(null)} style={s.carouselBtn}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
              <Text style={s.carouselCount}>{(carouselIdx ?? 0) + 1} / {photos.length}</Text>
              <TouchableOpacity onPress={() => deletePhoto(photos[carouselIdx ?? 0])} style={s.carouselBtn}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Image source={{ uri: photos[carouselIdx ?? 0]?.url ?? '' }} style={{ width: SW - 32, height: SH * 0.55, borderRadius: 16 }} resizeMode="contain" />
              {(carouselIdx ?? 0) > 0 && (
                <TouchableOpacity style={s.arrowLeft} onPress={() => setCarouselIdx(prev => (prev ?? 1) - 1)}>
                  <Ionicons name="chevron-back" size={28} color={Colors.text} />
                </TouchableOpacity>
              )}
              {(carouselIdx ?? 0) < photos.length - 1 && (
                <TouchableOpacity style={s.arrowRight} onPress={() => setCarouselIdx(prev => (prev ?? 0) + 1)}>
                  <Ionicons name="chevron-forward" size={28} color={Colors.text} />
                </TouchableOpacity>
              )}
            </View>
            {photos.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbStrip}>
                {photos.map((p, i) => (
                  <TouchableOpacity key={p.id} onPress={() => setCarouselIdx(i)} style={[s.thumbItem, i === carouselIdx && s.thumbItemActive]}>
                    <Image source={{ uri: p.url }} style={s.thumbImg} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </SafeAreaView>
        </BlurView>
      </Modal>

      {/* Link modal */}
      <BottomSheet visible={linkModal} onClose={() => setLinkModal(false)} sub="receipt" title="link to recording">
        <TextInput style={formStyles.searchInput} placeholder="search by name..." placeholderTextColor={Colors.faint} value={linkSearch} onChangeText={setLinkSearch} />
        <View style={s.linkDateRow}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={s.carouselBtn}>
            <Ionicons name="chevron-back" size={18} color={Colors.muted} />
          </TouchableOpacity>
          <Text style={s.linkDateText}>{new Date(linkDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
          <TouchableOpacity onPress={() => changeDate(1)} style={s.carouselBtn}>
            <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
          </TouchableOpacity>
        </View>
        {filteredRecordings.length === 0 ? (
          <Text style={formStyles.listEmpty}>no recordings on this date</Text>
        ) : (
          filteredRecordings.map((rec: any) => (
            <TouchableOpacity key={rec.id} style={formStyles.listItem} onPress={() => linkToRecording(rec)}>
              <View style={[s.linkTypeDot, { backgroundColor: typeColor(rec.type) }]} />
              <View style={{ flex: 1 }}>
                <Text style={formStyles.listItemText} numberOfLines={1}>{rec.name.toLowerCase()}</Text>
                <Text style={formStyles.listItemSub}>{rec.type} · {Number(rec.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              </View>
              <Ionicons name="link-outline" size={14} color={Colors.cyan} />
            </TouchableOpacity>
          ))
        )}
        <View style={formStyles.actions}>
          <TouchableOpacity style={formStyles.cancelBtn} onPress={() => setLinkModal(false)}>
            <Text style={formStyles.cancelBtnText}>cancel</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Delete entry confirm */}
      <ConfirmModal
        visible={deleteEntryConfirm}
        onClose={() => setDeleteEntryConfirm(false)}
        title="delete folder"
        message="this will delete all photos. cannot be undone."
        actions={[
          { label: 'cancel', onPress: () => setDeleteEntryConfirm(false), muted: true },
          { label: 'delete', onPress: deleteEntry, destructive: true },
        ]}
      />

      {/* Delete photo confirm */}
      <ConfirmModal
        visible={!!deletePhotoConfirm}
        onClose={() => setDeletePhotoConfirm(null)}
        title="delete photo"
        message="this photo will be permanently deleted."
        actions={[
          { label: 'cancel', onPress: () => setDeletePhotoConfirm(null), muted: true },
          { label: 'delete', onPress: () => deletePhoto(deletePhotoConfirm!), destructive: true },
        ]}
      />

      {/* Rename modal */}
      <BottomSheet visible={renameModal} onClose={() => setRenameModal(false)} sub="receipt" title="rename folder">
        <TextInput
          style={formStyles.input}
          placeholder="folder name"
          placeholderTextColor="#c0c0c0"
          value={renameVal}
          onChangeText={setRenameVal}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={rename}
        />
        <View style={formStyles.actions}>
          <TouchableOpacity style={formStyles.cancelBtn} onPress={() => setRenameModal(false)}>
            <Text style={formStyles.cancelBtnText}>cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={formStyles.primaryBtn} onPress={rename}>
            <Text style={formStyles.primaryBtnText}>save</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // Title row
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleNameBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  pageDate: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  // Photo grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: 24 },
  cell: { width: CELL, height: CELL, borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: Colors.input, position: 'relative' },
  cellImg: { width: '100%', height: '100%' },
  cellDelete: { position: 'absolute', top: 3, right: 3 },
  // Linked recording card
  linkedCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  linkedName: { fontFamily: Fonts.display, fontSize: 16, color: Colors.text, letterSpacing: -0.5 },
  unlinkText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.danger, marginTop: 3 },
  recordingActions: { gap: 10, marginBottom: 16 },
  makeRecordingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.text, borderRadius: Radius.pill, paddingVertical: 13 },
  makeRecordingText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.white },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingVertical: 13, borderWidth: 1, borderColor: Colors.borderMid },
  linkBtnText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  // Carousel
  carouselHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  carouselBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  carouselCount: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.text },
  arrowLeft: { position: 'absolute', left: 8, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: Radius.pill, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  arrowRight: { position: 'absolute', right: 8, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: Radius.pill, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  thumbStrip: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  thumbItem: { width: 56, height: 56, borderRadius: Radius.sm, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbItemActive: { borderColor: Colors.cyan },
  thumbImg: { width: '100%', height: '100%' },
  // Link modal
  linkDateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingVertical: 4 },
  linkDateText: { fontFamily: Fonts.display, fontSize: 15, color: Colors.text },
  linkTypeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
});

