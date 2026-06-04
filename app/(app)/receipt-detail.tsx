import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated,
  Dimensions, ScrollView, Image, ActivityIndicator, Alert,
  Modal, TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

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
  const [linkModal, setLinkModal] = useState(false);
  const [linkDate, setLinkDate] = useState(new Date().toISOString().split('T')[0]);
  const [linkRecordings, setLinkRecordings] = useState<any[]>([]);
  const [linkSearch, setLinkSearch] = useState('');
  const carouselRef = useRef<any>(null);

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
    load();
  }, []);

  const load = async () => {
    const { data: e } = await supabase.from('receipt_entries').select('*').eq('id', receiptId).single();
    if (e) {
      setEntry(e);
      if (e.recording_id) {
        const { data: rec } = await supabase.from('recordings').select('name, type').eq('id', e.recording_id).single();
        if (rec) setLinkedRecordingName(rec.name);
      }
    }
    const { data: rows } = await supabase.from('receipt_photos').select('id, storage_path').eq('entry_id', receiptId).order('created_at');
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

  const deleteEntry = () => {
    Alert.alert('Delete Folder', 'This will delete all photos. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        for (const p of photos) await supabase.storage.from('receipts').remove([p.path]);
        await supabase.from('receipt_entries').delete().eq('id', receiptId);
        handleBack();
      }},
    ]);
  };

  const deletePhoto = async (photo: Photo) => {
    await supabase.storage.from('receipts').remove([photo.path]);
    await supabase.from('receipt_photos').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    setCarouselIdx(null);
  };

  const openCarousel = (idx: number) => setCarouselIdx(idx);

  const compress = async (uri: string) => {
    const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
    return r.uri;
  };

  const decode = (base64: string): Uint8Array => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
    const bytes = Math.floor(base64.length * 0.75);
    const result = new Uint8Array(bytes);
    let j = 0;
    for (let i = 0; i < base64.length; i += 4) {
      const a = lookup[base64.charCodeAt(i)], b = lookup[base64.charCodeAt(i+1)];
      const c = lookup[base64.charCodeAt(i+2)], d = lookup[base64.charCodeAt(i+3)];
      result[j++] = (a << 2) | (b >> 4);
      result[j++] = ((b & 15) << 4) | (c >> 2);
      result[j++] = ((c & 3) << 6) | d;
    }
    return result;
  };

  const uploadPhoto = async (uri: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const fileName = `${user.id}/${receiptId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    let uploadData: Uint8Array | Blob;
    if (typeof window !== 'undefined' && (uri.startsWith('blob:') || uri.startsWith('data:'))) {
      const res = await fetch(uri); uploadData = await res.blob();
    } else {
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      uploadData = decode(b64);
    }
    const { error } = await supabase.storage.from('receipts').upload(fileName, uploadData, { contentType: 'image/jpeg' });
    if (error) throw error;
    const { data: row } = await supabase.from('receipt_photos').insert({ entry_id: receiptId, storage_path: fileName }).select().single();
    const { data: signed } = await supabase.storage.from('receipts').createSignedUrl(fileName, 3600);
    if (row && signed) setPhotos(prev => [...prev, { id: row.id, url: signed.signedUrl, path: fileName }]);
  };

  const addFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1 });
    if (!result.canceled) {
      for (const asset of result.assets) {
        const compressed = await compress(asset.uri);
        await uploadPhoto(compressed);
      }
    }
  };

  const addFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compress(result.assets[0].uri);
      await uploadPhoto(compressed);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const loadRecordingsForDate = async (date: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('recordings').select('id, name, type, amount, transaction_date').eq('transaction_date', date).eq('user_id', user.id).order('created_at', { ascending: false });
    setLinkRecordings(data ?? []);
  };

  const openLinkModal = () => {
    setLinkDate(new Date().toISOString().split('T')[0]);
    setLinkSearch('');
    loadRecordingsForDate(new Date().toISOString().split('T')[0]);
    setLinkModal(true);
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

  if (loading) return (
    <Animated.View style={[s.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#0ccfcf" />
      </SafeAreaView>
    </Animated.View>
  );

  return (
    <Animated.View style={[s.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={s.inner}>

        {/* Header — same style as recording-detail */}
        <TouchableOpacity onPress={handleBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#8a8a8a" />
        </TouchableOpacity>

        <View style={s.titleBlock}>
          <Text style={s.pageLabel}>receipts</Text>
          <View style={s.titleRow}>
            <TouchableOpacity style={s.titleNameBtn} onPress={() => { setRenameVal(entry?.note ?? ''); setRenameModal(true); }}>
              <Text style={s.pageName} numberOfLines={1}>{(entry?.note ?? 'untitled').toLowerCase()}</Text>
              <Ionicons name="pencil-outline" size={12} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
            <Text style={s.pageDate}>{formatDate(entry?.created_at ?? '')}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.actionBtn} onPress={addFromCamera}>
            <Ionicons name="camera-outline size={15} color=#425252 />
 <Text style={s.actionBtnText}>camera</Text>
 </TouchableOpacity>
 <TouchableOpacity style={s.actionBtn} onPress={addFromGallery}>
 <Ionicons name=images-outline size={15} color=#425252 />
 <Text style={s.actionBtnText}>photos</Text>
 </TouchableOpacity>
 <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={deleteEntry}>
 <Ionicons name=trash-outline size={15} color=#ed6a6a />
 <Text style={[s.actionBtnText, { color: '#ed6a6a' }]}>delete</Text>
 </TouchableOpacity>
 </View>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Section header */}
          <Text style={s.sectionHeader}>photos</Text>

          {/* Photo grid */}
          {photos.length > 0 ? (
            <View style={s.grid}>
              {photos.map((p, i) => (
                <TouchableOpacity key={p.id} onPress={() => openCarousel(i)} activeOpacity={0.85} style={s.cell}>
                  <Image source={{ uri: p.url }} style={s.cellImg} resizeMode="cover" />
                  <TouchableOpacity style={s.cellDelete} onPress={() => deletePhoto(p)}>
                    <Ionicons name="close-circle" size={18} color="#ed6a6a" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={s.emptyGrid}>
              <Ionicons name="images-outline" size={32} color="#e8e8e8" />
              <Text style={s.emptyText}>no photos yet</Text>
            </View>
          )}
          {/* Recording section */}
          <Text style={s.sectionHeader}>recording</Text>
          {entry?.recording_id ? (
            <View style={s.linkedRecordingCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.linkedRecordingName} numberOfLines={1}>{linkedRecordingName.toLowerCase()}</Text>
                <TouchableOpacity onPress={unlink}>
                  <Text style={s.unlinkText}>unlink recording</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: entry.recording_id } } as any)}>
                <Ionicons name="arrow-forward size={16} color=#c0c0c0 />
 </TouchableOpacity>
 </View>
 ) : (
 <View style={s.recordingActions}>
 <TouchableOpacity style={s.makeRecordingBtn} onPress={() => router.push({ pathname: '/(app)/add-recording', params: { from: 'receipt', receiptId, defaultDate: new Date().toISOString().split('T')[0] } } as any)} activeOpacity={0.85}>
 <Ionicons name=add-circle-outline size={16} color=#fff />
 <Text style={s.makeRecordingText}>make a recording</Text>
 </TouchableOpacity>
 <TouchableOpacity style={s.linkExistingBtn} onPress={openLinkModal} activeOpacity={0.85}>
 <Ionicons name=link-outline size={16} color=#425252 />
 <Text style={s.linkExistingText}>link existing</Text>
 </TouchableOpacity>
 </View>
 )}

        </ScrollView>
      </SafeAreaView>

      {/* Carousel - Windows Photo Viewer style */}
      <Modal visible={carouselIdx !== null} transparent animationType="fade onRequestClose={() => setCarouselIdx(null)}>
 <BlurView intensity={60} tint=light style={StyleSheet.absoluteFill}>
 <SafeAreaView style={{ flex: 1 }}>
 {/* Header */}
 <View style={s.carouselHeader}>
 <TouchableOpacity onPress={() => setCarouselIdx(null)} style={s.carouselBtn}>
 <Ionicons name=close size={22} color=#425252 />
 </TouchableOpacity>
 <Text style={s.carouselCount}>{(carouselIdx ?? 0) + 1} / {photos.length}</Text>
 <TouchableOpacity onPress={() => deletePhoto(photos[carouselIdx ?? 0])} style={s.carouselBtn}>
 <Ionicons name=trash-outline size={18} color=#ed6a6a />
 </TouchableOpacity>
 </View>
 {/* Main photo with arrows */}
 <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
 <Image
 source={{ uri: photos[carouselIdx ?? 0]?.url ?? '' }}
 style={{ width: SW - 32, height: SH * 0.55, borderRadius: 16 }}
 resizeMode=contain
 />
 {/* Left arrow */}
 {(carouselIdx ?? 0) > 0 && (
 <TouchableOpacity style={s.arrowLeft} onPress={() => setCarouselIdx(i => (i ?? 1) - 1)}>
 <Ionicons name=chevron-back size={28} color=#425252 />
 </TouchableOpacity>
 )}
 {/* Right arrow */}
 {(carouselIdx ?? 0) < photos.length - 1 && (
 <TouchableOpacity style={s.arrowRight} onPress={() => setCarouselIdx(i => (i ?? 0) + 1)}>
 <Ionicons name=chevron-forward size={28} color=#425252 />
 </TouchableOpacity>
 )}
 </View>
 {/* Thumbnail strip */}
 {photos.length > 1 && (
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbStrip}>
 {photos.map((p, i) => (
 <TouchableOpacity key={p.id} onPress={() => setCarouselIdx(i)} style={[s.thumbItem, i === carouselIdx && s.thumbItemActive]}>
 <Image source={{ uri: p.url }} style={s.thumbImg} resizeMode=cover />
 </TouchableOpacity>
 ))}
 </ScrollView>
 )}
 </SafeAreaView>
 </BlurView>
 </Modal>
      {/* Link to recording modal */}
      <Modal visible={linkModal} transparent animationType="fade onRequestClose={() => setLinkModal(false)}>
 <BlurView intensity={40} tint=light style={StyleSheet.absoluteFill}>
 <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setLinkModal(false)}>
 <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
 <View style={[s.modalBox, { width: 340 }]}>
 <Text style={s.modalTitle}>link to recording</Text>
 {/* Search */}
 <View style={s.modalInputBlock}>
 <TextInput style={s.modalInput} placeholder=search by name... placeholderTextColor=#c0c0c0 value={linkSearch} onChangeText={setLinkSearch} />
 </View>
 {/* Date picker */}
 <View style={s.linkDateRow}>
 <TouchableOpacity onPress={() => { const d = new Date(linkDate); d.setDate(d.getDate()-1); const s2 = d.toISOString().split('T')[0]; setLinkDate(s2); loadRecordingsForDate(s2); }}>
 <Ionicons name=chevron-back size={18} color=#929090 />
 </TouchableOpacity>
 <Text style={s.linkDateText}>{new Date(linkDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
 <TouchableOpacity onPress={() => { const d = new Date(linkDate); d.setDate(d.getDate()+1); const s2 = d.toISOString().split('T')[0]; setLinkDate(s2); loadRecordingsForDate(s2); }}>
 <Ionicons name=chevron-forward size={18} color=#929090 />
 </TouchableOpacity>
 </View>
 {/* Recording list */}
 <ScrollView style={{ maxHeight: 220, width: '100%' }} showsVerticalScrollIndicator={false}>
 {filteredRecordings.length === 0 ? (
 <Text style={s.linkEmpty}>no recordings on this date</Text>
 ) : (
 filteredRecordings.map((rec: any) => {
 const hasReceipt = false; // could check but keep simple
 return (
 <TouchableOpacity key={rec.id} style={[s.linkRecItem]} onPress={() => linkToRecording(rec)}>
 <View style={{ flex: 1 }}>
 <Text style={s.linkRecName} numberOfLines={1}>{rec.name.toLowerCase()}</Text>
 <Text style={s.linkRecMeta}>{rec.type} \u00b7 {Number(rec.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
 </View>
 <Ionicons name=link-outline size={14} color=#0ccfcf />
 </TouchableOpacity>
 );
 })
 )}
 </ScrollView>
 <TouchableOpacity style={s.modalCancelBtn} onPress={() => setLinkModal(false)}>
 <Text style={s.modalCancelText}>cancel</Text>
 </TouchableOpacity>
 </View>
 </TouchableOpacity>
 </TouchableOpacity>
 </BlurView>
 </Modal>
      {/* Rename modal */}
      <Modal visible={renameModal} transparent animationType="fade" onRequestClose={() => setRenameModal(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setRenameModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={s.modalBox}>
                <Text style={s.modalTitle}>rename folder</Text>
                <View style={s.modalInputBlock}>
                  <TextInput style={s.modalInput} placeholder="folder name" placeholderTextColor="#c0c0c0" value={renameVal} onChangeText={setRenameVal} autoFocus returnKeyType="done" onSubmitEditing={rename} />
                </View>
                <View style={s.modalBtns}>
                  <TouchableOpacity style={s.modalCancelBtn} onPress={() => setRenameModal(false)}>
                    <Text style={s.modalCancelText}>cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.modalSaveBtn} onPress={rename}>
                    <Text style={s.modalSaveText}>save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  backBtn: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 4 },
  titleBlock: { paddingHorizontal: 32, marginBottom: 16 },
  pageLabel: { fontFamily: 'ChillaxMedium', fontSize: 11, color: '#929090', marginBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleNameBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  pageName: { fontFamily: 'Avenelle', fontSize: 26, color: '#425252', letterSpacing: -0.5, lineHeight: 30, flex: 1 },
  pageDate: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090' },
  actionRow: { flexDirection: 'row', gap: 8, marginHorizontal: 32, marginBottom: 20 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#fafafa' },
  actionBtnDanger: { borderColor: '#fde8e8', backgroundColor: '#fff8f8' },
  actionBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#425252' },
  scroll: { paddingHorizontal: 32, paddingBottom: 60 },
  sectionHeader: { fontFamily: 'ChillaxMedium', fontSize: 14, color: '#0ccfcf', letterSpacing: -0.3, marginBottom: 12, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, marginBottom: 24 },
  cell: { width: CELL, height: CELL, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f5f5f5' },
  cellImg: { width: '100%', height: '100%' },
  cellDelete: { position: 'absolute', top: 3, right: 3 },
  emptyGrid: { alignItems: 'center', paddingVertical: 32, gap: 8, marginBottom: 24 },
  emptyText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#c0c0c0' },
  makeRecordingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#425252', borderRadius: 999, paddingVertical: 13 },
  makeRecordingText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#fff' },
  carouselHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  carouselBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  carouselCount: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#425252' },
  arrowLeft: { position: 'absolute', left: 8, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 999, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  arrowRight: { position: 'absolute', right: 8, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 999, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  thumbStrip: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  thumbItem: { width: 56, height: 56, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbItemActive: { borderColor: '#0ccfcf' },
  thumbImg: { width: '100%', height: '100%' },
  linkedRecordingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fafafa', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  linkedRecordingName: { fontFamily: 'Avenelle', fontSize: 16, color: '#425252', letterSpacing: -0.5 },
  unlinkText: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#ed6a6a', marginTop: 3 },
  recordingActions: { gap: 8 },
  linkExistingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fafafa', borderRadius: 999, paddingVertical: 13, borderWidth: 1, borderColor: '#e8e8e8' },
  linkExistingText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#425252' },
  linkDateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, width: '100%' },
  linkDateText: { fontFamily: 'Avenelle', fontSize: 15, color: '#425252' },
  linkRecItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  linkRecName: { fontFamily: 'RobotoMono_700Bold', fontSize: 12, color: '#425252' },
  linkRecMeta: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', marginTop: 2 },
  linkEmpty: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#c0c0c0', textAlign: 'center', paddingVertical: 16 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, width: 300, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontFamily: 'ChillaxMedium', fontSize: 16, color: '#425252' },
  modalInputBlock: { backgroundColor: '#fafafa', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#f0f0f0' },
  modalInput: { fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252', paddingVertical: 12 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  modalCancelText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#8a8a8a' },
  modalSaveBtn: { flex: 1, backgroundColor: '#425252', borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  modalSaveText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#fff' },
});
