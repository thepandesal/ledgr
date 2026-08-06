import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, TextInput, Alert, RefreshControl } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useCallback, useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import BottomSheet from '@/components/ui/BottomSheet';
import TopHeader from '@/components/ui/TopHeader';
import formStyles from '@/components/ui/formStyles';
import accountStyles from '@/components/ui/accountStyles';
import { Colors, Radius, Spacing } from '@/components/ui/theme';
import { DC } from '../../../src/lib/design';
import { compressImage, uploadReceiptPhoto } from '../../../src/lib/receiptUpload';
import { Brand } from '../../../src/lib/brand';
import NavIcon from '@/components/ui/NavIcons';
import { useNav } from '../../../src/lib/NavContext';

const SVG_ADD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4.75c.69 0 1.25.56 1.25 1.25v4.75H18a1.25 1.25 0 1 1 0 2.5h-4.75V18a1.25 1.25 0 1 1-2.5 0v-4.75H6a1.25 1.25 0 1 1 0-2.5h4.75V6c0-.69.56-1.25 1.25-1.25" /></svg>`;

interface Entry {
  id: string;
  note: string | null;
  created_at: string;
  recording_id: string | null;
  recording?: { name: string; type: string } | null;
  firstPhoto?: string;
  photoCount: number;
}

export default function ReceiptsScreen({ isActive, onClose }: { isActive?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useUser();
  const insets = useSafeAreaInsets();
  const { switchTab, toggleNotifDropdown } = useNav();

  useEffect(() => {
    if (isActive && userId) {
      queryClient.invalidateQueries({ queryKey: ['receipts', userId] });
    }
  }, [isActive, userId]);

  useFocusEffect(useCallback(() => {
    if (userId) queryClient.invalidateQueries({ queryKey: ['receipts', userId] });
  }, [userId]));

  const [addModal, setAddModal] = useState(false);
  const [addStep, setAddStep] = useState<'name' | 'photos'>('name');
  const [folderName, setFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'unlinked' | 'linked'>('unlinked');
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: entries = [], isLoading: loading } = useQuery({
    queryKey: ['receipts', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('receipt_entries')
        .select('*, receipt_photos(storage_path, url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!data) return [];
      const recordingIds = data.map((e: any) => e.recording_id).filter(Boolean);
      let recordingMap: Record<string, { name: string; type: string }> = {};
      if (recordingIds.length > 0) {
        const { data: recs } = await supabase.from('recordings').select('id, name, type').in('id', recordingIds);
        (recs ?? []).forEach((r: any) => { recordingMap[r.id] = { name: r.name, type: r.type }; });
      }
      return data.map((e: any) => {
        const photos: any[] = Array.isArray(e.receipt_photos) ? e.receipt_photos : [];
        return {
          ...e,
          firstPhoto: photos[0]?.url ?? '',
          photoCount: photos.length,
          recording: e.recording_id ? (recordingMap[e.recording_id] ?? null) : null,
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
        queryClient.invalidateQueries({ queryKey: ['receipts', userId] });
      } catch (e: any) {
        if (e?.message === 'RECEIPT_LIMIT_REACHED') Alert.alert('monthly limit reached', 'you\'ve used all 10 free receipt photo uploads this month. resets on the 1st.');
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
        queryClient.invalidateQueries({ queryKey: ['receipts', userId] });
      } catch (e: any) {
        if (e?.message === 'RECEIPT_LIMIT_REACHED') Alert.alert('monthly limit reached', 'you\'ve used all 10 free receipt photo uploads this month. resets on the 1st.');
      }
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    date.setHours(0, 0, 0, 0);
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === yesterday.getTime()) return 'Yesterday';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const typeColor = (type: string) => type === 'expense' ? Colors.expense : type === 'income' ? Colors.income : Colors.text;

  const filteredEntries = entries.filter(e => activeTab === 'unlinked' ? !e.recording_id : !!e.recording_id);
  const paginatedEntries = filteredEntries.slice(0, displayCount);
  const hasMore = displayCount < filteredEntries.length;

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
    if (isCloseToBottom && hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => { setDisplayCount(prev => prev + 10); setIsLoadingMore(false); }, 300);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['receipts', userId] });
    setRefreshing(false);
  };

  return (
    <View style={s.container}>
      <TopHeader
        title="Receipts"
        centered
        variant="blue"
        topInset={insets.top}
        onBack={() => onClose ? onClose() : switchTab('home')}
        right={
          <TouchableOpacity onPress={toggleNotifDropdown} activeOpacity={0.7}>
            <NavIcon name="notifications" size={22} color="#ffffff" />
          </TouchableOpacity>
        }
      />
      <View style={s.tabRow}>
        <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
          {(['unlinked', 'linked'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => { setActiveTab(tab); setDisplayCount(10); }}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={() => setAddModal(true)} activeOpacity={0.7} style={s.addBtn}>
          <SvgXml xml={SVG_ADD} width={16} height={16} color="#ffffff" />
          <Text style={s.addBtnText}>New Receipt</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={Brand.color.accent} /></View>
      ) : filteredEntries.length === 0 ? (
        <View style={s.center}>
          <Text style={Brand.type.emptyText}>{activeTab === 'unlinked' ? 'no unlinked receipts' : 'no linked receipts'}</Text>
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
                <View style={s.thumbEmpty} />
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
                <Text style={accountStyles.photoBtnText}>camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={accountStyles.photoBtn} onPress={addFromGallery}>
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
    </View>
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

  tabRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DC.pagePadding, paddingTop: 12, paddingBottom: 4, gap: 8 },
  tab:           { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, backgroundColor: 'transparent', borderWidth: 1, borderColor: DC.controlBorder },
  tabActive:     { backgroundColor: DC.viewBtnBg, borderColor: DC.viewBtnBg },
  tabText:       { fontFamily: Brand.font.mono, fontSize: 12, color: DC.pageText },
  tabTextActive: { fontFamily: Brand.font.monoBold, fontSize: 12, color: DC.viewBtnText },

  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: DC.headerBlueBg },
  addBtnText: { fontFamily: Brand.font.monoBold, fontSize: 11, color: '#ffffff' },
  addIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  loadMoreWrap: { alignItems: 'center', paddingVertical: 20 },
  loadMoreText: { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted },
});
