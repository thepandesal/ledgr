import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Animated, Dimensions, ActivityIndicator, TextInput, Platform, Image, Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../src/lib/supabase';
import { useUser } from '../../src/hooks/useUser';
import { compressImage, uploadReceiptPhoto } from '../../src/lib/receiptUpload';
import { Colors, Fonts, Radius } from '@/components/ui/theme';
import BottomSheet from '@/components/ui/BottomSheet';
import { useScreenAnim } from '@/components/ui/ScreenWrapper';
import PageHeader from '@/components/ui/PageHeader';
import itemStyles from '@/components/ui/itemStyles';
import { Brand } from '../../src/lib/brand';
import { DC } from '../../src/lib/design';
import { AppFont } from '../../src/lib/fonts';
import { ocrReceiptImage, parseReceiptText, type ParsedItem } from '../../src/lib/receiptParser';
import { CalSansBase64, ChillaxMediumBase64, ChillaxBoldBase64 } from '../../src/lib/fontBase64';
import PaymentModal, { type PaymentItem } from './payment-modal';

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
    router.back();
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
  const { userId, defaultCurrency } = useUser();

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
  const [addPersonModal, setAddPersonModal] = useState(false);
  const [tagInputVal, setTagInputVal] = useState('');
  const suppressSubmitRef = useRef(false);
  const [contacts, setContacts] = useState<string[]>([]);
  const [contactsVisible, setContactsVisible] = useState(5);
  const [peopleVisible, setPeopleVisible] = useState(10);
  const [pendingInvitePerson, setPendingInvitePerson] = useState<{ name: string; friendId: string } | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);

  const sendInvite = async (personName: string, friendId: string, amount: number) => {
    setSendingInvite(true);
    await supabase.from('split_bill_invites').insert({
      split_bill_id: splitBillId,
      inviter_user_id: userId,
      invitee_user_id: friendId,
      person_name: personName,
      amount,
      status: 'pending',
    });
    await supabase.from('notifications').insert({
      user_id: friendId,
      type: 'split_bill_invite',
      title: `${userName} has tagged you on a split bill`,
      body: `${String(name)} — your share is ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}. tap to see`,
      message: `${String(name)} — your share is ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}. tap to see`,
      data: { splitBillId, splitBillName: String(name) },
      is_read: false,
      status: 'new',
    });
    queryClient.invalidateQueries({ queryKey: ['split-bill-invites', splitBillId] });
    setSendingInvite(false);
    setPendingInvitePerson(null);
  };

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

  const { data: people = [], refetch: refetchPeople } = useQuery({
    queryKey: ['split-bill-people', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('bill_splits')
        .select('id, person_name')
        .eq('split_bill_id', splitBillId)
        .order('created_at');
      return data ?? [];
    },
    enabled: !!splitBillId,
  });

  const filledPeople = people.map((p: any) => p.person_name);

  // ── My invite (as invitee) ──────────────────────────────────────────────────
  const { data: myInvite, refetch: refetchMyInvite } = useQuery<any>({
    queryKey: ['my-split-bill-invite', splitBillId, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_bill_invites')
        .select('id, person_name, amount, status')
        .eq('split_bill_id', splitBillId)
        .eq('invitee_user_id', userId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!splitBillId && !!userId,
  });

  const [acceptModal, setAcceptModal] = useState(false);
  const [acceptSpaces, setAcceptSpaces] = useState<any[]>([]);
  const [acceptCategories, setAcceptCategories] = useState<any[]>([]);
  const [acceptSpaceId, setAcceptSpaceId] = useState('');
  const [acceptCategoryId, setAcceptCategoryId] = useState('');
  const [acceptSaving, setAcceptSaving] = useState(false);

  const openAcceptModal = async () => {
    const [{ data: spaces }, { data: cats }] = await Promise.all([
      supabase.from('spaces').select('id, name').eq('user_id', userId).eq('is_active', true).order('name'),
      supabase.from('categories').select('id, name').eq('user_id', userId).order('name'),
    ]);
    setAcceptSpaces(spaces ?? []);
    setAcceptCategories(cats ?? []);
    setAcceptSpaceId(spaces?.[0]?.id ?? '');
    setAcceptCategoryId('');
    setAcceptModal(true);
  };

  const confirmAccept = async () => {
    if (!myInvite || !acceptSpaceId) return;
    setAcceptSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const { data: rec } = await supabase.from('recordings').insert({
      user_id: userId,
      space_id: acceptSpaceId,
      name: String(name),
      type: 'debt',
      amount: myInvite.amount,
      transaction_date: today,
      status: 'unpaid',
      category_id: acceptCategoryId || null,
    }).select('id').single();
    await supabase.from('split_bill_invites').update({
      status: 'accepted',
      accepted_space_id: acceptSpaceId,
      accepted_category_id: acceptCategoryId || null,
      created_recording_id: rec?.id ?? null,
    }).eq('id', myInvite.id);
    queryClient.invalidateQueries({ queryKey: ['split-bill-invites', splitBillId] });
    queryClient.invalidateQueries({ queryKey: ['my-split-bill-invite', splitBillId, userId] });
    setAcceptSaving(false);
    setAcceptModal(false);
  };

  const confirmDecline = async () => {
    if (!myInvite) return;
    await supabase.from('split_bill_invites').update({ status: 'declined' }).eq('id', myInvite.id);
    queryClient.invalidateQueries({ queryKey: ['split-bill-invites', splitBillId] });
    refetchMyInvite();
  };
  const { data: invites = [] } = useQuery<{ person_name: string; status: string }[]>({
    queryKey: ['split-bill-invites', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_bill_invites')
        .select('person_name, status')
        .eq('split_bill_id', splitBillId);
      return data ?? [];
    },
    enabled: !!splitBillId,
  });

  const getInviteStatus = (personName: string) =>
    invites.find(i => i.person_name.toLowerCase() === personName.toLowerCase())?.status ?? null;

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

  // find a friend whose name matches the typed name
  const findMatchingFriend = (name: string) =>
    friends.find(f => f.name.toLowerCase() === name.trim().toLowerCase()) ?? null;

  useEffect(() => {
    if (!userId) return;
    supabase.from('contacts').select('name').eq('user_id', userId).order('name')
      .then(({ data }) => { if (data) setContacts(data.map((c: any) => c.name)); });
  }, [userId]);

  const savePerson = async (name: string) => {
    if (!name.trim() || filledPeople.some(p => p.toLowerCase() === name.trim().toLowerCase())) return;
    await supabase.from('bill_splits').insert({ split_bill_id: splitBillId, user_id: userId, person_name: name.trim() });
    // save to contacts too
    const exists = contacts.includes(name.trim());
    if (!exists) {
      await supabase.from('contacts').insert({ user_id: userId, name: name.trim() });
      setContacts(prev => [...prev, name.trim()].sort());
    }
    refetchPeople();
  };

  const removePerson = async (id: string) => {
    await supabase.from('bill_splits').delete().eq('id', id);
    refetchPeople();
  };

  const handleAddPersonSubmit = async () => {
    if (suppressSubmitRef.current) { suppressSubmitRef.current = false; return; }
    const personName = tagInputVal.trim();
    if (!personName) return;
    await savePerson(personName);
    setTagInputVal('');
    // check if this name matches a friend — if so, prompt invite
    const match = findMatchingFriend(personName);
    const alreadyInvited = invites.some(i => i.person_name.toLowerCase() === personName.toLowerCase());
    if (match && !alreadyInvited) {
      setPendingInvitePerson({ name: personName, friendId: match.id });
    }
  };

  // ── Add recording state ──────────────────────────────────────────────────
  const [addRecModal, setAddRecModal] = useState(false);
  const [allRecordings, setAllRecordings] = useState<any[]>([]);
  const [recTab, setRecTab] = useState<'debt' | 'due' | 'expense' | 'income'>('expense');
  const [recSearch, setRecSearch] = useState('');
  const [recDays, setRecDays] = useState<30 | 60 | 180 | 365 | null>(30);
  const [recShowMore, setRecShowMore] = useState(false);

  const REC_TABS: { key: 'debt' | 'due' | 'expense' | 'income'; label: string }[] = [
    { key: 'expense', label: 'expense' },
    { key: 'due',     label: 'due' },
    { key: 'debt',    label: 'debt' },
    { key: 'income',  label: 'income' },
  ];

  const REC_RANGES: { value: 30 | 60 | 180 | 365 | null; label: string }[] = [
    { value: 30, label: 'this month' },
    { value: 60, label: '60 days' },
    { value: 180, label: '180 days' },
    { value: 365, label: '1 year' },
    { value: null, label: 'all time' },
  ];

  const openAddRecording = async () => {
    const linkedIds = linkedRecordings.map((lr: any) => lr.recording?.id);
    const { data } = await supabase
      .from('recordings')
      .select('id, name, amount, type, transaction_date, status, is_due')
      .eq('user_id', userId)
      .in('type', ['expense', 'due', 'debt', 'income'])
      .order('transaction_date', { ascending: false })
      .limit(200);
    setAllRecordings((data ?? []).filter((r: any) => !linkedIds.includes(r.id) && r.type !== 'debt' && r.type !== 'due' && !r.is_due));
    setRecTab('expense');
    setRecSearch('');
    setRecDays(30);
    setRecShowMore(false);
    setAddRecModal(true);
  };

  const linkRecording = async (rec: any) => {
    await supabase.from('split_bill_recordings').insert({
      split_bill_id: splitBillId,
      recording_id: rec.id,
      amount_contributed: rec.amount,
    });
    setAddRecModal(false);
    queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
  };
  // Step 1: pick recording → Step 2: add item rows → tap saved item to assign people
  const [addItemModal, setAddItemModal]           = useState(false);
  const [itemStep, setItemStep]                   = useState<'pick-type' | 'pick-recording' | 'add-items' | 'manual' | 'parse-choice' | 'parsing' | 'parse-review'>('pick-type');
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  const [itemRows, setItemRows]                   = useState<{ name: string; cost: string }[]>([{ name: '', cost: '' }]);
  const [savingItem, setSavingItem]               = useState(false);
  const [manualItemType, setManualItemType]        = useState<'receivable' | 'payable'>('receivable');

  // ── Receipt parser state ──────────────────────────────────────────────────
  const [parseReceiptPhotos, setParseReceiptPhotos] = useState<{ id: string; url: string }[]>([]);
  const [parsedItems, setParsedItems]               = useState<{ name: string; cost: string }[]>([]);
  const [parsedTotal, setParsedTotal]               = useState<number | null>(null);
  const [parsePhotoIndex, setParsePhotoIndex]       = useState(0);
  const [parseEnlargeModal, setParseEnlargeModal]   = useState(false);
  const [parseLoading, setParseLoading]             = useState(false);
  const [parseError, setParseError]                 = useState('');
  const [parseOverBudgetModal, setParseOverBudgetModal] = useState(false);
  const [editingParsedItem, setEditingParsedItem]   = useState<{ idx: number; field: 'name' | 'cost'; value: string } | null>(null);
  const [editingExistingItem, setEditingExistingItem] = useState<{ item: any; field: 'name' | 'cost'; value: string } | null>(null);

  // assign-people sheet (tap an existing item)
  const [assignItem, setAssignItem]   = useState<any>(null);
  const [assignPeople, setAssignPeople] = useState<string[]>([]);

  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ['split-bill-items', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_items')
        .select('*')
        .eq('split_bill_id', splitBillId)
        .order('created_at');
      return data ?? [];
    },
    enabled: !!splitBillId,
  });

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
    setAssignItem(item);
    setAssignPeople(item.people ?? []);
  };

  const saveAssign = async () => {
    await supabase.from('split_items').update({ people: assignPeople.length ? assignPeople : null }).eq('id', assignItem.id);
    setAssignItem(null);
    refetchItems();
  };

  const deleteItem = async (id: string) => {
    await supabase.from('split_items').delete().eq('id', id);
    refetchItems();
  };

  const saveExistingItem = async () => {
    if (!editingExistingItem) return;
    const { item, field, value } = editingExistingItem;
    await supabase.from('split_items').update({ [field]: field === 'cost' ? parseFloat(value) || 0 : value.trim() }).eq('id', item.id);
    setEditingExistingItem(null);
    refetchItems();
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
  const [shareSelectedIds, setShareSelectedIds] = useState<string[]>([]);
  const [shareOriginalIds, setShareOriginalIds] = useState<string[]>([]);
  const [shareLink, setShareLink]               = useState('');
  const [shareCopied, setShareCopied]           = useState(false);
  const [shareSaving, setShareSaving]           = useState(false);
  const [shareGenerating, setShareGenerating]   = useState(false);
  const [saveImgLoading, setSaveImgLoading]     = useState(false);

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
      .replace(/^-|-$/g, '');

    // Find existing slugs for this user to determine counter
    const { data: existing } = await supabase
      .from('split_shares')
      .select('slug')
      .eq('user_id', userId)
      .like('slug', `${baseSlug}%`);

    const usedSlugs = (existing ?? []).map((r: any) => r.slug);
    let slug = baseSlug;
    let counter = 2;
    while (usedSlugs.includes(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const { data } = await supabase.from('split_shares')
      .insert({ split_bill_id: splitBillId, recording_id: firstRecordingId, data: { account_ids: shareSelectedIds }, user_id: userId, slug })
      .select('id').single();
    setShareGenerating(false);
    if (!data) return;
    setShareLink(`https://ledgr.art/split/${userId}/${slug}`);
    await refetchShareRow();
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    if (Platform.OS !== 'web') {
      await Clipboard.setStringAsync(shareLink);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareLink)
        .then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); })
        .catch(fallbackCopy);
    } else { fallbackCopy(); }
  };

  const fallbackCopy = () => {
    if (typeof document === 'undefined') return;
    const el = document.createElement('textarea');
    el.value = shareLink;
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0;font-size:16px';
    document.body.appendChild(el); el.focus(); el.select();
    try { document.execCommand('copy'); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); } catch (_) {}
    document.body.removeChild(el);
  };

  const saveAsImage = async () => {
    if (!shareLink) return;
    setSaveImgLoading(true);
    try {
      // Build per-person totals (same logic as share page)
      const totals: Record<string, number> = {};
      filledPeople.forEach((p: string) => { totals[p] = 0; });
      items.forEach((item: any) => {
        const d = isDeductType(item.recording_type);
        const pp = (item.people ?? []).length > 0 ? Number(item.cost) / item.people.length : 0;
        (item.people ?? []).forEach((p: string) => { if (totals[p] !== undefined) totals[p] += d ? -pp : pp; });
      });
      const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
      const fmt2 = (n: number) => Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 });

      // Per-person rows — matching share page style
      const personRowsHtml = filledPeople.map((p: string) => {
        const total = totals[p] ?? 0;
        const color = total < 0 ? '#d97060' : '#2A7A6F';
        return `<div style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid #eef0f0">`+
          `<div style="width:30px;height:30px;border-radius:50%;background:#e8f5f4;display:flex;align-items:center;justify-content:center;flex-shrink:0">`+
          `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2A7A6F" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>`+
          `<span style="font-family:'Chillax',sans-serif;font-weight:500;font-size:13px;color:#2e3d3d;flex:1">${p}</span>`+
          `<span style="font-family:'Chillax',sans-serif;font-weight:700;font-size:14px;color:${color}">${total < 0 ? '-' : ''}${fmt2(total)}</span>`+
          `</div>`;
      }).join('');
      const totalRowHtml = `<div style="display:flex;align-items:center;gap:12px;padding:13px 16px;background:#e8f5f4">`+
        `<div style="width:30px;height:30px;border-radius:50%;background:#b6e1de;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'Chillax',sans-serif;font-weight:700;font-size:12px;color:#2A7A6F">Σ</div>`+
        `<span style="font-family:'Chillax',sans-serif;font-weight:700;font-size:13px;font-weight:600;color:#2A7A6F;flex:1">total</span>`+
        `<span style="font-family:'Chillax',sans-serif;font-weight:700;font-size:14px;color:#2A7A6F">${grandTotal < 0 ? '-' : ''}${fmt2(grandTotal)}</span>`+
        `</div>`;

      // Item rows — matching share page style
            // Group items by recording
      const recGroups: { recId: string | null; recName: string; items: any[] }[] = [];
      items.forEach((item: any) => {
        const key = item.recording_id ?? null;
        const existing = recGroups.find(g => g.recId === key);
        if (existing) { existing.items.push(item); }
        else {
          const lr = linkedRecordings.find((l: any) => l.recording?.id === key);
          recGroups.push({ recId: key, recName: lr?.recording?.name ?? (key ? '' : 'manual'), items: [item] });
        }
      });
      const itemRowsHtml = recGroups.map((group) => {
        const groupHeader = recGroups.length > 1
          ? `<div style="padding:8px 16px;background:#f0f8f7;font-family:'Chillax',sans-serif;font-weight:700;font-size:10px;color:#2A7A6F;text-transform:uppercase;letter-spacing:0.8px">${group.recName}</div>`
          : '';
        const rows = group.items.map((item: any, ii: number) => {
          const d = isDeductType(item.recording_type);
          const color = d ? '#d97060' : '#2A7A6F';
          const people: string[] = item.people ?? [];
          const perPerson = people.length > 0 ? Number(item.cost) / people.length : 0;
          const peopleSection = people.length > 0
            ? `<div style="font-family:'Chillax',sans-serif;font-weight:500;font-size:11px;color:${color};margin-bottom:4px">${d ? '-' : ''}${perPerson.toLocaleString('en-US', { minimumFractionDigits: 2 })} each</div>`+
              `<div style="display:flex;flex-wrap:wrap;gap:4px">`+
              people.map((p: string) => `<span style="background:#e8f5f4;border-radius:99px;padding:2px 9px;font-family:'Chillax',sans-serif;font-weight:500;font-size:10px;color:#2A7A6F">${p}</span>`).join('') +
              `</div>`
            : '';
          return `<div style="border-bottom:1px solid #eef0f0;padding:13px 16px;display:flex;align-items:flex-start;gap:12px">`+
            `<div style="width:28px;height:28px;border-radius:50%;background:#e8f5f4;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'Chillax',sans-serif;font-weight:700;font-size:12px;color:#2A7A6F;margin-top:1px">${ii + 1}</div>`+
            `<div style="flex:1">`+
            `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">`+
            `<span style="font-family:'Chillax',sans-serif;font-weight:500;font-size:13px;color:#2e3d3d;flex:1;line-height:1.4">${item.name}</span>`+
            `<span style="font-family:'Chillax',sans-serif;font-weight:700;font-size:14px;color:${color};white-space:nowrap">${d ? '-' : ''}${Number(item.cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>`+
            `</div>`+
            (people.length > 0 ? `<div style="margin-top:6px">${peopleSection}</div>` : '') +
            `</div></div>`;
        }).join('');
        return groupHeader + rows;
      }).join('');

      // Payment info — matching share page style
      const selectedAccounts = shareAccounts.filter((a: any) => shareSelectedIds.includes(a.id));
      const accountsWithBase64 = await Promise.all(selectedAccounts.map(async (a: any) => {
        if (!a.qr_code) return { ...a, qr_base64: null };
        try {
          const res = await fetch(a.qr_code);
          const blob = await res.blob();
          const base64 = await new Promise<string>(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          return { ...a, qr_base64: base64 };
        } catch { return { ...a, qr_base64: null }; }
      }));
      const payRowsHtml = accountsWithBase64.map((a: any) => {
        const qrSrc = a.qr_base64 || a.qr_code;
        const qrImg = qrSrc ? `<img src="${qrSrc}" width="72" height="72" style="border-radius:10px;object-fit:contain;flex-shrink:0"/>` : '';
        return `<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid #eef0f0">`+
          `<div style="width:30px;height:30px;border-radius:50%;background:#b6e1de;display:flex;align-items:center;justify-content:center;flex-shrink:0">`+
          `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2A7A6F" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></div>`+
          `<div style="flex:1;display:flex;flex-direction:column;gap:3px">`+
          `<div style="font-family:'Chillax',sans-serif;font-weight:700;font-size:14px;color:#2e3d3d">${a.bank ?? ''}</div>`+
          `<div style="font-family:'Chillax',sans-serif;font-weight:500;font-size:10px;color:#929090">${a.holder_name ?? a.account_name ?? ''}</div>`+
          `<div style="font-family:'Chillax',sans-serif;font-weight:700;font-size:13px;color:#2e3d3d;letter-spacing:0.3px">${a.account_number ?? ''}</div>`+
          `</div>${qrImg}</div>`;
      }).join('');

      const sectionLabel = (text: string) =>
        `<div style="font-family:'Chillax',sans-serif;font-weight:500;font-size:11px;color:#929090;letter-spacing:0.6px;text-transform:uppercase;margin:24px 0 10px">${text}</div>`;
      const block = (inner: string) =>
        `<div style="border:1px solid #eef0f0;border-radius:14px;overflow:hidden">${inner}</div>`;

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">`+
        `<style>`+
        `@font-face{font-family:'CalSans';src:url('${CalSansBase64}') format('truetype')}`+
        `@font-face{font-family:'Chillax';font-weight:500;src:url('${ChillaxMediumBase64}') format('opentype')}`+
        `@font-face{font-family:'Chillax';font-weight:700;src:url('${ChillaxBoldBase64}') format('opentype')}`+
        `*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Chillax',sans-serif;font-weight:500;background:#fff;padding:36px 32px;width:480px;margin:0 auto;-webkit-font-smoothing:antialiased}</style>`+
        `</head><body>`+
        `<div style="font-family:'CalSans',serif;font-size:28px;font-weight:400;color:#1a2e2e;letter-spacing:-0.5px;margin-bottom:6px">${String(name).toLowerCase()}</div>`+
        `<div style="font-family:'Chillax',sans-serif;font-weight:500;font-size:11px;color:#929090;margin-bottom:28px;letter-spacing:0.2px">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>`+
        sectionLabel('per person pay') + block(personRowsHtml + totalRowHtml) +
        (items.length > 0 ? sectionLabel('item breakdown') + block(itemRowsHtml) : '') +
        (payRowsHtml ? sectionLabel('payment information') + block(payRowsHtml) : '') +
        `<div style="font-family:'Chillax',sans-serif;font-weight:500;font-size:10px;color:#c8d0d0;text-align:center;margin-top:32px">generated by LEDGR</div>`+
        `</body></html>`;

      if (Platform.OS !== 'web') {
        const Print = require('expo-print');
        const Sharing = require('expo-sharing');
        const { uri } = await Print.printToFileAsync({ html, width: 520 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save split bill' });
        }
      } else if (typeof document !== 'undefined') {
        const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const Print = require('expo-print');
        if (isMobile) {
          await Print.printAsync({ html });
        } else {
          const { uri } = await Print.printToFileAsync({ html, width: 520 });
          const res = await fetch(uri);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `${String(name).replace(/\s+/g, '-')}-split.pdf`;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        }
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
    if (unpaid.length > 0) {
      setUnpaidPeopleNames(unpaid);
      setCloseNoRecordings(noRecs);
      setCloseCreateRecording(false);
      setCloseSpaceId(null);
      if (noRecs) {
        const { data: sp } = await supabase.from('spaces').select('id, name').eq('user_id', userId).eq('is_active', true).order('name');
        setCloseSpaces(sp ?? []);
      }
      setCloseConfirmModal(true);
    } else if (noRecs) {
      // No unpaid people and no recordings — just close
      await supabase.from('split_bills').update({ status: 'closed' }).eq('id', splitBillId);
      setBillStatus('closed');
      queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    } else {
      await supabase.from('split_bills').update({ status: 'closed' }).eq('id', splitBillId);
      setBillStatus('closed');
      queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    }
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
  const computeTotals = () => {
    const totals: Record<string, number> = {};
    filledPeople.forEach(p => { totals[p] = 0; });
    items.forEach((item: any) => {
      const deduct = isDeductType(item.recording_type);
      const pp = (item.people ?? []).length > 0 ? Number(item.cost) / item.people.length : 0;
      (item.people ?? []).forEach((p: string) => {
        if (totals[p] !== undefined) totals[p] += deduct ? -pp : pp;
      });
    });
    return totals;
  };

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
    <Animated.View style={[{ flex: 1, backgroundColor: Colors.white }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <PageHeader
          title={String(name)}
          onBack={handleBack}
          right={
            billStatus === 'ongoing' ? (
              <TouchableOpacity onPress={openEditName} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="create-outline" size={18} color={DC.pageTextMuted} />
              </TouchableOpacity>
            ) : undefined
          }
        />

        {/* Actions row */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: PAGE, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
          <TouchableOpacity style={s.actionBtn} onPress={openShareModal}>
            <Text style={s.actionBtnText}>share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={handleToggleStatus}>
            <Text style={s.actionBtnText}>{billStatus === 'closed' ? 'reopen' : 'close'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtnDanger} onPress={() => setDeleteSplitModal(true)}>
            <Text style={s.actionBtnDangerText}>delete</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={{ height: 8 }} />

          {/* Invite banner — shown to invitee only */}
          {myInvite && myInvite.status === 'pending' && (
            <View style={{ backgroundColor: ACCENT + '33', borderRadius: Radius.lg, padding: 16, marginBottom: 12, gap: 8 }}>
              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: ACCENT_DARK }}>
                you've been added to this split bill
              </Text>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.text }}>
                your share: {fmt(Number(myInvite.amount))}
              </Text>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted }}>
                accept to create a debt recording on your end.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderMid }}
                  onPress={confirmDecline}
                >
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 12, color: Colors.muted }}>decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 2, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: ACCENT_DARK, alignItems: 'center' }}
                  onPress={openAcceptModal}
                >
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 12, color: Colors.white }}>accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {myInvite && myInvite.status === 'accepted' && (
            <View style={{ backgroundColor: ACCENT + '22', borderRadius: Radius.lg, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={16} color={ACCENT_DARK} />
              <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: ACCENT_DARK }}>you accepted this split bill — debt recorded</Text>
            </View>
          )}
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>recordings</Text>
            {billStatus === 'ongoing' && (
              <TouchableOpacity onPress={openAddRecording} style={s.sectionAddBtn}>
                <Text style={{ fontFamily: AppFont.bold, fontSize: 13, color: '#111111' }}>add</Text>
              </TouchableOpacity>
            )}
          </View>
          {loadingRecs ? (
            <ActivityIndicator color={ACCENT_DARK} />
          ) : linkedRecordings.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>no recordings linked yet</Text>
            </View>
          ) : (
            <View style={s.list}>
              {linkedRecordings.map((lr: any, recIdx: number) => {
                  const rec = lr.recording;
                  const isDone =
                    (rec?.type === 'expense' && rec?.status === 'paid') ||
                    (rec?.type === 'due'     && rec?.status === 'paid') ||
                    (rec?.type === 'debt'    && rec?.status === 'paid');
                  const isPartial =
                    (rec?.type === 'expense' && rec?.status === 'partial') ||
                    (rec?.type === 'due'     && rec?.status === 'partial') ||
                    (rec?.type === 'debt'    && rec?.status === 'partial');
                  const actionable = rec?.type === 'expense' || rec?.type === 'due' || rec?.type === 'debt';
                  return (
                <TouchableOpacity
                  key={lr.id}
                  style={s.recRow}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: lr.recording?.id } } as any)}
                >

                  <Text style={s.recNum}>{recIdx + 1}</Text>
                  <View style={s.recMid}>
                    <Text style={s.recName} numberOfLines={1}>{lr.recording?.name ?? '—'}</Text>
                    <Text style={s.recDate}>
                      {rec?.transaction_date
                        ? new Date(rec.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </Text>
                    
                  </View>
                  <View style={s.recRight}>
                    <Text style={s.recAmount}>{fmt(Number(lr.amount_contributed))}</Text>
                    {(() => {
                      const total = Number(rec?.amount ?? 0);
                      if (total <= 0) return null;
                      const ifor = items.filter((i: any) => i.recording_id === rec?.id);
                      let pa = 0;
                      if (ifor.length > 0) {
                        const op: Record<string, number> = {};
                        ifor.forEach((i: any) => { const pp = (i.people ?? []).length > 0 ? Number(i.cost) / i.people.length : 0; (i.people ?? []).forEach((p: string) => { op[p] = (op[p] ?? 0) + pp; }); });
                        const cp: Record<string, number> = {};
                        payments.filter((pay: any) => pay.status !== 'cancelled').forEach((pay: any) => { const ow = op[pay.person_name] ?? 0; if (ow > 0) { const al = cp[pay.person_name] ?? 0; const cr = Math.min(Number(pay.amount), ow - al); if (cr > 0) { cp[pay.person_name] = al + cr; pa += cr; } } });
                      } else { pa = Number(rec?.paid_amount ?? 0); }
                      const fc = pa >= total - 0.01;
                      if (fc) return <Text style={s.recStatus}>{rec?.type === 'due' ? 'fully collected' : 'fully paid'} {fmt(pa)}</Text>;
                      if (pa > 0) return <Text style={s.recStatus}>partial {fmt(pa)}</Text>;
                      return null;
                    })()}
                  </View>
                  {actionable && !isDone && billStatus === 'ongoing' && (
                    <TouchableOpacity
                      onPress={() => openMarkPaid(lr)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color={ACCENT_DARK} />
                    </TouchableOpacity>
                  )}
                  {billStatus === 'ongoing' && (
                    <TouchableOpacity
                      onPress={() => handleRemoveRecording(lr)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={14} color={Colors.faint} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                  );
                })}
            </View>
          )}

          {/* People */}
          <View style={s.divider} />
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>people</Text>
            {billStatus === 'ongoing' && (
              <TouchableOpacity onPress={() => { setTagInputVal(''); setContactsVisible(5); setAddPersonModal(true); }} style={s.sectionAddBtn}>
                <Text style={{ fontFamily: AppFont.bold, fontSize: 13, color: '#111111' }}>add</Text>
              </TouchableOpacity>
            )}
          </View>
          {filledPeople.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>no people yet — tap add</Text>
            </View>
          ) : (
            <View style={s.chipWrap}>
              {people.slice(0, peopleVisible).map((p: any) => {
                const inviteStatus = getInviteStatus(p.person_name);
                return (
                <View key={p.id} style={{ position: 'relative' }}>
                  <View style={s.personChip}>
                    <Text style={s.personChipText}>{p.person_name}</Text>
                    {inviteStatus === 'pending'  && <Ionicons name="time-outline"           size={11} color="#F59E0B" />}
                    {inviteStatus === 'accepted' && <Ionicons name="checkmark-circle"       size={11} color={ACCENT_DARK} />}
                    {inviteStatus === 'declined' && <Ionicons name="close-circle-outline"   size={11} color={Colors.muted} />}
                  </View>
                  {billStatus === 'ongoing' && (
                    <TouchableOpacity
                      onPress={() => removePerson(p.id)}
                      style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={9} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
                );
              })}
              {peopleVisible < people.length && (
                <TouchableOpacity
                  style={[s.personChip, { backgroundColor: Colors.surface }]}
                  onPress={() => setPeopleVisible(v => v + 10)}
                >
                  <Text style={[s.personChipText, { color: Colors.muted }]}>
                    +{people.length - peopleVisible} more
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Items */}
          <View style={s.divider} />
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>items</Text>
            {billStatus === 'ongoing' && (
              <TouchableOpacity
                onPress={openAddItem}
                style={[s.sectionAddBtn, filledPeople.length === 0 && { opacity: 0.4 }]}
                disabled={filledPeople.length === 0}
              >
                <Text style={{ fontFamily: AppFont.bold, fontSize: 13, color: '#111111' }}>add</Text>
              </TouchableOpacity>
            )}
          </View>
          {items.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>{filledPeople.length === 0 ? 'add people first' : 'no items yet'}</Text>
            </View>
          ) : (
            <View style={s.list}>
              {items.map((item: any, idx: number) => {
                const deduct = isDeductType(item.recording_type);
                const perPerson = item.people?.length > 0 ? Number(item.cost) / item.people.length : 0;
                return (
                  <View key={item.id} style={s.itemCard}>
                    <Text style={s.itemNum}>{idx + 1}</Text>
                    <TouchableOpacity style={{ flex: 1, gap: 2 }} onPress={() => openAssign(item)} activeOpacity={0.8}>
                      <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.itemCost}>{deduct ? '-' : ''}{fmt(Number(item.cost))}</Text>
                      {item.people?.length > 0 ? (
                        <>
                          <Text style={s.itemSplit}>
                            {deduct ? '-' : '+'}{perPerson.toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                          </Text>
                          <Text style={s.itemSplit} numberOfLines={1}>{item.people.join(', ')}</Text>
                        </>
                      ) : (
                        <Text style={[s.itemSplit, { color: Colors.faint }]}>tap to assign people</Text>
                      )}
                    </TouchableOpacity>
                    {billStatus === 'ongoing' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {item.recording_id && (
                          <TouchableOpacity
                            style={s.itemEditBtn}
                            onPress={async () => {
                              const lr = linkedRecordings.find((l: any) => l.recording?.id === item.recording_id);
                              if (!lr) return;
                              setItemRows([{ name: '', cost: '' }]);
                              setParsedItems([]);
                              setParsedTotal(null);
                              setParseReceiptPhotos([]);
                              setParseError('');
                              setSelectedRecording(lr);
                              setItemStep('add-items');
                              setAddItemModal(true);
                            }}
                          >
                            <Text style={s.itemEditBtnText}>edit</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close" size={14} color={Colors.faint} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={s.itemsTotalRow}>
                <Text style={s.itemsTotalLabel}>total allocated</Text>
                <View style={s.itemsTotalDots} />
                <Text style={s.itemsTotalValue}>{fmt(totalItemsCost)}</Text>
              </View>
            </View>
          )}

          {/* Receipt */}
          <View style={s.divider} />
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>receipt</Text>
            {billStatus === 'ongoing' && (
              <TouchableOpacity onPress={() => setAddReceiptModal(true)} style={s.sectionAddBtn}>
                <Text style={{ fontFamily: AppFont.bold, fontSize: 13, color: '#111111' }}>add</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Direct receipts uploaded to this split bill */}
          {linkedReceipt && receiptPhotos.length > 0 ? (
            <>
              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: ACCENT_DARK, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>uploaded here</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                {receiptPhotos.map((p, idx) => (
                  <TouchableOpacity key={p.id} onPress={() => { setPhotoModalPool('direct'); setPhotoModalIndex(idx); setPhotoModal(true); }} activeOpacity={0.85}>
                    <Image source={{ uri: p.url }} style={{ width: 90, height: 90, borderRadius: Radius.md, backgroundColor: Colors.surface }} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            receiptPhotos.length === 0 && recordingReceiptPhotos.length === 0 && (
              <View style={s.emptyWrap}>
                <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>no receipt photos yet</Text>
              </View>
            )
          )}
          {/* Receipts from linked recordings */}
          {recordingReceiptPhotos.length > 0 && (
            <>
              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: ACCENT_DARK, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: linkedReceipt && receiptPhotos.length > 0 ? 8 : 0, marginBottom: 6 }}>from recordings</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                {recordingReceiptPhotos.map((p, idx) => (
                  <View key={p.id}>
                    <TouchableOpacity onPress={() => { setPhotoModalPool('recording'); setPhotoModalIndex(idx); setPhotoModal(true); }} activeOpacity={0.85}>
                      <Image source={{ uri: p.url }} style={{ width: 90, height: 90, borderRadius: Radius.md, backgroundColor: Colors.surface }} resizeMode="cover" />
                    </TouchableOpacity>
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 9, color: Colors.muted, maxWidth: 90, marginTop: 3 }} numberOfLines={1}>{p.recordingName}</Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          {/* Charged expenses */}
          {chargedExpenses.length > 0 && (
            <>
              <View style={s.divider} />
              <View style={s.sectionRow}>
                <Text style={s.sectionHeader}>charged to spaces</Text>
              </View>
              <View style={s.list}>
                {chargedExpenses.map((exp: any) => (
                  <TouchableOpacity
                    key={exp.id}
                    style={s.recRow}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: exp.id } } as any)}
                  >
                    <View style={[s.recIconWrap, { backgroundColor: PEACH + '33' }]}>
                      <Ionicons name="card-outline" size={16} color={PEACH} />
                    </View>
                    <View style={s.recMid}>
                      <Text style={s.recName} numberOfLines={1}>{exp.name}</Text>
                      <Text style={s.recDate}>
                        {exp.space?.name ?? '—'}{exp.account?.account_name ? ` · ${exp.account.account_name}` : ''}
                      </Text>
                    </View>
                    <Text style={[s.recAmount, { color: PEACH }]}>{fmt(Number(exp.amount))}</Text>
                    <Ionicons name="chevron-forward" size={13} color={Colors.faint} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Payment history */}
          <View style={s.divider} />
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>payment history</Text>
          </View>
          {filledPeople.length === 0 || items.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>add people and items to see payment history</Text>
            </View>
          ) : (() => {
            const totals = computeTotals();
            return (
            <View style={s.list}>
                {filledPeople.map(p => {
                  const owed = totals[p] ?? 0;
                  const isNegative = owed < 0; // you owe them
                  const absOwed = Math.abs(owed);
                  const personPayments = payments.filter((pay: any) => pay.person_name === p);
                  const activePersonPayments = personPayments.filter((pay: any) => pay.status !== 'cancelled');
                  const paid = activePersonPayments.reduce((s: number, pay: any) => s + Number(pay.amount), 0);
                  const remaining = Math.max(0, absOwed - paid);
                  const fullyPaid = absOwed > 0 && paid >= absOwed - 0.01;
                  const pct = absOwed > 0 ? Math.min(paid / absOwed, 1) : 0;
                  const lastPayment = activePersonPayments.length > 0
                    ? activePersonPayments.reduce((latest: any, pay: any) =>
                        new Date(pay.created_at) > new Date(latest.created_at) ? pay : latest
                      )
                    : null;
                  // Build relationship summary for this person
                  const personRecRows = getPersonRecordingRows(p);
                  const personManualOwed = getPersonManualOwed(p);

                  return (
                    <View key={p} style={[s.itemCard, { flexDirection: 'column', alignItems: 'stretch', gap: 0, paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }]}>
                      {/* Person row â€” no number */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 }}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[s.itemName, { fontSize: 18 }]}>{p}</Text>
                          <Text style={s.itemSplit}>this bill: {fmt(absOwed)}</Text>
                          {personBalances[p] !== undefined && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted }}>
                                {personBalances[p] < 0 ? 'you owe' : 'owed'} all time:
                              </Text>
                              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: personBalances[p] < 0 ? Colors.expense : ACCENT_DARK }}>
                                {fmt(Math.abs(personBalances[p]))}
                              </Text>
                            </View>
                          )}
                        </View>
                        {!fullyPaid && absOwed > 0 && billStatus === 'ongoing' && (
                          <TouchableOpacity style={s.itemEditBtn} onPress={() => { setItemPayPerson(p); setItemPayModal(true); }}>
                            <Text style={s.itemEditBtnText}>mark paid</Text>
                          </TouchableOpacity>
                        )}
                        {fullyPaid && (
                          <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: '#F3FAD3' }}>
                            <Text style={{ fontFamily: AppFont.bold, fontSize: 13, color: '#111111' }}>settled</Text>
                          </View>
                        )}
                      </View>
                      {/* Payment rows with numbering */}
                      {personPayments.length > 0 && (
                        <>
                          <View style={{ height: 2, backgroundColor: Colors.border, marginHorizontal: 0 }} />
                          <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 }}>
                            {personPayments.slice().sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                              .slice(0, showMorePayments[p] ? undefined : 3)
                              .map((pay: any, payIdx: number) => (
                              <View key={pay.id} style={[
                                { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: payIdx < (showMorePayments[p] ? personPayments.length : Math.min(3, personPayments.length)) - 1 ? 1 : 0, borderBottomColor: Colors.border },
                                pay.status === 'cancelled' && { opacity: 0.45 },
                              ]}>
                                <Text style={s.itemNum}>{payIdx + 1}</Text>
                                <View style={{ flex: 1, gap: 1 }}>
                                  {pay.charged_recording_id ? (
                                    <TouchableOpacity onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: pay.charged_recording_id } } as any)}>
                                      <Text style={[s.itemName, pay.status === 'cancelled' && { textDecorationLine: 'line-through', color: Colors.muted }]}>{fmt(Number(pay.amount))}</Text>
                                    </TouchableOpacity>
                                  ) : (
                                    <Text style={[s.itemName, pay.status === 'cancelled' && { textDecorationLine: 'line-through', color: Colors.muted }]}>{fmt(Number(pay.amount))}</Text>
                                  )}
                                  <Text style={[s.itemSplit, { fontStyle: 'italic' }]}>
                                    {new Date(pay.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    {pay.status === 'cancelled' && pay.cancelled_reason ? ` Â· ${pay.cancelled_reason}` : pay.status === 'cancelled' ? ' Â· cancelled' : ''}
                                  </Text>
                                </View>
                                {pay.status !== 'cancelled' && billStatus === 'ongoing' && (
                                  <TouchableOpacity onPress={() => openCancelPayment(pay)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="close" size={14} color={Colors.faint} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            ))}
                            {personPayments.length > 3 && (
                              <TouchableOpacity onPress={() => setShowMorePayments(prev => ({ ...prev, [p]: !prev[p] }))} style={{ paddingTop: 8 }}>
                                <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: ACCENT_DARK }}>
                                  {showMorePayments[p] ? 'show less' : `show ${personPayments.length - 3} more`}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {/* Payment logs */}
          {chargedExpenses.length > 0 && (
            <>
              <View style={s.divider} />
              <View style={s.sectionRow}>
                <Text style={s.sectionHeader}>payment logs</Text>
              </View>
              <View style={s.list}>
                {chargedExpenses.map((exp: any) => (
                  <TouchableOpacity
                    key={exp.id}
                    style={s.recRow}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: exp.id } } as any)}
                  >
                    <View style={[s.recIconWrap, { backgroundColor: ACCENT + '44' }]}>
                      <Ionicons name="receipt-outline" size={16} color={ACCENT_DARK} />
                    </View>
                    <View style={s.recMid}>
                      <Text style={s.recName} numberOfLines={1}>{exp.name}</Text>
                      <Text style={s.recDate}>{exp.space?.name ?? '—'}{exp.account?.account_name ? ' · ' + exp.account.account_name : ''}</Text>
                      <Text style={s.recDate}>{exp.transaction_date ? new Date(exp.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</Text>
                    </View>
                    <Text style={[s.recAmount, { color: ACCENT_DARK }]}>{fmt(Number(exp.amount))}</Text>
                    <Ionicons name="chevron-forward" size={13} color={Colors.faint} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* moved to actions row above recordings */}
          <View style={{ height: 20 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Add item modal */}
      <BottomSheet visible={addItemModal} onClose={() => { setAddItemModal(false); setEditingParsedItem(null); }} title="add items" maxHeight="65%">
        {/* Edit field overlay — inside BottomSheet so it renders above it */}
        {(editingParsedItem || editingExistingItem) && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, zIndex: 999 }}>
            <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => { setEditingParsedItem(null); setEditingExistingItem(null); }} />
            <View style={{ width: '100%', backgroundColor: Colors.white, borderRadius: 20, padding: 24, gap: 12 }}>
              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {(editingParsedItem?.field ?? editingExistingItem?.field) === 'name' ? 'item name' : 'item cost'}
              </Text>
              <TextInput
                style={[s.itemFormInput, { fontSize: 16 }]}
                value={editingParsedItem?.value ?? editingExistingItem?.value ?? ''}
                onChangeText={v => {
                  if (editingParsedItem) setEditingParsedItem(prev => prev ? { ...prev, value: v } : null);
                  else setEditingExistingItem(prev => prev ? { ...prev, value: v } : null);
                }}
                keyboardType={(editingParsedItem?.field ?? editingExistingItem?.field) === 'cost' ? 'decimal-pad' : 'default'}
                autoFocus
                selectTextOnFocus
              />
              <TouchableOpacity
                style={[s.doneBtn, { marginTop: 0 }]}
                onPress={async () => {
                  if (editingParsedItem) {
                    const { idx, field, value } = editingParsedItem;
                    if (itemStep === 'parse-review') {
                      setParsedItems(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
                    } else {
                      setItemRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
                    }
                    setEditingParsedItem(null);
                  } else if (editingExistingItem) {
                    const { item, field, value } = editingExistingItem;
                    const update = field === 'cost'
                      ? { cost: parseFloat(value) || 0 }
                      : { name: value.trim() };
                    if (field === 'cost') { const recTotal = Number(selectedRecording?.amount_contributed ?? 0); if (recTotal > 0) { const otherCost = items.filter((i: any) => i.recording_id === selectedRecording?.recording?.id && i.id !== item.id).reduce((s: number, i: any) => s + Number(i.cost), 0); const newRowsCost = itemRows.reduce((s, r) => s + (parseFloat(r.cost || '0') || 0), 0); if (otherCost + (parseFloat(value) || 0) + newRowsCost > recTotal + 0.01) { setParseOverBudgetModal(true); return; } } } await supabase.from('split_items').update(update).eq('id', item.id); refetchItems(); setEditingExistingItem(null);
                  }
                }}
              >
                <Text style={s.doneBtnText}>done</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {itemStep === 'pick-type' ? (
          <View style={{ gap: 12 }}>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted, marginBottom: 4 }}>how do you want to add items?</Text>
            <TouchableOpacity
              style={[s.recPickRow, { borderBottomWidth: 0, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16 }]}
              onPress={() => setItemStep(linkedRecordings.length > 0 ? 'pick-recording' : 'manual')}
            >
              <View style={[s.recIconWrap, { backgroundColor: ACCENT + '22' }]}>
                <Ionicons name="receipt-outline" size={16} color={ACCENT} />
              </View>
              <View style={s.recMid}>
                <Text style={s.recName}>from a recording</Text>
                <Text style={s.recDate}>link to an existing recording</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={Colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.recPickRow, { borderBottomWidth: 0, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16 }]}
              onPress={() => { setItemRows([{ name: '', cost: '' }]); setItemStep('manual'); }}
            >
              <View style={[s.recIconWrap, { backgroundColor: '#FFAB9122' }]}>
                <Ionicons name="create-outline" size={16} color="#FFAB91" />
              </View>
              <View style={s.recMid}>
                <Text style={s.recName}>manual item</Text>
                <Text style={s.recDate}>receivable or loan · no recording created</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        ) : itemStep === 'manual' ? (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Type toggle */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {(['receivable', 'payable'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.modeBtn, manualItemType === t && s.modeBtnActive]}
                  onPress={() => setManualItemType(t)}
                >
                  <Text style={[s.modeBtnText, manualItemType === t && s.modeBtnTextActive]}>
                    {t === 'receivable' ? 'receivable (+)' : 'loan (-)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {itemRows.map((row, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: ACCENT_DARK, backgroundColor: ACCENT + '44', width: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20 }}>{i + 1}</Text>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditingParsedItem({ idx: i, field: 'name', value: row.name })}>
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: row.name ? Colors.text : Colors.faint }} numberOfLines={1}>{row.name || 'add name'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingParsedItem({ idx: i, field: 'cost', value: row.cost })}>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: row.cost ? Colors.text : Colors.faint }}>{row.cost || '0.00'}</Text>
                </TouchableOpacity>
                {itemRows.length > 1 && (
                  <TouchableOpacity onPress={() => setItemRows(prev => prev.filter((_, idx) => idx !== i))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={14} color={Colors.faint} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 }} onPress={() => setItemRows(prev => [...prev, { name: '', cost: '' }])}>
              <Ionicons name="add" size={13} color={ACCENT_DARK} />
              <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: ACCENT_DARK }}>add another</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity style={[s.doneBtn, { flex: 1, backgroundColor: Colors.surface, marginTop: 0 }]} onPress={() => setItemStep('pick-type')}>
                <Text style={[s.doneBtnText, { color: Colors.muted }]}>back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.doneBtn, { flex: 2, marginTop: 0, opacity: savingItem || !itemRows.some(r => r.name.trim() && r.cost) ? 0.4 : 1 }]}
                onPress={saveManualItems}
                disabled={savingItem || !itemRows.some(r => r.name.trim() && r.cost)}
              >
                <Text style={s.doneBtnText}>save items</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : itemStep === 'pick-recording' ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {linkedRecordings.map((lr: any) => {
              const recType = lr.recording?.type ?? '';
              const deduct = isDeductType(recType);
              return (
                <TouchableOpacity key={lr.id} style={s.recPickRow} onPress={() => handlePickRecording(lr)}>
                  <View style={[s.recIconWrap, { backgroundColor: ACCENT + '44' }]}>
                    <Ionicons name={recType === 'payable' ? 'cash-outline' : deduct ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={16} color={deduct ? ACCENT_DARK : '#FFAB91'} />
                  </View>
                  <View style={s.recMid}>
                    <Text style={s.recName} numberOfLines={1}>{lr.recording?.name ?? '—'}</Text>
                    <Text style={s.recDate}>{recType} · {fmt(Number(lr.amount_contributed))}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.muted} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : itemStep === 'add-items' ? (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[s.recDate, { marginBottom: 8 }]}>
              {selectedRecording?.recording?.name} · {selectedRecording?.recording?.type} · {fmt(Number(selectedRecording?.amount_contributed))}
            </Text>
            {/* Existing items for this recording */}
            {(() => {
              const existing = items.filter((i: any) => i.recording_id === selectedRecording?.recording?.id);
              if (existing.length === 0) return null;
              return (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>already added</Text>
                  {existing.map((item: any, i: number) => (
                    <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                      <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: ACCENT_DARK, backgroundColor: ACCENT + '44', width: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20 }}>{i + 1}</Text>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditingExistingItem({ item, field: 'name', value: item.name })}>
                        <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text }} numberOfLines={1}>{item.name}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingExistingItem({ item, field: 'cost', value: String(item.cost) })}>
                        <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: Colors.text }}>{fmt(Number(item.cost))}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={14} color={Colors.faint} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })()}
            {/* Budget bar */}
            {(() => {
              const recTotal = Number(selectedRecording?.amount_contributed ?? 0);
              const alreadyUsed = items
                .filter((i: any) => i.recording_id === selectedRecording?.recording?.id)
                .reduce((s: number, i: any) => s + Number(i.cost), 0);
              const newTotal = itemRows.reduce((s, r) => s + parseFloat(r.cost || '0'), 0);
              const used = alreadyUsed + newTotal;
              const pct = recTotal > 0 ? Math.min(used / recTotal, 1) : 0;
              const over = recTotal > 0 && used > recTotal + 0.01;
              return (
                <View style={{ marginBottom: 12 }}>
                  <View style={{ height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ height: 4, borderRadius: 2, width: `${pct * 100}%` as any, backgroundColor: over ? Colors.expense : ACCENT }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: over ? Colors.expense : ACCENT_DARK }}>{fmt(used)} used</Text>
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: over ? Colors.expense : Colors.muted }}>
                      {over ? `${fmt(used - recTotal)} over` : `${fmt(recTotal - used)} left`}
                    </Text>
                  </View>
                </View>
              );
            })()}
            {itemRows.map((row, i) => {
              const recTotal = Number(selectedRecording?.amount_contributed ?? 0);
              const alreadyUsed = items
                .filter((i2: any) => i2.recording_id === selectedRecording?.recording?.id)
                .reduce((s: number, i2: any) => s + Number(i2.cost), 0);
              const runningTotal = itemRows.slice(0, i + 1).reduce((s, r) => s + parseFloat(r.cost || '0'), 0);
              const rowOver = recTotal > 0 && alreadyUsed + runningTotal > recTotal + 0.01;
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: ACCENT_DARK, backgroundColor: ACCENT + '44', width: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20 }}>{i + 1}</Text>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditingParsedItem({ idx: i, field: 'name', value: row.name })}>
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: row.name ? Colors.text : Colors.faint }} numberOfLines={1}>{row.name || 'add name'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingParsedItem({ idx: i, field: 'cost', value: row.cost })}>
                    <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: rowOver ? Colors.expense : row.cost ? Colors.text : Colors.faint }}>{row.cost || '0.00'}</Text>
                  </TouchableOpacity>
                  {itemRows.length > 1 && (
                    <TouchableOpacity onPress={() => setItemRows(prev => prev.filter((_, idx) => idx !== i))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={14} color={Colors.faint} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 }} onPress={() => setItemRows(prev => [...prev, { name: '', cost: '' }])}>
              <Ionicons name="add" size={13} color={ACCENT_DARK} />
              <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: ACCENT_DARK }}>add another</Text>
            </TouchableOpacity>
            {(() => {
              const recTotal = Number(selectedRecording?.amount_contributed ?? 0);
              const alreadyUsed = items
                .filter((i: any) => i.recording_id === selectedRecording?.recording?.id)
                .reduce((s: number, i: any) => s + Number(i.cost), 0);
              const newTotal = itemRows.reduce((s, r) => s + parseFloat(r.cost || '0'), 0);
              const over = recTotal > 0 && alreadyUsed + newTotal > recTotal + 0.01;
              const hasValid = itemRows.some(r => r.name.trim() && r.cost);
              return (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity style={[s.doneBtn, { flex: 1, backgroundColor: Colors.surface, marginTop: 0 }]} onPress={() => setItemStep('pick-recording')}>
                    <Text style={[s.doneBtnText, { color: Colors.muted }]}>back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.doneBtn, { flex: 2, marginTop: 0, opacity: savingItem || !hasValid || over ? 0.4 : 1 }]}
                    onPress={saveItems}
                    disabled={savingItem || !hasValid || over}
                  >
                    <Text style={s.doneBtnText}>save items</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </ScrollView>
        ) : itemStep === 'parse-choice' ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[s.recDate, { marginBottom: 12 }]}>
              {selectedRecording?.recording?.name} · {fmt(Number(selectedRecording?.amount_contributed))}
            </Text>
            {parseError ? (
              <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.expense, marginBottom: 12 }}>{parseError}</Text>
            ) : null}
            {parseReceiptPhotos.length > 0 ? (
              <TouchableOpacity
                style={[s.recPickRow, { borderBottomWidth: 0, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, marginBottom: 10 }]}
                onPress={() => handleParseReceipt(parseReceiptPhotos)}
              >
                <View style={[s.recIconWrap, { backgroundColor: ACCENT + '22' }]}>
                  <Ionicons name="scan-outline" size={16} color={ACCENT_DARK} />
                </View>
                <View style={s.recMid}>
                  <Text style={s.recName}>parse existing receipt</Text>
                  <Text style={s.recDate}>{parseReceiptPhotos.length} photo{parseReceiptPhotos.length !== 1 ? 's' : ''} found</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={Colors.muted} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[s.recPickRow, { borderBottomWidth: 0, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16, marginBottom: 10 }]}
              onPress={handleUploadReceiptForParse}
            >
              <View style={[s.recIconWrap, { backgroundColor: ACCENT + '22' }]}>
                <Ionicons name="camera-outline" size={16} color={ACCENT_DARK} />
              </View>
              <View style={s.recMid}>
                <Text style={s.recName}>upload & parse receipt</Text>
                <Text style={s.recDate}>upload a photo and scan for items</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={Colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.recPickRow, { borderBottomWidth: 0, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 16 }]}
              onPress={() => { setItemRows([{ name: '', cost: '' }]); setItemStep('add-items'); }}
            >
              <View style={[s.recIconWrap, { backgroundColor: '#FFAB9122' }]}>
                <Ionicons name="create-outline" size={16} color="#FFAB91" />
              </View>
              <View style={s.recMid}>
                <Text style={s.recName}>add manually</Text>
                <Text style={s.recDate}>type items yourself</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={Colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 16 }]} onPress={() => setItemStep('pick-recording')}>
              <Text style={[s.doneBtnText, { color: Colors.muted }]}>back</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : itemStep === 'parsing' ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 16 }}>
            <ActivityIndicator color={ACCENT_DARK} size="large" />
            <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>reading receipt...</Text>
          </View>
        ) : itemStep === 'parse-review' ? (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Receipt photos */}
            {parseReceiptPhotos.length > 0 && (
              <>
                <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>receipt</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 16 }}>
                  {parseReceiptPhotos.map((p, idx) => (
                    <TouchableOpacity key={p.id} onPress={() => setParsePhotoIndex(idx === parsePhotoIndex && parseEnlargeModal ? -1 : idx) || setParseEnlargeModal(true)} activeOpacity={0.85}>
                      <Image source={{ uri: p.url }} style={{ width: 100, height: 100, borderRadius: Radius.md, backgroundColor: Colors.surface }} resizeMode="cover" />
                      <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 4, padding: 2 }}>
                        <Ionicons name="expand-outline" size={10} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {/* Inline enlarge — renders inside BottomSheet so it stacks correctly */}
                {parseEnlargeModal && parseReceiptPhotos[parsePhotoIndex] && (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
                    <TouchableOpacity
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                      activeOpacity={1}
                      onPress={() => setParseEnlargeModal(false)}
                    />
                    <Image
                      source={{ uri: parseReceiptPhotos[parsePhotoIndex].url }}
                      style={{ width: '100%', height: '90%', borderRadius: 8 }}
                      resizeMode="contain"
                    />
                    <TouchableOpacity
                      style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6, zIndex: 1000 }}
                      onPress={() => setParseEnlargeModal(false)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Ionicons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* Totals checker */}
            {(() => {
              const parsedSum = parsedItems.reduce((s, r) => s + (parseFloat(r.cost || '0') || 0), 0);
              const recTotal = Number(selectedRecording?.amount_contributed ?? 0);
              const alreadyUsed = items
                .filter((i: any) => i.recording_id === selectedRecording?.recording?.id)
                .reduce((s: number, i: any) => s + Number(i.cost), 0);
              const totalWithExisting = alreadyUsed + parsedSum;
              const diff = parsedTotal ? Math.abs(parsedSum - parsedTotal) : null;
              const overRec = recTotal > 0 && totalWithExisting > recTotal + 0.01;
              return (
                <View style={{ backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12, marginBottom: 16, gap: 6 }}>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>totals check</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted }}>new items sum</Text>
                    <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: Colors.text }}>{fmt(parsedSum)}</Text>
                  </View>
                  {alreadyUsed > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted }}>already allocated</Text>
                      <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: Colors.muted }}>{fmt(alreadyUsed)}</Text>
                    </View>
                  )}
                  {alreadyUsed > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted }}>total after save</Text>
                      <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: overRec ? Colors.expense : Colors.text }}>{fmt(totalWithExisting)}</Text>
                    </View>
                  )}
                  {parsedTotal ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted }}>receipt total</Text>
                      <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: diff && diff > 0.5 ? Colors.expense : ACCENT_DARK }}>{fmt(parsedTotal)}</Text>
                    </View>
                  ) : null}
                  {recTotal > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted }}>recording amount</Text>
                      <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: overRec ? Colors.expense : Colors.text }}>{fmt(recTotal)}</Text>
                    </View>
                  )}
                  {diff && diff > 0.5 ? (
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.expense, marginTop: 2 }}>⚠ items sum differs from receipt total by {fmt(diff)} — check for missing items</Text>
                  ) : parsedTotal ? (
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: ACCENT_DARK, marginTop: 2 }}>✓ items match receipt total</Text>
                  ) : null}
                  {overRec && (
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.expense, marginTop: 2 }}>⚠ total exceeds recording amount</Text>
                  )}
                </View>
              );
            })()}

            {/* Editable parsed items — tap to edit */}
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>parsed items</Text>
            {parsedItems.map((row, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: ACCENT_DARK, backgroundColor: ACCENT + '44', width: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20 }}>{i + 1}</Text>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditingParsedItem({ idx: i, field: 'name', value: row.name })}>
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: row.name ? Colors.text : Colors.faint }} numberOfLines={1}>
                    {row.name || 'add name'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingParsedItem({ idx: i, field: 'cost', value: row.cost })}>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: row.cost ? Colors.text : Colors.faint }}>
                    {row.cost || '0.00'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setParsedItems(prev => prev.filter((_, idx) => idx !== i))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={14} color={Colors.faint} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 }} onPress={() => setParsedItems(prev => [...prev, { name: '', cost: '' }])}>
              <Ionicons name="add" size={13} color={ACCENT_DARK} />
              <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: ACCENT_DARK }}>add item</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity style={[s.doneBtn, { flex: 1, backgroundColor: Colors.surface, marginTop: 0 }]} onPress={() => setItemStep('parse-choice')}>
                <Text style={[s.doneBtnText, { color: Colors.muted }]}>back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.doneBtn, { flex: 2, marginTop: 0, opacity: savingItem || !parsedItems.some(r => r.name.trim() && r.cost) || (() => { const recTotal = Number(selectedRecording?.amount_contributed ?? 0); const alreadyUsed = items.filter((i: any) => i.recording_id === selectedRecording?.recording?.id).reduce((s: number, i: any) => s + Number(i.cost), 0); const newTotal = parsedItems.reduce((s, r) => s + parseFloat(r.cost || '0'), 0); return recTotal > 0 && alreadyUsed + newTotal > recTotal + 0.01; })() ? 0.4 : 1 }]}
                onPress={saveParsedItems}
                disabled={savingItem || !parsedItems.some(r => r.name.trim() && r.cost)}
              >
                <Text style={s.doneBtnText}>{savingItem ? 'saving...' : 'save items'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={!!assignItem} onClose={() => setAssignItem(null)} title="assign people">
        {assignItem && (() => {
          const deduct = isDeductType(assignItem.recording_type);
          const cost = Number(assignItem.cost);
          const perPerson = assignPeople.length > 0 ? cost / assignPeople.length : 0;
          return (
            <>
              <Text style={[s.recDate, { marginBottom: 12 }]}>
                {assignItem.name} · {deduct ? '-' : '+'}{fmt(cost)}
              </Text>
              <View style={[itemStyles.personSelectRow, { marginBottom: 12 }]}>
                {filledPeople.map((p, pi) => {
                  const sel = assignPeople.includes(p);
                  return (
                    <TouchableOpacity
                      key={pi}
                      style={[itemStyles.personSelectChip, sel && itemStyles.personSelectChipActive]}
                      onPress={() => setAssignPeople(prev => sel ? prev.filter(x => x !== p) : [...prev, p])}
                    >
                      <Text style={[itemStyles.personSelectText, sel && itemStyles.personSelectTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {assignPeople.length > 0 && (
                <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: deduct ? ACCENT_DARK : '#FFAB91', marginBottom: 12 }}>
                  {deduct ? '-' : '+'}{fmt(perPerson)} each
                </Text>
              )}
              <TouchableOpacity style={s.doneBtn} onPress={saveAssign}>
                <Text style={s.doneBtnText}>done</Text>
              </TouchableOpacity>
            </>
          );
        })()}
      </BottomSheet>

      {/* Add person modal */}
      <BottomSheet visible={addPersonModal} onClose={() => setAddPersonModal(false)} title="add people">
        <View style={s.tagInputWrap}>
          {people.map((p: any) => (
            <View key={p.id} style={s.tagChip}>
              <Text style={s.tagChipText}>{p.person_name}</Text>
              <TouchableOpacity onPress={() => removePerson(p.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close" size={11} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ))}
          <TextInput
            style={s.tagInput}
            placeholder={filledPeople.length === 0 ? 'type a name and press enter...' : ''}
            placeholderTextColor={Colors.faint}
            value={tagInputVal}
            onChangeText={setTagInputVal}
            returnKeyType="done"
            onSubmitEditing={handleAddPersonSubmit}
            blurOnSubmit={false}
            autoFocus
          />
        </View>
        <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Friends section */}
          {friends.length > 0 && (() => {
            const filteredFriends = friends.filter(f =>
              (!tagInputVal.trim() || f.name.toLowerCase().includes(tagInputVal.toLowerCase())) &&
              !filledPeople.some(p => p.toLowerCase() === f.name.toLowerCase())
            );
            if (filteredFriends.length === 0) return null;
            return (
              <>
                <Text style={[s.contactsLabel, { marginBottom: 6 }]}>friends</Text>
                {filteredFriends.map(f => (
                  <TouchableOpacity key={f.id} style={s.contactRow} onPress={() => { suppressSubmitRef.current = true; savePerson(f.name); setTagInputVal(''); }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: ACCENT + '44', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: ACCENT_DARK }}>{f.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={[s.contactName, { flex: 1 }]}>{f.name}</Text>
                    <Ionicons name="add" size={14} color={ACCENT_DARK} />
                  </TouchableOpacity>
                ))}
                <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 8 }} />
              </>
            );
          })()}
          {/* Contacts section */}
          <Text style={[s.contactsLabel, { marginBottom: 6 }]}>contacts</Text>
          {contacts.length === 0 && <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.faint }}>no contacts saved yet</Text>}
          {(() => {
            const filtered = contacts.filter(c =>
              !tagInputVal.trim() || c.toLowerCase().includes(tagInputVal.toLowerCase())
            );
            const visible = filtered.slice(0, contactsVisible);
            return (
              <>
                {visible.map((c, i) => {
                  const added = filledPeople.some(p => p.toLowerCase() === c.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[s.contactRow, added && { opacity: 0.35 }]}
                      onPress={() => { if (!added) { suppressSubmitRef.current = true; savePerson(c); setTagInputVal(''); } }}
                      disabled={added}
                    >
                      <Text style={s.contactName}>{c}</Text>
                      {added
                        ? <Ionicons name="checkmark" size={14} color={Colors.faint} />
                        : <Ionicons name="add" size={14} color={ACCENT_DARK} />}
                    </TouchableOpacity>
                  );
                })}
                {contactsVisible < filtered.length && (
                  <TouchableOpacity
                    style={{ paddingVertical: 10, alignItems: 'center' }}
                    onPress={() => setContactsVisible(prev => prev + 5)}
                  >
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: ACCENT_DARK }}>
                      show {Math.min(5, filtered.length - contactsVisible)} more
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            );
          })()}
        </ScrollView>
        <TouchableOpacity style={s.doneBtn} onPress={() => setAddPersonModal(false)} activeOpacity={0.8}>
          <Text style={s.doneBtnText}>done</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Friend invite prompt */}
      <BottomSheet visible={!!pendingInvitePerson} onClose={() => setPendingInvitePerson(null)} title="link to friend?">
        {pendingInvitePerson && (() => {
          const totals = computeTotals();
          const amount = Math.abs(totals[pendingInvitePerson.name] ?? 0);
          return (
            <>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text, marginBottom: 4 }}>
                {pendingInvitePerson.name} is one of your friends.
              </Text>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginBottom: 16 }}>
                send them an invite? they'll see this split bill and their share ({amount > 0 ? amount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : 'tbd'}) as a debt on their end.
              </Text>
              <TouchableOpacity
                style={[s.doneBtn, { opacity: sendingInvite ? 0.5 : 1 }]}
                onPress={() => sendInvite(pendingInvitePerson.name, pendingInvitePerson.friendId, amount)}
                disabled={sendingInvite}
              >
                <Text style={s.doneBtnText}>{sendingInvite ? 'sending...' : 'send invite'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]}
                onPress={() => setPendingInvitePerson(null)}
              >
                <Text style={[s.doneBtnText, { color: Colors.muted }]}>skip</Text>
              </TouchableOpacity>
            </>
          );
        })()}
      </BottomSheet>

      {/* Add recording modal */}
      <BottomSheet visible={addRecModal} onClose={() => setAddRecModal(false)} title="link a recording" maxHeight="70%">
        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
          {REC_TABS.map(t => (
            <TouchableOpacity key={t.key} style={[s.modeBtn, recTab === t.key && s.modeBtnActive]} onPress={() => { setRecTab(t.key); setRecSearch(''); setRecShowMore(false); }}>
              <Text style={[s.modeBtnText, recTab === t.key && s.modeBtnTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {/* Date range */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
          {REC_RANGES.map(r => (
            <TouchableOpacity key={String(r.value)} style={[s.modeBtn, { paddingHorizontal: 10, paddingVertical: 5 }, recDays === r.value && s.modeBtnActive]} onPress={() => { setRecDays(r.value); setRecShowMore(false); }}>
              <Text style={[s.modeBtnText, { fontSize: 11 }, recDays === r.value && s.modeBtnTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, paddingHorizontal: 10, marginBottom: 10, gap: 6 }}>
          <Ionicons name="search-outline" size={14} color={Colors.faint} />
          <TextInput
            style={{ flex: 1, fontFamily: AppFont.regular, fontSize: 13, color: Colors.text, paddingVertical: 8 }}
            placeholder="search..."
            placeholderTextColor={Colors.faint}
            value={recSearch}
            onChangeText={v => { setRecSearch(v); setRecShowMore(false); }}
          />
          {recSearch.length > 0 && (
            <TouchableOpacity onPress={() => setRecSearch('')}>
              <Ionicons name="close" size={13} color={Colors.faint} />
            </TouchableOpacity>
          )}
        </View>
        {/* List */}
        <ScrollView showsVerticalScrollIndicator={false}>
          {(() => {
            const cutoff = recDays ? new Date(Date.now() - recDays * 86400000).toISOString().split('T')[0] : null;
            const filtered = allRecordings.filter(r =>
              r.type === recTab &&
              r.name.toLowerCase().includes(recSearch.toLowerCase()) &&
              (!cutoff || (r.transaction_date ?? '') >= cutoff)
            );
            if (filtered.length === 0)
              return <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.faint }}>no recordings found</Text>;
            const visible = filtered.slice(0, recShowMore ? filtered.length : 10);
            return (
              <>
                {visible.map((rec: any) => {
                  const deduct = isDeductType(rec.type);
                  return (
                    <TouchableOpacity key={rec.id} style={s.recPickRow} onPress={() => linkRecording(rec)}>
                      <View style={[s.recIconWrap, { backgroundColor: deduct ? ACCENT + '44' : '#FFAB9122' }]}>
                        <Ionicons name={rec.type === 'payable' ? 'cash-outline' : deduct ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={16} color={deduct ? ACCENT_DARK : '#FFAB91'} />
                      </View>
                      <View style={s.recMid}>
                        <Text style={s.recName} numberOfLines={1}>{rec.name}</Text>
                        <Text style={s.recDate}>{rec.transaction_date ? new Date(rec.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Text>
                      {(rec.type === 'payable' || rec.type === 'receivable') && rec.status && (
                        <View style={{ backgroundColor: rec.status === 'paid' || rec.status === 'received' ? ACCENT + '44' : rec.status === 'partial' ? '#FFAB9122' : Colors.border, borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1, marginTop: 3, alignSelf: 'flex-start' }}>
                          <Text style={{ fontFamily: AppFont.semiBold, fontSize: 9, color: rec.status === 'paid' || rec.status === 'received' ? ACCENT_DARK : rec.status === 'partial' ? '#FFAB91' : Colors.muted }}>{rec.status}</Text>
                        </View>
                      )}
                      </View>
                      <Text style={[s.recAmount, { color: deduct ? ACCENT_DARK : '#FFAB91' }]}>{fmt(Number(rec.amount))}</Text>
                    </TouchableOpacity>
                  );
                })}
                {!recShowMore && filtered.length > 10 && (
                  <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center' }} onPress={() => setRecShowMore(true)}>
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: ACCENT_DARK }}>
                      show {filtered.length - 10} more
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            );
          })()}
        </ScrollView>
      </BottomSheet>

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
                <Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={sel ? ACCENT_DARK : Colors.faint} />
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
              <Ionicons name={shareCopied ? 'checkmark-circle' : 'copy-outline'} size={16} color={shareCopied ? Colors.income : ACCENT} />
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
          <Ionicons name="document-outline" size={15} color={Colors.text} />
          <Text style={[s.doneBtnText, { color: Colors.text }]}>{saveImgLoading ? 'generating...' : 'export as pdf'}</Text>
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
                    <Ionicons name={markPaidAccount?.id === acc.id ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={markPaidAccount?.id === acc.id ? ACCENT_DARK : Colors.faint} />
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
              {/* Charge to space */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4 }}
                onPress={() => setChargeToSpace(v => !v)}
                activeOpacity={0.7}
              >
                <Ionicons name={chargeToSpace ? 'checkbox' : 'square-outline'} size={18} color={chargeToSpace ? ACCENT_DARK : Colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: Colors.text }}>charge to a space</Text>
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted }}>creates an expense on the selected space</Text>
                </View>
              </TouchableOpacity>
              {chargeToSpace && (
                <View style={{ gap: 10, marginBottom: 8 }}>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>space</Text>
                  <View style={{ borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, overflow: 'hidden' }}>
                    {[...chargeSpaces].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((sp: any) => (
                      <TouchableOpacity key={sp.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: chargeSpaceId === sp.id ? ACCENT + '22' : Colors.white }} onPress={() => setChargeSpaceId(sp.id)}>
                        <Ionicons name={chargeSpaceId === sp.id ? 'radio-button-on' : 'radio-button-off'} size={16} color={chargeSpaceId === sp.id ? ACCENT_DARK : Colors.faint} style={{ marginRight: 10 }} />
                        <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: chargeSpaceId === sp.id ? ACCENT_DARK : Colors.text }}>{sp.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>account <Text style={{ fontFamily: AppFont.regular, textTransform: 'none' }}>(optional)</Text></Text>
                  <View style={{ borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, overflow: 'hidden' }}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: !chargeAccountId ? ACCENT + '22' : Colors.white }} onPress={() => setChargeAccountId(null)}>
                      <Ionicons name={!chargeAccountId ? 'radio-button-on' : 'radio-button-off'} size={16} color={!chargeAccountId ? ACCENT_DARK : Colors.faint} style={{ marginRight: 10 }} />
                      <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>none</Text>
                    </TouchableOpacity>
                    {[...chargeAccounts].sort((a: any, b: any) => a.account_name.localeCompare(b.account_name)).map((ac: any) => (
                      <TouchableOpacity key={ac.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: chargeAccountId === ac.id ? ACCENT + '22' : Colors.white }} onPress={() => setChargeAccountId(ac.id)}>
                        <Ionicons name={chargeAccountId === ac.id ? 'radio-button-on' : 'radio-button-off'} size={16} color={chargeAccountId === ac.id ? ACCENT_DARK : Colors.faint} style={{ marginRight: 10 }} />
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
                      <Ionicons name={!chargeCategoryId ? 'radio-button-on' : 'radio-button-off'} size={16} color={!chargeCategoryId ? ACCENT_DARK : Colors.faint} style={{ marginRight: 10 }} />
                      <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>none</Text>
                    </TouchableOpacity>
                    {[...chargeCategories].sort((a: any, b: any) => a.name.localeCompare(b.name)).map((cat: any) => (
                      <TouchableOpacity key={cat.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: chargeCategoryId === cat.id ? ACCENT + '22' : Colors.white }} onPress={() => setChargeCategoryId(cat.id)}>
                        <Ionicons name={chargeCategoryId === cat.id ? 'radio-button-on' : 'radio-button-off'} size={16} color={chargeCategoryId === cat.id ? ACCENT_DARK : Colors.faint} style={{ marginRight: 10 }} />
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
          <Ionicons name="camera-outline" size={18} color={ACCENT_DARK} />
          <Text style={s.doneBtnText}>camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: Colors.surface }]}
          onPress={addReceiptFromGallery}
        >
          <Ionicons name="images-outline" size={18} color={Colors.text} />
          <Text style={[s.doneBtnText, { color: Colors.text }]}>gallery</Text>
        </TouchableOpacity>
      </BottomSheet>

            {/* Photo carousel modal */}
      <Modal visible={photoModal} transparent animationType="fade" onRequestClose={() => setPhotoModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: DC.photoViewerBg }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: DC.pagePadding, paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: AppFont.bold, fontSize: 15, color: DC.pageText }}>receipt</Text>
            </View>
            <TouchableOpacity onPress={() => setPhotoModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ position: 'absolute', right: DC.pagePadding }}>
              <Ionicons name="close" size={22} color={DC.pageText} />
            </TouchableOpacity>
          </View>
          {(() => {
            const pool = photoModalPool === 'direct' ? receiptPhotos : recordingReceiptPhotos;
            return (
              <>
                {/* Photo + arrows */}
                <View style={{ height: 420, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                  <TouchableOpacity
                    onPress={() => setPhotoModalIndex(i => i - 1)}
                    disabled={photoModalIndex === 0}
                    style={{ position: 'absolute', left: 12, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: DC.photoViewerNav, justifyContent: 'center', alignItems: 'center', opacity: photoModalIndex === 0 ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-back" size={20} color={DC.pageText} />
                  </TouchableOpacity>
                  <Image source={{ uri: pool[photoModalIndex]?.url ?? '' }} style={{ width: width - 80, height: 400, borderRadius: 12 }} resizeMode="contain" />
                  <TouchableOpacity
                    onPress={() => setPhotoModalIndex(i => i + 1)}
                    disabled={photoModalIndex === pool.length - 1}
                    style={{ position: 'absolute', right: 12, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: DC.photoViewerNav, justifyContent: 'center', alignItems: 'center', opacity: photoModalIndex === pool.length - 1 ? 0.3 : 1 }}
                  >
                    <Ionicons name="chevron-forward" size={20} color={DC.pageText} />
                  </TouchableOpacity>
                </View>
                {/* Recording name label */}
                {pool[photoModalIndex] && 'recordingName' in pool[photoModalIndex] && (pool[photoModalIndex] as any).recordingName ? (
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: DC.pageTextMuted, textAlign: 'center', marginTop: 4 }} numberOfLines={1}>{(pool[photoModalIndex] as any).recordingName}</Text>
                ) : null}
                {/* Dot indicators */}
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 12 }}>
                  {pool.map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => setPhotoModalIndex(i)}>
                      <View style={{ width: i === photoModalIndex ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === photoModalIndex ? DC.accent1 : DC.cardBorder }} />
                    </TouchableOpacity>
                  ))}
                </View>
                {/* Thumbnail strip */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DC.pagePadding, gap: 8, paddingBottom: 16 }}>
                  {pool.map((p, i) => (
                    <TouchableOpacity key={p.id} onPress={() => setPhotoModalIndex(i)} activeOpacity={0.8}>
                      <Image source={{ uri: p.url }} style={{ width: 64, height: 64, borderRadius: 8, borderWidth: i === photoModalIndex ? 2 : 0, borderColor: DC.accent1 }} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
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
        <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted, marginBottom: 12 }}>
          these people haven't paid yet:
        </Text>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {unpaidPeopleNames.map((name, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="alert-circle-outline" size={14} color={PEACH} />
              <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text }}>{name}</Text>
            </View>
          ))}
        </View>
        {closeNoRecordings ? (
          <>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginBottom: 12 }}>
              no recordings linked to this split bill. you can create one now.
            </Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
              onPress={() => setCloseCreateRecording(v => !v)}
            >
              <Ionicons name={closeCreateRecording ? 'checkbox' : 'square-outline'} size={20} color={ACCENT_DARK} />
              <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.text, flex: 1 }}>
                create an expense and return recordings
              </Text>
            </TouchableOpacity>
            {closeCreateRecording && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>space</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {closeSpaces.map(sp => (
                    <TouchableOpacity
                      key={sp.id}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1,
                        borderColor: closeSpaceId === sp.id ? ACCENT_DARK : Colors.borderMid,
                        backgroundColor: closeSpaceId === sp.id ? ACCENT + '22' : Colors.surface,
                      }}
                      onPress={() => setCloseSpaceId(sp.id)}
                    >
                      <Text style={{
                        fontFamily: AppFont.semiBold, fontSize: 12,
                        color: closeSpaceId === sp.id ? ACCENT_DARK : Colors.text,
                      }}>{sp.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        ) : (
          <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginBottom: 16 }}>
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
            <Ionicons name="checkmark-circle-outline" size={14} color={ACCENT_DARK} />
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
                <Ionicons name="people-outline" size={16} color={ACCENT_DARK} />
              </View>
              <View style={s.recMid}>
                <Text style={s.recName}>{bill.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={Colors.muted} />
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

      {/* Accept invite modal */}
      <BottomSheet visible={acceptModal} onClose={() => setAcceptModal(false)} title="accept split bill invite" maxHeight="60%">
        {myInvite && (
          <>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted, marginBottom: 16 }}>
              a debt of {fmt(Number(myInvite.amount))} will be created. pick where to store it.
            </Text>
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>space</Text>
            <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
              {acceptSpaces.map((sp: any) => (
                <TouchableOpacity
                  key={sp.id}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}
                  onPress={() => setAcceptSpaceId(sp.id)}
                >
                  <Ionicons name={acceptSpaceId === sp.id ? 'radio-button-on' : 'radio-button-off'} size={16} color={acceptSpaceId === sp.id ? ACCENT_DARK : Colors.faint} />
                  <Text style={{ fontFamily: AppFont.medium, fontSize: 13, color: Colors.text }}>{sp.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>category <Text style={{ fontFamily: AppFont.regular, textTransform: 'none' }}>(optional)</Text></Text>
            <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}
                onPress={() => setAcceptCategoryId('')}
              >
                <Ionicons name={!acceptCategoryId ? 'radio-button-on' : 'radio-button-off'} size={16} color={!acceptCategoryId ? ACCENT_DARK : Colors.faint} />
                <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>none</Text>
              </TouchableOpacity>
              {acceptCategories.map((cat: any) => (
                <TouchableOpacity
                  key={cat.id}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}
                  onPress={() => setAcceptCategoryId(cat.id)}
                >
                  <Ionicons name={acceptCategoryId === cat.id ? 'radio-button-on' : 'radio-button-off'} size={16} color={acceptCategoryId === cat.id ? ACCENT_DARK : Colors.faint} />
                  <Text style={{ fontFamily: AppFont.medium, fontSize: 13, color: Colors.text }}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[s.doneBtn, { opacity: acceptSaving || !acceptSpaceId ? 0.5 : 1 }]}
              onPress={confirmAccept}
              disabled={acceptSaving || !acceptSpaceId}
            >
              <Text style={s.doneBtnText}>{acceptSaving ? 'saving...' : 'confirm & create debt'}</Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>

      {/* Over-budget overlay — inside Animated.View, shown above BottomSheet via zIndex */}
      {parseOverBudgetModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, zIndex: 9999 }}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => setParseOverBudgetModal(false)} />
          <View style={{ width: '100%', backgroundColor: Colors.white, borderRadius: 20, padding: 24, gap: 12 }}>
            <Text style={{ fontFamily: AppFont.bold, fontSize: 20, color: Colors.text }}>items over budget</Text>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>
              the sum of items exceeds the recording amount. please reduce item costs before saving.
            </Text>
            <TouchableOpacity style={[s.doneBtn, { marginTop: 0 }]} onPress={() => setParseOverBudgetModal(false)}>
              <Text style={s.doneBtnText}>ok, i'll fix it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <PaymentModal
        visible={itemPayModal}
        person={itemPayPerson}
        splitBillId={splitBillId}
        onClose={() => setItemPayModal(false)}
        onConfirm={confirmItemPay}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAGE, paddingTop: 16, paddingBottom: 16, gap: 10, backgroundColor: Colors.headerBg, borderBottomWidth: 1, borderBottomColor: Colors.borderMid },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.color.accent + '22', alignItems: 'center', justifyContent: 'center' },
  headerBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.color.accent + '22', alignItems: 'center', justifyContent: 'center' },
  title:      { flex: 1, fontFamily: AppFont.bold, fontSize: 20, color: Brand.color.accent, letterSpacing: -0.3 },
  totalBadge: { backgroundColor: ACCENT + '44', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  totalBadgeText: { fontFamily: AppFont.semiBold, fontSize: 12, color: ACCENT_DARK },

  scroll: { paddingBottom: 80, paddingHorizontal: PAGE },
  divider: { height: 2, backgroundColor: Colors.border, marginTop: 16, marginBottom: 8, marginHorizontal: -PAGE },

  emptyWrap: { alignItems: 'center', gap: 8, paddingVertical: 16 },

  // ── Section blocks
  sectionBlock: { marginBottom: 4 },
  sectionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, paddingBottom: 10 },
  sectionHeader: { fontFamily: AppFont.bold, fontSize: DC.sectionLabelSize, color: DC.sectionLabelColor, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  sectionAddBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: DC.btnBg, borderWidth: DC.btnBorderWidth, borderColor: DC.btnBorder, alignItems: 'center', justifyContent: 'center' },
  sectionAddText:{ fontFamily: AppFont.medium, fontSize: 11, color: ACCENT_DARK },
  actionBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: DC.btnBg, borderWidth: DC.btnBorderWidth, borderColor: DC.btnBorder, shadowColor: DC.btnShadowColor, shadowOffset: DC.btnShadowOffset, shadowOpacity: DC.btnShadowOpacity, shadowRadius: DC.btnShadowRadius, elevation: DC.btnElevation },
  actionBtnText:    { fontFamily: AppFont.bold, fontSize: 13, color: DC.btnText },
  actionBtnDanger:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: DC.btnDangerBg },
  actionBtnDangerText: { fontFamily: AppFont.bold, fontSize: 13, color: DC.btnDangerText },

  // ── List rows
  list:       { gap: 8 },
  recRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  recNum:     { width: 56, fontFamily: AppFont.bold, fontSize: 32, color: '#95D4CF', textAlign: 'center' },
  recRight:   { alignItems: 'flex-end', gap: 2 },
  recStatus:  { fontFamily: AppFont.regular, fontSize: 9, color: '#111111' },
  recMid:     { flex: 1, gap: 2 },
  recName:    { fontFamily: AppFont.bold, fontSize: 14, color: '#111111' },
  recDate:    { fontFamily: AppFont.regular, fontSize: 11, color: '#111111' },
  recAmount:  { fontFamily: AppFont.bold, fontSize: 14, letterSpacing: -0.3, color: '#111111' },

  // ── People chips
  chipWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 12, paddingTop: 4 },
  personChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F8F8F8', borderRadius: Radius.pill, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: '#EFEFEF' },
  personChipText:{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text },

  tagInputWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, padding: 8, minHeight: 44, marginBottom: 12 },
  tagChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: ACCENT + '44', borderRadius: Radius.pill, paddingVertical: 4, paddingLeft: 10, paddingRight: 6 },
  tagChipText:   { fontFamily: AppFont.semiBold, fontSize: 11, color: ACCENT_DARK },
  tagInput:      { fontFamily: AppFont.regular, fontSize: 16, color: Colors.text, minWidth: 120, flex: 1, padding: 2 },
  contactsLabel: { fontFamily: AppFont.semiBold, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' as const, color: Colors.muted, marginBottom: 6 },
  contactRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  contactName:   { fontFamily: AppFont.medium, fontSize: 14, color: Colors.text },

  itemCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  itemEditBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: DC.btnBg, borderWidth: DC.btnBorderWidth, borderColor: DC.btnBorder, shadowColor: DC.btnShadowColor, shadowOffset: DC.btnShadowOffset, shadowOpacity: DC.btnShadowOpacity, shadowRadius: DC.btnShadowRadius, elevation: DC.btnElevation },
  itemEditBtnText:{ fontFamily: AppFont.bold, fontSize: 13, color: DC.btnText },
  itemNum:        { width: 56, fontFamily: AppFont.bold, fontSize: 32, color: '#95D4CF', textAlign: 'center' },
  itemName:       { fontFamily: AppFont.bold, fontSize: 14, color: '#111111' },
  itemSplit:      { fontFamily: AppFont.regular, fontSize: 11, color: '#111111' },
  itemCost:       { fontFamily: AppFont.bold, fontSize: 14, letterSpacing: -0.2, color: '#111111' },
  itemsTotalRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: Colors.surface, borderRadius: 10, marginTop: 4 },
  itemsTotalLabel:{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted },
  itemsTotalDots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: Colors.faint, marginHorizontal: 8 },
  itemsTotalValue:{ fontFamily: AppFont.semiBold, fontSize: 11, color: Colors.text },
  itemFormRow:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
  itemFormInput:  { fontFamily: AppFont.regular, fontSize: 16, color: Colors.text, backgroundColor: Colors.white, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid },
  manualRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.surface },
  manualLeft:     { flex: 1, gap: 4 },
  manualName:     { fontFamily: AppFont.medium, fontSize: 13, color: Colors.text },
  manualHint:     { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted },
  manualInput:    { flex: 0, minWidth: 96, width: 96, textAlign: 'right' },
  manualTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMid },
  manualTotalLabel:{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted },
  manualTotalValue:{ fontFamily: AppFont.semiBold, fontSize: 14, color: Colors.text },

  summaryRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: PAGE, borderWidth: 1, borderColor: Colors.border },
  summaryName:   { fontFamily: AppFont.regular, fontSize: 10, color: Colors.text, flexShrink: 0 },
  summaryDots:   { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: Colors.faint, marginHorizontal: 10 },
  summaryAmount: { fontFamily: AppFont.semiBold, fontSize: 13, color: Colors.text, flexShrink: 0 },


  recPickRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },

  modeBtn:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  modeBtnActive:     { backgroundColor: ACCENT + '44', borderColor: ACCENT },
  modeBtnText:       { fontFamily: AppFont.regular,     fontSize: 12, color: Colors.muted },
  modeBtnTextActive: { color: ACCENT_DARK, fontFamily: AppFont.semiBold },
  doneBtn:           { backgroundColor: DC.btnBg, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 16, borderWidth: DC.btnBorderWidth, borderColor: DC.btnBorder, shadowColor: DC.btnShadowColor, shadowOffset: DC.btnShadowOffset, shadowOpacity: DC.btnShadowOpacity, shadowRadius: DC.btnShadowRadius, elevation: DC.btnElevation },
  doneBtnText:       { fontFamily: AppFont.bold, fontSize: 14, color: DC.btnText },
});
