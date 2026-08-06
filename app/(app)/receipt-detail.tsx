import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated,
  Dimensions, ScrollView, Image, ActivityIndicator, Alert, Modal, TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { useScreenAnim } from '@/components/ui/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import TopHeader from '@/components/ui/TopHeader';
import { Colors, Fonts, Radius } from '@/components/ui/theme';
import { DC } from '../../src/lib/design';
import { Brand } from '../../src/lib/brand';
import { compressImage, uploadReceiptPhoto } from '../../src/lib/receiptUpload';

const { width: SW, height: SH } = Dimensions.get('window');
const COLS = 3;
const GAP = 8;
const CELL = (SW - DC.pagePadding * 2 - GAP * (COLS - 1)) / COLS;

interface Photo { id: string; url: string; path: string; }

export default function ReceiptDetailScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  const router = useRouter();
  const { slideAnim, handleBack } = useScreenAnim();
  const insets = useSafeAreaInsets();

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
  const [uploading, setUploading] = useState(false);
  const [actionsModal, setActionsModal] = useState(false);

  useEffect(() => { load(); }, []);

  useFocusEffect(useCallback(() => {
    if (!uploading) load();
  }, [receiptId, uploading]));

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
    if (rows) setPhotos(rows.map((p: any) => ({ id: p.id, url: p.url ?? '', path: p.storage_path })));
    setLoading(false);
  };

  const rename = async () => {
    const newName = renameVal.trim() || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
      setUploading(true);
      try {
        for (const asset of result.assets) {
          const compressed = await compressImage(asset.uri);
          const uploaded = await uploadReceiptPhoto(compressed, receiptId);
          if (uploaded) setPhotos(prev => [...prev, uploaded]);
        }
      } catch (e: any) {
        if (e?.message === 'RECEIPT_LIMIT_REACHED') Alert.alert('monthly limit reached', 'you\'ve used all 10 free receipt photo uploads this month.');
      } finally { setUploading(false); }
    }
  };

  const addFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      try {
        const compressed = await compressImage(result.assets[0].uri);
        const uploaded = await uploadReceiptPhoto(compressed, receiptId);
        if (uploaded) setPhotos(prev => [...prev, uploaded]);
      } catch (e: any) {
        if (e?.message === 'RECEIPT_LIMIT_REACHED') Alert.alert('monthly limit reached', 'you\'ve used all 10 free receipt photo uploads this month.');
      } finally { setUploading(false); }
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

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const typeColor = (type: string) => type === 'expense' ? Colors.expense : type === 'income' ? Colors.income : DC.pageText;
  const formatDate = (d: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) return (
    <Animated.View style={[{ flex: 1, backgroundColor: '#ffffff' }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={DC.headerBlueBg} />
      </SafeAreaView>
    </Animated.View>
  );

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: '#ffffff' }, { transform: [{ translateX: slideAnim }] }]}>
      <TopHeader
        title="Receipt"
        subtitle={(entry?.note ?? 'untitled').toLowerCase()}
        centered
        variant="blue"
        topInset={insets.top}
        onBack={handleBack}
        right={
          <TouchableOpacity
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setActionsModal(true)}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#ffffff', fontSize: 16, letterSpacing: 2, lineHeight: 18 }}>···</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: DC.pagePadding, paddingTop: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* Date + add buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted }}>
            {formatDate(entry?.created_at ?? '')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={{ height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: DC.viewBtnBg, alignItems: 'center', justifyContent: 'center' }}
              onPress={addFromCamera}
              activeOpacity={0.8}
            >
              <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 11, color: DC.viewBtnText }}>camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: DC.viewBtnBg, alignItems: 'center', justifyContent: 'center' }}
              onPress={addFromGallery}
              activeOpacity={0.8}
            >
              <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 11, color: DC.viewBtnText }}>
                {uploading ? 'uploading...' : 'gallery'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Photos section */}
        <Text style={s.sectionLabel}>photos</Text>
        {photos.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 12, color: DC.pageTextMuted }}>no photos yet — tap camera or gallery above</Text>
          </View>
        ) : (
          <View style={s.grid}>
            {photos.map((p, i) => (
              <TouchableOpacity key={p.id} onPress={() => setCarouselIdx(i)} activeOpacity={0.85} style={s.cell}>
                <Image source={{ uri: p.url }} style={s.cellImg} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recording section */}
        <Text style={[s.sectionLabel, { marginTop: 8 }]}>recording</Text>
        {entry?.recording_id ? (
          <View style={s.linkedCard}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 13, color: DC.pageText }} numberOfLines={1}>{linkedRecordingName}</Text>
              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageTextMuted, marginTop: 1 }}>linked recording</Text>
            </View>
            <TouchableOpacity
              onPress={unlink}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder }}
              activeOpacity={0.7}
            >
              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted }}>unlink</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => router.push({ pathname: '/(app)/add-recording', params: { from: 'receipt', receiptId, defaultDate: new Date().toISOString().split('T')[0] } } as any)}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>make a recording</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryBtn} onPress={openLinkModal} activeOpacity={0.85}>
              <Text style={s.secondaryBtnText}>link existing recording</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* Photo carousel */}
      <Modal visible={carouselIdx !== null} transparent animationType="fade" onRequestClose={() => setCarouselIdx(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f1a19' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
            <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 15, color: '#ffffff' }}>receipt</Text>
            {photos.length > 1 && (
              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{(carouselIdx ?? 0) + 1} / {photos.length}</Text>
            )}
            <TouchableOpacity
              onPress={() => setCarouselIdx(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#ffffff', fontSize: 16, lineHeight: 18 }}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Photo */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            <TouchableOpacity
              onPress={() => setCarouselIdx(i => Math.max(0, (i ?? 0) - 1))}
              disabled={(carouselIdx ?? 0) === 0}
              style={{ position: 'absolute', left: 12, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', opacity: (carouselIdx ?? 0) === 0 ? 0.2 : 1 }}
              activeOpacity={0.7}
            >
              <Text style={{ color: '#ffffff', fontSize: 20, lineHeight: 22 }}>‹</Text>
            </TouchableOpacity>
            <Image
              source={{ uri: photos[carouselIdx ?? 0]?.url ?? '' }}
              style={{ width: SW - 32, height: SH * 0.65, borderRadius: 16 }}
              resizeMode="contain"
            />
            <TouchableOpacity
              onPress={() => setCarouselIdx(i => Math.min(photos.length - 1, (i ?? 0) + 1))}
              disabled={(carouselIdx ?? 0) === photos.length - 1}
              style={{ position: 'absolute', right: 12, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', opacity: (carouselIdx ?? 0) === photos.length - 1 ? 0.2 : 1 }}
              activeOpacity={0.7}
            >
              <Text style={{ color: '#ffffff', fontSize: 20, lineHeight: 22 }}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Dots + thumbnails */}
          <View style={{ paddingBottom: 16, paddingTop: 12, gap: 12 }}>
            {photos.length > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                {photos.map((_, i) => (
                  <TouchableOpacity key={i} onPress={() => setCarouselIdx(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <View style={{ width: i === carouselIdx ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === carouselIdx ? Brand.color.accent : 'rgba(255,255,255,0.2)' }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {photos.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                {photos.map((p, i) => (
                  <TouchableOpacity key={p.id} onPress={() => setCarouselIdx(i)} activeOpacity={0.8}>
                    <Image
                      source={{ uri: p.url }}
                      style={{ width: 56, height: 56, borderRadius: 10, borderWidth: i === carouselIdx ? 2 : 0, borderColor: Brand.color.accent, opacity: i === carouselIdx ? 1 : 0.45 }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {/* Delete button */}
            <TouchableOpacity
              onPress={() => setDeletePhotoConfirm(photos[carouselIdx ?? 0])}
              style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.expense }}>delete photo</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Actions bottom sheet */}
      <BottomSheet visible={actionsModal} onClose={() => setActionsModal(false)} title="actions">
        <TouchableOpacity
          style={s.actionRow}
          onPress={() => { setActionsModal(false); setRenameVal(entry?.note ?? ''); setRenameModal(true); }}
          activeOpacity={0.8}
        >
          <Text style={s.actionText}>rename</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.actionRow}
          onPress={() => { setActionsModal(false); setDeleteEntryConfirm(true); }}
          activeOpacity={0.8}
        >
          <Text style={[s.actionText, { color: Colors.expense }]}>delete receipt</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Link modal */}
      <BottomSheet visible={linkModal} onClose={() => setLinkModal(false)} title="link to recording">
        <View style={DC.textbox.wrap}>
          <TextInput
            style={DC.textbox.input}
            placeholder="search by name..."
            placeholderTextColor={DC.inputPlaceholder}
            value={linkSearch}
            onChangeText={setLinkSearch}
          />
        </View>
        <View style={{ height: 1, backgroundColor: DC.cardDividerColor, marginVertical: 12 }} />
        {filteredRecordings.length === 0 ? (
          <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 12, color: DC.pageTextMuted, paddingVertical: 8 }}>no recordings found</Text>
        ) : (
          filteredRecordings.map((rec: any, idx: number) => (
            <TouchableOpacity
              key={rec.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: idx < filteredRecordings.length - 1 ? DC.rowDivider.height : 0, borderBottomColor: DC.rowDivider.backgroundColor }}
              onPress={() => linkToRecording(rec)}
              activeOpacity={0.7}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: typeColor(rec.type), flexShrink: 0 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 13, color: DC.pageText }} numberOfLines={1}>{rec.name}</Text>
                <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageTextMuted }}>{rec.type} · {fmt(Number(rec.amount))}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </BottomSheet>

      {/* Rename modal */}
      <BottomSheet visible={renameModal} onClose={() => setRenameModal(false)} title="rename receipt">
        <View style={DC.textbox.wrap}>
          <TextInput
            style={DC.textbox.input}
            placeholder="receipt name"
            placeholderTextColor={DC.inputPlaceholder}
            value={renameVal}
            onChangeText={setRenameVal}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={rename}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <TouchableOpacity style={[s.primaryBtn, { flex: 1, backgroundColor: Colors.surface }]} onPress={() => setRenameModal(false)}>
            <Text style={[s.primaryBtnText, { color: DC.pageTextMuted }]}>cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.primaryBtn, { flex: 2 }]} onPress={rename}>
            <Text style={s.primaryBtnText}>save</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Delete entry confirm */}
      <ConfirmModal
        visible={deleteEntryConfirm}
        onClose={() => setDeleteEntryConfirm(false)}
        title="delete receipt"
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
    </Animated.View>
  );
}

const s = StyleSheet.create({
  sectionLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 11,
    color: DC.pageTextMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: DC.controlBorder,
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    marginBottom: 28,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: DC.cardBg,
  },
  cellImg: { width: '100%', height: '100%' },
  linkedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: DC.controlBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: '#111111',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 13,
    color: '#ffffff',
  },
  secondaryBtn: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DC.controlBorder,
  },
  secondaryBtnText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 13,
    color: DC.pageText,
  },
  actionRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: DC.rowDivider.backgroundColor,
  },
  actionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: DC.pageText,
  },
});
