import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Dimensions, FlatList, Image, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../src/lib/supabase';
import pageStyles from '@/components/ui/pageStyles';
import { Colors, Fonts, Radius } from '@/components/ui/theme';
import { compressImage, uploadReceiptPhoto } from '../../src/lib/receiptUpload';

const { width } = Dimensions.get('window');

export default function CaptureReceiptScreen() {
  const router = useRouter();
  const { receiptId, galleryOnly, recordingId, recordingName, recordingDate } = useLocalSearchParams<{ receiptId?: string; galleryOnly?: string; recordingId?: string; recordingName?: string; recordingDate?: string }>();
  const slideAnim = useRef(new Animated.Value(width)).current;

  const [photos, setPhotos] = useState<string[]>([]); // local URIs
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
    if (galleryOnly === '1') pickFromGallery();
  }, []);

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressImage(result.assets[0].uri);
      setPhotos(prev => [...prev, compressed]);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1 });
    if (!result.canceled) {
      const compressed = await Promise.all(result.assets.map(a => compressImage(a.uri)));
      setPhotos(prev => [...prev, ...compressed]);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (photos.length === 0) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }

      // Create or use existing receipt entry
      let rId = receiptId;
      if (!rId) {
        const note = recordingDate && recordingName
          ? `${new Date(recordingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${recordingName}`
          : new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const { data: rec, error } = await supabase.from('receipt_entries').insert({
          user_id: user.id,
          note,
          recording_id: recordingId ?? null,
        }).select().single();
        if (error || !rec) { Alert.alert('Error', error?.message ?? 'Failed to create receipt'); setSaving(false); return; }
        rId = rec.id;
      }

      for (const uri of photos) {
        const uploaded = await uploadReceiptPhoto(uri, rId!);
        if (!uploaded) { Alert.alert('Upload Error', 'Failed to upload photo'); setSaving(false); return; }
      }

      router.replace({ pathname: '/(app)/(tabs)/receipts' } as any);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong');
      setSaving(false);
    }
  };

  return (
    <Animated.View style={[pageStyles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={pageStyles.inner}>
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} style={pageStyles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.muted} />
          </TouchableOpacity>
          <View>
            <Text style={pageStyles.pageLabel}>receipts</Text>
            <Text style={[pageStyles.pageName, { fontSize: 22, lineHeight: 26 }]}>add photos</Text>
          </View>
        </View>

        {/* Photo grid */}
        <FlatList
          data={[...photos, 'add']}
          keyExtractor={(_, i) => String(i)}
          numColumns={3}
          contentContainerStyle={s.grid}
          renderItem={({ item, index }) => {
            if (item === 'add') return (
              <View style={s.addPhotoCell}>
                <TouchableOpacity style={s.addPhotoBtn} onPress={pickFromCamera}>
                  <Ionicons name="camera-outline" size={22} color={Colors.cyan} />
                  <Text style={s.addPhotoBtnText}>camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.addPhotoBtn} onPress={pickFromGallery}>
                  <Ionicons name="images-outline" size={22} color={Colors.text} />
                  <Text style={[s.addPhotoBtnText, { color: Colors.text }]}>gallery</Text>
                </TouchableOpacity>
              </View>
            );
            return (
              <View style={s.photoCell}>
                <Image source={{ uri: item }} style={s.photoThumb} resizeMode="cover" />
                <TouchableOpacity style={s.photoRemove} onPress={() => removePhoto(index)}>
                  <Ionicons name="close-circle" size={20} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
        {photos.length > 0 && (
          <View style={s.footer}>
            <Text style={s.footerCount}>{photos.length} photo{photos.length > 1 ? 's' : ''}</Text>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              <Text style={s.saveBtnText}>{saving ? 'saving...' : 'save receipt'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Animated.View>
  );
}

const CELL = (width - 48) / 3;

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 28, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  grid: { padding: 16, gap: 8 },
  photoCell: { width: CELL, height: CELL, marginRight: 8, marginBottom: 8, borderRadius: Radius.lg, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4 },
  addPhotoCell: { width: CELL * 2 + 8, height: CELL, marginBottom: 8, flexDirection: 'row', gap: 8 },
  addPhotoBtn: { flex: 1, height: '100%', borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: Colors.surface },
  addPhotoBtnText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.cyan },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  footerCount: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
  saveBtn: { backgroundColor: Colors.text, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 24 },
  saveBtnText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.white },
});




