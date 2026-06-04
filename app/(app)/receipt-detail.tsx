import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated,
  Dimensions, ScrollView, Image, FlatList, ActivityIndicator, Alert,
  Modal, TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { BlurView } from 'expo-blur';

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
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselIdx, setCarouselIdx] = useState<number | null>(null);
  const [renameModal, setRenameModal] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const carouselRef = useRef<any>(null);

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
    load();
  }, []);

  const load = async () => {
    const { data: e } = await supabase.from('receipt_entries').select('*').eq('id', receiptId).single();
    if (e) setEntry(e);
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

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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

        {/* Action buttons — same as recording-detail actionRow */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.actionBtn} onPress={() => router.push({ pathname: '/(app)/capture-receipt', params: { receiptId } } as any)}>
            <Ionicons name="camera-outline" size={15} color="#425252" />
            <Text style={s.actionBtnText}>add from camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => router.push({ pathname: '/(app)/capture-receipt', params: { receiptId, galleryOnly: '1' } } as any)}>
            <Ionicons name="images-outline" size={15} color="#425252" />
            <Text style={s.actionBtnText}>add from photos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={deleteEntry}>
            <Ionicons name="trash-outline" size={15} color="#ed6a6a" />
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
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={s.emptyGrid}>
              <Ionicons name="images-outline" size={32} color="#e8e8e8" />
              <Text style={s.emptyText}>no photos yet</Text>
            </View>
          )}

          {/* Make recording */}
          {!entry?.recording_id && (
            <>
              <Text style={s.sectionHeader}>recording</Text>
              <TouchableOpacity
                style={s.makeRecordingBtn}
                onPress={() => router.push({ pathname: '/(app)/add-recording', params: { from: 'receipt', receiptId, defaultDate: new Date().toISOString().split('T')[0] } } as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={16} color="#fff" />
                <Text style={s.makeRecordingText}>make a recording</Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </SafeAreaView>

      {/* Carousel */}
      <Modal visible={carouselIdx !== null} transparent animationType="fade" onRequestClose={() => setCarouselIdx(null)}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.carouselHeader}>
              <TouchableOpacity onPress={() => setCarouselIdx(null)} style={s.carouselBtn}>
                <Ionicons name="close" size={22} color="#425252" />
              </TouchableOpacity>
              <Text style={s.carouselCount}>{(carouselIdx ?? 0) + 1} / {photos.length}</Text>
              <TouchableOpacity onPress={() => deletePhoto(photos[carouselIdx ?? 0])} style={s.carouselBtn}>
                <Ionicons name="trash-outline" size={18} color="#ed6a6a" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <ScrollView
                ref={carouselRef as any}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentOffset={{ x: (carouselIdx ?? 0) * SW, y: 0 }}
                onMomentumScrollEnd={e => setCarouselIdx(Math.round(e.nativeEvent.contentOffset.x / SW))}
              >
                {photos.map(item => (
                  <View key={item.id} style={{ width: SW, height: SH * 0.6, justifyContent: 'center', alignItems: 'center' }}>
                    <Image source={{ uri: item.url }} style={{ width: SW - 32, height: SH * 0.55, borderRadius: 16 }} resizeMode="contain" />
                  </View>
                ))}
              </ScrollView>
            </View>
            {photos.length > 1 && (
              <View style={s.dots}>
                {photos.map((_, i) => <View key={i} style={[s.dot, i === carouselIdx && s.dotActive]} />)}
              </View>
            )}
          </SafeAreaView>
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
  emptyGrid: { alignItems: 'center', paddingVertical: 32, gap: 8, marginBottom: 24 },
  emptyText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#c0c0c0' },
  makeRecordingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#425252', borderRadius: 999, paddingVertical: 13 },
  makeRecordingText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#fff' },
  carouselHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  carouselBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  carouselCount: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#425252' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingBottom: 24 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#c0c0c0' },
  dotActive: { backgroundColor: '#0ccfcf', width: 14 },
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
