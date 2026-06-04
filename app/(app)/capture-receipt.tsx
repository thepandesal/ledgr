import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Dimensions, FlatList, Image, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../src/lib/supabase';

const { width } = Dimensions.get('window');

export default function CaptureReceiptScreen() {
  const router = useRouter();
  const { receiptId } = useLocalSearchParams<{ receiptId?: string }>();
  const slideAnim = useRef(new Animated.Value(width)).current;

  const [photos, setPhotos] = useState<string[]>([]); // local URIs
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
  }, []);

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: true }).start(() => router.back());
  };

  const compress = async (uri: string) => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compress(result.assets[0].uri);
      setPhotos(prev => [...prev, compressed]);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!result.canceled) {
      const compressed = await Promise.all(result.assets.map(a => compress(a.uri)));
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
      if (!user) return;

      // Create or use existing receipt
      let rId = receiptId;
      if (!rId) {
        const { data: rec, error } = await supabase.from('receipts').insert({ user_id: user.id }).select().single();
        if (error || !rec) throw error;
        rId = rec.id;
      }

      // Upload each photo to Supabase Storage
      for (const uri of photos) {
        const fileName = `${user.id}/${rId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const byteArray = decode(base64);
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, byteArray, { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
        await supabase.from('receipt_photos').insert({ receipt_id: rId, storage_path: fileName });
      }

      router.replace({ pathname: '/(app)/(tabs)/receipts' } as any);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  // decode base64 to Uint8Array for Supabase upload
  const decode = (base64: string): Uint8Array => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
    const bytes = Math.floor(base64.length * 0.75);
    const result = new Uint8Array(bytes);
    let j = 0;
    for (let i = 0; i < base64.length; i += 4) {
      const a = lookup[base64.charCodeAt(i)];
      const b = lookup[base64.charCodeAt(i + 1)];
      const c = lookup[base64.charCodeAt(i + 2)];
      const d = lookup[base64.charCodeAt(i + 3)];
      result[j++] = (a << 2) | (b >> 4);
      result[j++] = ((b & 15) << 4) | (c >> 2);
      result[j++] = ((c & 3) << 6) | d;
    }
    return result;
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#8a8a8a" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerSub}>receipts</Text>
            <Text style={styles.headerTitle}>add photos</Text>
          </View>
        </View>

        {/* Photo grid */}
        <FlatList
          data={[...photos, 'add']}
          keyExtractor={(_, i) => String(i)}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item, index }) => {
            if (item === 'add') return (
              <View style={styles.addPhotoCell}>
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickFromCamera}>
                  <Ionicons name="camera-outline" size={22} color="#0ccfcf" />
                  <Text style={styles.addPhotoBtnText}>camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickFromGallery}>
                  <Ionicons name="images-outline" size={22} color="#425252" />
                  <Text style={[styles.addPhotoBtnText, { color: '#425252' }]}>gallery</Text>
                </TouchableOpacity>
              </View>
            );
            return (
              <View style={styles.photoCell}>
                <Image source={{ uri: item }} style={styles.photoThumb} resizeMode="cover" />
                <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(index)}>
                  <Ionicons name="close-circle" size={20} color="#ed6a6a" />
                </TouchableOpacity>
              </View>
            );
          }}
        />

        {photos.length > 0 && (
          <View style={styles.footer}>
            <Text style={styles.footerCount}>{photos.length} photo{photos.length > 1 ? 's' : ''}</Text>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'saving...' : 'save receipt'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Animated.View>
  );
}

const CELL = (width - 48) / 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 28, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backBtn: { padding: 2 },
  headerSub: { fontFamily: 'ChillaxMedium', fontSize: 10, color: '#929090' },
  headerTitle: { fontFamily: 'Avenelle', fontSize: 22, color: '#425252', letterSpacing: -0.5, lineHeight: 26 },
  grid: { padding: 16, gap: 8 },
  photoCell: { width: CELL, height: CELL, marginRight: 8, marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4 },
  addPhotoCell: { width: CELL * 2 + 8, height: CELL, marginBottom: 8, flexDirection: 'row', gap: 8 },
  addPhotoBtn: { flex: 1, height: '100%', borderRadius: 12, borderWidth: 1.5, borderColor: '#f0f0f0', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: '#fafafa' },
  addPhotoBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#0ccfcf' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  footerCount: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090' },
  saveBtn: { backgroundColor: '#425252', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 24 },
  saveBtnText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#fff' },
});
