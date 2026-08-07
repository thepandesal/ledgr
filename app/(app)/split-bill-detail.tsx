import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Dimensions, ActivityIndicator, TextInput, Platform, Image, Modal, SafeAreaView,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopHeader from '@/components/ui/TopHeader';
import NavIcon from '@/components/ui/NavIcons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import ViewShot from 'react-native-view-shot';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../src/lib/supabase';
import { useUser } from '../../src/hooks/useUser';
import { compressImage, uploadReceiptPhoto, compressImageForOcr } from '../../src/lib/receiptUpload';
import { Colors, Fonts, Radius } from '@/components/ui/theme';
import BottomSheet from '@/components/ui/BottomSheet';
import { useScreenAnim } from '@/components/ui/ScreenWrapper';
import PageHeader from '@/components/ui/PageHeader';
import itemStyles from '@/components/ui/itemStyles';
import { Brand } from '../../src/lib/brand';
import { DC } from '../../src/lib/design';
import { AppFont } from '../../src/lib/fonts';
import { ocrReceiptImage, parseReceiptText, type ParsedItem } from '../../src/lib/receiptParser';
import CameraCapture from './CameraCapture';
import PaymentModal, { type PaymentItem } from './payment-modal';
import { computeSplitTotals } from '../../src/lib/splitBillUtils';
const SVG_BACK   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path fill="currentColor" d="M10.5 6a.75.75 0 0 0-.75-.75H3.81l1.97-1.97a.75.75 0 0 0-1.06-1.06L1.47 5.47a.75.75 0 0 0 0 1.06l3.25 3.25a.75.75 0 0 0 1.06-1.06L3.81 6.75h5.94A.75.75 0 0 0 10.5 6" /></svg>`;
const SVG_FORWARD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path fill="currentColor" d="M1.5 6a.75.75 0 0 1 .75-.75h5.94L6.22 3.28a.75.75 0 0 1 1.06-1.06l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 9.78a.75.75 0 0 1-1.06-1.06l1.97-1.97H2.25A.75.75 0 0 1 1.5 6" /></svg>`;
const SVG_CHECK_ONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><mask id="chk"><g fill="none" stroke-linejoin="round" stroke-width="4"><path fill="#fff" stroke="#fff" d="M24 44a19.94 19.94 0 0 0 14.142-5.858A19.94 19.94 0 0 0 44 24a19.94 19.94 0 0 0-5.858-14.142A19.94 19.94 0 0 0 24 4A19.94 19.94 0 0 0 9.858 9.858A19.94 19.94 0 0 0 4 24a19.94 19.94 0 0 0 5.858 14.142A19.94 19.94 0 0 0 24 44Z"/><path stroke="#000" stroke-linecap="round" d="m16 24l6 6l12-12"/></g></mask></defs><path fill="currentColor" d="M0 0h48v48H0z" mask="url(#chk)"/></svg>`;
const SVG_LINK   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.213 9.787a3.39 3.39 0 0 0-4.795 0l-3.425 3.426a3.39 3.39 0 0 0 4.795 4.794l.321-.304m-.321-4.49a3.39 3.39 0 0 0 4.795 0l3.424-3.426a3.39 3.39 0 0 0-4.794-4.795l-1.028.961" /></svg>`;
const SVG_IMAGE  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="currentColor"><path d="M7.25 8a1.25 1.25 0 1 1 2.5 0a1.25 1.25 0 0 1-2.5 0" /><path d="M9.367 2.25h5.266c1.092 0 1.958 0 2.655.057c.714.058 1.317.18 1.869.46a4.75 4.75 0 0 1 2.075 2.077c.281.55.403 1.154.461 1.868c.057.697.057 1.563.057 2.655v5.266c0 1.092 0 1.958-.057 2.655c-.058.714-.18 1.317-.46 1.869a4.75 4.75 0 0 1-2.076 2.075c-.552.281-1.155.403-1.869.461c-.697.057-1.563.057-2.655.057H9.367c-1.092 0-1.958 0-2.655-.057c-.714-.058-1.317-.18-1.868-.46a4.75 4.75 0 0 1-2.076-2.076c-.281-.552-.403-1.155-.46-1.869c-.058-.697-.058-1.563-.058-2.655V9.367c0-1.092 0-1.958.057-2.655c.058-.714.18-1.317.46-1.868a4.75 4.75 0 0 1 2.077-2.076c.55-.281 1.154-.403 1.868-.461c.697-.057 1.563-.057 2.655-.057M3.75 13.753v.847c0 1.133 0 1.937.052 2.566c.05.62.147 1.005.302 1.31a3.25 3.25 0 0 0 1.42 1.42c.305.155.69.251 1.31.302c.389.032.845.044 1.404.049c-.046-1.392.167-2.71.593-3.92c-1.12-1.606-2.98-2.641-5.08-2.574m16.5-3.084c-5.863-.493-10.727 3.874-10.511 9.581h4.86c1.133 0 1.937 0 2.566-.052c.62-.05 1.005-.147 1.31-.302a3.25 3.25 0 0 0 1.42-1.42c.155-.305.251-.69.302-1.31c.052-.63.052-1.434.052-2.566z" /></g></svg>`;
const SVG_ELLIPSIS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path fill="currentColor" d="M0 3v2h2V3zm3 0v2h2V3zm3 0v2h2V3z" /></svg>`;
const SVG_CLOSE    = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2m3.535 6.465a1 1 0 0 0-1.414 0L12 10.585l-2.121-2.12a1 1 0 1 0-1.414 1.414L10.585 12l-2.12 2.121a1 1 0 1 0 1.414 1.414L12 13.415l2.121 2.12a1 1 0 0 0 1.414-1.414L13.415 12l2.12-2.121a1 1 0 0 0 0-1.414" /></svg>`;
const ACCENT      = Brand.color.accent;      // light mint — backgrounds/chips only
const ACCENT_DARK = Brand.color.accentDark;  // #2A7A6F — text/icons on white
const ACCENT_TEXT = Brand.color.accentText;  // dark text ON accent bg
const PAGE        = 25;
const PEACH = '#FFAB91';
const { width } = Dimensions.get('window');
export default function SplitBillDetailScreen({ splitBillId: propSplitBillId, name: propName, onClose }: { splitBillId?: string; name?: string; onClose?: () => void }) {
  const params = useLocalSearchParams<{ splitBillId: string; name: string }>();
  const splitBillId = propSplitBillId ?? params.splitBillId;
  const name = propName ?? params.name;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { slideAnim, handleBack: handleBackAnim } = useScreenAnim();
  const handleBack = onClose ?? handleBackAnim;
  const handleBackOrDelete = async () => {
    // If the bill has no items, no people (via bill_splits), and no recordings, delete it silently
    const [{ data: billItems }, { data: billPeople }, { data: billRecs }] = await Promise.all([
      supabase.from('split_items').select('id').eq('split_bill_id', splitBillId).limit(1),
      supabase.from('bill_splits').select('id').eq('split_bill_id', splitBillId).limit(1),
      supabase.from('split_bill_recordings').select('id').eq('split_bill_id', splitBillId).limit(1),
    ]);
    const isEmpty = !billItems?.length && !billPeople?.length && !billRecs?.length;
    if (isEmpty) {
      await Promise.all([
        supabase.from('split_shares').delete().eq('split_bill_id', splitBillId),
        supabase.from('split_bills').delete().eq('id', splitBillId),
      ]);
      queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    }
    (onClose ?? handleBackAnim)();
  };
  useEffect(() => {
    // Load current status
    supabase.from('split_bills').select('status').eq('id', splitBillId).single()
      .then(({ data }) => { if (data?.status) setBillStatus(data.status as any); });
  }, []);
  const [editNameModal, setEditNameModal] = useState(false);
  const [editNameVal, setEditNameVal]     = useState('');
  const [deleteSplitModal, setDeleteSplitModal] = useState(false);
  const [billStatus, setBillStatus] = useState<'ongoing' | 'closed'>('ongoing');
  const openEditName = () => { setEditNameVal(String(name)); setEditNameModal(true); };
  const saveEditName = async () => {
    if (!editNameVal.trim()) return;
    await supabase.from('split_bills').update({ name: editNameVal.trim() }).eq('id', splitBillId);
    setEditNameModal(false);
    router.setParams({ name: editNameVal.trim() });
  };
  const confirmDeleteSplit = async () => {
    await Promise.all([
      supabase.from('bill_splits').delete().eq('split_bill_id', splitBillId),
      supabase.from('split_items').delete().eq('split_bill_id', splitBillId),
      supabase.from('split_bill_recordings').delete().eq('split_bill_id', splitBillId),
      supabase.from('split_bill_payments').delete().eq('split_bill_id', splitBillId),
      supabase.from('split_shares').delete().eq('split_bill_id', splitBillId),
      supabase.from('split_bills').delete().eq('id', splitBillId),
    ]);
    setDeleteSplitModal(false);
    queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    if (onClose) { onClose(); } else if (router.canGoBack()) { router.back(); }
  };
  const confirmDeleteSplitWithRecordings = async () => {
    // Delete receipt photos linked to this split bill
    if (linkedReceipt) {
      const { data: photos } = await supabase.from('receipt_photos').select('storage_path').eq('entry_id', linkedReceipt.id);
      if (photos && photos.length > 0) {
        await supabase.storage.from('receipts').remove(photos.map((p: any) => p.storage_path));
        await supabase.from('receipt_photos').delete().eq('entry_id', linkedReceipt.id);
      }
      await supabase.from('receipt_entries').delete().eq('id', linkedReceipt.id);
    }
    // Fetch payment recordings BEFORE deleting so we can reverse paid_amount
    const { data: paymentRecordings } = await supabase
      .from('recordings')
      .select('linked_recording_id, amount')
      .eq('split_bill_id', splitBillId)
      .not('linked_recording_id', 'is', null);
    // Now delete all recordings created from split bill payments
    await supabase.from('recordings').delete().eq('split_bill_id', splitBillId);
    if (paymentRecordings && paymentRecordings.length > 0) {
      const creditByParent: Record<string, number> = {};
      paymentRecordings.forEach((rec: any) => {
        if (rec.linked_recording_id) {
          creditByParent[rec.linked_recording_id] = (creditByParent[rec.linked_recording_id] ?? 0) + Number(rec.amount);
        }
      });
      for (const [parentId, creditToReverse] of Object.entries(creditByParent)) {
        const { data: parent } = await supabase
          .from('recordings')
          .select('paid_amount, amount, status')
          .eq('id', parentId)
          .single();
        if (parent) {
          const newPaid = Math.max(0, Number(parent.paid_amount ?? 0) - creditToReverse);
          const wasFullyPaid = parent.status === 'paid';
          const stillFullyPaid = newPaid >= Number(parent.amount) - 0.01;
          await supabase.from('recordings').update({
            paid_amount: newPaid,
            ...(wasFullyPaid && !stillFullyPaid ? { status: 'unpaid' } : {}),
          }).eq('id', parentId);
        }
      }
    }
    // Then delete the split bill itself
    await confirmDeleteSplit();
  };
  // ── Load linked recordings ────────────────────────────────────────────────
  const { userId, defaultCurrency, userName } = useUser();
  const insets = useSafeAreaInsets();
  // ── All-time loan/due balance per person (where you stand) ─────────────
  const { data: personBalances = {} } = useQuery({
    queryKey: ['person-loan-balances', userId],
    queryFn: async () => {
      const { data: recs } = await supabase
        .from('recordings')
        .select('type, person_name, amount, paid_amount')
        .eq('user_id', userId)
        .in('type', ['debt', 'due'])
        .neq('status', 'voided');
      const balances: Record<string, number> = {};
      (recs ?? []).forEach((r: any) => {
        const name = r.person_name;
        if (!name) return;
        const paid = Number(r.paid_amount ?? 0);
        const net = Number(r.amount) - paid;
        if (r.type === 'due') {
          balances[name] = (balances[name] ?? 0) + net; // they owe me
        } else {
          balances[name] = (balances[name] ?? 0) - net; // I owe them
        }
      });
      return balances;
    },
    enabled: !!userId,
  });
  // ── People state ─────────────────────────────────────────────────────────
  const [contacts, setContacts] = useState<string[]>([]);
  // ── Receipt state ─────────────────────────────────────────────────────────
  const [linkedReceipt, setLinkedReceipt]   = useState<any>(null);
  const [receiptPhotos, setReceiptPhotos]   = useState<{ id: string; url: string }[]>([]);
  // Receipts pulled from recordings linked to this split bill
  const [recordingReceiptPhotos, setRecordingReceiptPhotos] = useState<{ id: string; url: string; recordingName: string }[]>([]);
  const [addReceiptModal, setAddReceiptModal] = useState(false);
  const [photoModal, setPhotoModal]         = useState(false);
  const [photoModalIndex, setPhotoModalIndex] = useState(0);
  // which pool is the carousel showing: 'direct' | 'recording'
  const [photoModalPool, setPhotoModalPool] = useState<'direct' | 'recording'>('direct');
  const loadLinkedReceipt = async () => {
    if (!splitBillId) return;
    const { data: entry } = await supabase.from('receipt_entries').select('id, note, created_at').eq('split_bill_id', splitBillId).maybeSingle();
    if (!entry) { setLinkedReceipt(null); setReceiptPhotos([]); }
    else {
      setLinkedReceipt(entry);
      const { data: photos } = await supabase.from('receipt_photos').select('id, storage_path, url').eq('entry_id', entry.id).order('created_at');
      if (photos) {
        const urls = await Promise.all(photos.map(async (p: any) => {
          let url = p.url ?? '';
          if (!url && p.storage_path) {
            const { data } = await supabase.storage.from('receipts').createSignedUrl(p.storage_path, 3600);
            url = data?.signedUrl ?? '';
          }
          return { id: p.id, url };
        }));
        setReceiptPhotos(urls);
      }
    }
  };
  /** Load receipts that are attached to any recording linked to this split bill */
  const loadRecordingReceipts = async (linkedRecs: any[]) => {
    const recIds = linkedRecs.map((lr: any) => lr.recording?.id).filter(Boolean);
    if (recIds.length === 0) { setRecordingReceiptPhotos([]); return; }
    // Get all receipt_entries linked to these recordings
    const { data: entries } = await supabase.from('receipt_entries').select('id, recording_id').in('recording_id', recIds);
    if (!entries || entries.length === 0) { setRecordingReceiptPhotos([]); return; }
    const allPhotos: { id: string; url: string; recordingName: string }[] = [];
    for (const entry of entries) {
      const recName = linkedRecs.find((lr: any) => lr.recording?.id === entry.recording_id)?.recording?.name ?? '';
      const { data: photos } = await supabase.from('receipt_photos').select('id, storage_path, url').eq('entry_id', entry.id).order('created_at');
      if (photos) {
        for (const p of photos) {
          let url = p.url ?? '';
          if (!url && p.storage_path) {
            const { data } = await supabase.storage.from('receipts').createSignedUrl(p.storage_path, 3600);
            url = data?.signedUrl ?? '';
          }
          if (url) allPhotos.push({ id: p.id, url, recordingName: recName });
        }
      }
    }
    setRecordingReceiptPhotos(allPhotos);
  };
  const addReceiptFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      let entryId = linkedReceipt?.id;
      if (!entryId) {
        const { data: entry } = await supabase.from('receipt_entries').insert({ user_id: userId, note: String(name), split_bill_id: splitBillId }).select().maybeSingle();
        entryId = entry?.id;
      }
      if (!entryId) return;
      const compressed = await compressImage(result.assets[0].uri);
      await uploadReceiptPhoto(compressed, entryId);
      setAddReceiptModal(false);
      loadLinkedReceipt();
    }
  };
  const addReceiptFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1 });
    if (!result.canceled) {
      let entryId = linkedReceipt?.id;
      if (!entryId) {
        const { data: entry } = await supabase.from('receipt_entries').insert({ user_id: userId, note: String(name), split_bill_id: splitBillId }).select().maybeSingle();
        entryId = entry?.id;
      }
      if (!entryId) return;
      for (const asset of result.assets) {
        const compressed = await compressImage(asset.uri);
        await uploadReceiptPhoto(compressed, entryId);
      }
      setAddReceiptModal(false);
      loadLinkedReceipt();
    }
  };
  useEffect(() => { if (splitBillId) loadLinkedReceipt(); }, [splitBillId]);

  const handleDeleteReceiptPhoto = async () => {
    const pool = photoModalPool === 'direct' ? receiptPhotos : recordingReceiptPhotos;
    const current = pool[photoModalIndex];
    if (!current) return;
    // Remove from storage + DB
    const { data: row } = await supabase.from('receipt_photos').select('storage_path').eq('id', current.id).maybeSingle();
    if (row?.storage_path) await supabase.storage.from('receipts').remove([row.storage_path]);
    await supabase.from('receipt_photos').delete().eq('id', current.id);
    // Adjust index if we deleted the last item
    const newIndex = Math.max(0, photoModalIndex - 1);
    setPhotoModalIndex(newIndex);
    if (pool.length <= 1) setPhotoModal(false);
    loadLinkedReceipt();
  };

  // ── Friends list (for invite matching) ─────────────────────────────────────────────
  const { data: friends = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['friends', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('friendships')
        .select('id, requester_id, receiver_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
      if (!data || data.length === 0) return [];
      const friendIds = data.map((r: any) =>
        r.requester_id === userId ? r.receiver_id : r.requester_id
      );
      const names = await Promise.all(
        friendIds.map((id: string) =>
          supabase.rpc('get_user_display_name', { user_id: id }).then(({ data }) => ({ id, name: data ?? '' }))
        )
      );
      return names.filter(n => n.name);
    },
    enabled: !!userId,
  });
  useEffect(() => {
    if (!userId) return;
    supabase.from('contacts').select('name').eq('user_id', userId).order('name')
      .then(({ data }) => { if (data) setContacts(data.map((c: any) => c.name)); });
  }, [userId]);
  const [allRecordings, setAllRecordings] = useState<any[]>([]);
  // ── New unified Add Item modal state ──────────────────────────────────
  const [newItemModal, setNewItemModal] = useState(false);
  const [newItemStep, setNewItemStep] = useState<'choice' | 'form' | 'pick-recording' | 'scan-review' | 'scanning' | 'ocr-text'>('choice');
  const [newItemOcrText, setNewItemOcrText] = useState('');
  const [newItemFromRecording, setNewItemFromRecording] = useState<any>(null); // null = manual
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemPeople, setNewItemPeople] = useState<string[]>([]);
  const [newItemTab, setNewItemTab] = useState<'assign' | 'subitems'>('assign');
  const [newItemSubitems, setNewItemSubitems] = useState<{ name: string; amount: string; people: string[] }[]>([]);
  const [newItemPeopleSearch, setNewItemPeopleSearch] = useState('');
  const [newItemRecSearch, setNewItemRecSearch] = useState('');
  const [newItemRecShowMore, setNewItemRecShowMore] = useState(false);
  const [newItemSaving, setNewItemSaving] = useState(false);
  const [newItemScanLoading, setNewItemScanLoading] = useState(false);
  const [newItemScanGroups, setNewItemScanGroups] = useState<{ photoUri: string; items: { name: string; cost: string; selected?: boolean }[] }[]>([]);
  const [newItemScanItems, setNewItemScanItems] = useState<{ name: string; cost: string; selected?: boolean }[]>([]);
  const [newItemScanError, setNewItemScanError] = useState('');
  const [newItemScanSourceModal, setNewItemScanSourceModal] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [viewPhotoUri, setViewPhotoUri] = useState<string | null>(null);
  // All contacts + friends merged for assign people — deduplicated case-insensitively
  // Current user goes first
  const allPeopleForAssign = [...new Map(
    [
      ...(userName ? [userName] : []),
      ...friends.map(f => f.name),
      ...contacts.filter(c => !friends.some(f => f.name.toLowerCase() === c.toLowerCase())),
    ]
    .filter((n, idx, arr) => arr.findIndex(x => x.toLowerCase() === n.toLowerCase()) === idx)
    .map(name => [name.toLowerCase(), name])
  ).values()];
  const displayPersonName = (p: string) =>
    userName && p.toLowerCase() === userName.toLowerCase() ? `You (${p})` : p;
  const openNewItemModal = () => {
    setNewItemStep('choice');
    setNewItemFromRecording(null);
    setNewItemName('');
    setNewItemAmount('');
    setNewItemPeople([]);
    setNewItemTab('assign');
    setNewItemSubitems([]);
    setNewItemPeopleSearch('');
    setNewItemRecSearch('');
    setNewItemRecShowMore(false);
    setNewItemScanGroups([]);
    setNewItemScanItems([]);
    setNewItemScanError('');
    setNewItemOcrText('');
    setAssignItem(null);
    setNewItemModal(true);
  };
  const handleCameraDone = async (uris: string[]) => {
    setCameraVisible(false);
    if (uris.length === 0) return;
    setNewItemScanLoading(true);
    setNewItemScanError('');
    setNewItemStep('scanning');
    try {
      const groups: { photoUri: string; items: { name: string; cost: string; selected?: boolean }[] }[] = [];
      for (const uri of uris) {
        const parsed = await ocrReceiptImage(uri);
        groups.push({ photoUri: uri, items: parsed.items.map((i: any) => ({ name: i.name, cost: String(i.price), selected: true })) });
        let entryId = linkedReceipt?.id;
        if (!entryId) {
          const { data: entry } = await supabase.from('receipt_entries').insert({ user_id: userId, note: String(name), split_bill_id: splitBillId }).select().maybeSingle();
          entryId = entry?.id;
        }
        if (entryId) { await uploadReceiptPhoto(uri, entryId); loadLinkedReceipt(); }
      }
      const hasItems = groups.some(g => g.items.length > 0);
      if (!hasItems) {
        setNewItemScanError('no items detected — try a clearer photo');
        setNewItemStep('choice');
      } else {
        setNewItemScanGroups(groups);
        setNewItemStep('scan-review');
      }
    } catch (e: any) {
      setNewItemScanError(`failed to read receipt — ${e?.message ?? 'unknown error'}`);
      setNewItemStep('choice');
    }
    setNewItemScanLoading(false);
  };
  const handleScanReceipt = async (source: 'camera' | 'gallery') => {
    setNewItemScanSourceModal(false);
    if (source === 'camera') {
      setCameraVisible(true);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1 });
    if (result.canceled || !result.assets.length) return;
    setNewItemScanLoading(true);
    setNewItemScanError('');
    setNewItemStep('scanning');
    try {
      const groups: { photoUri: string; items: { name: string; cost: string; selected?: boolean }[] }[] = [];
      for (const asset of result.assets) {
        const parsed = await ocrReceiptImage(asset.uri);
        groups.push({ photoUri: asset.uri, items: parsed.items.map((i: any) => ({ name: i.name, cost: String(i.price), selected: true })) });
        let entryId = linkedReceipt?.id;
        if (!entryId) {
          const { data: entry } = await supabase.from('receipt_entries').insert({ user_id: userId, note: String(name), split_bill_id: splitBillId }).select().maybeSingle();
          entryId = entry?.id;
        }
        if (entryId) { await uploadReceiptPhoto(asset.uri, entryId); loadLinkedReceipt(); }
      }
      const hasItems = groups.some(g => g.items.length > 0);
      if (!hasItems) {
        setNewItemScanError('no items detected — try a clearer photo');
        setNewItemStep('choice');
      } else {
        setNewItemScanGroups(groups);
        setNewItemStep('scan-review');
      }
    } catch (e: any) {
      setNewItemScanError(`failed to read receipt — ${e?.message ?? 'unknown error'}`);
      setNewItemStep('choice');
    }
    setNewItemScanLoading(false);
  };
  const [scanFromReceiptsModal, setScanFromReceiptsModal] = useState(false);
  const handleScanFromReceiptPhoto = async (url: string) => {
    setScanFromReceiptsModal(false);
    setNewItemScanSourceModal(false);
    setNewItemScanLoading(true);
    setNewItemScanError('');
    setNewItemStep('scanning');
    try {
      const parsed = await ocrReceiptImage(url);
      if (parsed.items.length === 0) {
        setNewItemScanError('no items detected — try a clearer photo');
        setNewItemStep('choice');
      } else {
        setNewItemScanGroups([{ photoUri: url, items: parsed.items.map((i: any) => ({ name: i.name, cost: String(i.price), selected: true })) }]);
        setNewItemStep('scan-review');
      }
    } catch (e: any) {
      setNewItemScanError('failed to read receipt — try again or add manually');
      setNewItemStep('choice');
    }
    setNewItemScanLoading(false);
  };
  const saveScanItems = async () => {
    const allValid = newItemScanGroups.flatMap(g => g.items.filter(r => r.selected !== false && r.name.trim() && parseFloat(r.cost) > 0));
    if (!allValid.length) return;
    setNewItemSaving(true);
    const existingReceiptCount = items.filter((i: any) => i.name && /^receipt \d+$/i.test(i.name.trim())).length;
    let receiptCounter = existingReceiptCount;
    for (const group of newItemScanGroups) {
      const valid = group.items.filter(r => r.selected !== false && r.name.trim() && parseFloat(r.cost) > 0);
      if (!valid.length) continue;
      receiptCounter++;
      const parentCost = valid.reduce((s, r) => s + parseFloat(r.cost), 0);
      const { data: parent } = await supabase.from('split_items').insert({
        split_bill_id: splitBillId, user_id: userId, name: `Receipt ${receiptCounter}`,
        cost: parentCost, recording_type: 'expense', people: [],
      }).select('id').single();
      if (parent?.id) {
        await supabase.from('split_items').insert(
          valid.map(r => ({
            split_bill_id: splitBillId, user_id: userId,
            name: r.name.trim(), cost: parseFloat(r.cost),
            recording_type: 'expense', parent_item_id: parent.id,
          }))
        );
      }
    }
    setNewItemScanGroups([]);
    setNewItemScanItems([]);
    setNewItemSaving(false);
    setNewItemModal(false);
    refetchItems();
  };
  const openNewItemForm = (recording: any | null) => {
    setNewItemFromRecording(recording);
    setNewItemName(recording ? recording.name : '');
    setNewItemAmount(recording ? String(recording.amount) : '');
    setNewItemPeople([]);
    setNewItemTab('assign');
    setNewItemSubitems([]);
    setNewItemPeopleSearch('');
    setNewItemStep('form');
  };
  const newItemRecordingBudgetUsed = newItemFromRecording
    ? items.filter((i: any) => i.recording_id === newItemFromRecording.id).reduce((s: number, i: any) => s + Number(i.cost), 0)
    : 0;
  const newItemSubitemsTotal = newItemSubitems.reduce((s, sub) => s + (parseFloat(sub.amount || '0') || 0), 0);
  const newItemRecordingOver = newItemFromRecording
    ? newItemSubitemsTotal > Number(newItemFromRecording.amount) - newItemRecordingBudgetUsed + 0.01
    : false;
  const saveNewItem = async () => {
    if (newItemSaving) return;
    const hasSubitems = newItemSubitems.length > 0;
    if (!newItemName.trim()) return;
    if (!hasSubitems && !newItemAmount) return;
    if (newItemFromRecording && newItemRecordingOver) return;
    setNewItemSaving(true);
    const recId = newItemFromRecording?.id ?? null;
    const recType = newItemFromRecording?.type ?? 'expense';
    // If editing an existing item (assignItem is set), update instead of insert
    if (assignItem && !hasSubitems) {
      await supabase.from('split_items').update({
        name: newItemName.trim(),
        cost: parseFloat(newItemAmount || '0') || 0,
        people: newItemPeople.length ? newItemPeople : null,
      }).eq('id', assignItem.id);
      setNewItemSaving(false);
      setNewItemModal(false);
      setAssignItem(null);
      refetchItems();
      return;
    }
    if (hasSubitems) {
      const validSubs = newItemSubitems.filter(s => s.name.trim() && parseFloat(s.amount || '0') > 0);
      if (validSubs.length === 0) { setNewItemSaving(false); return; }
      const parentCost = validSubs.reduce((s, sub) => s + (parseFloat(sub.amount || '0') || 0), 0);
      const { data: parent, error: parentErr } = await supabase.from('split_items').insert({
        split_bill_id: splitBillId,
        recording_id: recId,
        user_id: userId,
        name: newItemName.trim(),
        cost: parentCost,
        recording_type: recType,
        people: [],
      }).select('id').single();
      if (parentErr) { console.error('parent insert error:', parentErr); setNewItemSaving(false); return; }
      if (parent?.id) {
        for (const sub of validSubs) {
          await supabase.from('split_items').insert({
            split_bill_id: splitBillId,
            recording_id: recId,
            user_id: userId,
            name: sub.name.trim(),
            cost: parseFloat(sub.amount || '0'),
            recording_type: recType,
            people: sub.people.length ? sub.people : [],
            parent_item_id: parent.id,
          });
        }
      }
    } else {
      await supabase.from('split_items').insert({
        split_bill_id: splitBillId,
        recording_id: recId,
        user_id: userId,
        name: newItemName.trim(),
        cost: parseFloat(newItemAmount || '0') || 0,
        recording_type: recType,
        people: newItemPeople.length ? newItemPeople : [],
      });
    }
    // If from recording and not yet linked, link it
    if (recId) {
      const alreadyLinked = linkedRecordings.some((lr: any) => lr.recording?.id === recId);
      if (!alreadyLinked) {
        await supabase.from('split_bill_recordings').insert({
          split_bill_id: splitBillId,
          recording_id: recId,
          amount_contributed: newItemFromRecording.amount,
        });
        queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
      }
    }
    setNewItemSaving(false);
    setNewItemModal(false);
    refetchItems();
  };

  // assign-people sheet (tap an existing item)
  const [assignItem, setAssignItem]   = useState<any>(null);
  const [assignPeople, setAssignPeople] = useState<string[]>([]);
  // Edit item modal state
  const [editItemModal, setEditItemModal] = useState(false);
  const [editItemTarget, setEditItemTarget] = useState<any>(null); // the parent group
  const [editItemTab, setEditItemTab] = useState<'assign' | 'subitems'>('assign');
  const [editItemSubSearch, setEditItemSubSearch] = useState('');
  const [editItemPeopleSearch, setEditItemPeopleSearch] = useState('');
  // Add subitem modal state
  const [addSubitemModal, setAddSubitemModal] = useState(false);
  const [subitemName, setSubitemName] = useState('');
  const [subitemCost, setSubitemCost] = useState('');
  const [subitemPeople, setSubitemPeople] = useState<string[]>([]);
  const [subitemPeopleSearch, setSubitemPeopleSearch] = useState('');
  const [savingSubitem, setSavingSubitem] = useState(false);
  const [editingSubitemId, setEditingSubitemId] = useState<string | null>(null);
  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ['split-bill-items', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_items')
        .select('*, parent_item_id')
        .eq('split_bill_id', splitBillId)
        .order('created_at');
      return data ?? [];
    },
    enabled: !!splitBillId,
  });
  const filledPeople = [...new Set(
    items.flatMap((i: any) => i.people ?? [])
  )];
  // receivable / expense = collect from them (+), loan / income / savings = give back (-)
  const isDeductType = (type: string) => type === 'payable' || type === 'debt';
  const totalItemsCost = items.reduce((s: number, i: any) => s + Number(i.cost), 0);
  const openAddItem = () => {
    setItemStep('pick-type');
    setSelectedRecording(null);
    setItemRows([{ name: '', cost: '' }]);
    setParsedItems([]);
    setParsedTotal(null);
    setParseReceiptPhotos([]);
    setParseError('');
    setAddItemModal(true);
  };
  const handlePickRecording = async (lr: any) => {
    setSelectedRecording(lr);
    setItemRows([{ name: '', cost: '' }]);
    // Check if this recording already has receipt photos
    const recId = lr.recording?.id;
    if (!recId) { setItemStep('add-items'); return; }
    const { data: entries } = await supabase
      .from('receipt_entries')
      .select('id')
      .eq('recording_id', recId)
      .limit(1);
    if (entries && entries.length > 0) {
      // Has receipt — load photos and go straight to parse choice
      const { data: photos } = await supabase
        .from('receipt_photos')
        .select('id, storage_path, url')
        .eq('entry_id', entries[0].id)
        .order('created_at');
      const urls = await Promise.all((photos ?? []).map(async (p: any) => {
        let url = p.url ?? '';
        if (!url && p.storage_path) {
          const { data } = await supabase.storage.from('receipts').createSignedUrl(p.storage_path, 3600);
          url = data?.signedUrl ?? '';
        }
        return { id: p.id, url };
      }));
      setParseReceiptPhotos(urls.filter(p => p.url));
      setItemStep('parse-choice');
    } else {
      // No receipt — go to parse choice (will offer upload)
      setParseReceiptPhotos([]);
      setItemStep('parse-choice');
    }
  };
  const handleParseReceipt = async (photos: { id: string; url: string }[]) => {
    if (photos.length === 0) return;
    setParseLoading(true);
    setParseError('');
    setItemStep('parsing');
    try {
      // Parse the first photo (primary receipt image)
      const result = await ocrReceiptImage(photos[0].url);
      if (result.items.length === 0) {
        setParseError('no items detected — try a clearer photo or add manually');
        setItemStep('parse-choice');
      } else {
        setParsedItems(result.items.map(i => ({ name: i.name, cost: String(i.price) })));
        setParsedTotal(result.detectedTotal);
        setParsePhotoIndex(0);
        setItemStep('parse-review');
      }
    } catch (e) {
      setParseError('failed to read receipt — try again or add manually');
      setItemStep('parse-choice');
    } finally {
      setParseLoading(false);
    }
  };
  const handleUploadReceiptForParse = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    setParseLoading(true);
    setItemStep('parsing');
    try {
      // Upload to the recording's receipt entry
      const recId = selectedRecording?.recording?.id;
      if (recId) {
        let entryId: string | null = null;
        const { data: existing } = await supabase.from('receipt_entries').select('id').eq('recording_id', recId).limit(1);
        if (existing && existing.length > 0) {
          entryId = existing[0].id;
        } else {
          const { data: entry } = await supabase.from('receipt_entries').insert({ user_id: userId, note: selectedRecording?.recording?.name ?? '', recording_id: recId }).select().maybeSingle();
          entryId = entry?.id ?? null;
        }
        if (entryId) {
          const compressed = await compressImage(result.assets[0].uri);
          await uploadReceiptPhoto(compressed, entryId);
        }
      }
      const result2 = await ocrReceiptImage(result.assets[0].uri);
      if (result2.items.length === 0) {
        setParseError('no items detected — try a clearer photo or add manually');
        setItemStep('parse-choice');
      } else {
        setParseReceiptPhotos([{ id: 'uploaded', url: result.assets[0].uri }]);
        setParsedItems(result2.items.map(i => ({ name: i.name, cost: String(i.price) })));
        setParsedTotal(result2.detectedTotal);
        setParsePhotoIndex(0);
        setItemStep('parse-review');
      }
    } catch (e) {
      setParseError('failed to read receipt — try again or add manually');
      setItemStep('parse-choice');
    } finally {
      setParseLoading(false);
    }
  };
  const saveParsedItems = async () => {
    const valid = parsedItems.filter(r => r.name.trim() && r.cost && parseFloat(r.cost) > 0);
    if (!valid.length) return;
    const recTotal = Number(selectedRecording?.amount_contributed ?? 0);
    const alreadyUsed = items
      .filter((i: any) => i.recording_id === selectedRecording?.recording?.id)
      .reduce((s: number, i: any) => s + Number(i.cost), 0);
    const newTotal = valid.reduce((s, r) => s + parseFloat(r.cost || '0'), 0);
    if (recTotal > 0 && alreadyUsed + newTotal > recTotal + 0.01) { setParseOverBudgetModal(true); return; }
    setSavingItem(true);
    const recType = selectedRecording?.recording?.type ?? 'expense';
    await supabase.from('split_items').insert(
      valid.map(r => ({
        split_bill_id: splitBillId,
        recording_id: selectedRecording?.recording?.id ?? null,
        user_id: userId,
        name: r.name.trim(),
        cost: parseFloat(r.cost),
        recording_type: recType,
      }))
    );
    setSavingItem(false);
    setAddItemModal(false);
    refetchItems();
  };
  const saveManualItems = async () => {
    const valid = itemRows.filter(r => r.name.trim() && r.cost);
    if (!valid.length) return;
    setSavingItem(true);
    await supabase.from('split_items').insert(
      valid.map(r => ({
        split_bill_id: splitBillId,
        user_id: userId,
        name: r.name.trim(),
        cost: parseFloat(r.cost),
        recording_type: manualItemType,
      }))
    );
    setSavingItem(false);
    setAddItemModal(false);
    refetchItems();
  };
  const saveItems = async () => {
    const valid = itemRows.filter(r => r.name.trim() && r.cost);
    if (!valid.length) return;
    const recTotal = Number(selectedRecording.amount_contributed);
    const alreadyUsed = items
      .filter((i: any) => i.recording_id === selectedRecording.recording?.id)
      .reduce((s: number, i: any) => s + Number(i.cost), 0);
    const newTotal = valid.reduce((s, r) => s + parseFloat(r.cost || '0'), 0);
    if (alreadyUsed + newTotal > recTotal + 0.01) return;
    setSavingItem(true);
    const recType = selectedRecording.recording?.type ?? 'expense';
    const { error } = await supabase.from('split_items').insert(
      valid.map(r => ({
        split_bill_id: splitBillId,
        recording_id: selectedRecording.recording?.id,
        user_id: userId,
        name: r.name.trim(),
        cost: parseFloat(r.cost),
        recording_type: recType,
      }))
    ).select();
    setSavingItem(false);
    if (error) return;
    setAddItemModal(false); refetchItems();
  };
  const openAssign = (item: any) => {
    const lr = linkedRecordings.find((l: any) => l.recording?.id === item.recording_id);
    // For recording-linked items group by recording_id.
    // For manual items group by parent_item_id (if a subitem) or own id (if parent/standalone).
    const groupKey = item.recording_id
      ? (i: any) => i.recording_id === item.recording_id
      : item.parent_item_id
        ? (i: any) => i.parent_item_id === item.parent_item_id || i.id === item.parent_item_id
        : (i: any) => i.id === item.id || i.parent_item_id === item.id;
    const groupItems = items.filter(groupKey);
    // Always use the parent item (no parent_item_id) as the anchor for editItemTarget
    const parentItem = item.recording_id
      ? groupItems[0] ?? item
      : groupItems.find((i: any) => !i.parent_item_id) ?? item;
    const recAmount = lr
      ? Number(lr.amount_contributed)
      : groupItems.reduce((s: number, i: any) => s + Number(i.cost), 0);
    setEditItemTarget({
      item: parentItem,
      recName: lr?.recording?.name ?? parentItem.name,
      recAmount,
      isExisting: !!parentItem.recording_id,
      groupItems,
    });
    const hasExistingSubitems = groupItems.length > 1;
    setEditItemTab(hasExistingSubitems ? 'subitems' : 'assign');
    setEditItemSubSearch('');
    setEditItemPeopleSearch('');
    setAssignItem(parentItem);
    setAssignPeople(parentItem.people ?? []);
    // Open newItemModal in form step pre-filled with this item
    setNewItemFromRecording(lr?.recording ?? null);
    setNewItemName(parentItem.name);
    setNewItemAmount(String(parentItem.cost));
    setNewItemPeople(parentItem.people ?? []);
    setNewItemTab(hasExistingSubitems ? 'subitems' : 'assign');
    setNewItemSubitems([]);
    setNewItemPeopleSearch('');
    setNewItemScanGroups([]);
    setNewItemScanItems([]);
    setNewItemScanError('');
    setNewItemStep('form');
    setNewItemModal(true);
  };
  const [editItemTabWarnModal, setEditItemTabWarnModal] = useState(false);
  const [editItemTabPending, setEditItemTabPending] = useState<'assign' | 'subitems' | null>(null);
  const handleEditItemTabChange = (tab: 'assign' | 'subitems') => {
    if (tab === editItemTab) return;
    // Warn if switching away from a tab that has content
    if (editItemTab === 'assign' && assignPeople.length > 0) {
      setEditItemTabPending(tab);
      setEditItemTabWarnModal(true);
      return;
    }
    if (editItemTab === 'subitems') {
      const subitems = (editItemTarget?.groupItems ?? []).filter((i: any) => i.id !== editItemTarget?.item?.id);
      if (subitems.length > 0) {
        setEditItemTabPending(tab);
        setEditItemTabWarnModal(true);
        return;
      }
    }
    setEditItemTab(tab);
  };
  const confirmEditItemTabChange = async () => {
    if (!editItemTabPending) return;
    if (editItemTab === 'assign' && assignPeople.length > 0) {
      // Clear people assignment on parent item
      setAssignPeople([]);
      await supabase.from('split_items').update({ people: null }).eq('id', assignItem.id);
      refetchItems();
    }
    if (editItemTab === 'subitems') {
      // Delete all subitems
      const subitems = (editItemTarget?.groupItems ?? []).filter((i: any) => i.id !== editItemTarget?.item?.id);
      for (const sub of subitems) {
        await supabase.from('split_items').delete().eq('id', sub.id);
      }
      setEditItemTarget((prev: any) => prev ? { ...prev, groupItems: [prev.item] } : prev);
      await refetchItems();
    }
    setEditItemTab(editItemTabPending);
    setEditItemTabPending(null);
    setEditItemTabWarnModal(false);
  };
  const openAddSubitem = (prefill?: { id: string; name: string; cost: string; people: string[] }) => {
    setSubitemName(prefill?.name ?? '');
    setSubitemCost(prefill?.cost ?? '');
    setSubitemPeople(prefill?.people ?? []);
    setSubitemPeopleSearch('');
    setEditingSubitemId(prefill?.id ?? null);
    setAddSubitemModal(true);
  };
  const saveSubitem = async () => {
    if (!subitemName.trim() || !subitemCost) return;
    setSavingSubitem(true);
    const target = editItemTarget;
    const recId = target?.item?.recording_id ?? null;
    const recType = target?.item?.recording_type ?? 'receivable';
    if (editingSubitemId) {
      await supabase.from('split_items').update({
        name: subitemName.trim(),
        cost: parseFloat(subitemCost),
        people: subitemPeople.length ? subitemPeople : null,
      }).eq('id', editingSubitemId);
    } else {
      // Clear people on parent item since subitems now handle assignment
      await supabase.from('split_items').update({ people: null }).eq('id', target.item.id);
      await supabase.from('split_items').insert({
        split_bill_id: splitBillId,
        recording_id: recId,
        user_id: userId,
        name: subitemName.trim(),
        cost: parseFloat(subitemCost),
        recording_type: recType,
        people: subitemPeople.length ? subitemPeople : null,
      });
    }
    setSavingSubitem(false);
    setAddSubitemModal(false);
    refetchItems();
    // Refresh groupItems in editItemTarget
    const updated = await supabase.from('split_items').select('*').eq('split_bill_id', splitBillId).order('created_at');
    const allItems = updated.data ?? [];
    const groupItems = allItems.filter((i: any) => i.recording_id === recId);
    setEditItemTarget((prev: any) => prev ? { ...prev, groupItems } : prev);
  };

  const deleteItem = async (id: string) => {
    const item = items.find((i: any) => i.id === id);
    await supabase.from('split_items').delete().eq('id', id);
    if (item?.recording_id) {
      const remaining = items.filter((i: any) => i.recording_id === item.recording_id && i.id !== id);
      if (remaining.length === 0) {
        await supabase.from('split_bill_recordings').delete()
          .eq('split_bill_id', splitBillId)
          .eq('recording_id', item.recording_id);
        queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
      }
    }
    await refetchItems();
    // Refresh groupItems in editItemTarget if modal is open
    setEditItemTarget((prev: any) => {
      if (!prev) return prev;
      return { ...prev, groupItems: prev.groupItems.filter((i: any) => i.id !== id) };
    });
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const { data: shareRow, refetch: refetchShareRow } = useQuery({
    queryKey: ['split-bill-share', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_shares')
        .select('id, data, slug, user_id')
        .eq('split_bill_id', splitBillId)
        .maybeSingle();
      return data;
    },
    enabled: !!splitBillId,
  });
  const [shareModal, setShareModal]             = useState(false);
  const [shareAccounts, setShareAccounts]       = useState<any[]>([]);
  const [shareAccountsLoaded, setShareAccountsLoaded] = useState(false);
  const [shareSelectedIds, setShareSelectedIds] = useState<string[]>([]);
  const [shareOriginalIds, setShareOriginalIds] = useState<string[]>([]);
  const [shareLink, setShareLink]               = useState('');
  const [shareCopied, setShareCopied]           = useState(false);
  const [shareSaving, setShareSaving]           = useState(false);
  const [shareGenerating, setShareGenerating]   = useState(false);
  const [saveImgLoading, setSaveImgLoading]     = useState(false);
  const [walletPickerModal, setWalletPickerModal] = useState(false);
  const [walletSearch, setWalletSearch]           = useState('');

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [actionsModal, setActionsModal] = useState(false);

  // Load saved wallet selection + account details when shareRow becomes available
  useEffect(() => {
    if (!shareRow?.id) return;
    const savedIds = shareRow.data?.account_ids ?? [];
    setShareSelectedIds(savedIds);
    setShareOriginalIds(savedIds);
    // Restore the share link if a slug already exists
    if (shareRow.slug && shareRow.user_id) {
      setShareLink(`https://ledgr.art/split/${shareRow.user_id}/${shareRow.slug}`);
    }
    if (savedIds.length > 0 && shareAccounts.length === 0) {
      supabase.from('accounts').select('id, account_name, bank, account_number, qr_code')
        .eq('user_id', userId).order('account_name')
        .then(({ data }) => { if (data) { setShareAccounts(data); setShareAccountsLoaded(true); } });
    }
  }, [shareRow?.id]);
  const openShareModal = async () => {
    setShareCopied(false);
    const { data: accs } = await supabase
      .from('accounts')
      .select('id, account_name, bank, account_number, qr_code')
      .eq('user_id', userId)
      .order('account_name');
    setShareAccounts(accs ?? []);
    if (shareRow) {
      const savedIds = shareRow.data?.account_ids ?? [];
      setShareSelectedIds(savedIds);
      setShareOriginalIds(savedIds);
      const link = shareRow.slug && shareRow.user_id
        ? `https://ledgr.art/split/${shareRow.user_id}/${shareRow.slug}`
        : `https://ledgr.art/split/${shareRow.id}`;
      setShareLink(link);
    } else {
      setShareSelectedIds([]);
      setShareOriginalIds([]);
      setShareLink('');
    }
    setShareModal(true);
  };
  const saveShareAccounts = async () => {
    if (!shareRow) return;
    setShareSaving(true);
    await supabase.from('split_shares').update({ data: { account_ids: shareSelectedIds } }).eq('id', shareRow.id);
    await refetchShareRow();
    setShareOriginalIds([...shareSelectedIds]);
    setShareSaving(false);
  };
  const generateLink = async () => {
    setShareGenerating(true);
    const firstRecordingId = linkedRecordings[0]?.recording?.id ?? null;
    // Build slug from bill name
    const baseSlug = String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'bill';
    // Find existing slugs for this user to determine counter
    const { data: existing } = await supabase
      .from('split_shares')
      .select('slug')
      .eq('user_id', userId)
      .like('slug', `${baseSlug}%`);
    const usedSlugs = (existing ?? []).map((r: any) => r.slug).filter(Boolean);
    // Check if a share row already exists for this split bill
    const { data: existingRow } = await supabase
      .from('split_shares')
      .select('id, slug')
      .eq('split_bill_id', splitBillId)
      .maybeSingle();
    // If it already has a slug, just reuse it — no need to generate a new one
    if (existingRow?.slug) {
      setShareGenerating(false);
      const link = `https://ledgr.art/split/${userId}/${existingRow.slug}`;
      setShareLink(link);
      await refetchShareRow();
      return link;
    }
    let slug = baseSlug;
    let counter = 2;
    while (usedSlugs.includes(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    let finalSlug = slug;
    let shareId: string | null = null;
    if (existingRow) {
      // Update existing row — only set slug/user_id, don't touch account_ids
      finalSlug = existingRow.slug ?? slug;
      if (!existingRow.slug) {
        await supabase.from('split_shares').update({ slug, user_id: userId }).eq('id', existingRow.id);
      }
      shareId = existingRow.id;
    } else {
      // Insert new row — account_ids start empty, wallet section manages them separately
      const payload: any = {
        split_bill_id: splitBillId,
        data: { account_ids: shareSelectedIds },
        user_id: userId,
        slug,
      };
      if (firstRecordingId) payload.recording_id = firstRecordingId;
      const { data: inserted } = await supabase.from('split_shares').insert(payload).select('id').single();
      shareId = inserted?.id ?? null;
    }
    setShareGenerating(false);
    if (!shareId) return '';
    const link = `https://ledgr.art/split/${userId}/${finalSlug}`;
    setShareLink(link);
    await refetchShareRow();
    return link;
  };
  const copyShareLink = async (linkOverride?: string) => {
    const link = linkOverride ?? shareLink;
    if (!link) return;
    if (Platform.OS !== 'web') {
      await Clipboard.setStringAsync(link);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(link)
        .then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); })
        .catch(() => fallbackCopy(link));
    } else { fallbackCopy(link); }
  };
  const fallbackCopy = (link: string) => {
    if (typeof document === 'undefined') return;
    const el = document.createElement('textarea');
    el.value = link;
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0;font-size:16px';
    document.body.appendChild(el); el.focus(); el.select();
    try { document.execCommand('copy'); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); } catch (_) {}
    document.body.removeChild(el);
  };
  const viewShotRef = useRef<any>(null);
  const saveAsImage = async () => {
    setSaveImgLoading(true);
    try {
      if (Platform.OS !== 'web') {
        const uri = await viewShotRef.current.capture();
        const MediaLibrary = require('expo-media-library');
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(uri);
        } else {
          const Sharing = require('expo-sharing');
          if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png' });
        }
      } else {
        const html2canvas = (await import('html2canvas')).default;
        const el = document.getElementById('split-bill-capture');
        if (!el) return;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${String(name).toLowerCase().replace(/\s+/g, '-')}-split.png`;
        a.click();
      }
    } catch (e) { console.error('saveAsImage error:', e); }
    setSaveImgLoading(false);
  };
  const { data: linkedRecordings = [], isLoading: loadingRecs } = useQuery({
    queryKey: ['split-bill-recordings', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_bill_recordings')
        .select('id, amount_contributed, recording:recording_id(id, name, amount, type, transaction_date, status, paid_amount, is_due, space_id, category_id, linked_recording_id)')
        .eq('split_bill_id', splitBillId)
        .order('created_at');
      return (data ?? []).map((r: any) => ({
        ...r,
        recording: Array.isArray(r.recording) ? r.recording[0] : r.recording,
      }));
    },
    enabled: !!splitBillId,
  });
  // Load recording receipts whenever linked recordings change
  useEffect(() => {
    if (linkedRecordings.length > 0) loadRecordingReceipts(linkedRecordings);
    else setRecordingReceiptPhotos([]);
  }, [linkedRecordings.map((lr: any) => lr.recording?.id).join(',')]);
  // ── Mark recording complete (from split bill) ──────────────────────────
  const [removeRecordingBlockedModal, setRemoveRecordingBlockedModal] = useState(false);
  const [markRecCompleteModal, setMarkRecCompleteModal] = useState(false);
  const handleRemoveRecording = async (lr: any) => {
    const rec = lr.recording;
    if (!rec) return;
    // Check if any payments have been credited to this recording
    const { data: linkedReturns } = await supabase
      .from('recordings')
      .select('id')
      .eq('linked_recording_id', rec.id)
      .eq('split_bill_id', splitBillId)
      .limit(1);
    if (linkedReturns && linkedReturns.length > 0) {
      // Payments exist — block removal
      setRemoveRecordingBlockedModal(true);
      return;
    }
    // No payments — safe to remove: delete linked items too
    await supabase.from('split_items').delete()
      .eq('split_bill_id', splitBillId)
      .eq('recording_id', rec.id);
    await supabase.from('split_bill_recordings').delete().eq('id', lr.id);
    queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
    refetchItems();
  };
  const [markRecCompleteLr, setMarkRecCompleteLr]       = useState<any>(null);
  const [markRecCompleteLoading, setMarkRecCompleteLoading] = useState(false);
  const openMarkRecComplete = (lr: any) => {
    setMarkRecCompleteLr(lr);
    setMarkRecCompleteModal(true);
  };
  const confirmMarkRecComplete = async () => {
    if (!markRecCompleteLr) return;
    setMarkRecCompleteLoading(true);
    const rec = markRecCompleteLr.recording;
    await supabase.from('recordings').update({ paid_amount: rec.amount, status: 'paid', is_due: true }).eq('id', rec.id);
    setMarkRecCompleteModal(false);
    setMarkRecCompleteLr(null);
    setMarkRecCompleteLoading(false);
    queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
  };
  // ── Close confirm ────────────────────────────────────────────────────────
  const [closeConfirmModal, setCloseConfirmModal] = useState(false);
  const [unpaidPeopleNames, setUnpaidPeopleNames] = useState<string[]>([]);
  const [closingLoading, setClosingLoading] = useState(false);
  const [closeCreateRecording, setCloseCreateRecording] = useState(false);
  const [closeSpaceId, setCloseSpaceId] = useState<string | null>(null);
  const [closeSpaces, setCloseSpaces] = useState<any[]>([]);
  const [closeNoRecordings, setCloseNoRecordings] = useState(false);
  const handleToggleStatus = async () => {
    if (billStatus === 'closed') {
      // Reopening — revert recordings back to their actual collected state
      for (const lr of linkedRecordings) {
        const rec = lr.recording;
        if (!rec) continue;
        const { data: returnRecs } = await supabase
          .from('recordings')
          .select('amount')
          .eq('linked_recording_id', rec.id)
          .eq('split_bill_id', splitBillId)
          .eq('type', 'return');
        const actualCollected = (returnRecs ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
        const total = Number(rec.amount);
        const newStatus = actualCollected <= 0 ? 'unpaid' : actualCollected >= total - 0.01 ? 'paid' : 'partial';
        await supabase.from('recordings').update({
          paid_amount: actualCollected,
          status: newStatus,
        }).eq('id', rec.id);
      }
      await supabase.from('split_bills').update({ status: 'ongoing' }).eq('id', splitBillId);
      setBillStatus('ongoing');
      queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
      return;
    }
    // Closing — find people who haven't fully paid
    const totals = computeTotals();
    const unpaid = filledPeople.filter(p => {
      const owed = Math.abs(totals[p] ?? 0);
      const paid = activePayments
        .filter((pay: any) => pay.person_name === p)
        .reduce((s: number, pay: any) => s + Number(pay.amount), 0);
      return owed > 0 && paid < owed - 0.01;
    });
    const noRecs = linkedRecordings.length === 0;
    // Always show close confirm so user can optionally create a recording
    setUnpaidPeopleNames(unpaid);
    setCloseNoRecordings(noRecs);
    setCloseCreateRecording(false);
    setCloseSpaceId(null);
    const { data: sp } = await supabase.from('spaces').select('id, name').eq('user_id', userId).eq('is_active', true).order('name');
    setCloseSpaces(sp ?? []);
    setCloseConfirmModal(true);
  };
  const confirmClose = async () => {
    setClosingLoading(true);
    const today = new Date().toISOString().split('T')[0];
    let expenseId: string | null = null;
    if (closeCreateRecording && closeSpaceId) {
      const total = items.reduce((s: number, i: any) => s + Number(i.cost), 0);
      const { data: expense } = await supabase.from('recordings').insert({
        user_id: userId,
        space_id: closeSpaceId,
        name: String(name),
        type: 'expense',
        amount: total,
        transaction_date: today,
        status: 'paid',
        paid_amount: total,
        split_bill_id: splitBillId,
      }).select('id').single();
      expenseId = expense?.id ?? null;
      if (expenseId) {
        await supabase.from('split_bill_recordings').insert({
          split_bill_id: splitBillId,
          recording_id: expenseId,
          amount_contributed: total,
        });
      }
      // Create return recordings for each person's payments
      for (const pay of activePayments) {
        const amt = Number(pay.amount);
        if (amt <= 0) continue;
        await supabase.from('recordings').insert({
          user_id: userId,
          space_id: closeSpaceId,
          name: `${String(name)} · ${pay.person_name}`,
          type: 'return',
          amount: amt,
          transaction_date: today,
          status: 'received',
          linked_recording_id: expenseId,
          split_bill_id: splitBillId,
        });
      }
    }
    for (const lr of linkedRecordings) {
      const rec = lr.recording;
      if (!rec) continue;
      if (rec.type === 'expense') {
        await supabase.from('recordings').update({ is_due: true }).eq('id', rec.id);
      }
    }
    await supabase.from('split_bills').update({ status: 'closed' }).eq('id', splitBillId);
    setBillStatus('closed');
    setCloseConfirmModal(false);
    setClosingLoading(false);
    queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
    if (closeCreateRecording && closeSpaceId) {
      queryClient.invalidateQueries({ queryKey: ['recordings', closeSpaceId] });
    }
  };
  // ── Auto-complete check after payment ────────────────────────────────────
  const [autoCompleteRecs, setAutoCompleteRecs] = useState<any[]>([]);
  const [autoCompleteModal, setAutoCompleteModal] = useState(false);
  const [autoCompleteLoading, setAutoCompleteLoading] = useState(false);
  const checkAutoComplete = (updatedPayments: any[]) => {
    // For each linked recording, check if total payments from all people cover the recording amount
    const toComplete: any[] = [];
    for (const lr of linkedRecordings) {
      const rec = lr.recording;
      if (!rec || rec.status === 'paid') continue;
      // Get items for this recording
      const recItems = items.filter((item: any) => item.recording_id === rec.id);
      if (recItems.length === 0) continue;
      // Build total owed per person for this recording
      const owedPerPerson: Record<string, number> = {};
      recItems.forEach((item: any) => {
        const pp = (item.people ?? []).length > 0 ? Number(item.cost) / item.people.length : 0;
        (item.people ?? []).forEach((p: string) => { owedPerPerson[p] = (owedPerPerson[p] ?? 0) + pp; });
      });
      const totalOwed = Object.values(owedPerPerson).reduce((s, v) => s + v, 0);
      if (totalOwed <= 0) continue;
      // Sum all payments credited to this recording
      const creditedPerPerson: Record<string, number> = {};
      updatedPayments.filter((pay: any) => pay.status !== 'cancelled').forEach((pay: any) => {
        const personOwed = owedPerPerson[pay.person_name] ?? 0;
        if (personOwed > 0) {
          const already = creditedPerPerson[pay.person_name] ?? 0;
          const credit = Math.min(Number(pay.amount), personOwed - already);
          if (credit > 0) creditedPerPerson[pay.person_name] = already + credit;
        }
      });
      const totalCredited = Object.values(creditedPerPerson).reduce((s, v) => s + v, 0);
      if (totalCredited >= totalOwed - 0.01) {
        toComplete.push(lr);
      }
    }
    if (toComplete.length > 0) {
      setAutoCompleteRecs(toComplete);
      setAutoCompleteModal(true);
    }
  };
  const confirmAutoComplete = async () => {
    setAutoCompleteLoading(true);
    for (const lr of autoCompleteRecs) {
      const rec = lr.recording;
      if (rec) {
        const updates: any = { paid_amount: rec.amount, status: 'paid' };
        if (rec.type === 'expense') updates.is_due = true;
        await supabase.from('recordings').update(updates).eq('id', rec.id);
      }
    }
    setAutoCompleteModal(false);
    setAutoCompleteLoading(false);
    queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
  };
  // ── Mark as paid ───────────────────────────────────────────────────────
  const [markPaidRec, setMarkPaidRec]     = useState<any>(null);
  const [markPaidAccounts, setMarkPaidAccounts] = useState<any[]>([]);
  const [markPaidAccount, setMarkPaidAccount]   = useState<any>(null);
  const [markPaidLoading, setMarkPaidLoading]   = useState(false);
  const openMarkPaid = async (lr: any) => {
    const rec = lr.recording;
    if (!rec) return;
    const alreadyDone =
      (rec.type === 'expense' && rec.status === 'paid') ||
      (rec.type === 'due'     && rec.status === 'paid') ||
      (rec.type === 'debt'    && rec.status === 'paid');
    if (alreadyDone) return;
    const { data: accs } = await supabase
      .from('accounts').select('id, account_name, bank, account_number')
      .eq('user_id', userId).order('account_name');
    setMarkPaidAccounts(accs ?? []);
    setMarkPaidAccount(accs?.[0] ?? null);
    setMarkPaidRec(lr);
  };
  const confirmMarkPaid = async () => {
    if (!markPaidRec) return;
    setMarkPaidLoading(true);
    const rec = markPaidRec.recording;
    const today = new Date().toISOString().split('T')[0];
    const accId = markPaidAccount?.id ?? null;
    if (rec.type === 'expense') {
      await supabase.from('recordings').insert({
        user_id: userId, space_id: rec.space_id,
        name: rec.name, type: 'return',
        amount: rec.amount, transaction_date: today,
        status: 'received', account_id: accId,
        category_id: rec.category_id ?? null,
        linked_recording_id: rec.id,
      });
      await supabase.from('recordings').update({ status: 'paid', is_due: true, paid_amount: rec.amount }).eq('id', rec.id);
    } else if (rec.type === 'due') {
      await supabase.from('recordings').insert({
        user_id: userId, space_id: rec.space_id,
        name: rec.name, type: 'income',
        amount: rec.amount, transaction_date: today,
        status: 'received', account_id: accId,
        category_id: rec.category_id ?? null,
        linked_recording_id: rec.id,
      });
      if (rec.linked_recording_id) {
        await supabase.from('recordings').insert({
          user_id: userId, space_id: rec.space_id,
          name: rec.name, type: 'expense',
          amount: rec.amount, transaction_date: today,
          status: 'paid', account_id: accId,
          category_id: rec.category_id ?? null,
          linked_recording_id: rec.linked_recording_id,
        });
      }
      await supabase.from('recordings').update({ status: 'paid', paid_amount: rec.amount }).eq('id', rec.id);
    } else if (rec.type === 'debt') {
      // Create expense payment linked to loan
      await supabase.from('recordings').insert({
        user_id: userId, space_id: rec.space_id,
        name: rec.name, type: 'expense',
        amount: rec.amount, transaction_date: today,
        status: 'paid', account_id: accId,
        category_id: rec.category_id ?? null,
        linked_recording_id: rec.id,
      });
      await supabase.from('recordings').update({ status: 'paid', paid_amount: rec.amount }).eq('id', rec.id);
    }
    setMarkPaidLoading(false);
    setMarkPaidRec(null);
    queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
  };
  const totalAmount = linkedRecordings.reduce((s: number, r: any) => s + Number(r.amount_contributed), 0);
  // ── Payment history ────────────────────────────────────────────────────────────
  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ['split-bill-payments', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_bill_payments')
        .select('id, person_name, amount, created_at, status, cancelled_reason, cancelled_at, charged_recording_id')
        .eq('split_bill_id', splitBillId)
        .order('created_at');
      return data ?? [];
    },
    enabled: !!splitBillId,
  });
  const [paymentModal, setPaymentModal]     = useState(false);
  const [paymentPerson, setPaymentPerson]   = useState('');
  const [paymentMode, setPaymentMode]       = useState<'full' | 'manual'>('full');
  const [paymentAmount, setPaymentAmount]   = useState('');
  const [paymentManualAmounts, setPaymentManualAmounts] = useState<Record<string, string>>({});
  const [paymentRecord, setPaymentRecord]   = useState(true);
  const [paymentSaving, setPaymentSaving]   = useState(false);
  const [itemPayModal, setItemPayModal]     = useState(false);
  const [itemPayPerson, setItemPayPerson]   = useState('');
  const [chargeToSpace, setChargeToSpace]   = useState(false);
  const [showMorePayments, setShowMorePayments] = useState<Record<string, boolean>>({});
  const [chargeSpaceId, setChargeSpaceId]   = useState<string | null>(null);
  const [chargeAccountId, setChargeAccountId] = useState<string | null>(null);
  const [chargeCategoryId, setChargeCategoryId] = useState<string | null>(null);
  const [chargeSpaces, setChargeSpaces]     = useState<any[]>([]);
  const [chargeAccounts, setChargeAccounts] = useState<any[]>([]);
  const [chargeCategories, setChargeCategories] = useState<any[]>([]);
  const { data: chargedExpenses = [], refetch: refetchChargedExpenses } = useQuery({
    queryKey: ['split-bill-charged-expenses', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('id, name, amount, transaction_date, space:space_id(name), account:account_id(account_name)')
        .eq('split_bill_id', splitBillId)
        .eq('type', 'expense')
        .is('linked_recording_id', null)
        .order('created_at');
      return (data ?? []).map((r: any) => ({
        ...r,
        space: Array.isArray(r.space) ? r.space[0] : r.space,
        account: Array.isArray(r.account) ? r.account[0] : r.account,
      }));
    },
    enabled: !!splitBillId,
  });
  // ── Cancel payment state ───────────────────────────────────────────────
  const [cancelPaymentModal, setCancelPaymentModal] = useState(false);
  const [cancelPaymentTarget, setCancelPaymentTarget] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);
  // ── Overpayment state ──────────────────────────────────────────────────
  const [overpaymentModal, setOverpaymentModal] = useState(false);
  const [overpaymentAmount, setOverpaymentAmount] = useState(0);
  const [overpaymentPerson, setOverpaymentPerson] = useState('');
  const [overpaymentApplyModal, setOverpaymentApplyModal] = useState(false);
  const [otherSplitBills, setOtherSplitBills] = useState<any[]>([]);
  const confirmOverpaymentIncome = async () => {
    const spaceId = linkedRecordings[0]?.recording?.space_id ?? null;
    await supabase.from('recordings').insert({
      user_id: userId,
      space_id: spaceId,
      name: `${String(name)} · ${overpaymentPerson} overpayment`,
      type: 'income',
      amount: overpaymentAmount,
      transaction_date: new Date().toISOString().split('T')[0],
      status: 'received',
    });
    setOverpaymentModal(false);
  };
  const openApplyToSplitBill = async () => {
    const { data } = await supabase
      .from('split_bills')
      .select('id, name')
      .eq('user_id', userId)
      .eq('status', 'ongoing')
      .neq('id', splitBillId)
      .order('created_at', { ascending: false });
    setOtherSplitBills(data ?? []);
    setOverpaymentModal(false);
    setOverpaymentApplyModal(true);
  };
  const confirmApplyToSplitBill = async (targetBillId: string) => {
    await supabase.from('split_bill_payments').insert({
      split_bill_id: targetBillId,
      person_name: overpaymentPerson,
      amount: overpaymentAmount,
    });
    setOverpaymentApplyModal(false);
  };
  const openCancelPayment = (pay: any) => {
    setCancelPaymentTarget(pay);
    setCancelReason('');
    setCancelPaymentModal(true);
  };
  const confirmCancelPayment = async () => {
    if (!cancelPaymentTarget) return;
    setCancelSaving(true);
    const pay = cancelPaymentTarget;
    // 1. Void linked return recordings instead of deleting
    const { data: linkedReturns } = await supabase
      .from('recordings')
      .select('id, amount, linked_recording_id')
      .eq('split_bill_payment_id', pay.id);
    if (linkedReturns && linkedReturns.length > 0) {
      const creditByParent: Record<string, number> = {};
      for (const ret of linkedReturns) {
        if (ret.linked_recording_id) {
          creditByParent[ret.linked_recording_id] =
            (creditByParent[ret.linked_recording_id] ?? 0) + Number(ret.amount);
        }
      }
      // Void the return recordings
      await supabase.from('recordings').update({
        status: 'voided',
        void_reason: cancelReason.trim() || 'payment cancelled',
        voided_at: new Date().toISOString(),
      }).eq('split_bill_payment_id', pay.id);
      // Reverse paid_amount on each parent recording
      for (const [parentId, creditToReverse] of Object.entries(creditByParent)) {
        const { data: parent } = await supabase
          .from('recordings')
          .select('paid_amount, amount, status')
          .eq('id', parentId)
          .single();
        if (parent) {
          const newPaid = Math.max(0, Number(parent.paid_amount ?? 0) - creditToReverse);
          const wasFullyPaid = parent.status === 'paid';
          const stillFullyPaid = newPaid >= Number(parent.amount) - 0.01;
          await supabase.from('recordings').update({
            paid_amount: newPaid,
            ...(wasFullyPaid && !stillFullyPaid ? { status: 'unpaid' } : {}),
          }).eq('id', parentId);
        }
      }
    }
    // 2. Reduce or delete the consolidated charged expense if this payment was charged to a space
    if (pay.charged_recording_id) {
      const { data: chargedExp } = await supabase
        .from('recordings')
        .select('id, amount, space_id')
        .eq('id', pay.charged_recording_id)
        .limit(1)
        .then(r => ({ data: r.data?.[0] ?? null, error: r.error }));
      if (chargedExp) {
        const newAmount = Number(chargedExp.amount) - Number(pay.amount);
        if (newAmount <= 0.001) {
          await supabase.from('recordings').delete().eq('id', chargedExp.id);
        } else {
          await supabase.from('recordings').update({ amount: newAmount }).eq('id', chargedExp.id);
        }
        queryClient.invalidateQueries({ queryKey: ['recordings', chargedExp.space_id] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-activities', userId] });
      }
    }
    // 3. Mark payment as cancelled (never delete)
    await supabase.from('split_bill_payments').update({
      status: 'cancelled',
      cancelled_reason: cancelReason.trim() || null,
      cancelled_at: new Date().toISOString(),
    }).eq('id', pay.id);
    setCancelSaving(false);
    setCancelPaymentModal(false);
    setCancelPaymentTarget(null);
    refetchPayments();
    queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
  };
  // compute per-person totals (reuse across summary + payment)
  // The current user's share is excluded from payment tracking — they already paid
  const computeTotals = () => {
    const totals = computeSplitTotals(items);
    filledPeople.forEach(p => { if (totals[p] === undefined) totals[p] = 0; });
    // Remove the user's own entry — their share is not a loan
    if (userName) delete totals[userName];
    return totals;
  };
  const filledPeopleForPayment = filledPeople.filter(
    p => !userName || p.toLowerCase() !== userName.toLowerCase()
  );
  // Only active payments count toward paid totals
  const activePayments = payments.filter((p: any) => p.status !== 'cancelled');
  const openPaymentModal = async (person: string) => {
    setPaymentPerson(person);
    setPaymentMode('full');
    setPaymentAmount('');
    setPaymentManualAmounts({});
    setPaymentRecord(true);
    setChargeToSpace(false);
    setChargeSpaceId(null);
    setChargeAccountId(null);
    setChargeCategoryId(null);
    const [{ data: sp }, { data: ac }, { data: cats }] = await Promise.all([
      supabase.from('spaces').select('id, name').eq('user_id', userId).eq('is_active', true).order('name'),
      supabase.from('accounts').select('id, account_name, bank').eq('user_id', userId).order('account_name'),
      supabase.from('categories').select('id, name').eq('user_id', userId).order('name'),
    ]);
    setChargeSpaces(sp ?? []);
    setChargeAccounts(ac ?? []);
    setChargeCategories(cats ?? []);
    setPaymentModal(true);
  };
  const getPersonRecordingRows = (person: string) => {
    const recordingOwed: Record<string, { amount: number; rec: any }> = {};
    items.forEach((item: any) => {
      const assignedToMe = (item.people ?? []).includes(person);
      if (!assignedToMe || !item.recording_id) return;
      const pp = (item.people ?? []).length > 0 ? Number(item.cost) / item.people.length : 0;
      const deduct = isDeductType(item.recording_type);
      const rid = item.recording_id;
      const lr = linkedRecordings.find((l: any) => l.recording?.id === rid);
      if (!recordingOwed[rid]) recordingOwed[rid] = { amount: 0, rec: lr?.recording };
      recordingOwed[rid].amount += deduct ? -pp : pp;
    });
    return Object.entries(recordingOwed)
      .map(([recordingId, { amount, rec }]) => ({
        recordingId,
        recording: rec,
        owed: amount,
        paid: Number(rec?.paid_amount ?? 0),
      }))
      .filter((row) => row.recording);
  };
  const getPersonManualOwed = (person: string) => {
    let manual = 0;
    items.forEach((item: any) => {
      const assignedToMe = (item.people ?? []).includes(person);
      if (!assignedToMe || item.recording_id) return;
      const pp = (item.people ?? []).length > 0 ? Number(item.cost) / item.people.length : 0;
      const deduct = isDeductType(item.recording_type);
      manual += deduct ? -pp : pp;
    });
    return manual;
  };
  // ── Manual return prompt state ─────────────────────────────────────────
  const [manualReturnModal, setManualReturnModal] = useState(false);
  const [manualReturnAmount, setManualReturnAmount] = useState(0);
  const [manualReturnType, setManualReturnType] = useState<'return' | 'expense'>('return');
  const [manualReturnSaving, setManualReturnSaving] = useState(false);
  const confirmManualReturn = async () => {
    setManualReturnSaving(true);
    const spaceId = linkedRecordings[0]?.recording?.space_id ?? null;
    await supabase.from('recordings').insert({
      user_id: userId, space_id: spaceId,
      name: String(name),
      type: manualReturnType,
      amount: manualReturnAmount,
      transaction_date: new Date().toISOString().split('T')[0],
      status: manualReturnType === 'return' ? 'received' : 'paid',
      // FIX 1: tag with split_bill_id so future payments can find this
      // recording by ID instead of name, making the dedup rename-safe.
      split_bill_id: splitBillId,
    });
    setManualReturnSaving(false);
    setManualReturnModal(false);
  };
  const savePayment = async () => {
    const totals = computeTotals();
    const owed = Math.abs(totals[paymentPerson] ?? 0);
    const paidSoFar = activePayments
      .filter((p: any) => p.person_name === paymentPerson)
      .reduce((s: number, p: any) => s + Number(p.amount), 0);
    const manualRowsTotal = Object.values(paymentManualAmounts)
      .reduce((s, v) => s + (parseFloat(v || '0') || 0), 0);
    const amount = paymentMode === 'full'
      ? owed - paidSoFar
      : manualRowsTotal + (parseFloat(paymentAmount || '0') || 0);
    if (!amount || amount <= 0) return;
    setPaymentSaving(true);
    // 1. Record the payment in split_bill_payments
    const { data: paymentRow } = await supabase.from('split_bill_payments').insert({
      split_bill_id: splitBillId,
      person_name: paymentPerson,
      amount,
    }).select('id').single();
    // FIX 2: keep the id so we can tag every return recording with it
    const paymentRowId = paymentRow?.id ?? null;
    // 2. Compute per-recording and manual breakdown for this person
    // Build: { recordingId -> amount_owed_by_person } and manual total
    const recordingOwed: Record<string, { amount: number; rec: any }> = {};
    let manualOwed = 0;
    const requestedRecordingAmounts: Record<string, number> = {};
    Object.entries(paymentManualAmounts).forEach(([rid, value]) => {
      const parsed = parseFloat(value || '0');
      if (parsed > 0) requestedRecordingAmounts[rid] = parsed;
    });
    items.forEach((item: any) => {
      const assignedToMe = (item.people ?? []).includes(paymentPerson);
      if (!assignedToMe) return;
      const pp = (item.people ?? []).length > 0 ? Number(item.cost) / item.people.length : 0;
      const deduct = isDeductType(item.recording_type);
      if (item.recording_id) {
        const rid = item.recording_id;
        const lr = linkedRecordings.find((l: any) => l.recording?.id === rid);
        if (!recordingOwed[rid]) recordingOwed[rid] = { amount: 0, rec: lr?.recording };
        recordingOwed[rid].amount += deduct ? -pp : pp;
      } else {
        manualOwed += deduct ? -pp : pp;
      }
    });
    // 3. Assign payments by recording first, then manual items
    let remaining = amount;
    const today = new Date().toISOString().split('T')[0];
    for (const rid of Object.keys(recordingOwed)) {
      if (remaining <= 0) break;
      const { amount: itemAmount, rec } = recordingOwed[rid];
      if (!rec) continue;
      const requested = requestedRecordingAmounts[rid] ?? 0;
      const credit = requested > 0
        ? Math.min(requested, remaining, itemAmount)
        : Math.min(remaining, itemAmount);
      if (credit <= 0) continue;
      remaining -= credit;
      // FIX 2: store split_bill_payment_id so this return can be reversed
      // if the payment row is later deleted from history.
      await supabase.from('recordings').insert({
        user_id: userId,
        space_id: rec.space_id,
        name: `${rec.name} · ${paymentPerson}`,
        type: 'return',
        amount: credit,
        transaction_date: today,
        status: 'received',
        linked_recording_id: rid,
        split_bill_id: splitBillId,
        split_bill_payment_id: paymentRowId,
      });
      // Update paid_amount on the parent recording
      const { data: parentRec } = await supabase
        .from('recordings').select('paid_amount, amount, is_due')
        .eq('id', rid).single();
      if (parentRec) {
        const newPaid = Number(parentRec.paid_amount ?? 0) + credit;
        const fullyCollected = newPaid >= Number(parentRec.amount) - 0.01;
        await supabase.from('recordings').update({
          paid_amount: newPaid,
          is_due: true,
          ...(fullyCollected ? { status: 'paid' } : {}),
        }).eq('id', rid);
      }
    }
    // 4. Handle manual portion
    const manualExtra = parseFloat(paymentAmount || '0') || 0;
    if (remaining > 0 && manualOwed > 0) {
      const manualCredit = Math.min(remaining, manualOwed, manualExtra);
      const { data: existingManual } = await supabase
        .from('recordings')
        .select('id')
        .eq('user_id', userId)
        .eq('split_bill_id', splitBillId)
        .is('linked_recording_id', null)
        .limit(1);
      if (!existingManual || existingManual.length === 0) {
        setManualReturnAmount(manualCredit);
        setManualReturnType('return');
        setManualReturnModal(true);
      }
    }
    // 5. Charge to space — upsert a single consolidated expense per split bill per space
    if (chargeToSpace && chargeSpaceId) {
      const { data: existingArr } = await supabase
        .from('recordings')
        .select('id, amount')
        .eq('split_bill_id', splitBillId)
        .eq('space_id', chargeSpaceId)
        .eq('type', 'expense')
        .is('linked_recording_id', null)
        .limit(1);
      const existing = existingArr?.[0] ?? null;
      if (existing) {
        await supabase.from('recordings').update({
          amount: Number(existing.amount) + amount,
          transaction_date: today,
          account_id: chargeAccountId || null,
          category_id: chargeCategoryId || null,
        }).eq('id', existing.id);
        // tag this payment row with the consolidated expense id so cancel can find it
        if (paymentRowId) {
          await supabase.from('split_bill_payments').update({ charged_recording_id: existing.id }).eq('id', paymentRowId);
        }
      } else {
        const { data: newExp } = await supabase.from('recordings').insert({
          user_id: userId,
          space_id: chargeSpaceId,
          name: String(name),
          type: 'expense',
          amount,
          transaction_date: today,
          status: 'paid',
          account_id: chargeAccountId || null,
          category_id: chargeCategoryId || null,
          split_bill_id: splitBillId,
        }).select('id').single();
        if (paymentRowId && newExp?.id) {
          await supabase.from('split_bill_payments').update({ charged_recording_id: newExp.id }).eq('id', paymentRowId);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['recordings', chargeSpaceId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-activities', userId] });
    }
    setPaymentSaving(false);
    setPaymentModal(false);
    refetchPayments();
    queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
    if (chargeToSpace) refetchChargedExpenses();
    // Check if any recordings are now fully paid by all people
    const updatedPayments = [...activePayments, { person_name: paymentPerson, amount }];
    checkAutoComplete(updatedPayments);
    // Detect overpayment
    const totalsAfter = computeTotals();
    const owedAfter = Math.abs(totalsAfter[paymentPerson] ?? 0);
    const paidAfter = [...activePayments, { person_name: paymentPerson, amount }]
      .filter((p: any) => p.person_name === paymentPerson)
      .reduce((s: number, p: any) => s + Number(p.amount), 0);
    const excess = paidAfter - owedAfter;
    if (excess > 0.01) {
      setOverpaymentAmount(Math.round(excess * 100) / 100);
      setOverpaymentPerson(paymentPerson);
      setOverpaymentModal(true);
    }
  };
  const confirmItemPay = async (paymentItems: PaymentItem[], mode: 'all' | 'this-bill' | 'selected') => {
    setItemPayModal(false);
    if (paymentItems.length === 0) return;
    const linkedRecUpdates: { id: string; amount: number }[] = [];
    const manualAmounts: { name: string; amount: number }[] = [];
    for (const pi of paymentItems) {
      if (pi.source === 'split_bill') {
        const billId = pi.id.replace('sb-', '');
        const billItems = items.filter((i: any) => i.split_bill_id === billId && (i.people ?? []).includes(itemPayPerson));
        const linkedRecMap = new Map<string, number>();
        let manualTotal = 0;
        billItems.forEach((bi: any) => {
          const pp = (bi.people ?? []).length > 0 ? Number(bi.cost) / bi.people.length : 0;
          const deduct = isDeductType(bi.recording_type);
          const amt = Math.abs(deduct ? -pp : pp);
          if (bi.recording_id) {
            linkedRecMap.set(bi.recording_id, (linkedRecMap.get(bi.recording_id) ?? 0) + amt);
          } else {
            manualTotal += amt;
          }
        });
        for (const [recId, amt] of linkedRecMap) {
          linkedRecUpdates.push({ id: recId, amount: amt });
        }
        if (manualTotal > 0) {
          const bill = items.find((i: any) => i.split_bill_id === billId);
          manualAmounts.push({ name: String(name), amount: manualTotal });
        }
        const payRow = {
          user_id: userId, split_bill_id: billId, person_name: itemPayPerson,
          amount: pi.amount, created_at: new Date().toISOString(),
        };
        await supabase.from('split_bill_payments').insert(payRow);
      } else {
        const recId = pi.id.replace('rec-', '');
        linkedRecUpdates.push({ id: recId, amount: pi.amount });
      }
    }
    const readIds = linkedRecUpdates.map((u) => u.id);
    const { data: existingRecs } = await supabase.from('recordings').select('id, paid_amount, amount').in('id', readIds);
    const recMap = new Map((existingRecs ?? []).map((r: any) => [r.id, r]));
    const updates: { id: string; paid_amount: number; status?: string }[] = [];
    linkedRecUpdates.forEach((u) => {
      const rec = recMap.get(u.id);
      if (!rec) return;
      const newPaid = Number(rec.paid_amount ?? 0) + u.amount;
      const upd: any = { paid_amount: newPaid };
      if (newPaid >= Number(rec.amount)) upd.status = 'paid';
      updates.push({ id: u.id, ...upd });
    });
    const spaceId = linkedRecordings[0]?.recording?.space_id ?? null;
    const insertPromises = manualAmounts.map((m) =>
      supabase.from('recordings').insert({
        user_id: userId, space_id: spaceId,
        name: `${m.name} · ${itemPayPerson}`,
        type: 'return', amount: m.amount,
        transaction_date: new Date().toISOString().split('T')[0],
        status: 'paid', paid_amount: m.amount,
      })
    );
    const updatePromises = updates.map((u) =>
      supabase.from('recordings').update({ paid_amount: u.paid_amount, status: u.status ?? undefined }).eq('id', u.id)
    );
    await Promise.all([...insertPromises, ...updatePromises]);
    await Promise.all([refetchItems(), refetchPayments(), queryClient.invalidateQueries({ queryKey: ['transactions'] })]);
  };
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const typeColor = (type: string) => {
    if (type === 'debt') return PEACH;
    return ACCENT_DARK;
  };
    return (

    <Animated.View style={[{ flex: 1, backgroundColor: '#ffffff' }, { transform: [{ translateX: slideAnim }] }]}>
      <View style={{ flex: 1 }}>
        <TopHeader
          title="Split Bill"
          subtitle={String(name)}
          centered
          variant="blue"
          topInset={insets.top}
          onBack={handleBackOrDelete}
          right={
            <TouchableOpacity style={s.ellipsisBtn} onPress={() => setActionsModal(true)} activeOpacity={0.7}>
              <SvgXml xml={SVG_ELLIPSIS} width={14} height={14} color="#ffffff" />
            </TouchableOpacity>
          }
        />

        {/* ── Faux header (kept) — frozen ── */}
        <View style={{ backgroundColor: DC.pageBg }}>
          {/* Row 2: left arrow + steps + right arrow */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: DC.pagePadding, paddingTop: 16, paddingBottom: 16 }}>
            <TouchableOpacity
              onPress={() => { if (wizardStep > 1) setWizardStep((wizardStep - 1) as 1 | 2 | 3); }}
              disabled={wizardStep === 1}
              activeOpacity={0.7}
              style={{ opacity: wizardStep === 1 ? 0.3 : 1 }}
            >
              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 18, color: DC.pageText, lineHeight: 22 }}>{'<'}</Text>
            </TouchableOpacity>
            <View style={[s.stepRow, { flex: 1, marginBottom: 0, paddingBottom: 0, justifyContent: 'center' }]}>
              {(['Items', 'Payments', 'Share'] as const).map((label, idx) => {
                const step = (idx + 1) as 1 | 2 | 3;
                const active = wizardStep === step;
                const done = wizardStep > step;
                return (
                  <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {idx > 0 && <View style={[s.stepDash, done && s.stepDashDone]} />}
                    <TouchableOpacity style={{ alignItems: 'center', gap: 4 }} onPress={() => setWizardStep(step)} activeOpacity={0.7}>
                      <View style={[s.stepCircle, active && s.stepCircleActive]}>
                        <Text style={[s.stepNum, active && s.stepNumActive]}>{step}</Text>
                      </View>
                      <Text style={[s.stepLabel, active && s.stepLabelActive]}>{label}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
            <TouchableOpacity
              onPress={() => { if (wizardStep < 3) setWizardStep((wizardStep + 1) as 1 | 2 | 3); }}
              disabled={wizardStep === 3}
              activeOpacity={0.7}
              style={{ opacity: wizardStep === 3 ? 0.3 : 1 }}
            >
              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 18, color: DC.pageText, lineHeight: 22 }}>{'>'}</Text>
            </TouchableOpacity>
          </View>
          {/* Divider — end to end */}
          <View style={{ height: DC.rowDivider.height, backgroundColor: DC.rowDivider.backgroundColor }} />
        </View>

        {/* ── Step 1: Items ── */}
        {wizardStep === 1 && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

            {/* Add Items */}
            <View style={s.sectionRow}>
              <Text style={s.sectionHeader}>Items</Text>
              {billStatus === 'ongoing' && (
                <TouchableOpacity style={s.addCircleBtn} onPress={openNewItemModal} activeOpacity={0.7}>
                  <Text style={s.addCircleBtnText}>+</Text>
                </TouchableOpacity>
              )}
            </View>
            {items.length === 0 ? (
              <View style={s.dottedCard}>
                <View style={s.emptyRow}>
                  <Text style={s.emptyText}>{filledPeople.length === 0 ? 'add people first' : 'no items yet'}</Text>
                </View>
              </View>
            ) : (() => {
              const recGroups: { recId: string | null; recName: string; recIdx: number; recAmount: number; items: any[] }[] = [];
              items.forEach((item: any) => {
                // Group by recording_id if linked, parent_item_id if manual subitem, else own id
                const key = item.recording_id ?? item.parent_item_id ?? item.id;
                const existing = recGroups.find(g => g.recId === key);
                if (existing) { existing.items.push(item); }
                else {
                  const lr = linkedRecordings.find((l: any) => l.recording?.id === item.recording_id);
                  recGroups.push({ recId: key, recName: lr?.recording?.name ?? item.name, recIdx: recGroups.length + 1, recAmount: Number(lr?.amount_contributed ?? 0), items: [item] });
                }
              });
              linkedRecordings.forEach((lr: any) => {
                if (!recGroups.find(g => g.recId === lr.recording?.id)) {
                  recGroups.push({ recId: lr.recording?.id ?? null, recName: lr.recording?.name ?? '-', recIdx: recGroups.length + 1, recAmount: Number(lr.amount_contributed ?? 0), items: [] });
                }
              });
              return (
                <View style={{ gap: 8 }}>
                  {recGroups.map((group) => {
                    const hasSubitems = group.items.length > 1;
                    const singleItem = group.items.length === 1 ? group.items[0] : null;
                    return (
                      <TouchableOpacity key={group.recId ?? 'manual'} style={s.dottedCard} onPress={() => { if (group.items.length > 0) openAssign(group.items[0]); }} activeOpacity={0.85}>
                        {hasSubitems ? (
                          <>
                            <View style={s.itemParentRow}>
                              <Text style={s.itemParentNum}>{group.recIdx}</Text>
                              <View style={{ flex: 1 }}>
                                <Text style={[s.subItemName]} numberOfLines={1}>{group.recName}</Text>
                                {group.recId && linkedRecordings.some((lr: any) => lr.recording?.id === group.recId) && (
                                  <Text style={{ ...DC.typography.subContent, color: DC.pageTextMuted }}>Record</Text>
                                )}
                              </View>
                              {billStatus === 'ongoing' && (
                                <TouchableOpacity onPress={() => deleteItem(group.items[0].id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                  <SvgXml xml={SVG_CLOSE} width={18} height={18} color={DC.pageTextMuted} />
                                </TouchableOpacity>
                              )}
                            </View>
                            <View style={{ height: DC.rowDivider.height, backgroundColor: DC.rowDivider.backgroundColor, marginHorizontal: -14 }} />
                            {group.items.slice(1).map((item: any, subIdx: number) => {
                              const deduct = isDeductType(item.recording_type);
                              const subitems = group.items.slice(1);
                              const isFirst = subIdx === 0;
                              const isLast = subIdx === subitems.length - 1;
                              const isSingle = subitems.length === 1;
                              // Bar positioning: single = centered half, first = bottom half, last = top half, middle = full
                              const barStyle = isSingle
                                ? { top: '25%' as any, bottom: '25%' as any }
                                : isFirst
                                ? { top: '50%' as any, bottom: 0 }
                                : isLast
                                ? { top: 0, bottom: '50%' as any }
                                : { top: 0, bottom: 0 };
                              return (
                                <TouchableOpacity key={item.id} style={s.subItemRow} onPress={() => openAssign(item)} activeOpacity={0.8}>
                                  <View style={[s.subItemBar, barStyle]} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={s.subItemName} numberOfLines={1}>{item.name}</Text>
                                    <Text style={[s.subItemPeople, { fontStyle: 'italic' }]} numberOfLines={1}>{(item.people ?? []).length > 0 ? item.people.join(', ') : 'tap to assign'}</Text>
                                  </View>
                                  <Text style={s.subItemAmount}>{deduct ? '- ' : ''}{fmt(Number(item.cost))}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </>
                        ) : singleItem ? (
                          <TouchableOpacity style={s.itemParentRow} onPress={() => openAssign(singleItem)} activeOpacity={0.8}>
                            <Text style={s.itemParentNum}>{group.recIdx}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={s.subItemName} numberOfLines={1}>{singleItem.name}</Text>
                              {singleItem.recording_id && linkedRecordings.some((lr: any) => lr.recording?.id === singleItem.recording_id) && (
                                <Text style={{ ...DC.typography.subContent, color: DC.pageTextMuted }}>Record</Text>
                              )}
                              <Text style={[s.subItemPeople, { fontStyle: 'italic' }]} numberOfLines={1}>{(singleItem.people ?? []).length > 0 ? singleItem.people.join(', ') : 'tap to assign'}</Text>
                            </View>
                            <Text style={s.subItemAmount}>{isDeductType(singleItem.recording_type) ? '- ' : ''}{fmt(Number(singleItem.cost))}</Text>
                            {billStatus === 'ongoing' && (
                              <TouchableOpacity onPress={() => deleteItem(singleItem.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <SvgXml xml={SVG_CLOSE} width={18} height={18} color={DC.pageTextMuted} />
                              </TouchableOpacity>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <View style={s.itemParentRow}>
                            <Text style={s.itemParentNum}>{group.recIdx}</Text>
                            <Text style={[s.subItemName, { flex: 1 }]} numberOfLines={1}>{group.recName}</Text>
                            <Text style={s.subItemPeople}>no items yet</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })()}
            {/* ── Receipts section ── */}
            <View style={s.sectionRow}>
              <Text style={s.sectionHeader}>Receipts</Text>
              {billStatus === 'ongoing' && (
                <TouchableOpacity style={s.addCircleBtn} onPress={() => setAddReceiptModal(true)} activeOpacity={0.7}>
                  <Text style={s.addCircleBtnText}>+</Text>
                </TouchableOpacity>
              )}
            </View>
            {(() => {
              const allPhotos: { id: string; url: string; label: string }[] = [
                ...receiptPhotos.map(p => ({ ...p, label: 'direct' })),
                ...recordingReceiptPhotos.map(p => ({ ...p, label: p.recordingName || 'recording' })),
              ];
              if (allPhotos.length === 0) return (
                <View style={s.dottedCard}>
                  <View style={s.emptyRow}><Text style={s.emptyText}>no receipts yet — tap + to add</Text></View>
                </View>
              );
              return (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DC.pagePadding, gap: 10, paddingBottom: 8 }}>
                  {allPhotos.map((p, i) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => {
                        const isRecording = receiptPhotos.findIndex(x => x.id === p.id) === -1;
                        setPhotoModalPool(isRecording ? 'recording' : 'direct');
                        setPhotoModalIndex(isRecording ? recordingReceiptPhotos.findIndex(x => x.id === p.id) : receiptPhotos.findIndex(x => x.id === p.id));
                        setPhotoModal(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: p.url }} style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: Colors.surface }} resizeMode="cover" />
                      {p.label !== 'direct' && (
                        <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 9, color: DC.pageTextMuted, maxWidth: 72, marginTop: 3 }} numberOfLines={1}>{p.label}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              );
            })()}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── Step 2: Payments ── */}
        {wizardStep === 2 && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

            {/* Per Person Pay */}
            <View style={s.sectionRow}>
              <Text style={s.sectionHeader}>Per Person Pay</Text>
            </View>
            <View style={s.dottedCard}>
              {filledPeople.length === 0 ? (
                <View style={s.emptyRow}><Text style={s.emptyText}>add people and items first</Text></View>
              ) : (() => {
                const totals = computeSplitTotals(items);
                filledPeople.forEach(p => { if (totals[p] === undefined) totals[p] = 0; });
                return filledPeople.map((p, idx) => {
                  const owed = totals[p] ?? 0;
                  const isMe = userName && p.toLowerCase() === userName.toLowerCase();
                  const amtColor = owed < 0 ? Colors.expense : DC.pageText;
                  return (
                    <View key={p}>
                      <View style={s.payPersonRow}>
                        <View style={s.payAvatar}>
                          <Text style={s.payAvatarText}>{p.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={s.payPersonName}>{isMe ? `${p} (you)` : p}</Text>
                        <Text style={[s.payPersonAmount, { color: amtColor }]}>
                          {owed < 0 ? '- ' : ''}{fmt(Math.abs(owed))}
                        </Text>
                      </View>
                      {idx < filledPeople.length - 1 && <View style={s.divider} />}
                    </View>
                  );
                });
              })()}
            </View>

            {/* Payment History */}
            <View style={s.sectionRow}>
              <Text style={s.sectionHeader}>Payment History</Text>
            </View>
            <View style={s.dottedCard}>
              {filledPeopleForPayment.length === 0 ? (
                <View style={s.emptyRow}><Text style={s.emptyText}>no payment history yet</Text></View>
              ) : (() => {
                const totals = computeTotals();
                return filledPeopleForPayment.map((p, idx) => {
                  const owed = Math.abs(totals[p] ?? 0);
                  const amtColor = (totals[p] ?? 0) < 0 ? Colors.expense : DC.pageText;
                  const personPayments = activePayments.filter((pay: any) => pay.person_name === p);
                  const paid = personPayments.reduce((s: number, pay: any) => s + Number(pay.amount), 0);
                  const fullyPaid = owed > 0 && paid >= owed - 0.01;
                  return (
                    <View key={p}>
                      <View style={s.payPersonRow}>
                        <View style={s.payAvatar}>
                          <Text style={s.payAvatarText}>{p.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={s.payPersonName}>{p}</Text>
                        <Text style={[s.payPersonAmount, { color: amtColor }]}>
                          {(totals[p] ?? 0) < 0 ? '- ' : ''}{fmt(Math.abs(totals[p] ?? 0))}
                        </Text>
                        {!fullyPaid && billStatus === 'ongoing' && (
                          <TouchableOpacity style={s.addPayBtn} onPress={() => openPaymentModal(p)} activeOpacity={0.7}>
                            <Text style={s.addPayBtnText}>+</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {personPayments.map((pay: any, pi: number) => (
                        <View key={pay.id} style={s.paySubRow}>
                          <Text style={s.paySubLabel}>Payment {pi + 1}</Text>
                          <Text style={[s.paySubAmount, { flex: 1, textAlign: 'right', marginRight: 8 }]}>{fmt(Number(pay.amount))}</Text>
                          <TouchableOpacity onPress={() => openCancelPayment(pay)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: Colors.expense, lineHeight: 16 }}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      {idx < filledPeopleForPayment.length - 1 && <View style={s.divider} />}
                    </View>
                  );
                });
              })()}
            </View>

            {/* Wallet — payment accounts for the share link */}
            <View style={s.sectionRow}>
              <Text style={s.sectionHeader}>Wallet</Text>
              <TouchableOpacity
                style={s.addCircleBtn}
                onPress={async () => {
                  if (!shareAccountsLoaded) {
                    const { data: accs } = await supabase.from('accounts').select('id, account_name, bank, account_number, qr_code').eq('user_id', userId).order('account_name');
                    setShareAccounts(accs ?? []);
                    setShareAccountsLoaded(true);
                    if (shareRow && shareSelectedIds.length === 0) setShareSelectedIds(shareRow.data?.account_ids ?? []);
                  }
                  setWalletSearch('');
                  setWalletPickerModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={s.addCircleBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {shareSelectedIds.length === 0 ? (
              <View style={s.dottedCard}>
                <View style={s.emptyRow}>
                  <Text style={s.emptyText}>no accounts selected — tap + to add</Text>
                </View>
              </View>
            ) : (
              <View style={s.dottedCard}>
                {shareAccounts.filter((a: any) => shareSelectedIds.includes(a.id)).map((acc: any, idx: number, arr: any[]) => (
                  <View key={acc.id}>
                    <View style={s.walletRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.walletBank}>{acc.bank}</Text>
                        <Text style={s.walletHolder}>{acc.account_name}</Text>
                        <Text style={s.walletNumber}>{acc.account_number}</Text>
                      </View>
                      {acc.qr_code ? (
                        <Image source={{ uri: acc.qr_code }} style={s.walletQr} resizeMode="contain" />
                      ) : null}
                      <TouchableOpacity
                        onPress={async () => {
                          const next = shareSelectedIds.filter((x: string) => x !== acc.id);
                          setShareSelectedIds(next);
                          if (shareRow) {
                            await supabase.from('split_shares').update({ data: { account_ids: next } }).eq('id', shareRow.id);
                          } else {
                            await supabase.from('split_shares').insert({ split_bill_id: splitBillId, user_id: userId, data: { account_ids: next } });
                          }
                          setShareOriginalIds(next);
                          await refetchShareRow();
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 16, color: DC.pageTextMuted, lineHeight: 18 }}>×</Text>
                      </TouchableOpacity>
                    </View>
                    {idx < arr.length - 1 && <View style={s.divider} />}
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── Step 3: Share ── */}
        {wizardStep === 3 && (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.sectionRow}>
              <Text style={s.sectionHeader}>Share as</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 32, paddingHorizontal: DC.pagePadding, paddingTop: 8 }}>
              {/* Link */}
              <TouchableOpacity
                style={{ alignItems: 'center', gap: 8, opacity: shareGenerating ? 0.5 : 1 }}
                onPress={async () => {
                  let link = shareLink;
                  if (!link) {
                    link = await generateLink() ?? '';
                  }
                  await copyShareLink(link);
                }}
                disabled={shareGenerating}
                activeOpacity={0.8}
              >
                {shareGenerating ? (
                  <ActivityIndicator size="small" color={DC.pageText} style={{ width: 32, height: 32 }} />
                ) : shareCopied ? (
                  <SvgXml xml={SVG_CHECK_ONE} width={32} height={32} color={ACCENT_DARK} />
                ) : (
                  <SvgXml xml={SVG_LINK} width={32} height={32} color={DC.pageText} />
                )}
                <Text style={[s.shareLabel, shareCopied && { color: ACCENT_DARK }]}>
                  {shareGenerating ? 'generating...' : shareCopied ? 'copied!' : 'Link'}
                </Text>
              </TouchableOpacity>
              {/* Image */}
              <TouchableOpacity
                style={{ alignItems: 'center', gap: 8, opacity: saveImgLoading ? 0.5 : 1 }}
                onPress={async () => {
                  if (shareAccounts.length === 0) {
                    const { data: accs } = await supabase.from('accounts').select('id, account_name, bank, account_number, qr_code').eq('user_id', userId).order('account_name');
                    setShareAccounts(accs ?? []);
                    if (shareRow) setShareSelectedIds(shareRow.data?.account_ids ?? []);
                  }
                  saveAsImage();
                }}
                disabled={saveImgLoading}
                activeOpacity={0.8}
              >
                {saveImgLoading ? (
                  <ActivityIndicator size="small" color={DC.pageText} style={{ width: 32, height: 32 }} />
                ) : (
                  <SvgXml xml={SVG_IMAGE} width={32} height={32} color={DC.pageText} />
                )}
                <Text style={s.shareLabel}>{saveImgLoading ? 'generating...' : 'Image'}</Text>
              </TouchableOpacity>
            </View>
            {shareGenerating && (
              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted, paddingHorizontal: DC.pagePadding, marginTop: 8 }}>generating link...</Text>
            )}
            {shareCopied && !shareGenerating && (
              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: ACCENT_DARK, paddingHorizontal: DC.pagePadding, marginTop: 8 }}>✓ link copied to clipboard</Text>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

      </View>

      {/* ── Hidden capture view for image export ── */}
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={{ position: 'absolute', left: -9999, top: 0, width: 380, backgroundColor: '#ffffff' }}>
        <View nativeID="split-bill-capture" style={{ padding: 28, backgroundColor: '#ffffff' }}>
          <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 24, color: '#1a2e2e', letterSpacing: -0.5, marginBottom: 4 }}>{String(name).toLowerCase()}</Text>
          <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: '#929090', marginBottom: 24 }}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>

          {/* Per person */}
          <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 10, color: '#929090', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>per person pay</Text>
          <View style={{ borderRadius: 12, borderWidth: 1, borderColor: '#eef0f0', overflow: 'hidden', marginBottom: 20 }}>
            {(() => {
              const totals: Record<string, number> = {};
              filledPeople.forEach((p: string) => { totals[p] = 0; });
              items.forEach((item: any) => {
                const d = isDeductType(item.recording_type);
                const pp = (item.people ?? []).length > 0 ? Number(item.cost) / item.people.length : 0;
                (item.people ?? []).forEach((p: string) => { if (totals[p] !== undefined) totals[p] += d ? -pp : pp; });
              });
              const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
              return (
                <>
                  {filledPeople.map((p: string, i: number) => {
                    const total = totals[p] ?? 0;
                    return (
                      <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#eef0f0' }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#e8f5f4', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 11, color: '#2A7A6F' }}>{p.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={{ flex: 1, fontFamily: 'Poppins-Regular', fontSize: 13, color: '#2e3d3d' }}>{p}</Text>
                        <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: total < 0 ? '#d97060' : '#2A7A6F' }}>{total < 0 ? '-' : ''}{fmt(Math.abs(total))}</Text>
                      </View>
                    );
                  })}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#e8f5f4' }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#b6e1de', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 11, color: '#2A7A6F' }}>Σ</Text>
                    </View>
                    <Text style={{ flex: 1, fontFamily: 'Poppins-Bold', fontSize: 13, color: '#2A7A6F' }}>total</Text>
                    <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: '#2A7A6F' }}>{fmt(grandTotal)}</Text>
                  </View>
                </>
              );
            })()}
          </View>

          {/* Items */}
          {items.length > 0 && (
            <>
              <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 10, color: '#929090', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>item breakdown</Text>
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: '#eef0f0', overflow: 'hidden', marginBottom: 20 }}>
                {items.map((item: any, ii: number) => {
                  const d = isDeductType(item.recording_type);
                  const people: string[] = item.people ?? [];
                  return (
                    <View key={item.id} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eef0f0' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#e8f5f4', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 10, color: '#2A7A6F' }}>{ii + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                            <Text style={{ flex: 1, fontFamily: 'Poppins-Regular', fontSize: 12, color: '#2e3d3d' }}>{item.name}</Text>
                            <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 12, color: d ? '#d97060' : '#2A7A6F' }}>{d ? '-' : ''}{fmt(Number(item.cost))}</Text>
                          </View>
                          {people.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                              {people.map((p: string) => (
                                <View key={p} style={{ backgroundColor: '#e8f5f4', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                                  <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 10, color: '#2A7A6F' }}>{p}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Wallet accounts */}
          {shareAccounts.filter((a: any) => shareSelectedIds.includes(a.id)).length > 0 && (
            <>
              <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 10, color: '#929090', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>payment information</Text>
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: '#eef0f0', overflow: 'hidden', marginBottom: 20 }}>
                {shareAccounts.filter((a: any) => shareSelectedIds.includes(a.id)).map((acc: any, i: number, arr: any[]) => (
                  <View key={acc.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: '#eef0f0' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: '#2e3d3d' }}>{acc.bank}</Text>
                      <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 10, color: '#929090' }}>{acc.account_name}</Text>
                      <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 12, color: '#2e3d3d' }}>{acc.account_number}</Text>
                    </View>
                    {acc.qr_code ? <Image source={{ uri: acc.qr_code }} style={{ width: 56, height: 56, borderRadius: 8 }} resizeMode="contain" /> : null}
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 10, color: '#c8d0d0', textAlign: 'center', marginTop: 8 }}>generated by LEDGR</Text>
        </View>
      </ViewShot>
      <BottomSheet visible={actionsModal} onClose={() => setActionsModal(false)} title="actions">
        <TouchableOpacity style={s.actionSheetRow} onPress={() => { setActionsModal(false); handleToggleStatus(); }} activeOpacity={0.8}>
          <Text style={s.actionSheetText}>{billStatus === 'closed' ? 'reopen bill' : 'close bill'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionSheetRow} onPress={() => { setActionsModal(false); openEditName(); }} activeOpacity={0.8}>
          <Text style={s.actionSheetText}>rename</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionSheetRow} onPress={() => { setActionsModal(false); setDeleteSplitModal(true); }} activeOpacity={0.8}>
          <Text style={[s.actionSheetText, { color: Colors.expense }]}>delete split bill</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* ── New unified Add Item modal ── */}
      <Modal visible={newItemModal} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setNewItemModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setNewItemModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ flex: 1, backgroundColor: '#ffffff' }}>
            <SafeAreaView style={{ flex: 1 }}>

              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingTop: 28, paddingBottom: 16 }}>
                <Text style={{ ...DC.typography.pageTitle }}>Add Item</Text>
                <TouchableOpacity onPress={() => setNewItemModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <SvgXml xml={SVG_CLOSE} width={28} height={28} color={DC.pageText} />
                </TouchableOpacity>
              </View>

              {/* ── Choice step ── */}
              {newItemStep === 'choice' && (
                <View style={{ paddingHorizontal: DC.pagePadding, gap: 12 }}>
                  {newItemScanError ? <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: Colors.expense, marginBottom: 4 }}>{newItemScanError}</Text> : null}
                  <TouchableOpacity
                    style={{ borderWidth: DC.cardBorderWidth, borderColor: DC.cardBorder, borderRadius: DC.cardRadius, padding: 20 }}
                    onPress={() => openNewItemForm(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 14, color: DC.pageText }}>Add an item</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ borderWidth: DC.cardBorderWidth, borderColor: DC.cardBorder, borderRadius: DC.cardRadius, padding: 20 }}
                    onPress={async () => {
                      const { data } = await supabase
                        .from('recordings')
                        .select('id, name, amount, type, transaction_date, status, is_due')
                        .eq('user_id', userId)
                        .in('type', ['expense', 'income'])
                        .order('transaction_date', { ascending: false })
                        .limit(200);
                      setAllRecordings((data ?? []).filter((r: any) => !r.is_due));
                      setNewItemRecSearch('');
                      setNewItemRecShowMore(false);
                      setNewItemStep('pick-recording');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 14, color: DC.pageText }}>Add an existing record</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ borderWidth: DC.cardBorderWidth, borderColor: DC.cardBorder, borderRadius: DC.cardRadius, padding: 20, opacity: newItemScanLoading ? 0.5 : 1 }}
                    onPress={() => setNewItemScanSourceModal(true)}
                    disabled={newItemScanLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 14, color: DC.pageText }}>
                      {newItemScanLoading ? 'scanning...' : 'Scan from receipt'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Scanning step ── */}
              {newItemStep === 'scanning' && (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: DC.pagePadding }}>
                  <ActivityIndicator size="large" color={DC.headerBlueBg} />
                  <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 14, color: DC.pageText, textAlign: 'center' }}>Reading receipt...</Text>
                  <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted, textAlign: 'center' }}>detecting items and prices</Text>
                </View>
              )}

              {/* ── OCR Text step ── */}
              {newItemStep === 'ocr-text' && (
                <View style={{ flex: 1 }}>
                  <View style={{ paddingHorizontal: DC.pagePadding, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: DC.cardDividerColor }}>
                    <Text style={{ ...DC.typography.sectionHeader }}>OCR Output</Text>
                    <Text style={{ ...DC.typography.subContent, color: DC.pageTextMuted, marginTop: 2 }}>edit the text below if needed, then tap Parse</Text>
                  </View>
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: DC.pagePadding }}>
                    <TextInput
                      style={{ fontFamily: 'Poppins-Regular', fontSize: 13, color: DC.pageText, borderWidth: 1, borderColor: DC.controlBorder, borderRadius: 10, padding: 12, minHeight: 200, textAlignVertical: 'top' }}
                      multiline
                      value={newItemOcrText}
                      onChangeText={setNewItemOcrText}
                      autoCorrect={false}
                      spellCheck={false}
                    />
                  </ScrollView>
                  <View style={{ paddingHorizontal: DC.pagePadding, paddingVertical: 12, borderTopWidth: 1, borderTopColor: DC.cardDividerColor, gap: 8 }}>
                    <TouchableOpacity
                      style={[s.doneBtn, { marginTop: 0, opacity: !newItemOcrText.trim() ? 0.4 : 1 }]}
                      disabled={!newItemOcrText.trim()}
                      onPress={() => {
                        const { parseReceiptText } = require('../../src/lib/receiptParser');
                        const parsed = parseReceiptText(newItemOcrText);
                        if (parsed.items.length === 0) {
                          setNewItemScanError('no items found in text — try editing the text above');
                          setNewItemStep('ocr-text');
                        } else {
                          setNewItemScanGroups([{ photoUri: '', items: parsed.items.map((i: any) => ({ name: i.name, cost: String(i.price), selected: true })) }]);
                          setNewItemStep('scan-review');
                        }
                      }}
                    >
                      <Text style={s.doneBtnText}>Parse Items</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 0 }]} onPress={() => setNewItemStep('choice')}>
                      <Text style={[s.doneBtnText, { color: Colors.muted }]}>back</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── Scan review step ── */}
              {newItemStep === 'scan-review' && (() => {
                const allValid = newItemScanGroups.flatMap(g => g.items.filter(r => r.selected !== false && r.name.trim() && parseFloat(r.cost) > 0));
                const selectedCount = allValid.length;
                const selectedTotal = allValid.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
                return (
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: DC.cardDividerColor }}>
                      <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted }}>tap to select / deselect</Text>
                      <TouchableOpacity onPress={() => {
                        const allSelected = newItemScanGroups.every(g => g.items.every(r => r.selected !== false));
                        setNewItemScanGroups(prev => prev.map(g => ({ ...g, items: g.items.map(x => ({ ...x, selected: !allSelected })) })));
                      }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 11, color: DC.viewBtnText }}>
                          {newItemScanGroups.every(g => g.items.every(r => r.selected !== false)) ? 'deselect all' : 'select all'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted, fontStyle: 'italic', paddingHorizontal: DC.pagePadding, paddingTop: 10, paddingBottom: 6 }}>Please double-check the amounts — the receipt reader may not always be accurate.</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingVertical: 10, backgroundColor: DC.viewBtnBg }}>
                      <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.viewBtnText }}>{selectedCount} item{selectedCount !== 1 ? 's' : ''} selected</Text>
                      <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 14, color: DC.viewBtnText }}>{selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                      {newItemScanGroups.map((group, gIdx) => (
                        <View key={gIdx}>
                          {/* Photo header row */}
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: DC.pagePadding, paddingVertical: 10, backgroundColor: DC.cardBg, borderBottomWidth: DC.rowDivider.height, borderBottomColor: DC.rowDivider.backgroundColor }}
                            onPress={() => setViewPhotoUri(group.photoUri)}
                            activeOpacity={0.8}
                          >
                            <Image source={{ uri: group.photoUri }} style={{ width: 36, height: 36, borderRadius: 6 }} resizeMode="cover" />
                            <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 12, color: DC.pageText, flex: 1 }}>Photo #{gIdx + 1}</Text>
                            <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.viewBtnText }}>view</Text>
                          </TouchableOpacity>
                          {group.items.length === 0 ? (
                            <View style={{ paddingHorizontal: DC.pagePadding, paddingVertical: 12 }}>
                              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted, fontStyle: 'italic' }}>no items detected in this photo</Text>
                            </View>
                          ) : group.items.map((item, idx) => {
                            const isSelected = item.selected !== false;
                            const isLast = idx === group.items.length - 1;
                            return (
                              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: DC.pagePadding, borderBottomWidth: isLast ? 0 : DC.rowDivider.height, borderBottomColor: DC.rowDivider.backgroundColor, opacity: isSelected ? 1 : 0.35 }}>
                                <TouchableOpacity onPress={() => setNewItemScanGroups(prev => prev.map((g, gi) => gi !== gIdx ? g : { ...g, items: g.items.map((x, i) => i !== idx ? x : { ...x, selected: !isSelected }) }))} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: isSelected ? DC.viewBtnText : DC.controlBorder, backgroundColor: isSelected ? DC.viewBtnText : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                    {isSelected && <Text style={{ color: '#ffffff', fontSize: 11, fontFamily: 'Poppins-Bold', lineHeight: 14 }}>✓</Text>}
                                  </View>
                                </TouchableOpacity>
                                <Text style={{ flex: 1, fontFamily: 'Poppins-Regular', fontSize: 13, color: DC.pageText }} numberOfLines={1}>{item.name}</Text>
                                <TextInput
                                  style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText, textAlign: 'right', width: 80, borderWidth: 1, borderColor: DC.controlBorder, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: Colors.surface }}
                                  value={item.cost}
                                  onChangeText={v => setNewItemScanGroups(prev => prev.map((g, gi) => gi !== gIdx ? g : { ...g, items: g.items.map((x, i) => i !== idx ? x : { ...x, cost: v }) }))}
                                  keyboardType="decimal-pad"
                                  selectTextOnFocus
                                />
                              </View>
                            );
                          })}
                        </View>
                      ))}
                    </ScrollView>
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: DC.pagePadding, paddingVertical: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: DC.cardDividerColor, flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity style={[s.doneBtn, { flex: 1, marginTop: 0, backgroundColor: Colors.surface }]} onPress={() => setNewItemStep('choice')}>
                        <Text style={[s.doneBtnText, { color: Colors.muted }]}>back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.doneBtn, { flex: 2, marginTop: 0, opacity: newItemSaving || selectedCount === 0 ? 0.4 : 1 }]}
                        onPress={saveScanItems}
                        disabled={newItemSaving || selectedCount === 0}
                      >
                        <Text style={s.doneBtnText}>{newItemSaving ? 'saving...' : `add ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}

              {/* ── Pick recording step ── */}
              {newItemStep === 'pick-recording' && (
                <SafeAreaView style={{ flex: 1 }}>
                  <View style={{ ...DC.textbox.wrap, marginHorizontal: DC.pagePadding, marginBottom: 12 }}>
                    <TextInput
                      style={{ ...DC.textbox.input }}
                      placeholder="Search record..."
                      placeholderTextColor={DC.inputPlaceholder}
                      value={newItemRecSearch}
                      onChangeText={v => { setNewItemRecSearch(v); setNewItemRecShowMore(false); }}
                      autoFocus
                    />
                  </View>
                  <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                    {(() => {
                      const q = newItemRecSearch.trim().toLowerCase();
                      const alreadyLinkedIds = new Set(linkedRecordings.map((lr: any) => lr.recording?.id));
                      const filtered = allRecordings.filter((r: any) =>
                        !q || r.name.toLowerCase().includes(q) || (r.transaction_date ?? '').includes(q)
                      );
                      const visible = filtered.slice(0, newItemRecShowMore ? filtered.length : 10);
                      if (filtered.length === 0) return (
                        <View style={{ padding: DC.pagePadding }}>
                          <Text style={{ ...DC.typography.muted }}>no recordings found</Text>
                        </View>
                      );
                      return (
                        <>
                          {visible.map((rec: any) => {
                            const alreadyAdded = alreadyLinkedIds.has(rec.id);
                            const typeLabel = rec.type === 'expense' ? 'Expense' : rec.type === 'income' ? 'Income' : rec.type;
                            const dateStr = rec.transaction_date ? new Date(rec.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                            return (
                              <TouchableOpacity
                                key={rec.id}
                                style={[rm.row, alreadyAdded && { opacity: 0.5 }]}
                                onPress={() => { if (!alreadyAdded) openNewItemForm(rec); }}
                                disabled={alreadyAdded}
                                activeOpacity={0.7}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={rm.name} numberOfLines={1}>{rec.name}</Text>
                                  <Text style={rm.sub}>{typeLabel} · {dateStr}</Text>
                                  {alreadyAdded && <Text style={[rm.sub, { fontStyle: 'italic' }]}>(already linked)</Text>}
                                </View>
                                <Text style={rm.amount}>{fmt(Number(rec.amount))}</Text>
                              </TouchableOpacity>
                            );
                          })}
                          {!newItemRecShowMore && filtered.length > 10 && (
                            <TouchableOpacity style={{ paddingVertical: 16, paddingHorizontal: DC.pagePadding }} onPress={() => setNewItemRecShowMore(true)}>
                              <Text style={{ ...DC.typography.sectionBody, color: DC.pageTextMuted }}>Show {filtered.length - 10} more...</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      );
                    })()}
                  </ScrollView>
                </SafeAreaView>
              )}

              {/* ── Form step ── */}
              {newItemStep === 'form' && (
                <SafeAreaView style={{ flex: 1 }}>
                  {/* Recording context */}
                  {newItemFromRecording && (
                    <View style={{ paddingHorizontal: DC.pagePadding, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: DC.cardDividerColor }}>
                      <Text style={{ ...DC.typography.sectionHeader }}>Record:</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 13, color: DC.pageText }} numberOfLines={1}>{newItemFromRecording.name}</Text>
                          <Text style={{ ...DC.typography.subContent }}>
                            {newItemFromRecording.type} · {newItemFromRecording.transaction_date ? new Date(newItemFromRecording.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                          </Text>
                        </View>
                        <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 14, color: DC.pageText }}>{fmt(Number(newItemFromRecording.amount))}</Text>
                      </View>
                      {/* Budget bar */}
                      {(() => {
                        const total = Number(newItemFromRecording.amount);
                        const used = newItemRecordingBudgetUsed + newItemSubitemsTotal;
                        const pct = total > 0 ? Math.min(used / total, 1) : 0;
                        const over = used > total + 0.01;
                        return (
                          <View style={{ marginTop: 8 }}>
                            <View style={{ height: 4, backgroundColor: DC.cardBorder, borderRadius: 2, overflow: 'hidden' }}>
                              <View style={{ height: 4, borderRadius: 2, width: `${pct * 100}%` as any, backgroundColor: over ? Colors.expense : ACCENT_DARK }} />
                            </View>
                            <Text style={{ ...DC.typography.subContent, color: over ? Colors.expense : DC.pageTextMuted, marginTop: 2 }}>
                              {fmt(used)} used · {over ? `${fmt(used - total)} over` : `${fmt(total - used)} left`}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  )}

                  {/* Name + Amount row */}
                  <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: DC.pagePadding, paddingTop: 16, paddingBottom: 12 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ ...DC.typography.sectionHeader }}>Name</Text>
                      <View style={DC.textbox.wrap}>
                        <TextInput
                          style={DC.textbox.input}
                          placeholder="Type a name"
                          placeholderTextColor={DC.inputPlaceholder}
                          value={newItemName}
                          onChangeText={setNewItemName}
                          autoFocus={!newItemFromRecording}
                        />
                      </View>
                    </View>
                    <View style={{ width: 110, gap: 4 }}>
                      <Text style={{ ...DC.typography.sectionHeader }}>Amount {newItemTab === 'subitems' && <Text style={{ fontFamily: 'Poppins-Regular', color: DC.pageTextMuted }}>(optional)</Text>}</Text>
                      <View style={[DC.textbox.wrap, newItemTab === 'subitems' && { opacity: 0.4 }]}>
                        <TextInput
                          style={DC.textbox.input}
                          placeholder="0.00"
                          placeholderTextColor={DC.inputPlaceholder}
                          value={newItemAmount}
                          onChangeText={setNewItemAmount}
                          keyboardType="decimal-pad"
                          editable={newItemTab !== 'subitems'}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />
              {/* Tab row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: DC.pagePadding, paddingTop: 12, paddingBottom: 12 }}>
                <TouchableOpacity style={editItemTab === 'assign' ? DC.button.active : DC.button.base} onPress={() => handleEditItemTabChange('assign')} activeOpacity={0.8}>
                  <Text style={editItemTab === 'assign' ? DC.button.textActive : DC.button.textInactive}>Assign People</Text>
                </TouchableOpacity>
                <TouchableOpacity style={editItemTab === 'subitems' ? DC.button.active : DC.button.base} onPress={() => handleEditItemTabChange('subitems')} activeOpacity={0.8}>
                  <Text style={editItemTab === 'subitems' ? DC.button.textActive : DC.button.textInactive}>Add Subitems</Text>
                </TouchableOpacity>
                {editItemTab === 'subitems' && (
                  <TouchableOpacity style={DC.circleBtn.addSm} onPress={openAddSubitem} activeOpacity={0.7}>
                    <Text style={s.addCircleBtnText}>+</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Total bar — shown on subitems tab */}
              {editItemTab === 'subitems' && (() => {
                const subitems = (editItemTarget?.groupItems ?? []).filter((i: any) => i.id !== editItemTarget?.item?.id);
                const total = subitems.reduce((s: number, i: any) => s + Number(i.cost), 0);
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingVertical: 10, backgroundColor: DC.viewBtnBg }}>
                    <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.viewBtnText }}>{subitems.length} subitem{subitems.length !== 1 ? 's' : ''}</Text>
                    <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 14, color: DC.viewBtnText }}>{total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  </View>
                );
              })()}

              {/* Assign People tab */}
              {editItemTab === 'assign' && (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                  {/* Tag input — uses newItemPeople, not assignPeople/assignItem */}
                  <View style={[s.tagInputWrap, { marginHorizontal: DC.pagePadding, marginBottom: 8 }]}>
                    {newItemPeople.map(p => (
                      <TouchableOpacity key={p} style={s.tagChip} onPress={() => setNewItemPeople(prev => prev.filter(x => x !== p))} activeOpacity={0.7}>
                        <Text style={s.tagChipText}>{displayPersonName(p)}</Text>
                        <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 11, color: DC.pageTextMuted }}>✕</Text>
                      </TouchableOpacity>
                    ))}
                    <TextInput
                      style={s.tagInput}
                      placeholder={newItemPeople.length === 0 ? 'type a name...' : ''}
                      placeholderTextColor={DC.inputPlaceholder}
                      value={newItemPeopleSearch}
                      onChangeText={v => setNewItemPeopleSearch(v)}
                      onSubmitEditing={async () => {
                        const val = newItemPeopleSearch.trim();
                        if (!val) return;
                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                        const n = match ?? val;
                        if (!newItemPeople.some(p => p.toLowerCase() === n.toLowerCase())) setNewItemPeople(prev => [...prev, n]);
                        setNewItemPeopleSearch('');
                        if (!match && !contacts.some(c => c.toLowerCase() === n.toLowerCase())) {
                          setContacts(prev => [...prev, n].sort());
                          await supabase.from('contacts').insert({ user_id: userId, name: n });
                        }
                      }}
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                  </View>
                  {newItemPeopleSearch.trim() !== '' && (
                    <View style={[s.dropdownList, { marginHorizontal: DC.pagePadding, marginBottom: 8 }]}>
                      {allPeopleForAssign.filter(p => p.toLowerCase().includes(newItemPeopleSearch.toLowerCase())).map(p => {
                        const alreadySel = newItemPeople.some(x => x.toLowerCase() === p.toLowerCase());
                        return (
                          <TouchableOpacity key={p} style={[s.dropdownItem, alreadySel && { backgroundColor: DC.viewBtnBg }]} onPress={() => {
                            if (alreadySel) {
                              setNewItemPeople(prev => prev.filter(x => x.toLowerCase() !== p.toLowerCase()));
                            } else {
                              setNewItemPeople(prev => [...prev, p]);
                            }
                            setNewItemPeopleSearch('');
                          }} activeOpacity={0.7}>
                            <Text style={[s.dropdownItemText, alreadySel && { color: DC.viewBtnText, fontFamily: 'Poppins-SemiBold' }]}>{displayPersonName(p)}{alreadySel ? ' ✓' : ''}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      {!allPeopleForAssign.some(p => p.toLowerCase() === newItemPeopleSearch.trim().toLowerCase()) && (
                        <TouchableOpacity style={[s.dropdownItem, { borderBottomWidth: 0 }]} onPress={async () => {
                          const n = newItemPeopleSearch.trim();
                          if (!newItemPeople.some(p => p.toLowerCase() === n.toLowerCase())) setNewItemPeople(prev => [...prev, n]);
                          setNewItemPeopleSearch('');
                          if (!contacts.some(c => c.toLowerCase() === n.toLowerCase())) {
                            setContacts(prev => [...prev, n].sort());
                            await supabase.from('contacts').insert({ user_id: userId, name: n });
                          }
                        }} activeOpacity={0.7}>
                          <Text style={[s.dropdownItemText, { color: DC.viewBtnText }]}>+ Add "{newItemPeopleSearch.trim()}" to contacts</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  <Text style={{ ...DC.typography.sectionHeader, paddingHorizontal: DC.pagePadding, marginBottom: 8 }}>People</Text>
                  {allPeopleForAssign
                    .filter(p => !newItemPeopleSearch.trim() || p.toLowerCase().includes(newItemPeopleSearch.toLowerCase()))
                    .map((p, idx, arr) => {
                      const sel = newItemPeople.includes(p);
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[
                            { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: DC.pagePadding, paddingVertical: DC.rowPaddingV },
                            idx < arr.length - 1 && { borderBottomWidth: DC.rowDivider.height, borderBottomColor: DC.rowDivider.backgroundColor },
                          ]}
                          onPress={() => setNewItemPeople(prev => sel ? prev.filter(x => x !== p) : [...prev, p])}
                          activeOpacity={0.7}
                        >
                          <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                            {sel ? (
                              <SvgXml xml={SVG_CHECK_ONE} width={28} height={28} color={DC.headerBlueBg} />
                            ) : (
                              <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: DC.controlBorder }} />
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText }}>{displayPersonName(p)}</Text>
                            {sel && <Text style={{ ...DC.typography.subContent, color: DC.pageTextMuted }}>Added</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              )}

              {/* Add Subitems tab */}
              {editItemTab === 'subitems' && (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                  {(editItemTarget?.groupItems ?? []).filter((i: any) => i.id !== editItemTarget?.item?.id).length === 0 ? (
                    <View style={{ paddingHorizontal: DC.pagePadding, paddingTop: 24 }}>
                      <Text style={{ ...DC.typography.muted }}>no subitems yet — tap + to add</Text>
                    </View>
                  ) : (
                    (editItemTarget?.groupItems ?? []).filter((i: any) => i.id !== editItemTarget?.item?.id).map((item: any, idx: number) => (
                      <TouchableOpacity
                        key={item.id}
                        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: DC.pagePadding, borderBottomWidth: 1, borderBottomColor: DC.controlBorder }}
                        onPress={() => openAddSubitem({ id: item.id, name: item.name, cost: String(item.cost), people: item.people ?? [] })}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText, minWidth: 16 }}>{idx + 1}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...DC.typography.sectionBody, fontFamily: 'Poppins-SemiBold' }} numberOfLines={1}>{item.name}</Text>
                          {(item.people ?? []).length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                              {(item.people ?? []).map((p: string) => (
                                <View key={p} style={{ backgroundColor: DC.pageActionBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                                  <Text style={{ ...DC.typography.subContent }}>{p}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                        <Text style={{ ...DC.typography.amount }}>{fmt(Number(item.cost))}</Text>
                        <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <SvgXml xml={SVG_CLOSE} width={18} height={18} color={DC.pageTextMuted} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}

              {/* Save button — always visible at bottom of form step */}
              <View style={{ paddingHorizontal: DC.pagePadding, paddingVertical: 12, borderTopWidth: 1, borderTopColor: DC.cardDividerColor }}>
                <TouchableOpacity
                  style={[s.doneBtn, { marginTop: 0, opacity: newItemSaving || !newItemName.trim() || (!newItemAmount && newItemTab !== 'subitems') ? 0.4 : 1 }]}
                  onPress={saveNewItem}
                  disabled={newItemSaving || !newItemName.trim() || (!newItemAmount && newItemTab !== 'subitems')}
                >
                  <Text style={s.doneBtnText}>{newItemSaving ? 'saving...' : 'save item'}</Text>
                </TouchableOpacity>
              </View>
                </SafeAreaView>
              )}
            </SafeAreaView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      {/* Add / Edit Subitem — compact bottom sheet */}
      <BottomSheet visible={addSubitemModal} onClose={() => setAddSubitemModal(false)} title={editingSubitemId ? 'edit subitem' : 'add subitem'}>
        <View style={{ gap: 12 }}>
          {/* Name + Amount side by side */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>name</Text>
              <View style={DC.textbox.wrap}>
                <TextInput
                  style={DC.textbox.input}
                  placeholder="item name"
                  placeholderTextColor={DC.inputPlaceholder}
                  value={subitemName}
                  onChangeText={setSubitemName}
                  autoFocus
                />
              </View>
            </View>
            <View style={{ width: 100, gap: 4 }}>
              <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>amount</Text>
              <View style={DC.textbox.wrap}>
                <TextInput
                  style={[DC.textbox.input, { textAlign: 'right' }]}
                  placeholder="0.00"
                  placeholderTextColor={DC.inputPlaceholder}
                  value={subitemCost}
                  onChangeText={setSubitemCost}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
              </View>
            </View>
          </View>
          {/* Assign people */}
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>assign people</Text>
            {/* Search input */}
            <View style={DC.textbox.wrap}>
              <TextInput
                style={DC.textbox.input}
                placeholder="search or type a name..."
                placeholderTextColor={DC.inputPlaceholder}
                value={subitemPeopleSearch}
                onChangeText={setSubitemPeopleSearch}
                onSubmitEditing={async () => {
                  const val = subitemPeopleSearch.trim();
                  if (!val) return;
                  const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                  const name = match ?? val;
                  if (!subitemPeople.some(p => p.toLowerCase() === name.toLowerCase())) setSubitemPeople(prev => [...prev, name]);
                  setSubitemPeopleSearch('');
                  if (!match && !contacts.some(c => c.toLowerCase() === name.toLowerCase())) {
                    setContacts(prev => [...prev, name].sort());
                    await supabase.from('contacts').insert({ user_id: userId, name });
                  }
                }}
                returnKeyType="done"
                blurOnSubmit={false}
              />
            </View>
            {/* People rows — filtered by search, show first 3 when no search */}
            <View style={{ borderWidth: 1, borderColor: DC.controlBorder, borderRadius: 10, overflow: 'hidden', marginTop: 2 }}>
              {(() => {
                const q = subitemPeopleSearch.trim().toLowerCase();
                const filtered = q
                  ? allPeopleForAssign.filter(p => p.toLowerCase().includes(q))
                  : allPeopleForAssign.slice(0, 3);
                const showAdd = q && !allPeopleForAssign.some(p => p.toLowerCase() === q);
                const rows = [...filtered, ...(showAdd ? [null] : [])];
                if (rows.length === 0) return (
                  <View style={{ padding: 12 }}>
                    <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.muted }}>no people found</Text>
                  </View>
                );
                return rows.map((p, idx) => {
                  const isLast = idx === rows.length - 1;
                  if (p === null) {
                    return (
                      <TouchableOpacity
                        key="add-new"
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 }}
                        onPress={async () => {
                          const name = subitemPeopleSearch.trim();
                          if (!subitemPeople.some(x => x.toLowerCase() === name.toLowerCase())) setSubitemPeople(prev => [...prev, name]);
                          setSubitemPeopleSearch('');
                          if (!contacts.some(c => c.toLowerCase() === name.toLowerCase())) {
                            setContacts(prev => [...prev, name].sort());
                            await supabase.from('contacts').insert({ user_id: userId, name });
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 13, color: DC.viewBtnText, flex: 1 }}>+ add "{subitemPeopleSearch.trim()}"</Text>
                      </TouchableOpacity>
                    );
                  }
                  const sel = subitemPeople.some(x => x.toLowerCase() === p.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={p}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: isLast ? 0 : DC.rowDivider.height, borderBottomColor: DC.rowDivider.backgroundColor, backgroundColor: sel ? DC.viewBtnBg : 'transparent' }}
                      onPress={() => setSubitemPeople(prev => sel ? prev.filter(x => x.toLowerCase() !== p.toLowerCase()) : [...prev, p])}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontFamily: sel ? 'Poppins-SemiBold' : 'Poppins-Regular', fontSize: 13, color: sel ? DC.viewBtnText : DC.pageText, flex: 1 }}>{displayPersonName(p)}</Text>
                      {sel && <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 12, color: DC.viewBtnText }}>✓</Text>}
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>
          </View>
          {/* Save */}
          <TouchableOpacity
            style={[s.doneBtn, { marginTop: 4, opacity: savingSubitem || !subitemName.trim() || !subitemCost ? 0.4 : 1 }]}
            onPress={saveSubitem}
            disabled={savingSubitem || !subitemName.trim() || !subitemCost}
          >
            <Text style={s.doneBtnText}>{savingSubitem ? 'saving...' : 'save'}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>




      {/* Wallet picker modal */}
      <Modal visible={walletPickerModal} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setWalletPickerModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setWalletPickerModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' as any }}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingTop: 20, paddingBottom: 12 }}>
                <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 16, color: DC.pageText }}>Select Accounts</Text>
                <TouchableOpacity onPress={() => setWalletPickerModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <SvgXml xml={SVG_CLOSE} width={22} height={22} color={DC.pageText} />
                </TouchableOpacity>
              </View>
              {/* Search */}
              <View style={{ ...DC.textbox.wrap, marginHorizontal: DC.pagePadding, marginBottom: 12 }}>
                <TextInput
                  style={DC.textbox.input}
                  placeholder="search accounts..."
                  placeholderTextColor={DC.inputPlaceholder}
                  value={walletSearch}
                  onChangeText={setWalletSearch}
                  autoFocus
                />
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {shareAccounts.length === 0 ? (
                  <View style={{ paddingHorizontal: DC.pagePadding, paddingVertical: 20 }}>
                    <Text style={{ ...DC.typography.muted }}>no accounts found — add one in the Accounts tab</Text>
                  </View>
                ) : (
                  shareAccounts
                    .filter((a: any) => !walletSearch.trim() ||
                      a.bank?.toLowerCase().includes(walletSearch.toLowerCase()) ||
                      a.account_name?.toLowerCase().includes(walletSearch.toLowerCase()) ||
                      a.account_number?.includes(walletSearch)
                    )
                    .map((acc: any, idx: number, arr: any[]) => {
                      const sel = shareSelectedIds.includes(acc.id);
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: DC.pagePadding, paddingVertical: 14, borderBottomWidth: idx < arr.length - 1 ? DC.rowDivider.height : 0, borderBottomColor: DC.rowDivider.backgroundColor, backgroundColor: sel ? ACCENT + '10' : 'transparent' }}
                          onPress={async () => {
                            const next = sel
                              ? shareSelectedIds.filter((x: string) => x !== acc.id)
                              : [...shareSelectedIds, acc.id];
                            setShareSelectedIds(next);
                            if (shareRow) {
                              await supabase.from('split_shares').update({ data: { account_ids: next } }).eq('id', shareRow.id);
                            } else {
                              await supabase.from('split_shares').insert({ split_bill_id: splitBillId, user_id: userId, data: { account_ids: next } });
                            }
                            setShareOriginalIds(next);
                            await refetchShareRow();
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: sel ? ACCENT_DARK : DC.controlBorder, backgroundColor: sel ? ACCENT_DARK : 'transparent', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {sel && <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'Poppins-Bold', lineHeight: 15 }}>✓</Text>}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.walletBank}>{acc.bank}</Text>
                            <Text style={s.walletHolder}>{acc.account_name}</Text>
                            <Text style={s.walletNumber}>{acc.account_number}</Text>
                          </View>
                          {acc.qr_code ? (
                            <Image source={{ uri: acc.qr_code }} style={{ width: 44, height: 44, borderRadius: 6 }} resizeMode="contain" />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })
                )}
              </ScrollView>
            </SafeAreaView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Share modal */}
      <BottomSheet visible={shareModal} onClose={() => setShareModal(false)} title="share split bill" maxHeight="72%">
        {/* Accounts */}
        <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>payment account (optional)</Text>
        <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
          {shareAccounts.map((acc: any) => {
            const sel = shareSelectedIds.includes(acc.id);
            return (
              <TouchableOpacity
                key={acc.id}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}
                onPress={() => setShareSelectedIds(prev => sel ? prev.filter(x => x !== acc.id) : [...prev, acc.id])}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: Colors.text }}>{acc.account_name}</Text>
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted }}>{acc.bank} · {acc.account_number}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {shareAccounts.length === 0 && <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.faint, paddingVertical: 8 }}>no accounts found</Text>}
        </ScrollView>
        {/* Save accounts button — only shown when link exists */}
        {shareLink ? (() => {
          const hasChanged = JSON.stringify([...shareSelectedIds].sort()) !== JSON.stringify([...shareOriginalIds].sort());
          return (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                style={[s.modeBtn, { flex: 1, alignItems: 'center', opacity: !hasChanged ? 0.4 : 1 }]}
                onPress={() => setShareSelectedIds([...shareOriginalIds])}
                disabled={!hasChanged}
              >
                <Text style={s.modeBtnText}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeBtn, { flex: 2, alignItems: 'center', opacity: shareSaving ? 0.5 : 1, borderColor: hasChanged ? ACCENT : Colors.borderMid, backgroundColor: hasChanged ? ACCENT + '18' : Colors.surface }]}
                onPress={saveShareAccounts}
                disabled={shareSaving || !hasChanged}
              >
                <Text style={[s.modeBtnText, hasChanged && { color: ACCENT_DARK, fontFamily: AppFont.semiBold }]}>
                  {shareSaving ? 'saving...' : 'save account selection'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })() : null}
        {/* Generate link — only shown when no link yet */}
        {!shareLink && (
          <TouchableOpacity
            style={[s.doneBtn, { marginTop: 12, opacity: shareGenerating ? 0.5 : 1 }]}
            onPress={generateLink}
            disabled={shareGenerating}
          >
            <Text style={s.doneBtnText}>{shareGenerating ? 'generating...' : 'generate link'}</Text>
          </TouchableOpacity>
        )}
        {/* Link textbox + copy */}
        <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 }}>link</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: shareLink ? ACCENT : Colors.borderMid, borderRadius: Radius.md, paddingHorizontal: 12, gap: 8 }}>
          <Text style={{ flex: 1, fontFamily: AppFont.regular, fontSize: 11, color: shareLink ? Colors.text : Colors.faint, paddingVertical: 12 }} numberOfLines={1}>
            {shareLink || 'generate a link first'}
          </Text>
          {shareLink ? (
            <TouchableOpacity onPress={copyShareLink} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            </TouchableOpacity>
          ) : null}
        </View>
        {shareCopied && <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.income, marginTop: 4 }}>copied to clipboard!</Text>}
        {/* Save as image */}
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: saveImgLoading || !shareLink ? 0.4 : 1 }]}
          onPress={saveAsImage}
          disabled={saveImgLoading || !shareLink}
        >
          <Text style={[s.doneBtnText, { color: Colors.text }]}>{saveImgLoading ? 'generating...' : 'save as image'}</Text>
        </TouchableOpacity>
      </BottomSheet>
      {/* Mark as paid modal */}
      <BottomSheet visible={!!markPaidRec} onClose={() => setMarkPaidRec(null)} title="mark as paid">
        {markPaidRec && (() => {
          const rec = markPaidRec.recording;
          const label = rec?.type === 'receivable' ? 'mark as received' : 'mark as paid';
          const hint = rec?.type === 'expense'
            ? 'creates an income linked to this expense'
            : rec?.type === 'receivable'
            ? `creates an income linked to this receivable${rec?.linked_recording_id ? ' + expense for the linked loan' : ''}`
            : 'creates an expense payment linked to this loan';
          return (
            <>
              <Text style={[s.recDate, { marginBottom: 12 }]}>{rec?.name} · {fmt(Number(rec?.amount))}</Text>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginBottom: 16 }}>{hint}</Text>
              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>account</Text>
              <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                {markPaidAccounts.map((acc: any) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}
                    onPress={() => setMarkPaidAccount(acc)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: Colors.text }}>{acc.account_name}</Text>
                      <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted }}>{acc.bank} · {acc.account_number}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {markPaidAccounts.length === 0 && <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.faint }}>no accounts found</Text>}
              </ScrollView>
              <TouchableOpacity
                style={[s.doneBtn, { opacity: markPaidLoading ? 0.5 : 1 }]}
                onPress={confirmMarkPaid}
                disabled={markPaidLoading}
              >
                <Text style={s.doneBtnText}>{markPaidLoading ? 'saving...' : label}</Text>
              </TouchableOpacity>
            </>
          );
        })()}
      </BottomSheet>
      {/* Payment modal */}
      <BottomSheet visible={paymentModal} onClose={() => setPaymentModal(false)} title="add payment">
        {paymentModal && (() => {
          const totals = computeTotals();
          const owed = Math.abs(totals[paymentPerson] ?? 0);
          const isNegative = (totals[paymentPerson] ?? 0) < 0;
          const paid = activePayments
            .filter((p: any) => p.person_name === paymentPerson)
            .reduce((s: number, p: any) => s + Number(p.amount), 0);
          const remaining = Math.max(0, owed - paid);
          const actionLabel = isNegative ? 'confirm payment' : 'confirm received';
          const recordHint = isNegative
            ? 'creates an expense recording when fully settled'
            : 'creates an income recording when fully settled';
          return (
            <>
              <Text style={[s.recDate, { marginBottom: 4 }]}>{paymentPerson}</Text>
              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: isNegative ? PEACH : ACCENT_DARK, marginBottom: 12 }}>
                {isNegative ? 'amount to pay: ' : 'amount to collect: '}{fmt(remaining)} remaining
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {(['full', 'manual'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.modeBtn, paymentMode === m && s.modeBtnActive]}
                    onPress={() => setPaymentMode(m)}
                  >
                    <Text style={[s.modeBtnText, paymentMode === m && s.modeBtnTextActive]}>
                      {m === 'full' ? 'full payment' : 'manual amount'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {paymentMode === 'manual' && (() => {
                const recordingRows = getPersonRecordingRows(paymentPerson);
                const manualOwed = getPersonManualOwed(paymentPerson);
                const manualEntered = Object.values(paymentManualAmounts)
                  .reduce((s, v) => s + (parseFloat(v || '0') || 0), 0) + (parseFloat(paymentAmount || '0') || 0);
                return (
                  <>
                    {recordingRows.length > 0 && recordingRows.map((row) => (
                      <View key={row.recordingId} style={s.manualRow}>
                        <View style={s.manualLeft}>
                          <Text style={s.manualName} numberOfLines={1}>{row.recording?.name ?? 'recording'}</Text>
                          <Text style={s.manualHint}>owed {fmt(row.owed)} · settled {fmt(row.paid)}</Text>
                        </View>
                        <TextInput
                          style={[s.itemFormInput, s.manualInput]}
                          placeholder="0.00"
                          placeholderTextColor={Colors.faint}
                          value={paymentManualAmounts[row.recordingId] ?? ''}
                          onChangeText={(value) => setPaymentManualAmounts((prev) => ({ ...prev, [row.recordingId]: value }))}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    ))}
                    {manualOwed > 0 && (
                      <View style={s.manualRow}>
                        <View style={s.manualLeft}>
                          <Text style={s.manualName}>manual items</Text>
                          <Text style={s.manualHint}>owed {fmt(manualOwed)} · no linked recording</Text>
                        </View>
                        <TextInput
                          style={[s.itemFormInput, s.manualInput]}
                          placeholder="0.00"
                          placeholderTextColor={Colors.faint}
                          value={paymentAmount}
                          onChangeText={setPaymentAmount}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    )}
                    {recordingRows.length === 0 && manualOwed === 0 && (
                      <TextInput
                        style={s.itemFormInput}
                        placeholder="0.00"
                        placeholderTextColor={Colors.faint}
                        value={paymentAmount}
                        onChangeText={setPaymentAmount}
                        keyboardType="decimal-pad"
                        autoFocus
                      />
                    )}
                    <View style={s.manualTotalRow}>
                      <Text style={s.manualTotalLabel}>total payment</Text>
                      <Text style={s.manualTotalValue}>{fmt(manualEntered)}</Text>
                    </View>
                  </>
                );
              })()}
              {paymentMode === 'full' && (
                <Text style={{ fontFamily: AppFont.semiBold, fontSize: 15, color: ACCENT_DARK, marginBottom: 8 }}>{fmt(remaining)}</Text>
              )}
              {/* Charge to space — only when all items for this person are recording-linked */}
              {getPersonRecordingRows(paymentPerson).length > 0 && getPersonManualOwed(paymentPerson) === 0 && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 }}
                onPress={() => setChargeToSpace(v => !v)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: Colors.text }}>charge to a space</Text>
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted }}>creates an expense on the selected space</Text>
                </View>
              </TouchableOpacity>
              )}
              {chargeToSpace && (
                <View style={{ gap: 10, marginBottom: 8 }}>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>space</Text>
                  <View style={{ borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, overflow: 'hidden' }}>
                    {[...chargeSpaces].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((sp: any) => (
                      <TouchableOpacity key={sp.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: chargeSpaceId === sp.id ? ACCENT + '22' : Colors.white }} onPress={() => setChargeSpaceId(sp.id)}>
                        <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: chargeSpaceId === sp.id ? ACCENT_DARK : Colors.text }}>{sp.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>account <Text style={{ fontFamily: AppFont.regular, textTransform: 'none' }}>(optional)</Text></Text>
                  <View style={{ borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, overflow: 'hidden' }}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: !chargeAccountId ? ACCENT + '22' : Colors.white }} onPress={() => setChargeAccountId(null)}>
                      <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>none</Text>
                    </TouchableOpacity>
                    {[...chargeAccounts].sort((a: any, b: any) => a.account_name.localeCompare(b.account_name)).map((ac: any) => (
                      <TouchableOpacity key={ac.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: chargeAccountId === ac.id ? ACCENT + '22' : Colors.white }} onPress={() => setChargeAccountId(ac.id)}>
                        <View>
                          <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: chargeAccountId === ac.id ? ACCENT_DARK : Colors.text }}>{ac.account_name}</Text>
                          <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted }}>{ac.bank}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>category <Text style={{ fontFamily: AppFont.regular, textTransform: 'none' }}>(optional)</Text></Text>
                  <View style={{ borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, overflow: 'hidden' }}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: !chargeCategoryId ? ACCENT + '22' : Colors.white }} onPress={() => setChargeCategoryId(null)}>
                      <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>none</Text>
                    </TouchableOpacity>
                    {[...chargeCategories].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((cat: any) => (
                      <TouchableOpacity key={cat.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: chargeCategoryId === cat.id ? ACCENT + '22' : Colors.white }} onPress={() => setChargeCategoryId(cat.id)}>
                        <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: chargeCategoryId === cat.id ? ACCENT_DARK : Colors.text }}>{cat.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              <TouchableOpacity
                style={[s.doneBtn, { opacity: paymentSaving || (chargeToSpace && !chargeSpaceId) ? 0.5 : 1 }]}
                onPress={savePayment}
                disabled={paymentSaving || (chargeToSpace && !chargeSpaceId)}
              >
                <Text style={s.doneBtnText}>{paymentSaving ? 'saving...' : actionLabel}</Text>
              </TouchableOpacity>
            </>
          );
        })()}
      </BottomSheet>
      {/* Add receipt modal */}
      <BottomSheet visible={addReceiptModal} onClose={() => setAddReceiptModal(false)} title="add receipt">
        <TouchableOpacity
          style={[s.doneBtn, { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 0 }]}
          onPress={addReceiptFromCamera}
        >
          <Text style={s.doneBtnText}>camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: Colors.surface }]}
          onPress={addReceiptFromGallery}
        >
          <Text style={[s.doneBtnText, { color: Colors.text }]}>gallery</Text>
        </TouchableOpacity>
      </BottomSheet>
                        {/* Photo carousel modal */}
      <Modal visible={photoModal} transparent animationType="fade" onRequestClose={() => setPhotoModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f1a19' }}>
          {(() => {
            const pool = photoModalPool === 'direct' ? receiptPhotos : recordingReceiptPhotos;
            const current = pool[photoModalIndex];
            const label = current && 'recordingName' in current ? (current as any).recordingName : null;
            return (
              <>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 15, color: '#ffffff', letterSpacing: 0.2 }}>receipt</Text>
                    {label ? <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: Brand.color.accent, marginTop: 1 }} numberOfLines={1}>{label}</Text> : null}
                  </View>
                  {pool.length > 1 && (
                    <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginRight: 12 }}>{photoModalIndex + 1} / {pool.length}</Text>
                  )}
                  <TouchableOpacity
                    onPress={() => setPhotoModal(false)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 16, lineHeight: 18 }}>×</Text>
                  </TouchableOpacity>
                </View>
                {/* Photo */}
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                  <TouchableOpacity
                    onPress={() => setPhotoModalIndex(i => i - 1)}
                    disabled={photoModalIndex === 0}
                    style={{ position: 'absolute', left: 12, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', opacity: photoModalIndex === 0 ? 0.2 : 1 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 20, lineHeight: 22 }}>‹</Text>
                  </TouchableOpacity>
                  <Image
                    source={{ uri: current?.url ?? '' }}
                    style={{ width: width - 32, height: '85%' as any, borderRadius: 16 }}
                    resizeMode="contain"
                  />
                  <TouchableOpacity
                    onPress={() => setPhotoModalIndex(i => i + 1)}
                    disabled={photoModalIndex === pool.length - 1}
                    style={{ position: 'absolute', right: 12, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', opacity: photoModalIndex === pool.length - 1 ? 0.2 : 1 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 20, lineHeight: 22 }}>›</Text>
                  </TouchableOpacity>
                </View>
                {/* Dots + thumbnails */}
                <View style={{ paddingBottom: 28, paddingTop: 12, gap: 12 }}>
                  {pool.length > 1 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                      {pool.map((_, i) => (
                        <TouchableOpacity key={i} onPress={() => setPhotoModalIndex(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <View style={{ width: i === photoModalIndex ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === photoModalIndex ? Brand.color.accent : 'rgba(255,255,255,0.2)' }} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {pool.length > 1 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                      {pool.map((p, i) => (
                        <TouchableOpacity key={p.id} onPress={() => setPhotoModalIndex(i)} activeOpacity={0.8}>
                          <Image
                            source={{ uri: p.url }}
                            style={{ width: 56, height: 56, borderRadius: 10, borderWidth: i === photoModalIndex ? 2 : 0, borderColor: Brand.color.accent, opacity: i === photoModalIndex ? 1 : 0.45 }}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
                {/* Delete / Remove button */}
                {(() => {
                  const pool = photoModalPool === 'direct' ? receiptPhotos : recordingReceiptPhotos;
                  const isDirect = photoModalPool === 'direct';
                  const label = isDirect ? 'delete photo' : 'remove from view';
                  const color = isDirect ? Colors.expense : 'rgba(255,255,255,0.5)';
                  return (
                    <TouchableOpacity
                      onPress={handleDeleteReceiptPhoto}
                      style={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, marginBottom: 8 }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 12, color }}>{label}</Text>
                    </TouchableOpacity>
                  );
                })()}
              </>
            );
          })()}
        </SafeAreaView>
      </Modal>
      {/* Manual return prompt */}
      <BottomSheet visible={manualReturnModal} onClose={() => setManualReturnModal(false)} title="manual item settlement">
        <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text, marginBottom: 16 }}>
          {defaultCurrency}{fmt(manualReturnAmount)} is from a manual item with no linked recording.
        </Text>
        <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>create a recording for this?</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity
            style={[s.modeBtn, manualReturnType === 'return' && s.modeBtnActive]}
            onPress={() => setManualReturnType('return')}
          >
            <Text style={[s.modeBtnText, manualReturnType === 'return' && s.modeBtnTextActive]}>money in (return)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, manualReturnType === 'expense' && s.modeBtnActive]}
            onPress={() => setManualReturnType('expense')}
          >
            <Text style={[s.modeBtnText, manualReturnType === 'expense' && s.modeBtnTextActive]}>money out (expense)</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[s.doneBtn, { opacity: manualReturnSaving ? 0.5 : 1 }]}
          onPress={confirmManualReturn}
          disabled={manualReturnSaving}
        >
          <Text style={s.doneBtnText}>{manualReturnSaving ? 'saving...' : 'create recording'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]}
          onPress={() => setManualReturnModal(false)}
        >
          <Text style={[s.doneBtnText, { color: Colors.muted }]}>skip</Text>
        </TouchableOpacity>
      </BottomSheet>
      {/* Edit name modal */}
      <BottomSheet visible={editNameModal} onClose={() => setEditNameModal(false)} title="rename split bill">
        <TextInput
          style={s.itemFormInput}
          value={editNameVal}
          onChangeText={setEditNameVal}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={saveEditName}
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <TouchableOpacity style={[s.doneBtn, { flex: 1, backgroundColor: Colors.surface, marginTop: 0 }]} onPress={() => setEditNameModal(false)}>
            <Text style={[s.doneBtnText, { color: Colors.muted }]}>cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.doneBtn, { flex: 2, marginTop: 0, opacity: editNameVal.trim() ? 1 : 0.4 }]}
            onPress={saveEditName}
            disabled={!editNameVal.trim()}
          >
            <Text style={s.doneBtnText}>save</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
      {/* Delete split bill modal */}
      <BottomSheet visible={deleteSplitModal} onClose={() => setDeleteSplitModal(false)} title="delete split bill">
        <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text, marginBottom: 16 }}>
          What would you like to do with the payment recordings and receipts?
        </Text>
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 0 }]}
          onPress={confirmDeleteSplit}
          activeOpacity={0.8}
        >
          <View style={{ gap: 4, alignItems: 'center' }}>
            <Text style={[s.doneBtnText, { color: Colors.text }]}>keep recordings &amp; receipts</Text>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted }}>deletes split bill only</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]}
          onPress={async () => {
            // Delete receipt photos linked to this split bill
            if (linkedReceipt) {
              const { data: photos } = await supabase.from('receipt_photos').select('storage_path').eq('entry_id', linkedReceipt.id);
              if (photos && photos.length > 0) {
                await supabase.storage.from('receipts').remove(photos.map((p: any) => p.storage_path));
                await supabase.from('receipt_photos').delete().eq('entry_id', linkedReceipt.id);
              }
              await supabase.from('receipt_entries').delete().eq('id', linkedReceipt.id);
            }
            confirmDeleteSplit();
          }}
          activeOpacity={0.8}
        >
          <View style={{ gap: 4, alignItems: 'center' }}>
            <Text style={[s.doneBtnText, { color: Colors.text }]}>keep recordings, delete receipts</Text>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted }}>deletes split bill + receipt photos</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { borderColor: Colors.expense, backgroundColor: Colors.expense + '22', marginTop: 8 }]}
          onPress={confirmDeleteSplitWithRecordings}
          activeOpacity={0.8}
        >
          <View style={{ gap: 4, alignItems: 'center' }}>
            <Text style={[s.doneBtnText, { color: Colors.expense }]}>delete everything</Text>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.expense + 'CC' }}>deletes split bill + recordings + receipts</Text>
          </View>
        </TouchableOpacity>
      </BottomSheet>
      {/* Mark recording complete modal */}
      <BottomSheet visible={markRecCompleteModal} onClose={() => setMarkRecCompleteModal(false)} title="mark as complete">
        {markRecCompleteLr && (() => {
          const rec = markRecCompleteLr.recording;
          const paid = Number(rec?.paid_amount ?? 0);
          const total = Number(rec?.amount ?? 0);
          const isPartial = paid > 0 && paid < total - 0.01;
          return (
            <>
              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 14, color: Colors.text, marginBottom: 8 }}>{rec?.name}</Text>
              {isPartial && (
                <View style={{ backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12, marginBottom: 16, gap: 4 }}>
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted }}>partially collected</Text>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: PEACH }}>{fmt(paid)} of {fmt(total)}</Text>
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted }}>{fmt(total - paid)} remaining — marking complete will set it as fully paid</Text>
                </View>
              )}
              {!isPartial && (
                <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted, marginBottom: 16 }}>
                  {paid >= total - 0.01 ? 'fully collected — mark as complete?' : 'mark this recording as fully paid?'}
                </Text>
              )}
              <TouchableOpacity
                style={[s.doneBtn, { opacity: markRecCompleteLoading ? 0.5 : 1 }]}
                onPress={confirmMarkRecComplete}
                disabled={markRecCompleteLoading}
              >
                <Text style={s.doneBtnText}>{markRecCompleteLoading ? 'saving...' : 'confirm complete'}</Text>
              </TouchableOpacity>
            </>
          );
        })()}
      </BottomSheet>
      {/* Close confirm modal */}
      <BottomSheet visible={closeConfirmModal} onClose={() => setCloseConfirmModal(false)} title="close split bill?" maxHeight="50%">
        {unpaidPeopleNames.length > 0 && (
          <>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted, marginBottom: 8 }}>
              these people haven't fully paid yet:
            </Text>
            <View style={{ gap: 6, marginBottom: 12 }}>
              {unpaidPeopleNames.map((name, i) => (
                <Text key={i} style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text }}>{name}</Text>
              ))}
            </View>
          </>
        )}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
          onPress={() => setCloseCreateRecording(v => !v)}
        >
          <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: closeCreateRecording ? ACCENT_DARK : Colors.borderMid, backgroundColor: closeCreateRecording ? ACCENT_DARK : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {closeCreateRecording && <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Poppins-Bold', lineHeight: 13 }}>✓</Text>}
          </View>
          <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.text, flex: 1 }}>
            create an expense &amp; return recordings
          </Text>
        </TouchableOpacity>
        {closeCreateRecording && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>space</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {closeSpaces.map(sp => (
                <TouchableOpacity
                  key={sp.id}
                  style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: closeSpaceId === sp.id ? ACCENT_DARK : Colors.borderMid, backgroundColor: closeSpaceId === sp.id ? ACCENT + '22' : Colors.surface }}
                  onPress={() => setCloseSpaceId(sp.id)}
                >
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 12, color: closeSpaceId === sp.id ? ACCENT_DARK : Colors.text }}>{sp.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        {!closeCreateRecording && linkedRecordings.length > 0 && (
          <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginBottom: 8 }}>
            closing will mark all linked recordings as paid.
          </Text>
        )}
        <TouchableOpacity
          style={[s.doneBtn, { opacity: closingLoading || (closeCreateRecording && !closeSpaceId) ? 0.5 : 1 }]}
          onPress={confirmClose}
          disabled={closingLoading || (closeCreateRecording && !closeSpaceId)}
        >
          <Text style={s.doneBtnText}>{closingLoading ? 'closing...' : 'close anyway'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]}
          onPress={() => setCloseConfirmModal(false)}
        >
          <Text style={[s.doneBtnText, { color: Colors.muted }]}>cancel</Text>
        </TouchableOpacity>
      </BottomSheet>
      {/* Auto-complete prompt after payment */}
      <BottomSheet visible={autoCompleteModal} onClose={() => setAutoCompleteModal(false)} title="recordings fully paid">
        <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted, marginBottom: 12 }}>
          all people have paid for the following recording{autoCompleteRecs.length !== 1 ? 's' : ''}. mark as complete?
        </Text>
        {autoCompleteRecs.map((lr: any) => (
          <View key={lr.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text, flex: 1 }} numberOfLines={1}>{lr.recording?.name}</Text>
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: ACCENT_DARK }}>{fmt(Number(lr.recording?.amount ?? 0))}</Text>
          </View>
        ))}
        <TouchableOpacity
          style={[s.doneBtn, { marginTop: 16, opacity: autoCompleteLoading ? 0.5 : 1 }]}
          onPress={confirmAutoComplete}
          disabled={autoCompleteLoading}
        >
          <Text style={s.doneBtnText}>{autoCompleteLoading ? 'saving...' : 'mark as complete'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]}
          onPress={() => setAutoCompleteModal(false)}
        >
          <Text style={[s.doneBtnText, { color: Colors.muted }]}>not yet</Text>
        </TouchableOpacity>
      </BottomSheet>
      {/* Overpayment modal */}
      <BottomSheet visible={overpaymentModal} onClose={() => setOverpaymentModal(false)} title="overpayment detected">
        <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text, marginBottom: 4 }}>
          {overpaymentPerson} paid {fmt(overpaymentAmount)} more than they owe.
        </Text>
        <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginBottom: 16 }}>
          what would you like to do with the excess?
        </Text>
        <TouchableOpacity style={s.doneBtn} onPress={confirmOverpaymentIncome}>
          <Text style={s.doneBtnText}>record as income</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]} onPress={openApplyToSplitBill}>
          <Text style={[s.doneBtnText, { color: Colors.muted }]}>apply to another split bill</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]} onPress={() => setOverpaymentModal(false)}>
          <Text style={[s.doneBtnText, { color: Colors.muted }]}>ignore</Text>
        </TouchableOpacity>
      </BottomSheet>
      {/* Apply overpayment to split bill picker */}
      <BottomSheet visible={overpaymentApplyModal} onClose={() => setOverpaymentApplyModal(false)} title="apply to split bill">
        <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginBottom: 12 }}>
          {fmt(overpaymentAmount)} will be recorded as a payment from {overpaymentPerson} on the selected bill.
        </Text>
        {otherSplitBills.length === 0 ? (
          <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.faint }}>no other ongoing split bills found</Text>
        ) : (
          otherSplitBills.map((bill: any) => (
            <TouchableOpacity key={bill.id} style={s.recPickRow} onPress={() => confirmApplyToSplitBill(bill.id)}>
              <View style={[s.recIconWrap, { backgroundColor: ACCENT + '44' }]}>
              </View>
              <View style={s.recMid}>
                <Text style={s.recName}>{bill.name}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </BottomSheet>
      {/* Cancel payment modal */}
      <BottomSheet visible={cancelPaymentModal} onClose={() => setCancelPaymentModal(false)} title="cancel payment">
        <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text, marginBottom: 4 }}>
          {cancelPaymentTarget?.person_name} · {fmt(Number(cancelPaymentTarget?.amount ?? 0))}
        </Text>
        <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginBottom: 16 }}>
          this will void the payment and reverse any collected amounts. the record will be kept for audit.
        </Text>
        <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>reason (optional)</Text>
        <TextInput
          style={s.itemFormInput}
          placeholder="e.g. sent to wrong account"
          placeholderTextColor={Colors.faint}
          value={cancelReason}
          onChangeText={setCancelReason}
          autoFocus
        />
        <TouchableOpacity
          style={[s.doneBtn, { marginTop: 12, backgroundColor: Colors.expense + '22', opacity: cancelSaving ? 0.5 : 1 }]}
          onPress={confirmCancelPayment}
          disabled={cancelSaving}
        >
          <Text style={[s.doneBtnText, { color: Colors.expense }]}>{cancelSaving ? 'cancelling...' : 'confirm cancellation'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]}
          onPress={() => setCancelPaymentModal(false)}
        >
          <Text style={[s.doneBtnText, { color: Colors.muted }]}>keep payment</Text>
        </TouchableOpacity>
      </BottomSheet>
      {/* Camera capture */}
      <CameraCapture
        visible={cameraVisible}
        onDone={handleCameraDone}
        onCancel={() => setCameraVisible(false)}
      />
      {/* View photo from scan review */}
      <Modal visible={!!viewPhotoUri} transparent animationType="fade" onRequestClose={() => setViewPhotoUri(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={1} onPress={() => setViewPhotoUri(null)}>
          {viewPhotoUri && <Image source={{ uri: viewPhotoUri }} style={{ width: width - 40, height: '80%' as any }} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
      {/* Remove recording blocked modal */}
      <BottomSheet visible={removeRecordingBlockedModal} onClose={() => setRemoveRecordingBlockedModal(false)} title="cannot remove">
        <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text, marginBottom: 8 }}>
          this recording has payments already applied to it.
        </Text>
        <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted, marginBottom: 16 }}>
          to remove it, first delete all payments linked to this recording from the payment history section.
        </Text>
        <TouchableOpacity style={s.doneBtn} onPress={() => setRemoveRecordingBlockedModal(false)}>
          <Text style={s.doneBtnText}>ok</Text>
        </TouchableOpacity>
      </BottomSheet>


      {/* Edit item tab switch warning */}
      <BottomSheet visible={editItemTabWarnModal} onClose={() => { setEditItemTabWarnModal(false); setEditItemTabPending(null); }} title="switch tab?">
        <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text, marginBottom: 16 }}>
          {editItemTab === 'assign'
            ? 'switching to subitems will clear the people assigned to this item.'
            : 'switching to assign people will delete all subitems on this item.'}
        </Text>
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: Colors.expense + '22' }]} onPress={confirmEditItemTabChange}>
          <Text style={[s.doneBtnText, { color: Colors.expense }]}>clear and switch</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]} onPress={() => { setEditItemTabWarnModal(false); setEditItemTabPending(null); }}>
          <Text style={[s.doneBtnText, { color: Colors.muted }]}>cancel</Text>
        </TouchableOpacity>
      </BottomSheet>

      <PaymentModal
        visible={itemPayModal}
        person={itemPayPerson}
        splitBillId={splitBillId}
        onClose={() => setItemPayModal(false)}
        onConfirm={confirmItemPay}
      />

      {/* Scan receipt source picker */}
      <BottomSheet visible={newItemScanSourceModal} onClose={() => setNewItemScanSourceModal(false)} title="scan from receipt">
        <TouchableOpacity
          style={[s.doneBtn, { marginTop: 0 }]}
          onPress={() => handleScanReceipt('camera')}
        >
          <Text style={s.doneBtnText}>camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]}
          onPress={() => handleScanReceipt('gallery')}
        >
          <Text style={[s.doneBtnText, { color: Colors.text }]}>gallery</Text>
        </TouchableOpacity>
        {(receiptPhotos.length > 0 || recordingReceiptPhotos.length > 0) && (
          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]}
            onPress={() => { setNewItemScanSourceModal(false); setScanFromReceiptsModal(true); }}
          >
            <Text style={[s.doneBtnText, { color: Colors.text }]}>from receipts</Text>
          </TouchableOpacity>
        )}
      </BottomSheet>

      {/* Pick from existing receipt photos */}
      <BottomSheet visible={scanFromReceiptsModal} onClose={() => setScanFromReceiptsModal(false)} title="pick a receipt photo">
        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {[...receiptPhotos.map(p => ({ ...p, label: 'direct' })), ...recordingReceiptPhotos.map(p => ({ ...p, label: p.recordingName || 'recording' }))].map((p, i) => (
            <TouchableOpacity
              key={p.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border }}
              onPress={() => handleScanFromReceiptPhoto(p.url)}
              activeOpacity={0.7}
            >
              <Image source={{ uri: p.url }} style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: Colors.surface }} resizeMode="cover" />
              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.text, flex: 1 }} numberOfLines={1}>
                {p.label === 'direct' ? 'receipt photo' : p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  // Page
  header:      { paddingHorizontal: DC.pagePadding, paddingTop: 28, paddingBottom: 8, backgroundColor: '#ffffff' },
  titleRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  goBack:      { ...DC.typography.goBack, marginBottom: 12 },
  title:       { ...DC.typography.pageTitle },
  subtitle:    { ...DC.typography.sectionBody, color: DC.pageTextMuted, marginTop: 2 },

  // Step indicator
  stepRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 0, paddingBottom: 12 },
  stepDivider: { height: 1, backgroundColor: DC.cardDividerColor, marginHorizontal: -DC.pagePadding, marginTop: 4 },
  stepCircle:  { width: 28, height: 28, borderRadius: 14, backgroundColor: DC.cardBg, borderWidth: 1, borderColor: DC.controlBorder, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: DC.headerBlueBg, borderColor: DC.headerBlueBg },
  stepCircleDone:   { backgroundColor: DC.cardBg, borderColor: DC.controlBorder },
  stepNum:     { fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted },
  stepNumActive: { fontFamily: 'Poppins-Bold', fontSize: 11, color: '#ffffff' },
  stepNumDone:   { fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted },
  stepLabel:   { fontFamily: 'Poppins-Regular', fontSize: 9, color: DC.pageTextMuted, textAlign: 'center' as const },
  stepLabelActive: { fontFamily: 'Poppins-SemiBold', fontSize: 9, color: DC.pageText },
  stepDash:    { width: 32, height: 1, backgroundColor: DC.controlBorder, marginTop: 14, marginHorizontal: 4 },
  stepDashDone: { backgroundColor: DC.headerBlueBg },

  // Next button
  nextBtn:     { ...DC.button.active, paddingHorizontal: 20 },
  nextBtnText: { ...DC.button.textActive },

  // Scroll
  scroll:      { paddingTop: 8, paddingBottom: 80 },

  // Section rows
  sectionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingTop: 20, paddingBottom: 8 },
  sectionHeader: { ...DC.typography.sectionHeader },

  // Add circle button — small for section headers
  addCircleBtn:     { ...DC.circleBtn.ghostSm },
  addCircleBtnText: { fontFamily: 'Poppins-Bold', fontSize: 14, color: DC.viewBtnText, lineHeight: 18 },

  // Dotted card
  dottedCard:  { borderWidth: 1.5, borderColor: '#aaaaaa', borderStyle: 'dashed' as const, borderRadius: 10, marginBottom: 8, marginHorizontal: DC.pagePadding, paddingHorizontal: 14 },
  divider:     { height: 1, backgroundColor: DC.cardDividerColor, marginHorizontal: -14 },
  emptyRow:    { paddingVertical: 16, alignItems: 'center' as const },
  emptyText:   { ...DC.typography.muted },

  // People avatars
  personAvatar:     { width: 52, height: 52, borderRadius: 26, backgroundColor: DC.pageActionBg, alignItems: 'center', justifyContent: 'center' },
  personAvatarText: { fontFamily: 'Poppins-Bold', fontSize: 18, color: DC.accentDark },
  personName:       { ...DC.typography.subContent, textAlign: 'center' as const, maxWidth: 60 },

  // Recording rows
  recRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  recNumWrap:  { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  recNum:      { fontFamily: 'Poppins-Bold', fontSize: 16, color: DC.pageText },
  recName:     { ...DC.typography.sectionBody, flex: 1 },
  recAmount:   { ...DC.typography.amount },

  // Sub-item rows (items under a recording)
  itemFlatRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 16 },
  itemParentRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  itemParentNum:  { fontFamily: 'Poppins-Bold', fontSize: 16, color: DC.pageText, minWidth: 16 },
  subItemRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 16, marginLeft: 6 },
  subItemBar:  { position: 'absolute' as const, left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, backgroundColor: DC.accentDark },
  subItemName: { ...DC.typography.sectionBody, flex: 1 },
  subItemPeople: { ...DC.typography.subContent },
  subItemAmount: { ...DC.typography.amount },

  // Payment rows
  payPersonRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  payAvatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: DC.viewBtnBg, alignItems: 'center', justifyContent: 'center' },
  payAvatarText:  { fontFamily: 'Poppins-Bold', fontSize: 14, color: DC.viewBtnText },
  payPersonName:  { ...DC.typography.sectionBody, flex: 1 },
  payPersonAmount: { fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText },
  addPayBtn:      { width: 28, height: 28, borderRadius: 14, backgroundColor: DC.headerBlueBg, alignItems: 'center', justifyContent: 'center' },
  addPayBtnText:  { fontFamily: 'Poppins-Bold', fontSize: 16, color: '#ffffff', lineHeight: 20 },
  paySubRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingLeft: 48 },
  paySubLabel:    { ...DC.typography.subContent },
  paySubAmount:   { fontFamily: 'Poppins-Bold', fontSize: 11, color: DC.pageText },

  // Ellipsis button
  ellipsisBtn:  { ...DC.circleBtn.base },

  // Action sheet rows
  actionSheetRow: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: DC.controlBorder },
  actionSheetText: { ...DC.typography.sectionBody },

  // Wallet row inside dottedCard
  walletRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  walletBank:   { fontFamily: 'Poppins-Bold', fontSize: 14, color: DC.pageText },
  walletHolder: { fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted, marginTop: 2 },
  walletNumber: { fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText, marginTop: 2 },
  walletQr:     { width: 80, height: 80, borderRadius: 8 },

  // Share icons
  shareIconWrap: { width: 56, height: 56, borderRadius: 12, backgroundColor: DC.cardBg, borderWidth: 1, borderColor: DC.controlBorder, alignItems: 'center', justifyContent: 'center' },
  shareIconText: { fontSize: 24 },
  shareLabel:    { ...DC.typography.sectionBody },

  // Generate link button
  generateLinkBtn: { marginHorizontal: DC.pagePadding, marginTop: 16, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder, alignItems: 'center' as const },
  generateLinkText: { ...DC.typography.sectionBody, color: DC.pageTextMuted },

  // Action buttons (step 3)
  actionBtn:     { paddingVertical: 14, borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder, alignItems: 'center' as const },
  actionBtnText: { ...DC.typography.sectionBody },

  // Existing modal styles (kept for bottom sheets)
  doneBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: DC.btnBg, borderRadius: 999, paddingVertical: 14, marginTop: 8 },
  doneBtnText:   { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: DC.btnText },
  modeBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder, backgroundColor: DC.cardBg },
  modeBtnActive: { borderColor: DC.accentDark, backgroundColor: DC.pageActionBg },
  modeBtnText:   { fontFamily: 'Poppins-Regular', fontSize: 12, color: DC.pageText },
  modeBtnTextActive: { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: DC.accentDark },
  itemFormInput: { fontFamily: 'Poppins-Regular', fontSize: 15, color: DC.pageText, borderWidth: 1, borderColor: DC.controlBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  recPickRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: DC.controlBorder },
  recIconWrap:   { width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  recMid:        { flex: 1, gap: 2 },
  recDate:       { fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageTextMuted },
  recStatus:     { fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageTextMuted },
  recRight:      { alignItems: 'flex-end', gap: 2 },
  itemCard:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: DC.controlBorder },
  itemNum:       { fontFamily: 'Poppins-Bold', fontSize: 10, color: DC.accentDark, backgroundColor: DC.pageActionBg, width: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20 },
  itemName:      { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: DC.pageText },
  itemCost:      { fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText },
  itemSplit:     { fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageTextMuted },
  itemEditBtn:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder },
  itemEditBtnText: { fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageText },
  itemsTotalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14 },
  itemsTotalLabel: { fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted },
  itemsTotalDots: { flex: 1, height: 1, borderBottomWidth: 1, borderBottomColor: DC.controlBorder, borderStyle: 'dashed', marginHorizontal: 8 },
  itemsTotalValue: { fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText },
  tagInputWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderWidth: 1, borderColor: DC.controlBorder, borderRadius: 10, padding: 8, minHeight: 44, marginBottom: 12 },
  tagChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: DC.pageActionBg, borderRadius: 999, paddingVertical: 4, paddingLeft: 10, paddingRight: 6 },
  tagChipText:   { fontFamily: 'Poppins-SemiBold', fontSize: 11, color: DC.pageText },
  tagInput:      { fontFamily: 'Poppins-Regular', fontSize: 15, color: DC.pageText, minWidth: 120, flex: 1, padding: 2 },
  contactsLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 10, color: DC.pageTextMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  contactRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: DC.controlBorder },
  contactName:   { fontFamily: 'Poppins-Regular', fontSize: 13, color: DC.pageText },
  personChip:    { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: DC.pageActionBg },
  personChipText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: DC.pageText },
  chipWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: DC.pagePadding, paddingBottom: 12 },
  manualRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: DC.controlBorder },
  manualLeft:    { flex: 1, gap: 2 },
  manualName:    { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: DC.pageText },
  manualHint:    { fontFamily: 'Poppins-Regular', fontSize: 10, color: DC.pageTextMuted },
  manualInput:   { width: 90, textAlign: 'right' as const },
  manualTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, marginTop: 4 },
  manualTotalLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: DC.pageText },
  manualTotalValue: { fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText },
  sectionAddBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder },
  emptyWrap:     { alignItems: 'center', paddingVertical: 16 },
  list:          { marginHorizontal: DC.pagePadding, borderWidth: 1, borderColor: DC.controlBorder, borderRadius: 12, overflow: 'hidden' },
  actionBtnDanger:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.expense },
  actionBtnDangerText: { fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.expense },
});




const rm = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: DC.pagePadding, borderBottomWidth: 1, borderBottomColor: DC.controlBorder },
  name:   { ...DC.typography.sectionBody, fontFamily: 'Poppins-SemiBold' as string },
  sub:    { ...DC.typography.subContent },
  amount: { ...DC.typography.amount, flexShrink: 0 },
});
