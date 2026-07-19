import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator, TextInput, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import BottomSheet from '@/components/ui/BottomSheet';
import formStyles from '@/components/ui/formStyles';
import accountStyles from '@/components/ui/accountStyles';
import { Colors, Radius, Spacing } from '@/components/ui/theme';
import { compressImage, uploadReceiptPhoto } from '../../../src/lib/receiptUpload';
import { Brand } from '../../../src/lib/brand';

interface Entry {
  id: string;
  note: string | null;
  created_at: string;
  recording_id: string | null;
  recording?: { name: string; type: string } | null;
  firstPhoto?: string;
  photoCount: number;
}

export default function ReceiptsScreen({ isActive }: { isActive?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useUser();

  useEffect(() => {
    if (isActive && userId) {
      queryClient.invalidateQueries({ queryKey: ['receipts', userId] });
    }
  }, [isActive, userId]);
  const [addModal, setAddModal] = useState(false);
  const [addStep, setAddStep] = useState<'name' | 'photos'>('name');
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // useFocusEffect removed — isActive prop handles refresh

  const { data: entries = [], isLoading: loading } = useQuery({
    queryKey: ['receipts', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('receipt_entries')
        .select('*, receipt_photos(storage_path, url), recordings(name, type)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!data) return [];
      return data.map((e: any) => {
        const photos: any[] = Array.isArray(e.receipt_photos) ? e.receipt_photos : [];
        const rec = Array.isArray(e.recordings) ? e.recordings[0] : e.recordings;
        return {
          ...e,
          firstPhoto: photos[0]?.url ?? '',
          photoCount: photos.length,
          recording: rec ?? null,
        };
      }) as Entry[];
    },
    enabled: !!userId,
  });

  const createEntry = async () => {
    if (!userId) return;
    setCreating(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const note = folderName.trim() || timeStr;
    const { data: entry, error } = await supabase.from('receipt_entries').insert({ user_id: userId, note }).select().single();
    setCreating(false);
    if (!error && entry) { setActiveEntryId(entry.id); setAddStep('photos'); }
  };

  const closeAddModal = () => {
    setAddModal(false); setAddStep('name'); setFolderName(''); setActiveEntryId(null);
    setDisplayCount(10);
    queryClient.invalidateQueries({ queryKey: ['receipts', userId] });
  };

  const addFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0] && activeEntryId) {
      try {
        const compressed = await compressImage(result.assets[0].uri);
        await uploadReceiptPhoto(compressed, activeEntryId);
      } catch (e: any) {
        if (e?.message === 'RECEIPT_LIMIT_REACHED') {
          Alert.alert('monthly limit reached', 'you\'ve used all 10 free receipt photo uploads this month. resets on the 1st.');
        }
      }
    }
  };

  const addFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1 });
    if (!result.canceled && activeEntryId) {
      try {
        const CONCURRENCY = 3;
        for (let i = 0; i < result.assets.length; i += CONCURRENCY) {
          await Promise.all(result.assets.slice(i, i + CONCURRENCY).map(async (asset) => {
            const compressed = await compressImage(asset.uri);
            await uploadReceiptPhoto(compressed, activeEntryId!);
          }));
        }
      } catch (e: any) {
        if (e?.message === 'RECEIPT_LIMIT_REACHED') {
          Alert.alert('monthly limit reached', 'you\'ve used all 10 free receipt photo uploads this month. resets on the 1st.');
        }
      }
    }
  };

  const formatDate = (d: string) => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  const typeColor = (type: string) => type === 'expense' ? Colors.expense : type === 'income' ? Colors.income : Colors.text;

  const paginatedEntries = entries.slice(0, displayCount);
  const hasMore = displayCount < entries.length;

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isCloseToBottom && hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayCount(prev => prev + 10);
        setIsLoadingMore(false);
      }, 300);
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['receipts', userId] });
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={s.container}>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={Brand.color.accent} /></View>
      ) : entries.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="receipt-outline" size={40} color={Colors.borderMid} />
          <Text style={Brand.type.emptyText}>no receipts yet</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={s.list} 
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={400}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {paginatedEntries.map(entry => (
            <TouchableOpacity key={entry.id} style={s.card} activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/(app)/receipt-detail', params: { receiptId: entry.id } } as any)}>
              {entry.firstPhoto ? (
                <Image source={{ uri: entry.firstPhoto }} style={s.thumb} resizeMode="cover" />
              ) : (
                <View style={s.thumbEmpty}>
                  <Ionicons name="image-outline" size={22} color={Colors.faint} />
                </View>
              )}
              <View style={s.cardInfo}>
                <Text style={s.cardDate}>{formatDate(entry.created_at)}</Text>
                <Text style={s.cardName} numberOfLines={1}>{entry.note ?? formatDate(entry.created_at)}</Text>
                <Text style={s.cardMeta}>{entry.photoCount} photo{entry.photoCount !== 1 ? 's' : ''}</Text>
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
          {hasMore && (
            <View style={s.loadMoreWrap}>
              {isLoadingMore ? (
                <ActivityIndicator color={Brand.color.accent} size="small" />
              ) : (
                <Text style={s.loadMoreText}>scroll for more</Text>
              )}
            </View>
          )}
          <Text style={[Brand.type.footer, { marginTop: 24 }]}>managed by LEDGR</Text>
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={() => setAddModal(true)} activeOpacity={0.8}>
        <Ionicons name="add" size={22} color={Brand.color.accentText} />
      </TouchableOpacity>

      <BottomSheet visible={addModal} onClose={closeAddModal} title={addStep === 'name' ? 'new receipt' : 'add photos'}>
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
                <Ionicons name="camera-outline" size={28} color={Brand.color.headerText} />
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
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  list:      { paddingHorizontal: Spacing.page, paddingTop: 12, paddingBottom: 80, gap: Brand.spacing.gap },

  card:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: Brand.spacing.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  thumb:     { width: 48, height: 48, borderRadius: Radius.md, flexShrink: 0 },
  thumbEmpty:{ width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.input, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardInfo:  { flex: 1, gap: 2 },
  cardDate:  { ...Brand.type.cardMeta },
  cardName:  { ...Brand.type.cardTitle },
  cardMeta:  { ...Brand.type.cardMeta },

  linkedBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  linkedDot:    { width: 6, height: 6, borderRadius: 3 },
  linkedText:   { ...Brand.type.cardMeta, color: Colors.text, maxWidth: 140 },
  unlinkedText: { ...Brand.type.cardMeta, marginTop: 2 },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Brand.color.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  loadMoreWrap: { alignItems: 'center', paddingVertical: 20 },
  loadMoreText: { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted },
});
