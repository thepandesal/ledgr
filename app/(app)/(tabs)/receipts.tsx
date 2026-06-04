import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { supabase } from '../../../src/lib/supabase';

interface ReceiptPhoto { id: string; storage_path: string; url?: string; }
interface Receipt {
  id: string;
  note: string | null;
  created_at: string;
  recording_id: string | null;
  recording?: { name: string; type: string; amount: number; };
  photos: ReceiptPhoto[];
}

export default function ReceiptsScreen() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { loadReceipts(); }, []));

  const loadReceipts = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: recs } = await supabase
      .from('receipt_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!recs) { setLoading(false); return; }

    const full: Receipt[] = await Promise.all(recs.map(async (r: any) => {
      // Fetch linked recording separately
      let recording = null;
      if (r.recording_id) {
        const { data: rec } = await supabase
          .from('recordings')
          .select('name, type, amount')
          .eq('id', r.recording_id)
          .single();
        recording = rec;
      }

      const { data: photos } = await supabase
        .from('receipt_photos')
        .select('id, storage_path')
        .eq('entry_id', r.id)
        .order('created_at')
        .limit(3);

      const photosWithUrls = await Promise.all((photos ?? []).map(async (p: any) => {
        const { data: signed } = await supabase.storage.from('receipt_entries').createSignedUrl(p.storage_path, 3600);
        return { ...p, url: signed?.signedUrl ?? '' };
      }));

      return { ...r, recording, photos: photosWithUrls };
    }));

    setReceipts(full);
    setLoading(false);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const typeColor = (type: string) => {
    if (type === 'expense') return '#ed6a6a';
    if (type === 'income' || type === 'savings') return '#2ab671';
    return '#425252';
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>your</Text>
          <Text style={s.headerTitle}>receipts</Text>
        </View>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => router.push('/(app)/capture-receipt' as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={14} color="#425252" />
          <Text style={s.addBtnText}>add receipt</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#0ccfcf" /></View>
      ) : receipts.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="receipt-outline" size={40} color="#e8e8e8" />
          <Text style={s.emptyText}>no receipts yet</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(app)/capture-receipt' as any)}>
            <Text style={s.emptyBtnText}>capture your first receipt</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {receipts.map(receipt => (
            <TouchableOpacity
              key={receipt.id}
              style={s.receiptCard}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/(app)/receipt-detail', params: { receiptId: receipt.id } } as any)}
            >
              {/* Photo thumbnails */}
              <View style={s.thumbRow}>
                {receipt.photos.length > 0 ? (
                  receipt.photos.map((p, pi) => (
                    <Image key={pi} source={{ uri: p.url }} style={s.thumb} resizeMode="cover" />
                  ))
                ) : (
                  <View style={s.thumbEmpty}>
                    <Ionicons name="image-outline" size={20} color="#c0c0c0" />
                  </View>
                )}
                {receipt.photos.length === 0 && <View style={[s.thumbEmpty, { opacity: 0 }]} />}
              </View>

              {/* Info */}
              <View style={s.cardInfo}>
                <Text style={s.cardDate}>{formatDate(receipt.created_at)}</Text>
                <Text style={s.cardCount}>{receipt.photos.length} photo{receipt.photos.length !== 1 ? 's' : ''}</Text>

                {/* Linked recording */}
                {receipt.recording ? (
                  <TouchableOpacity
                    style={s.linkedBadge}
                    onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: receipt.recording_id, from: 'receipts' } } as any)}
                  >
                    <View style={[s.linkedDot, { backgroundColor: typeColor(receipt.recording.type) }]} />
                    <Text style={s.linkedText} numberOfLines={1}>
                      {receipt.recording.name.toLowerCase()}
                    </Text>
                    <Ionicons name="arrow-forward" size={11} color="#929090" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={s.makeRecordingBtn}
                    onPress={() => router.push({ pathname: '/(app)/add-recording', params: { from: 'receipts', receiptId: receipt.id } } as any)}
                  >
                    <Ionicons name="add" size={12} color="#0ccfcf" />
                    <Text style={s.makeRecordingText}>make a recording</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Ionicons name="chevron-forward" size={16} color="#c0c0c0" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
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
  receiptCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fafafa', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  thumbRow: { flexDirection: 'row', gap: 4 },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  thumbEmpty: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, gap: 3 },
  cardDate: { fontFamily: 'ChillaxMedium', fontSize: 13, color: '#425252' },
  cardCount: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090' },
  linkedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f5f5f5', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, alignSelf: 'flex-start', marginTop: 2 },
  linkedDot: { width: 6, height: 6, borderRadius: 3 },
  linkedText: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#425252', maxWidth: 120 },
  makeRecordingBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  makeRecordingText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#0ccfcf' },
});


