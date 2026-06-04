import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Dimensions, ScrollView, Image, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';

const { width } = Dimensions.get('window');

export default function ReceiptDetailScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  const [receipt, setReceipt] = useState<any>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string; path: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    loadReceipt();
  }, []);

  const loadReceipt = async () => {
    const { data: rec } = await supabase
      .from('receipt_entries')
      .select('*, recording:recording_id(id, name, type, amount)')
      .eq('id', receiptId)
      .single();
    if (rec) setReceipt(rec);

    const { data: photoRows } = await supabase
      .from('receipt_photos')
      .select('id, storage_path')
      .eq('entry_id', receiptId)
      .order('created_at');

    if (photoRows) {
      const withUrls = await Promise.all(photoRows.map(async (p: any) => {
        const { data } = await supabase.storage.from('receipt_entries').createSignedUrl(p.storage_path, 3600);
        return { id: p.id, url: data?.signedUrl ?? '', path: p.storage_path };
      }));
      setPhotos(withUrls);
    }
    setLoading(false);
  };

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: true }).start(() => router.back());
  };

  const deleteReceipt = () => {
    Alert.alert('Delete Receipt', 'This will delete all photos. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        // Delete photos from storage
        for (const p of photos) {
          await supabase.storage.from('receipt_entries').remove([p.path]);
        }
        await supabase.from('receipt_entries').delete().eq('id', receiptId);
        handleBack();
      }},
    ]);
  };

  const typeColor = (type: string) => {
    if (type === 'expense') return '#ed6a6a';
    if (type === 'income' || type === 'savings') return '#2ab671';
    return '#425252';
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#0ccfcf" />
      </SafeAreaView>
    </Animated.View>
  );

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#8a8a8a" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>receipts</Text>
            <Text style={styles.headerTitle}>{formatDate(receipt?.created_at ?? '')}</Text>
          </View>
          <TouchableOpacity onPress={deleteReceipt} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={18} color="#ed6a6a" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Photo carousel */}
          {photos.length > 0 && (
            <View>
              <FlatList
                data={photos}
                keyExtractor={p => p.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={e => setActivePhoto(Math.round(e.nativeEvent.contentOffset.x / width))}
                renderItem={({ item }) => (
                  <Image source={{ uri: item.url }} style={styles.carouselImage} resizeMode="contain" />
                )}
              />
              {photos.length > 1 && (
                <View style={styles.dots}>
                  {photos.map((_, i) => (
                    <View key={i} style={[styles.dot, i === activePhoto && styles.dotActive]} />
                  ))}
                </View>
              )}
              <Text style={styles.photoCount}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</Text>
            </View>
          )}

          <View style={styles.content}>

            {/* Linked recording */}
            {receipt?.recording ? (
              <View>
                <Text style={styles.sectionHeader}>linked recording</Text>
                <TouchableOpacity
                  style={styles.linkedCard}
                  onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: receipt.recording.id, from: 'receipt', receiptId } } as any)}
                >
                  <View style={[styles.linkedDot, { backgroundColor: typeColor(receipt.recording.type) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linkedName}>{receipt.recording.name.toLowerCase()}</Text>
                    <Text style={styles.linkedAmount}>{Number(receipt.recording.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color="#c0c0c0" />
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.sectionHeader}>no recording yet</Text>
                <TouchableOpacity
                  style={styles.makeRecordingBtn}
                  onPress={() => router.push({ pathname: '/(app)/add-recording', params: { from: 'receipt', receiptId, defaultDate: new Date().toISOString().split('T')[0] } } as any)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text style={styles.makeRecordingText}>make a recording</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Add more photos */}
            <TouchableOpacity
              style={styles.addMorePhotosBtn}
              onPress={() => router.push({ pathname: '/(app)/capture-receipt', params: { receiptId } } as any)}
            >
              <Ionicons name="camera-outline" size={15} color="#425252" />
              <Text style={styles.addMorePhotosText}>add more photos</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 28, paddingTop: 14, paddingBottom: 12 },
  backBtn: { padding: 2 },
  headerSub: { fontFamily: 'ChillaxMedium', fontSize: 10, color: '#929090' },
  headerTitle: { fontFamily: 'Avenelle', fontSize: 22, color: '#425252', letterSpacing: -0.5, lineHeight: 26 },
  deleteBtn: { padding: 8 },
  carouselImage: { width, height: width, backgroundColor: '#f5f5f5' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e0e0e0' },
  dotActive: { backgroundColor: '#0ccfcf', width: 16 },
  photoCount: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', textAlign: 'center', marginTop: 4, marginBottom: 4 },
  content: { paddingHorizontal: 32, paddingTop: 16, paddingBottom: 60, gap: 20 },
  sectionHeader: { fontFamily: 'ChillaxMedium', fontSize: 14, color: '#0ccfcf', letterSpacing: -0.3, marginBottom: 10 },
  linkedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fafafa', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f0f0f0' },
  linkedDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  linkedName: { fontFamily: 'Avenelle', fontSize: 16, color: '#425252', letterSpacing: -0.5 },
  linkedAmount: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090', marginTop: 2 },
  makeRecordingBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#425252', borderRadius: 999, paddingVertical: 14 },
  makeRecordingText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#fff' },
  addMorePhotosBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fafafa', borderRadius: 999, paddingVertical: 12, borderWidth: 1, borderColor: '#e8e8e8' },
  addMorePhotosText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#425252' },
});


