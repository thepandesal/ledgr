import AddItemModal from './AddItemModal';
import { setPendingFocusDate } from './space-detail';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Dimensions, ScrollView, TextInput, Modal, Platform, Image, Share } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { compressImage, uploadReceiptPhoto } from '../../src/lib/receiptUpload';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import PayModal from '@/components/modals/PayModal';
import CollectModal from '@/components/modals/CollectModal';
import ShareModal from '@/components/modals/ShareModal';
import ReceivableModal from '@/components/modals/ReceivableModal';
import { InfoRow } from '@/components/ui';
import formStyles from '@/components/ui/formStyles';
import pageStyles from '@/components/ui/pageStyles';
import itemStyles from '@/components/ui/itemStyles';
import accountStyles from '@/components/ui/accountStyles';
import { Colors, Fonts, Radius } from '@/components/ui/theme';

const { width } = Dimensions.get('window');
const MAX_NAME_CHARS = 18;
const MAX_ITEM_NAME = 20;

interface Subitem { id: string; name: string; cost: number; people: string[]; }
interface Item { id: string; name: string; cost: number; people: string[]; subitems: Subitem[]; }

export default function RecordingDetailScreen() {
  const { recordingId } = useLocalSearchParams<{ recordingId: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  const [recording, setRecording] = useState<any>(null);
  const [people, setPeople] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [addPersonModal, setAddPersonModal] = useState(false);
  const [addItemModal, setAddItemModal] = useState(false);
  const [editSubitemsItemId, setEditSubitemsItemId] = useState<string | null>(null);
  const [editingItemCost, setEditingItemCost] = useState<{ id: string; value: string } | null>(null);
  const [cookingModal, setCookingModal] = useState(false);
  const [saveImageModal, setSaveImageModal] = useState(false);
  const [shareAccounts, setShareAccounts] = useState<any[]>([]);
  const [shareSelectedAccountIds, setShareSelectedAccountIds] = useState<string[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareRowId, setShareRowId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [addReceiptModal, setAddReceiptModal] = useState(false);
  const [linkedReceipt, setLinkedReceipt] = useState<any>(null);
  const [receiptPhotos, setReceiptPhotos] = useState<{ id: string; url: string }[]>([]);
  const [linkReceiptModal, setLinkReceiptModal] = useState(false);
  const [linkReceiptEntries, setLinkReceiptEntries] = useState<any[]>([]);
  const [captureHtml, setCaptureHtml] = useState<string | null>(null);
  const webviewRef = useRef<any>(null);
  const [copiedToast, setCopiedToast] = useState(false);
  const [tooltip, setTooltip] = useState<{ name: string } | null>(null);
  const [contacts, setContacts] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState<number | null>(null);
  const [deletePersonConfirm, setDeletePersonConfirm] = useState<{ idx: number; name: string; affectedItems: number } | null>(null);
  const [savingPeople, setSavingPeople] = useState(false);
  const [showAllPeopleModal, setShowAllPeopleModal] = useState(false);
  const [savedPeople, setSavedPeople] = useState<string[]>([]);
  const [tagInputVal, setTagInputVal] = useState('');
  const [payModal, setPayModal] = useState(false);
  const [payStep, setPayStep] = useState<'account' | 'mode'>('account');
  const [payMode, setPayMode] = useState<'full' | 'manual' | 'split'>('full');
  const [payManualAmount, setPayManualAmount] = useState('');
  const [paySelectedPeople, setPaySelectedPeople] = useState<string[]>([]);
  const [payAccounts, setPayAccounts] = useState<any[]>([]);
  const [payAccount, setPayAccount] = useState<any>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payComplete, setPayComplete] = useState<boolean | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [linkedPayments, setLinkedPayments] = useState<any[]>([]);
  const [linkedPayable, setLinkedPayable] = useState<any>(null);
  const [payablePerPerson, setPayablePerPerson] = useState<{ map: Record<string, number>; paidFor: string[] }>({ map: {}, paidFor: [] });
  const [personPayStatus, setPersonPayStatus] = useState<{ person: string; paid: number; total: number }[]>([]);
  const [collectModal, setCollectModal] = useState(false);
  const [collectStep, setCollectStep] = useState<'account' | 'mode'>('account');
  const [collectMode, setCollectMode] = useState<'full' | 'manual' | 'split'>('full');
  const [collectManualAmount, setCollectManualAmount] = useState('');
  const [collectSelectedPeople, setCollectSelectedPeople] = useState<string[]>([]);
  const [collectAccounts, setCollectAccounts] = useState<any[]>([]);
  const [collectAccount, setCollectAccount] = useState<any>(null);
  const [collectDate, setCollectDate] = useState(new Date().toISOString().split('T')[0]);
  const [collectComplete, setCollectComplete] = useState<boolean | null>(null);
  const [collectLoading, setCollectLoading] = useState(false);

  // Create receivable from expense
  const [receivableModal, setReceivableModal] = useState(false);
  const [receivableMode, setReceivableMode] = useState<'full' | 'manual' | 'split'>('full');
  const [receivableManualAmount, setReceivableManualAmount] = useState('');
  const [receivableSelectedPeople, setReceivableSelectedPeople] = useState<string[]>([]);
  const [receivableLoading, setReceivableLoading] = useState(false);

  // Add item form state
  const [itemForms, setItemForms] = useState<{ name: string; cost: string; people: string[]; subitemForms: { name: string; people: string[] }[] }[]>([{ name: '', cost: '', people: [], subitemForms: [] }]);
  const addItemForm = () => setItemForms(prev => [...prev, { name: '', cost: '', people: [], subitemForms: [] }]);
  const updateItemForm = (i: number, field: 'name' | 'cost', val: string) =>
    setItemForms(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: val }; return n; });
  const toggleItemFormPerson = (i: number, person: string) =>
    setItemForms(prev => { const n = [...prev]; const p = n[i].people.includes(person) ? n[i].people.filter(x => x !== person) : [...n[i].people, person]; n[i] = { ...n[i], people: p }; return n; });
  const removeItemForm = (i: number) => setItemForms(prev => prev.filter((_, idx) => idx !== i));
  const addSubitemForm = (itemIdx: number) =>
    setItemForms(prev => { const n = [...prev]; n[itemIdx] = { ...n[itemIdx], subitemForms: [...n[itemIdx].subitemForms, { name: '', people: [] }] }; return n; });
  const updateSubitemForm = (itemIdx: number, subIdx: number, field: 'name', val: string) =>
    setItemForms(prev => { const n = [...prev]; const subs = [...n[itemIdx].subitemForms]; subs[subIdx] = { ...subs[subIdx], [field]: val }; n[itemIdx] = { ...n[itemIdx], subitemForms: subs }; return n; });
  const toggleSubitemFormPerson = (itemIdx: number, subIdx: number, person: string) =>
    setItemForms(prev => { const n = [...prev]; const subs = [...n[itemIdx].subitemForms]; const people = subs[subIdx].people.includes(person) ? subs[subIdx].people.filter(p => p !== person) : [...subs[subIdx].people, person]; subs[subIdx] = { ...subs[subIdx], people }; n[itemIdx] = { ...n[itemIdx], subitemForms: subs }; return n; });
  const removeSubitemForm = (itemIdx: number, subIdx: number) =>
    setItemForms(prev => { const n = [...prev]; n[itemIdx] = { ...n[itemIdx], subitemForms: n[itemIdx].subitemForms.filter((_, idx) => idx !== subIdx) }; return n; });

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const confirmDelete = async (keepLinked: boolean, deleteReceipt = false, deletePayable = false) => {
    setDeleteLoading(true);
    try {
      const recordingDate = recording?.transaction_date ?? null;
      if (deleteReceipt && linkedReceipt) {
        const { data: photos } = await supabase.from('receipt_photos').select('storage_path, url').eq('entry_id', linkedReceipt.id);
        if (photos && photos.length > 0) {
          await supabase.storage.from('receipts').remove(photos.map((p: any) => p.storage_path));
          await supabase.from('receipt_photos').delete().eq('entry_id', linkedReceipt.id);
        }
        await supabase.from('receipt_entries').delete().eq('id', linkedReceipt.id);
      }
      await supabase.from('recordings').delete().eq('id', recordingId);
      if (deletePayable && linkedPayable) {
        await supabase.from('recordings').delete().eq('id', linkedPayable.id);
      } else if (!keepLinked && linkedPayable) {
        const revertPaid = Math.max(0, Number(linkedPayable.paid_amount ?? 0) - Number(recording?.amount ?? 0));
        await supabase.from('recordings').update({
          paid_amount: revertPaid,
          status: revertPaid <= 0 ? 'unpaid' : 'partial',
        }).eq('id', linkedPayable.id);
      }
      if (recordingDate) setPendingFocusDate(recordingDate);
      Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => {
        router.back();
      });
    } catch (e) { console.log(e); }
    finally { setDeleteLoading(false); }
  };

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
    loadRecording();
    loadContacts();
    loadPeople();
    loadItems();
    loadLinkedReceipt();
    loadPaymentData();
    // Pre-fetch share row ID so share button is instant
    supabase.from('split_shares').select('id').eq('recording_id', recordingId).maybeSingle()
      .then(({ data }) => { if (data) setShareRowId(data.id); });
  }, []);

  useFocusEffect(useCallback(() => {
    loadRecording();
    loadPaymentData();
  }, [recordingId]));

  const loadPaymentData = async () => {
    if (!recordingId) return;
    const { data: rec } = await supabase.from('recordings').select('type, linked_recording_id').eq('id', recordingId).single();
    if (!rec) return;

    if (rec.type === 'payable' || rec.type === 'receivable') {
      const paymentType = rec.type === 'payable' ? 'expense' : 'return';
      const { data: payments } = await supabase.from('recordings')
        .select('id, name, amount, transaction_date, payment_to, payment_from_account_id, accounts:payment_from_account_id(account_name, bank)')
        .eq('linked_recording_id', recordingId).eq('type', paymentType).order('transaction_date', { ascending: false });
      if (payments) {
        setLinkedPayments(payments);
        // Load breakdowns for all payment records to build per-person status
        const paymentIds = payments.map((p: any) => p.id);
        if (paymentIds.length > 0) {
          const { data: breakdowns } = await supabase.from('recording_breakdowns')
            .select('person, amount, account_id, recording_id').in('recording_id', paymentIds);
          if (breakdowns && breakdowns.length > 0) {
            // Build per-person total paid map
            const paidMap: Record<string, number> = {};
            breakdowns.forEach((b: any) => {
              paidMap[b.person] = (paidMap[b.person] || 0) + Number(b.amount);
            });
            // Get split totals per person
            const { data: splitItems } = await supabase.from('split_items').select('*, split_subitems(*)').eq('recording_id', recordingId);
            const totalMap: Record<string, number> = {};
            (splitItems ?? []).forEach((item: any) => {
              const subs = item.split_subitems ?? [];
              const calc = (people: string[], cost: number) => {
                const pp = people.length > 0 ? cost / people.length : 0;
                people.forEach((p: string) => { totalMap[p] = (totalMap[p] || 0) + pp; });
              };
              if (subs.length === 0) calc(item.people ?? [], Number(item.cost));
              else subs.forEach((s: any) => calc(s.people ?? [], Number(s.cost)));
            });
            const allPeople = [...new Set([...Object.keys(paidMap), ...Object.keys(totalMap)])];
            setPersonPayStatus(allPeople.map(person => ({
              person,
              paid: paidMap[person] ?? 0,
              total: totalMap[person] ?? 0,
            })));
          } else {
            setPersonPayStatus([]);
          }
        }
      }
    } else if ((rec.type === 'expense' || rec.type === 'return') && rec.linked_recording_id) {
      const { data: payable } = await supabase.from('recordings').select('id, name, amount, status, paid_amount').eq('id', rec.linked_recording_id).single();
      if (payable) setLinkedPayable(payable);
      const { data: rec2 } = await supabase.from('recordings').select('payment_to').eq('id', recordingId).single();
      const paidFor: string[] = rec2?.payment_to ? rec2.payment_to.split(', ').map((s: string) => s.trim()) : [];
      const { data: splitItems } = await supabase.from('split_items').select('*, split_subitems(*)').eq('recording_id', rec.linked_recording_id);
      if (splitItems) {
        const perPersonMap: Record<string, number> = {};
        splitItems.forEach((item: any) => {
          const subs = item.split_subitems ?? [];
          if (subs.length === 0) {
            const pp = (item.people ?? []).length > 0 ? Number(item.cost) / item.people.length : 0;
            (item.people ?? []).forEach((p: string) => { perPersonMap[p] = (perPersonMap[p] || 0) + pp; });
          } else {
            subs.forEach((sub: any) => {
              const pp = (sub.people ?? []).length > 0 ? Number(sub.cost) / sub.people.length : 0;
              (sub.people ?? []).forEach((p: string) => { perPersonMap[p] = (perPersonMap[p] || 0) + pp; });
            });
          }
        });
        setPayablePerPerson({ map: perPersonMap, paidFor });
      }
    }
  };

  const openCollectModal = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: accs } = await supabase.from('accounts').select().eq('user_id', user.id).order('account_name');
    if (accs) setCollectAccounts(accs);
    const defaultAcc = accs?.find((a: any) => a.id === recording?.receive_to_account_id) ?? accs?.find((a: any) => a.id === recording?.account_id) ?? accs?.[0] ?? null;
    setCollectAccount(defaultAcc);
    setCollectStep('account');
    setCollectMode('full');
    setCollectManualAmount('');
    setCollectSelectedPeople([]);
    setCollectDate(new Date().toISOString().split('T')[0]);
    setCollectComplete(null);
    setCollectModal(true);
  };

  const getCollectAmount = () => {
    if (collectMode === 'full') return Number(recording?.amount ?? 0);
    if (collectMode === 'manual') return parseFloat(collectManualAmount || '0') || 0;
    if (collectMode === 'split') {
      const perPersonMap: Record<string, number> = {};
      items.forEach(item => {
        if (item.subitems.length === 0) {
          const pp = item.people.length > 0 ? item.cost / item.people.length : 0;
          item.people.forEach(p => { perPersonMap[p] = (perPersonMap[p] || 0) + pp; });
        } else {
          item.subitems.forEach(sub => {
            const pp = sub.people.length > 0 ? sub.cost / sub.people.length : 0;
            sub.people.forEach(p => { perPersonMap[p] = (perPersonMap[p] || 0) + pp; });
          });
        }
      });
      return collectSelectedPeople.reduce((s, name) => s + (perPersonMap[name] ?? 0), 0);
    }
    return 0;
  };

  const confirmCollect = async () => {
    if (collectComplete === null || !recording) return;
    const amount = getCollectAmount();
    if (!amount || amount <= 0) return;
    setCollectLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Build per-person split breakdown if split mode
      const perPersonMap: Record<string, number> = {};
      if (collectMode === 'split') {
        items.forEach(item => {
          const calc = (people: string[], cost: number) => {
            const pp = people.length > 0 ? cost / people.length : 0;
            people.forEach(p => { perPersonMap[p] = (perPersonMap[p] || 0) + pp; });
          };
          if (item.subitems.length === 0) calc(item.people, item.cost);
          else item.subitems.forEach((s: any) => calc(s.people, s.cost));
        });
      }

      const { data: newRec } = await supabase.from('recordings').insert({
        space_id: recording.space_id,
        user_id: user.id,
        name: recording.name,
        type: 'return',
        amount,
        transaction_date: collectDate,
        status: 'received',
        account_id: collectAccount?.id ?? recording.account_id,
        payment_from_account_id: collectAccount?.id ?? recording.account_id,
        linked_recording_id: recordingId,
        category_id: recording.category_id ?? null,
        payment_to: collectMode === 'split' && collectSelectedPeople.length > 0 ? collectSelectedPeople.join(', ') : null,
      }).select('id').single();

      // Insert breakdowns for split mode
      if (newRec?.id && collectMode === 'split' && collectSelectedPeople.length > 0) {
        await supabase.from('recording_breakdowns').insert(
          collectSelectedPeople.map(person => ({
            recording_id: newRec.id,
            person,
            amount: perPersonMap[person] ?? 0,
            account_id: collectAccount?.id ?? null,
          }))
        );
      }

      const prevPaid = Number(recording.paid_amount ?? 0);
      const newPaid = prevPaid + amount;
      await supabase.from('recordings').update({
        status: collectComplete ? 'received' : 'partial',
        paid_amount: newPaid,
      }).eq('id', recordingId);
      setRecording((prev: any) => ({ ...prev, status: collectComplete ? 'received' : 'partial', paid_amount: newPaid }));
      setCollectModal(false);
      loadPaymentData();
    } catch (e) { console.log(e); }
    finally { setCollectLoading(false); }
  };

  const openPayModal = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: accs } = await supabase.from('accounts').select().eq('user_id', user.id).order('account_name');
    if (accs) setPayAccounts(accs);
    const defaultAcc = accs?.find((a: any) => a.id === recording?.account_id) ?? accs?.[0] ?? null;
    setPayAccount(defaultAcc);
    setPayStep('account');
    setPayMode('full');
    setPayManualAmount('');
    setPaySelectedPeople([]);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayComplete(null);
    setPayModal(true);
  };

  const getPayAmount = () => {
    if (payMode === 'full') return Number(recording?.amount ?? 0);
    if (payMode === 'manual') return parseFloat(payManualAmount || '0') || 0;
    if (payMode === 'split') {
      const perPersonMap: Record<string, number> = {};
      items.forEach(item => {
        if (item.subitems.length === 0) {
          const pp = item.people.length > 0 ? item.cost / item.people.length : 0;
          item.people.forEach(p => { perPersonMap[p] = (perPersonMap[p] || 0) + pp; });
        } else {
          item.subitems.forEach(sub => {
            const pp = sub.people.length > 0 ? sub.cost / sub.people.length : 0;
            sub.people.forEach(p => { perPersonMap[p] = (perPersonMap[p] || 0) + pp; });
          });
        }
      });
      return paySelectedPeople.reduce((s, name) => s + (perPersonMap[name] ?? 0), 0);
    }
    return 0;
  };

  const confirmPayment = async () => {
    if (payComplete === null || !recording) return;
    const amount = getPayAmount();
    if (!amount || amount <= 0) return;
    setPayLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const perPersonMap: Record<string, number> = {};
      if (payMode === 'split') {
        items.forEach(item => {
          const calc = (people: string[], cost: number) => {
            const pp = people.length > 0 ? cost / people.length : 0;
            people.forEach(p => { perPersonMap[p] = (perPersonMap[p] || 0) + pp; });
          };
          if (item.subitems.length === 0) calc(item.people, item.cost);
          else item.subitems.forEach((s: any) => calc(s.people, s.cost));
        });
      }

      const { data: newRec } = await supabase.from('recordings').insert({
        space_id: recording.space_id,
        user_id: user.id,
        name: recording.name,
        type: 'expense',
        amount,
        transaction_date: payDate,
        status: 'paid',
        account_id: payAccount?.id ?? recording.account_id,
        payment_from_account_id: payAccount?.id ?? recording.account_id,
        linked_recording_id: recordingId,
        category_id: recording.category_id ?? null,
        payment_to: payMode === 'split' && paySelectedPeople.length > 0 ? paySelectedPeople.join(', ') : null,
      }).select('id').single();

      if (newRec?.id && payMode === 'split' && paySelectedPeople.length > 0) {
        await supabase.from('recording_breakdowns').insert(
          paySelectedPeople.map(person => ({
            recording_id: newRec.id,
            person,
            amount: perPersonMap[person] ?? 0,
            account_id: payAccount?.id ?? null,
          }))
        );
      }

      const prevPaid = Number(recording.paid_amount ?? 0);
      const newPaid = prevPaid + amount;
      await supabase.from('recordings').update({
        status: payComplete ? 'paid' : 'partial',
        paid_amount: newPaid,
      }).eq('id', recordingId);
      setRecording((prev: any) => ({ ...prev, status: payComplete ? 'paid' : 'partial', paid_amount: newPaid }));
      setPayModal(false);
      loadPaymentData();
    } catch (e) { console.log(e); }
    finally { setPayLoading(false); }
  };

  const getReceivableAmount = () => {
    if (receivableMode === 'full') return Number(recording?.amount ?? 0);
    if (receivableMode === 'manual') return parseFloat(receivableManualAmount || '0') || 0;
    if (receivableMode === 'split') {
      const map: Record<string, number> = {};
      items.forEach(item => {
        const calc = (people: string[], cost: number) => {
          const pp = people.length > 0 ? cost / people.length : 0;
          people.forEach(p => { map[p] = (map[p] || 0) + pp; });
        };
        if (item.subitems.length === 0) calc(item.people, item.cost);
        else item.subitems.forEach(s => calc(s.people, s.cost));
      });
      return receivableSelectedPeople.reduce((s, p) => s + (map[p] ?? 0), 0);
    }
    return 0;
  };

  const confirmCreateReceivable = async () => {
    if (!recording) return;
    const amount = getReceivableAmount();
    if (!amount || amount <= 0) return;
    setReceivableLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const personLabel = receivableMode === 'split' && receivableSelectedPeople.length > 0
        ? receivableSelectedPeople.join(', ') : null;
      const { data: newRec } = await supabase.from('recordings').insert({
        space_id: recording.space_id,
        user_id: user.id,
        name: recording.name,
        type: 'receivable',
        amount,
        transaction_date: recording.transaction_date,
        status: 'pending',
        account_id: recording.account_id ?? null,
        category_id: recording.category_id ?? null,
        linked_recording_id: recordingId,
      }).select('id').single();
      setReceivableModal(false);
      setReceivableMode('full');
      setReceivableManualAmount('');
      setReceivableSelectedPeople([]);
      if (newRec?.id) router.push({ pathname: '/(app)/recording-detail', params: { recordingId: newRec.id } } as any);
    } catch (e) { console.log(e); }
    finally { setReceivableLoading(false); }
  };

  const loadExistingShare = async () => {
    // no-op: share data is now fetched live on the share page
  };

  const addReceiptFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      let entryId = linkedReceipt?.id;
      if (!entryId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const note = recording?.transaction_date && recording?.name
          ? `${new Date(recording.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${recording.name}`
          : recording?.name ?? '';
        const { data: entry } = await supabase.from('receipt_entries').insert({ user_id: user.id, note, recording_id: recordingId }).select().single();
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const note = recording?.transaction_date && recording?.name
          ? `${new Date(recording.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${recording.name}`
          : recording?.name ?? '';
        const { data: entry } = await supabase.from('receipt_entries').insert({ user_id: user.id, note, recording_id: recordingId }).select().single();
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

  const loadLinkedReceipt = async () => {
    if (!recordingId) return;
    const { data: entry } = await supabase.from('receipt_entries').select('id, note, created_at').eq('recording_id', recordingId).single();
    if (!entry) return;
    setLinkedReceipt(entry);
    const { data: photos } = await supabase.from('receipt_photos').select('id, storage_path, url').eq('entry_id', entry.id).order('created_at').limit(5);
    if (photos) {
      const urls = photos.map((p: any) => ({ id: p.id, url: p.url ?? '' }));
      setReceiptPhotos(urls.filter(u => u.url));
    }
  };

  const openLinkReceiptModal = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('receipt_entries').select('id, note, created_at').eq('user_id', user.id).is('recording_id', null).order('created_at', { ascending: false });
    setLinkReceiptEntries(data ?? []);
    setLinkReceiptModal(true);
  };

  const linkReceiptToRecording = async (entry: any) => {
    await supabase.from('receipt_entries').update({ recording_id: recordingId }).eq('id', entry.id);
    setLinkedReceipt(entry);
    setLinkReceiptModal(false);
    loadLinkedReceipt();
  };

  const loadRecording = async () => {
    if (!recordingId) return;
    const { data } = await supabase.from('recordings')
      .select('*, categories:category_id(name, color, icon), account:account_id(account_name, bank)')
      .eq('id', recordingId).single();
    if (data) setRecording(data);
  };

  const loadPeople = async () => {
    if (!recordingId) return;
    const { data } = await supabase.from('bill_splits')
      .select('person_name').eq('recording_id', recordingId).order('created_at');
    if (data && data.length > 0) {
      const loaded = data.map((r: any) => r.person_name);
      setPeople(loaded);
      setSavedPeople(loaded);
      setItems(prev => { checkStale(loaded, prev); return prev; });
    }
  };

  const loadItems = async () => {
    if (!recordingId) return;
    const { data } = await supabase.from('split_items')
      .select('*').eq('recording_id', recordingId).order('created_at');
    if (!data) return;
    const itemIds = data.map((r: any) => r.id);
    let subitems: any[] = [];
    if (itemIds.length > 0) {
      const { data: sd } = await supabase.from('split_subitems')
        .select('*').in('item_id', itemIds).order('created_at');
      if (sd) subitems = sd;
    }
    setItems(data.map((r: any) => ({
      id: r.id,
      name: r.name,
      cost: Number(r.cost),
      people: Array.isArray(r.people) ? r.people : [],
      subitems: subitems
        .filter((s: any) => s.item_id === r.id)
        .map((s: any) => ({ id: s.id, name: s.name, cost: Number(s.cost), people: Array.isArray(s.people) ? s.people : [] })),
    })));
  };

  const loadContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('contacts').select('name').eq('user_id', user.id).order('name');
    if (data) setContacts(data.map((c: any) => c.name));
  };

  const saveContact = async (name: string) => {
    if (!name.trim() || contacts.includes(name.trim())) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('contacts').insert({ user_id: user.id, name: name.trim() });
    setContacts(prev => [...prev, name.trim()].sort());
  };

  const openSaveImage = async () => {
    setSaveImageModal(true);
    // Pre-fetch accounts
    if (shareAccounts.length === 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: accs } = await supabase.from('accounts').select().eq('user_id', user.id).order('account_name');
      if (accs) setShareAccounts(accs);
    }
    // Always load the share row and previously selected accounts
    const { data: existing } = await supabase.from('split_shares').select('id, data').eq('recording_id', recordingId).maybeSingle();
    if (existing?.id) {
      setShareRowId(existing.id);
      setShareSelectedAccountIds(existing.data?.account_ids ?? []);
    } else {
      const { data: inserted } = await supabase.from('split_shares').insert({ recording_id: recordingId, data: {} }).select('id').single();
      if (inserted?.id) { setShareRowId(inserted.id); setShareSelectedAccountIds([]); }
    }
  };

  const buildShareData = () => {
    const perPersonMap: Record<string, number> = {};
    items.forEach(item => {
      if (item.subitems.length === 0) {
        // no subitems — split equally among item.people
        const pp = item.people.length > 0 ? item.cost / item.people.length : 0;
        item.people.forEach(p => { perPersonMap[p] = (perPersonMap[p] || 0) + pp; });
      } else {
        item.subitems.forEach(sub => {
          const pp = sub.people.length > 0 ? sub.cost / sub.people.length : 0;
          sub.people.forEach(p => { perPersonMap[p] = (perPersonMap[p] || 0) + pp; });
        });
      }
    });
    return {
      recordingName: recording?.name ?? '',
      recordingAmount: Number(recording?.amount ?? 0),
      recordingType: recording?.type ?? '',
      date: recording?.transaction_date ? new Date(recording.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
      perPerson: Object.entries(perPersonMap).map(([name, total]) => ({ name, total })),
      items: items.map(item => ({ name: item.name, cost: item.cost, people: item.people ?? [], subitems: item.subitems.map(s => ({ name: s.name, cost: s.cost, people: s.people })) })),
      payment: shareAccounts.filter(a => shareSelectedAccountIds.includes(a.id)).map(a => ({ accountName: a.account_name, bank: a.bank, accountNumber: a.account_number, qrCode: a.qr_code ?? null })),
      receiptId: linkedReceipt?.id ?? null,
    };
  };

  const buildHtml = (data: ReturnType<typeof buildShareData>) => {
    const amtColor = data.recordingType === 'expense' ? '#ed6a6a' : data.recordingType === 'income' ? '#2ab671' : '#425252';
    const perPersonRows = data.perPerson.map(p =>
      `<tr><td style="font-family:monospace;font-size:13px;color:#425252;padding:8px 0;border-bottom:1px dotted #ccc">${p.name}</td><td style="font-family:monospace;font-size:13px;font-weight:bold;color:#425252;text-align:right;padding:8px 0;border-bottom:1px dotted #ccc">${p.total.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>`
    ).join('');
    const itemsHtml = data.items.map(item => `
      <div style="background:#fafafa;border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid #f0f0f0">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <span style="font-family:monospace;font-weight:bold;font-size:13px;color:#425252">${item.name}</span>
          <span style="font-family:monospace;font-size:12px;color:#929090">${item.cost.toLocaleString('en-US',{minimumFractionDigits:2})}</span>
        </div>
        ${item.subitems.map(sub => {
          const pp = sub.people.length > 0 ? sub.cost / sub.people.length : sub.cost;
          return `<div style="display:flex;gap:8px;margin-bottom:8px">
            <span style="color:#c0c0c0">↳</span>
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between">
                <span style="font-family:monospace;font-weight:bold;font-size:11px;color:#425252">${sub.name}</span>
                <span style="font-family:monospace;font-size:11px;color:#929090">${sub.cost.toLocaleString('en-US',{minimumFractionDigits:2})}</span>
              </div>
              <div style="font-family:monospace;font-size:10px;color:#929090">${sub.people.length} ${sub.people.length===1?'person':'people'} · ${pp.toLocaleString('en-US',{minimumFractionDigits:2})} each</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${sub.people.map(p=>`<span style="background:#f0f0f0;border-radius:99px;padding:2px 8px;font-family:monospace;font-size:10px;color:#425252">${p}</span>`).join('')}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `).join('');
    const paymentHtml = data.payment ? `
      <h3 style="font-size:14px;color:#7fd8cd;margin:24px 0 10px">payment information</h3>
      <div style="background:#fafafa;border-radius:12px;padding:14px;border:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:15px;font-weight:600;color:#425252">${data.payment.accountName}</div>
          <div style="font-family:monospace;font-size:11px;color:#929090">${data.payment.bank}</div>
          <div style="font-family:monospace;font-weight:bold;font-size:13px;color:#425252">${data.payment.accountNumber}</div>
        </div>
        ${data.payment.qrCode ? `<img src="${data.payment.qrCode}" width="80" height="80" style="border-radius:8px"/>` : ''}
      </div>
    ` : '';
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:24px;background:#fff;font-family:sans-serif}*{box-sizing:border-box}</style></head><body>
      <div style="font-size:18px;color:#7fd8cd;margin-bottom:8px;font-weight:900;letter-spacing:-0.5px">LEDGR</div>
      <div style="font-size:24px;color:#425252;font-weight:600;margin-bottom:4px">${data.recordingName}</div>
      <div style="font-family:monospace;font-size:20px;color:${amtColor};margin-bottom:2px">${data.recordingAmount.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
      <div style="font-family:monospace;font-size:11px;color:#929090;margin-bottom:24px">${data.date}</div>
      <h3 style="font-size:14px;color:#7fd8cd;margin:0 0 10px">per person pay</h3>
      <div style="background:#fafafa;border-radius:12px;padding:8px 16px;border:1px solid #f0f0f0;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">${perPersonRows}</table>
      </div>
      <h3 style="font-size:14px;color:#7fd8cd;margin:0 0 10px">item information</h3>
      ${itemsHtml}
      ${paymentHtml}
      <div style="font-family:monospace;font-size:10px;color:#c0c0c0;text-align:center;margin-top:24px">generated by LEDGR</div>
    </body></html>`;
  };

  const generateShare = async () => {
    if (!shareRowId) return;
    // Upsert selected accounts into split_shares.data
    await supabase.from('split_shares').update({ data: { account_ids: shareSelectedAccountIds } }).eq('id', shareRowId);
    const shareUrl = `https://ledgr.art/split/${shareRowId}`;
    if (Platform.OS !== 'web') {
      Share.share({ message: shareUrl, url: shareUrl });
      setSaveImageModal(false);
    } else if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: recording?.name ?? 'split bill', url: shareUrl }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 3000);
      }).catch(() => {
        if (typeof window !== 'undefined') window.prompt('Copy this link:', shareUrl);
      });
    } else if (typeof window !== 'undefined') {
      window.prompt('Copy this link:', shareUrl);
    }
  };

  const saveAsImage = async () => {
    if (!recording || Platform.OS === 'web') {
      // Web fallback: generate link instead
      await generateShare();
      return;
    }
    setShareLoading(true);
    const html = buildHtml(buildShareData());
    const captureHtmlWithScript = html.replace(
      '</body>',
      `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
      <script>
        window.onload = function() {
          html2canvas(document.body, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(function(canvas) {
            var dataUrl = canvas.toDataURL('image/png');
            window.ReactNativeWebView.postMessage(dataUrl);
          });
        };
      </script></body>`
    );
    setCaptureHtml(captureHtmlWithScript);
  };

  const handleWebViewMessage = async (event: any) => {
    if (Platform.OS === 'web') return;
    const dataUrl = event.nativeEvent.data;
    if (!dataUrl.startsWith('data:image/png')) return;
    setCaptureHtml(null);
    try {
      const FileSystem = require('expo-file-system');
      const MediaLibrary = require('expo-media-library');
      const Sharing = require('expo-sharing');
      const base64 = dataUrl.replace('data:image/png;base64,', '');
      const fileUri = `${FileSystem.cacheDirectory}split_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(fileUri);
        setSaveImageModal(false);
        alert('Image saved to your camera roll!');
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Save split image' });
        setSaveImageModal(false);
      }
    } catch (e) { console.log(e); }
    finally { setShareLoading(false); }
  };

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  const openPeopleModal = () => {
    setSavedPeople([...people]);
    setTagInputVal('');
    setSuggestions([]);
    setAddPersonModal(true);
  };
  const addPerson = () => setPeople(prev => [...prev, '']);
  const updatePerson = (i: number, val: string) => {
    setPeople(prev => { const n = [...prev]; n[i] = val; return n; });
    setActiveSuggestionIdx(i);
    setSuggestions(val.trim() ? contacts.filter(c => c.toLowerCase().startsWith(val.toLowerCase()) && !people.includes(c)) : []);
  };
  const removePerson = (i: number) => setPeople(prev => prev.filter((_, idx) => idx !== i));

  const requestDeletePerson = (i: number) => {
    const name = people[i]?.trim();
    if (!name) { removePerson(i); return; }
    const affectedItems = items.reduce((count, item) =>
      count + item.subitems.filter(s => s.people.includes(name)).length, 0);
    if (affectedItems === 0) { removePerson(i); return; }
    setDeletePersonConfirm({ idx: i, name, affectedItems });
  };

  const confirmDeletePerson = () => {
    if (!deletePersonConfirm) return;
    const name = deletePersonConfirm.name;
    setItems(prev => prev.map(item => ({
      ...item,
      subitems: item.subitems.map(s => ({ ...s, people: s.people.filter(p => p !== name) }))
    })));
    removePerson(deletePersonConfirm.idx);
    setDeletePersonConfirm(null);
  };
  const pickSuggestion = (i: number, name: string) => {
    setPeople(prev => { const n = [...prev]; n[i] = name; return n; });
    setSuggestions([]);
    setActiveSuggestionIdx(null);
  };
  const savePeopleAndClose = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !recordingId) return;
    // Add any pending tag input value
    const pending = tagInputVal.trim();
    const filled = [...new Set([...people.filter(p => p.trim()), ...(pending ? [pending] : [])])];
    setSavingPeople(true);
    await supabase.from('bill_splits').delete().eq('recording_id', recordingId);
    if (filled.length > 0) {
      await supabase.from('bill_splits').insert(
        filled.map(name => ({ recording_id: recordingId, user_id: user.id, person_name: name }))
      );
    }
    for (const p of filled) await saveContact(p);
    setPeople(filled);
    setSavedPeople(filled);
    setTagInputVal('');
    setSavingPeople(false);
    setAddPersonModal(false);
    setSuggestions([]);
    checkStale(filled, items);
  };

  const filledPeople = people.filter(p => p.trim());

  const saveItem = async () => {
    const valid = itemForms.filter(f => f.name.trim() && f.cost);
    if (valid.length === 0) return;
    const currentTotal = items.reduce((s, i) => s + i.cost, 0);
    const newTotal = currentTotal + valid.reduce((s, f) => s + parseFloat(f.cost || '0'), 0);
    const recAmt = recording ? Number(recording.amount) : 0;
    if (recAmt > 0 && newTotal > recAmt + 0.01) {
      alert(`Total items (${newTotal.toFixed(2)}) would exceed recording amount (${recAmt.toFixed(2)})`);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !recordingId) return;
    const { data, error } = await supabase.from('split_items').insert(
      valid.map(f => ({ recording_id: recordingId, user_id: user.id, name: f.name.trim(), cost: parseFloat(f.cost), people: f.people }))
    ).select();
    if (!error && data) {
      // for each saved item, save its subitems with auto-equal cost
      const newItems: Item[] = [];
      for (let i = 0; i < data.length; i++) {
        const savedItem = data[i];
        const form = valid[i];
        const filledSubs = form.subitemForms.filter(s => s.name.trim());
        let subitems: Subitem[] = [];
        if (filledSubs.length > 0) {
          const equalCost = parseFloat(form.cost) / filledSubs.length;
          const { data: subData } = await supabase.from('split_subitems').insert(
            filledSubs.map(s => ({ item_id: savedItem.id, name: s.name.trim(), cost: equalCost, people: s.people }))
          ).select();
          if (subData) subitems = subData.map((s: any) => ({ id: s.id, name: s.name, cost: Number(s.cost), people: s.people }));
        }
        newItems.push({ id: savedItem.id, name: savedItem.name, cost: Number(savedItem.cost), people: savedItem.people ?? [], subitems });
      }
        setItems(prev => {
        const next = [...prev, ...newItems];
        checkStale(people, next);
        return next;
      });
    }
    setItemForms([{ name: '', cost: '', people: [], subitemForms: [] }]);
    setAddItemModal(false);
  };

  // subitem forms for editing existing item
  const [editSubitemForms, setEditSubitemForms] = useState<{ name: string; people: string[] }[]>([{ name: '', people: [] }]);
  const addEditSubitemForm = () => setEditSubitemForms(prev => [...prev, { name: '', people: [] }]);
  const updateEditSubitemForm = (i: number, val: string) => setEditSubitemForms(prev => { const n = [...prev]; n[i] = { ...n[i], name: val }; return n; });
  const toggleEditSubitemPerson = (i: number, person: string) => setEditSubitemForms(prev => { const n = [...prev]; const p = n[i].people.includes(person) ? n[i].people.filter(x => x !== person) : [...n[i].people, person]; n[i] = { ...n[i], people: p }; return n; });
  const removeEditSubitemForm = (i: number) => setEditSubitemForms(prev => prev.filter((_, idx) => idx !== i));

  const openEditSubitems = (item: Item) => {
    setEditSubitemsItemId(item.id);
    setEditSubitemForms([{ name: '', people: [] }]);
  };

  const saveEditSubitems = async () => {
    if (!editSubitemsItemId) return;
    const item = items.find(i => i.id === editSubitemsItemId);
    if (!item) return;
    const filled = editSubitemForms.filter(s => s.name.trim());
    if (filled.length === 0) { setEditSubitemsItemId(null); return; }
    const allSubs = [...item.subitems, ...filled.map(s => ({ id: '', name: s.name, cost: 0, people: s.people }))];
    const equalCost = item.cost / allSubs.length;
    // update existing subitem costs
    await Promise.all(item.subitems.map(s => supabase.from('split_subitems').update({ cost: equalCost }).eq('id', s.id)));
    // insert new subitems
    const { data } = await supabase.from('split_subitems').insert(
      filled.map(s => ({ item_id: editSubitemsItemId, name: s.name.trim(), cost: equalCost, people: s.people }))
    ).select();
    const newSubs: Subitem[] = data ? data.map((s: any) => ({ id: s.id, name: s.name, cost: equalCost, people: s.people })) : [];
    setItems(prev => prev.map(i => i.id === editSubitemsItemId
      ? { ...i, subitems: [...i.subitems.map(s => ({ ...s, cost: equalCost })), ...newSubs] }
      : i
    ));
    setEditSubitemsItemId(null);
  };

  const checkStale = (currentPeople: string[], currentItems: Item[]) => {
    // no-op: stale tracking removed, share page fetches live
  };

  const deleteItem = async (id: string) => {
    await supabase.from('split_items').delete().eq('id', id);
    setItems(prev => {
      const next = prev.filter(item => item.id !== id);
      checkStale(people, next);
      return next;
    });
  };

  const deleteSubitem = async (itemId: string, subitemId: string) => {
    await supabase.from('split_subitems').delete().eq('id', subitemId);
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const remaining = item.subitems.filter(s => s.id !== subitemId);
    if (remaining.length > 0) {
      const equalCost = item.cost / remaining.length;
      await Promise.all(remaining.map(s => supabase.from('split_subitems').update({ cost: equalCost }).eq('id', s.id)));
      setItems(prev => prev.map(i => i.id === itemId
        ? { ...i, subitems: remaining.map(s => ({ ...s, cost: equalCost })) }
        : i
      ));
    } else {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, subitems: [] } : i));
    }
  };

  const updateItemCost = async (itemId: string, newCost: number) => {
    if (isNaN(newCost) || newCost <= 0) return;
    await supabase.from('split_items').update({ cost: newCost }).eq('id', itemId);
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    // Redistribute subitem costs equally if subitems exist
    if (item.subitems.length > 0) {
      const equalCost = newCost / item.subitems.length;
      await Promise.all(item.subitems.map(s => supabase.from('split_subitems').update({ cost: equalCost }).eq('id', s.id)));
      setItems(prev => prev.map(i => i.id === itemId
        ? { ...i, cost: newCost, subitems: i.subitems.map(s => ({ ...s, cost: equalCost })) }
        : i
      ));
    } else {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, cost: newCost } : i));
    }
    setEditingItemCost(null);
  };

const truncate = (str: string, max: number) => str && str.length > max ? str.slice(0, max) + '...' : str;

  const amountColor = () => {
    if (!recording) return Colors.muted;
    if (recording.type === 'expense') return Colors.expense;
    if (recording.type === 'income' || recording.type === 'savings' || recording.type === 'return') return Colors.income;
    return Colors.text;
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const typeLabel = (type: string, status: string) => {
    if (type === 'payable') return `Payable · ${status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid'}`;
    if (type === 'receivable') return `Receivable · ${status === 'received' ? 'Received' : status === 'partial' ? 'Partial' : 'Pending'}`;
    if (type === 'return') return 'Return';
    return { expense: 'Expense', income: 'Income', savings: 'Savings' }[type] ?? type;
  };

  const isPayableLocked = recording?.type === 'payable' && (recording?.status === 'partial' || recording?.status === 'paid');
  const isReceivableLocked = recording?.type === 'receivable' && (recording?.status === 'partial' || recording?.status === 'received');
  const isSplitLocked = isPayableLocked || isReceivableLocked;

  const PREVIEW_LIMIT = 4;
  const visiblePeople = filledPeople.slice(0, PREVIEW_LIMIT);
  const extraCount = filledPeople.length - PREVIEW_LIMIT;

  return (
    <Animated.View style={[pageStyles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={pageStyles.inner}>
        <TouchableOpacity onPress={handleBack} style={pageStyles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.muted} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={pageStyles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={pageStyles.titleBlock}>
            <Text style={{ fontFamily: 'ChillaxRegular', fontSize: 11, color: Colors.muted, marginBottom: 2 }}>recordings</Text>
            <View style={pageStyles.titleRow}>
              <Text style={{ fontFamily: 'ChillaxMedium', fontSize: 24, color: Colors.text, flex: 1 }} numberOfLines={1} ellipsizeMode="tail">
                {truncate(recording?.name ?? '', MAX_NAME_CHARS).toLowerCase()}
              </Text>
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 22, color: amountColor(), flexShrink: 0 }}>
                {recording ? Number(recording.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
              </Text>
            </View>
            <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginTop: 4 }}>
              {formatDate(recording?.transaction_date)} · {typeLabel(recording?.type ?? '', recording?.status ?? '')}
            </Text>
          </View>
          </View>

          {/* Action buttons */}
          <View style={[pageStyles.actionRow, { marginBottom: 8 }]}>
            <TouchableOpacity
              style={pageStyles.actionBtn}
              onPress={() => {
                if (linkedReceipt) {
                  router.push({ pathname: '/(app)/receipt-detail', params: { receiptId: linkedReceipt.id } } as any);
                } else {
                  setAddReceiptModal(true);
                }
              }}
            >
              <Ionicons name="receipt-outline" size={15} color={Colors.text} />
              <Text style={pageStyles.actionBtnText}>{linkedReceipt ? 'view receipt' : 'add receipt'}</Text>
            </TouchableOpacity>
            {!linkedReceipt && (
              <TouchableOpacity style={pageStyles.actionBtn} onPress={openLinkReceiptModal}>
                <Ionicons name="link-outline" size={15} color={Colors.text} />
                <Text style={pageStyles.actionBtnText}>link receipt</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={pageStyles.actionRow}>
            {recording?.type === 'expense' && (
              <TouchableOpacity style={pageStyles.actionBtn} onPress={() => {
                setReceivableMode('full');
                setReceivableManualAmount('');
                setReceivableSelectedPeople([]);
                setReceivableModal(true);
              }}>
                <Ionicons name="arrow-undo-outline" size={15} color={Colors.text} />
                <Text style={pageStyles.actionBtnText}>create receivable</Text>
              </TouchableOpacity>
            )}
            {recording?.type === 'payable' && recording?.status !== 'paid' && (
              <TouchableOpacity style={pageStyles.actionBtn} onPress={openPayModal}>
                <Ionicons name="cash-outline" size={15} color={Colors.text} />
                <Text style={pageStyles.actionBtnText}>pay bill</Text>
              </TouchableOpacity>
            )}
            {recording?.type === 'payable' && recording?.status === 'paid' && (
              <View style={[pageStyles.actionBtn, pageStyles.actionBtnSuccess]}>
                <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                <Text style={[pageStyles.actionBtnText, { color: Colors.success }]}>fully paid</Text>
              </View>
            )}
            {recording?.type === 'receivable' && recording?.status !== 'received' && (
              <TouchableOpacity style={pageStyles.actionBtn} onPress={openCollectModal}>
                <Ionicons name="arrow-down-circle-outline" size={15} color={Colors.text} />
                <Text style={pageStyles.actionBtnText}>collect</Text>
              </TouchableOpacity>
            )}
            {recording?.type === 'receivable' && recording?.status === 'received' && (
              <View style={[pageStyles.actionBtn, pageStyles.actionBtnSuccess]}>
                <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                <Text style={[pageStyles.actionBtnText, { color: Colors.success }]}>fully received</Text>
              </View>
            )}
            <TouchableOpacity style={[pageStyles.actionBtn, pageStyles.actionBtnDanger]} onPress={() => setDeleteConfirm(true)}>
              <Ionicons name="trash-outline" size={15} color={Colors.danger} />
              <Text style={[pageStyles.actionBtnText, { color: Colors.danger }]}>delete</Text>
            </TouchableOpacity>
          </View>

          {/* Receipt strip */}
          {linkedReceipt && (
            <View style={accountStyles.receiptStrip}>
              <View style={accountStyles.receiptStripHeader}>
                <Text style={accountStyles.receiptStripLabel}>receipt</Text>
                <TouchableOpacity onPress={async () => {
                  await supabase.from('receipt_entries').update({ recording_id: null }).eq('id', linkedReceipt.id);
                  setLinkedReceipt(null); setReceiptPhotos([]);
                }}>
                  <Text style={accountStyles.receiptUnlink}>unlink</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {receiptPhotos.map(p => (
                  <TouchableOpacity key={p.id} onPress={() => router.push({ pathname: '/(app)/receipt-detail', params: { receiptId: linkedReceipt.id } } as any)}>
                    <Image source={{ uri: p.url }} style={accountStyles.receiptThumb} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Information */}
          <Text style={[pageStyles.sectionHeader, { fontFamily: Fonts.calSans }]}>information</Text>
          <View style={pageStyles.infoBlock}>
            <InfoRow label="Date of transaction" value={formatDate(recording?.transaction_date)} />
            <InfoRow label="Transaction type" value={typeLabel(recording?.type ?? '', recording?.status ?? '')} />
            <InfoRow label="Bank / Account" value={truncate(recording?.account?.account_name ?? '—', 16)} />
            {recording?.notes ? (
              <>
                <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 2 }} />
                <View style={{ paddingVertical: 8 }}>
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginBottom: 4 }}>Notes</Text>
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.text, lineHeight: 18 }}>{recording.notes}</Text>
                </View>
              </>
            ) : null}
            {linkedPayable && (
              <>
                <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 2 }} />
                <InfoRow label={recording?.type === 'return' ? 'linked receivable' : 'linked payable'} value={truncate(linkedPayable.name, 16)} />
              </>
            )}
          </View>
          {linkedPayable && (
            <TouchableOpacity style={pageStyles.linkedBtn} onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: linkedPayable.id } } as any)}>
              <Ionicons name="link-outline" size={12} color={Colors.muted} />
              <Text style={pageStyles.linkedBtnText}>{recording?.type === 'return' ? 'view receivable' : 'view payable'}</Text>
              <Ionicons name="arrow-forward" size={11} color={Colors.muted} />
            </TouchableOpacity>
          )}

          {/* Payment/collection history */}
          {(recording?.type === 'payable' || recording?.type === 'receivable') && linkedPayments.length > 0 && (
            <>
              <Text style={[pageStyles.sectionHeader, { fontFamily: Fonts.calSans }]}>{recording.type === 'receivable' ? 'collections' : 'payments'}</Text>
              <View style={pageStyles.infoBlock}>
                {linkedPayments.map((p: any, i: number) => (
                  <TouchableOpacity key={p.id} onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: p.id } } as any)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.expense }}>
                          {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                        <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>
                          {formatDate(p.transaction_date)} · {p.accounts?.account_name ?? '—'}
                        </Text>
                        {p.payment_to && (
                          <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.cyan, marginTop: 2 }}>
                            {p.payment_to}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={12} color={Colors.faint} />
                    </View>
                    {i < linkedPayments.length - 1 && <View style={{ height: 1, backgroundColor: Colors.border }} />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Per-person payment status */}
              {personPayStatus.length > 0 && (
                <>
                  <Text style={[pageStyles.sectionHeader, { fontFamily: Fonts.calSans }]}>per person status</Text>
                  <View style={pageStyles.infoBlock}>
                    {personPayStatus.map((s, i) => {
                      const fullyPaid = s.total > 0 && s.paid >= s.total - 0.01;
                      const partial = s.paid > 0 && !fullyPaid;
                      const statusColor = fullyPaid ? Colors.income : partial ? Colors.cyan : Colors.muted;
                      return (
                        <View key={s.person}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                            <Ionicons
                              name={fullyPaid ? 'checkmark-circle' : partial ? 'ellipse' : 'ellipse-outline'}
                              size={16} color={statusColor}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text }}>{s.person}</Text>
                              <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>
                                {s.paid > 0
                                  ? `${s.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })} of ${s.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                  : `owes ${s.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                              </Text>
                            </View>
                            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 11, color: statusColor }}>
                              {fullyPaid ? 'paid' : partial ? 'partial' : 'unpaid'}
                            </Text>
                          </View>
                          {i < personPayStatus.length - 1 && <View style={{ height: 1, backgroundColor: Colors.border }} />}
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          )}

          {/* Split bill */}
          <Text style={[pageStyles.sectionHeader, { fontFamily: Fonts.calSans }]}>split bill</Text>
          {linkedPayable ? (
            <>
              <TouchableOpacity style={pageStyles.linkedBtn} onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: linkedPayable.id } } as any)}>
                <Ionicons name="git-branch-outline" size={12} color={Colors.muted} />
                <Text style={pageStyles.linkedBtnText}>{recording?.type === 'return' ? 'view split bill on receivable' : 'view split bill on payable'}</Text>
                <Ionicons name="arrow-forward" size={11} color={Colors.muted} />
              </TouchableOpacity>
              {Object.keys(payablePerPerson.map).length > 0 && (
                <View style={pageStyles.infoBlock}>
                  {Object.entries(payablePerPerson.map).map(([name, total], i, arr) => {
                    const wasPaid = payablePerPerson.paidFor.includes(name);
                    return (
                      <View key={name}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                          <Text style={[{ fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, flexShrink: 0 }, wasPaid && { color: Colors.income }]}>{name}</Text>
                          <View style={{ flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: Colors.faint, marginHorizontal: 8 }} />
                          <Text style={[{ fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.text, flexShrink: 0, maxWidth: 130 }, wasPaid && { color: Colors.income }]}>{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                          {wasPaid
                            ? <Ionicons name="checkmark-circle" size={13} color={Colors.income} style={{ marginLeft: 6 }} />
                            : <Ionicons name="ellipse-outline" size={13} color={Colors.faint} style={{ marginLeft: 6 }} />}
                        </View>
                        {i < arr.length - 1 && <View style={{ height: 1, backgroundColor: Colors.border }} />}
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          ) : (<>
          {isSplitLocked && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.warningBg, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.warningBorder }}>
              <Ionicons name="lock-closed-outline" size={14} color={Colors.muted} />
              <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, flex: 1 }}>split bill is locked while payments are in progress</Text>
            </View>
          )}
          <View style={itemStyles.splitBtnGrid}>
            {[
              { icon: 'add-circle-outline', label: 'add item', onPress: () => {
                const total = items.reduce((s, i) => s + i.cost, 0);
                const recAmt = recording ? Number(recording.amount) : 0;
                if (filledPeople.length > 0 && !(Math.abs(total - recAmt) < 0.01 && recAmt > 0)) setAddItemModal(true);
              }, disabled: isSplitLocked || filledPeople.length === 0 || (Math.abs(items.reduce((s, i) => s + i.cost, 0) - (recording ? Number(recording.amount) : 0)) < 0.01 && items.length > 0) },
              { icon: 'people-outline', label: 'add people', onPress: () => openPeopleModal(), disabled: isSplitLocked },
              { icon: 'share-outline', label: 'share', onPress: () => openSaveImage(), disabled: filledPeople.length === 0 || items.length === 0 },
              { icon: 'person-add-outline', label: 'save person', onPress: () => setCookingModal(true), disabled: false },
            ].map(b => (
              <TouchableOpacity
                key={b.label}
                style={[itemStyles.splitBtn, b.disabled && itemStyles.splitBtnDisabled]}
                onPress={b.onPress}
                activeOpacity={b.disabled ? 1 : 0.8}
              >
                <Ionicons name={b.icon as any} size={16} color={b.disabled ? Colors.faint : Colors.text} />
                <Text style={[itemStyles.splitBtnText, b.disabled && { color: Colors.faint }]}>{b.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* People */}
          <Text style={itemStyles.peopleHeader}>people</Text>
          <View style={itemStyles.peopleContainer}>
            {filledPeople.length === 0 ? (
              <Text style={itemStyles.peoplePlaceholder}>no people added yet</Text>
            ) : (
              <View style={itemStyles.peopleChips}>
                {visiblePeople.map((person, i) => (
                  <View key={i} style={itemStyles.personChip}>
                    <Text style={itemStyles.personChipText}>{person}</Text>
                    {!isSplitLocked && (
                    <TouchableOpacity onPress={() => requestDeletePerson(people.findIndex(p => p === person))} style={itemStyles.personChipDelete}>
                      <Ionicons name="close" size={10} color={Colors.muted} />
                    </TouchableOpacity>
                    )}
                  </View>
                ))}
                {extraCount > 0 && (
                  <TouchableOpacity style={itemStyles.personChip} onPress={() => isSplitLocked ? setShowAllPeopleModal(true) : openPeopleModal()}>
                    <Text style={itemStyles.personChipText}>+{extraCount} more</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Items */}
          <Text style={[pageStyles.sectionHeader, { fontFamily: Fonts.calSans }]}>items</Text>
          {(() => {
            const totalItemsCost = items.reduce((s, i) => s + i.cost, 0);
            const recordingAmount = recording ? Number(recording.amount) : 0;
            const isFullyAllocated = Math.abs(totalItemsCost - recordingAmount) < 0.01 && recordingAmount > 0;
            return (
              <>
                {items.length === 0 ? (
                  <View style={pageStyles.emptyBox}>
                    <Text style={pageStyles.emptyText}>no items yet</Text>
                  </View>
                ) : (
                  <View style={itemStyles.itemsList}>
                    {items.map((item, idx) => {
                      return (
                        <View key={item.id}>
                          <View style={itemStyles.itemCard}>
                            <Text style={itemStyles.itemNumber}>{idx + 1}</Text>
                            {/* Left: name + cost */}
                            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                              <Text style={itemStyles.itemName} numberOfLines={1} ellipsizeMode="tail">{truncate(item.name, MAX_ITEM_NAME)}</Text>
                              {editingItemCost?.id === item.id ? (
                                <TextInput
                                  style={[itemStyles.itemCost, { borderBottomWidth: 1, borderBottomColor: Colors.cyan }]}
                                  value={editingItemCost.value}
                                  onChangeText={v => setEditingItemCost({ id: item.id, value: v })}
                                  keyboardType="decimal-pad"
                                  autoFocus
                                  onBlur={() => updateItemCost(item.id, parseFloat(editingItemCost.value))}
                                  onSubmitEditing={() => updateItemCost(item.id, parseFloat(editingItemCost.value))}
                                />
                              ) : (
                                <TouchableOpacity onPress={() => setEditingItemCost({ id: item.id, value: String(item.cost) })}>
                                  <Text style={[itemStyles.itemCost, { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: Colors.faint }]}>
                                    {item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            {/* Right: people + each amount + subitem btn + delete */}
                            <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                              {item.subitems.length === 0 && item.people.length > 0 && (
                                <>
                                  <View style={itemStyles.peopleRow}>
                                    {(item.people ?? []).slice(0, 3).map((p, pi) => (
                                      <TouchableOpacity key={pi} style={itemStyles.personCircle} onPress={() => setTooltip(tooltip?.name === p ? null : { name: p })}>
                                        <Text style={itemStyles.personCircleLetter}>{p[0]?.toUpperCase()}</Text>
                                      </TouchableOpacity>
                                    ))}
                                    {(item.people?.length ?? 0) > 3 && (
                                      <TouchableOpacity style={itemStyles.personCircleExtra} onPress={() => setShowAllPeopleModal(true)}>
                                        <Text style={itemStyles.personCircleLetter}>+{item.people.length - 3}</Text>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                  <Text style={itemStyles.itemSplit}>
                                    {(item.cost / item.people.length).toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                                  </Text>
                                </>
                              )}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                {!isSplitLocked && (
                                  <TouchableOpacity style={itemStyles.addSubitemBtn} onPress={() => openEditSubitems(item)}>
                                    <Ionicons name="add" size={13} color={Colors.cyan} />
                                    <Text style={itemStyles.addSubitemBtnText}>subitem</Text>
                                  </TouchableOpacity>
                                )}
                                {!isSplitLocked && (
                                  <TouchableOpacity onPress={() => deleteItem(item.id)} style={itemStyles.itemDelete}>
                                    <Ionicons name="close" size={14} color={Colors.faint} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </View>
                          {item.subitems.map(sub => {
                            const perPerson = sub.people.length > 0 ? sub.cost / sub.people.length : 0;
                            return (
                              <View key={sub.id} style={itemStyles.subitemCard}>
                                <Text style={itemStyles.subitemArrow}>↳</Text>
                                {/* Left: name + cost */}
                                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                                  <Text style={itemStyles.subitemName} numberOfLines={1} ellipsizeMode="tail">{truncate(sub.name, MAX_ITEM_NAME)}</Text>
                                  <Text style={itemStyles.subitemCost}>{sub.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                                </View>
                                {/* Right: people + each + delete */}
                                <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                                  {sub.people.length > 0 && (
                                    <>
                                      <View style={itemStyles.peopleRow}>
                                        {(sub.people ?? []).slice(0, 3).map((p, pi) => (
                                          <TouchableOpacity key={pi} style={itemStyles.personCircle} onPress={() => setTooltip(tooltip?.name === p ? null : { name: p })}>
                                            <Text style={itemStyles.personCircleLetter}>{p[0]?.toUpperCase()}</Text>
                                          </TouchableOpacity>
                                        ))}
                                        {(sub.people?.length ?? 0) > 3 && (
                                          <TouchableOpacity style={itemStyles.personCircleExtra} onPress={() => setShowAllPeopleModal(true)}>
                                            <Text style={itemStyles.personCircleLetter}>+{(sub.people?.length ?? 0) - 3}</Text>
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                      <Text style={itemStyles.itemSplit}>
                                        {perPerson.toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                                      </Text>
                                    </>
                                  )}
                                  {!isSplitLocked && (
                                    <TouchableOpacity onPress={() => deleteSubitem(item.id, sub.id)} style={itemStyles.itemDelete}>
                                      <Ionicons name="close" size={12} color={Colors.faint} />
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                    <View style={itemStyles.itemsTotalRow}>
                      <Text style={itemStyles.itemsTotalLabel}>total allocated</Text>
                      <View style={itemStyles.itemsTotalDots} />
                      <Text style={[itemStyles.itemsTotalValue, isFullyAllocated && { color: Colors.income }]}>
                        {totalItemsCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} / {recordingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>
                )}
                {isFullyAllocated && (
                  <Text style={itemStyles.allocatedNote}>all amount allocated</Text>
                )}
              </>
            );
          })()}
          </>)}

        </ScrollView>
      </SafeAreaView>

      {/* Tooltip */}
      {tooltip && (
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setTooltip(null)} activeOpacity={1}>
          <View style={pageStyles.tooltip}>
            <Text style={pageStyles.tooltipText}>{tooltip.name}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Add people modal */}
      <BottomSheet visible={addPersonModal} onClose={() => { setPeople(savedPeople); setAddPersonModal(false); setSuggestions([]); }} sub="split bill" title="people">
        {/* Tag input */}
        <View style={styles.tagInputWrap}>
          {people.filter(p => p.trim()).map((p, i) => (
            <View key={i} style={styles.tagChip}>
              <Text style={styles.tagChipText}>{p}</Text>
              <TouchableOpacity onPress={() => requestDeletePerson(people.indexOf(p))} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close" size={11} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ))}
          <TextInput
            style={styles.tagInput}
            placeholder={people.filter(p => p.trim()).length === 0 ? 'type a name and press enter...' : ''}
            placeholderTextColor={Colors.faint}
            value={tagInputVal}
            onChangeText={v => {
              setSuggestions(v.trim() ? contacts.filter(c => c.toLowerCase().startsWith(v.toLowerCase()) && !people.includes(c)) : []);
              setTagInputVal(v);
            }}
            returnKeyType="done"
            onSubmitEditing={() => {
              const name = tagInputVal.trim();
              if (name && !people.includes(name)) setPeople(prev => [...prev, name]);
              setTagInputVal('');
              setSuggestions([]);
            }}
            blurOnSubmit={false}
          />
        </View>

        {/* Contacts list */}
        <Text style={[formStyles.hintMuted, { marginTop: 8, marginBottom: 4 }]}>your contacts</Text>
        <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {contacts.length === 0 && <Text style={formStyles.listEmpty}>no contacts saved yet</Text>}
          {contacts.map((c, i) => {
            const added = people.includes(c);
            return (
              <TouchableOpacity
                key={i}
                style={[styles.contactRow, added && { opacity: 0.35 }]}
                onPress={() => { if (!added) { setPeople(prev => [...prev, c]); setTagInputVal(''); setSuggestions([]); } }}
                disabled={added}
              >
                <Text style={styles.contactName}>{c}</Text>
                {added
                  ? <Ionicons name="checkmark" size={14} color={Colors.faint} />
                  : <Ionicons name="add" size={14} color={Colors.cyan} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={formStyles.actions}>
          <TouchableOpacity style={formStyles.cancelBtn} onPress={() => { setPeople(savedPeople); setAddPersonModal(false); setSuggestions([]); setTagInputVal(''); }}>
            <Text style={formStyles.cancelBtnText}>cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[formStyles.primaryBtn, savingPeople && { opacity: 0.6 }]} onPress={savePeopleAndClose} disabled={savingPeople}>
            <Text style={formStyles.primaryBtnText}>{savingPeople ? 'saving...' : 'done'}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
      {/* Add item modal */}
      <AddItemModal
        visible={addItemModal}
        itemForms={itemForms}
        filledPeople={filledPeople}
        recording={recording}
        existingItemsTotal={items.reduce((s, i) => s + i.cost, 0)}
        onClose={() => { setAddItemModal(false); setItemForms([{ name: '', cost: '', people: [], subitemForms: [] }]); }}
        onSave={saveItem}
        updateItemForm={updateItemForm}
        removeItemForm={removeItemForm}
        addItemForm={addItemForm}
        toggleItemFormPerson={toggleItemFormPerson}
        addSubitemForm={addSubitemForm}
        updateSubitemForm={updateSubitemForm}
        removeSubitemForm={removeSubitemForm}
        toggleSubitemFormPerson={toggleSubitemFormPerson}
        MAX_ITEM_NAME={MAX_ITEM_NAME}
      />

      {/* Edit subitems modal */}
      <BottomSheet visible={!!editSubitemsItemId} onClose={() => setEditSubitemsItemId(null)} sub="split bill" title="add subitems">
        {(() => {
          const item = items.find(i => i.id === editSubitemsItemId);
          if (!item) return null;
          const totalSubs = item.subitems.length + editSubitemForms.filter(s => s.name.trim()).length;
          const equalCost = totalSubs > 0 ? item.cost / totalSubs : item.cost;
          return (
            <>
              <Text style={formStyles.hintMuted}>{item.name} · {item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              {item.subitems.length > 0 && <Text style={formStyles.hintMuted}>{item.subitems.length} existing · will become {equalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} each</Text>}
              <ScrollView style={{ width: '100%', maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                {editSubitemForms.map((sub, i) => (
                  <View key={i} style={styles.subitemFormRow}>
                    <Text style={itemStyles.subitemArrow}>↳</Text>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.subitemFormInputRow}>
                        <TextInput style={formStyles.input} placeholder="subitem name" placeholderTextColor={Colors.faint} value={sub.name} onChangeText={v => updateEditSubitemForm(i, v)} autoFocus={i === 0} />
                        {sub.name.trim() && <Text style={formStyles.hint}>{equalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>}
                        {editSubitemForms.length > 1 && (
                          <TouchableOpacity onPress={() => removeEditSubitemForm(i)} style={styles.removeBtn}>
                            <Ionicons name="close" size={12} color={Colors.faint} />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={itemStyles.personSelectRow}>
                        {filledPeople.map((p, pi) => {
                          const sel = sub.people.includes(p);
                          return (
                            <TouchableOpacity key={pi} style={[itemStyles.personSelectChip, sel && itemStyles.personSelectChipActive]} onPress={() => toggleEditSubitemPerson(i, p)}>
                              <Text style={[itemStyles.personSelectText, sel && itemStyles.personSelectTextActive]}>{p}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.addMoreBtn} onPress={addEditSubitemForm}>
                <Ionicons name="add" size={11} color={Colors.cyan} />
                <Text style={styles.addMoreText}>add more</Text>
              </TouchableOpacity>
              <View style={formStyles.actions}>
                <TouchableOpacity style={formStyles.cancelBtn} onPress={() => setEditSubitemsItemId(null)}>
                  <Text style={formStyles.cancelBtnText}>cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[formStyles.primaryBtn, editSubitemForms.every(s => !s.name.trim()) && { opacity: 0.4 }]} onPress={saveEditSubitems} disabled={editSubitemForms.every(s => !s.name.trim())}>
                  <Text style={formStyles.primaryBtnText}>save</Text>
                </TouchableOpacity>
              </View>
            </>
          );
        })()}
      </BottomSheet>

      {/* Delete person confirm */}
      <ConfirmModal
        visible={!!deletePersonConfirm}
        onClose={() => setDeletePersonConfirm(null)}
        title="remove person"
        actions={[
          { label: 'cancel', onPress: () => setDeletePersonConfirm(null), muted: true },
          { label: 'remove', onPress: confirmDeletePerson, destructive: true },
        ]}
      >
        <Text style={styles.deleteWarning}>
          <Text style={{ fontFamily: Fonts.monoBold }}>{deletePersonConfirm?.name}</Text>
          {` is included in ${deletePersonConfirm?.affectedItems} item${deletePersonConfirm?.affectedItems === 1 ? '' : 's'}. removing them will update those splits.`}
        </Text>
      </ConfirmModal>

      <ShareModal
        visible={saveImageModal}
        onClose={() => { setSaveImageModal(false); setLinkCopied(false); }}
        shareRowId={shareRowId}
        shareAccounts={shareAccounts}
        selectedAccountIds={shareSelectedAccountIds}
        setSelectedAccountIds={setShareSelectedAccountIds}
        linkCopied={linkCopied}
        shareLoading={shareLoading}
        onShare={generateShare}
        onSaveImage={saveAsImage}
      />

      {/* Link receipt modal */}
      <BottomSheet visible={linkReceiptModal} onClose={() => setLinkReceiptModal(false)} sub="receipt" title="link a receipt">
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
          {linkReceiptEntries.length === 0 ? (
            <Text style={formStyles.listEmpty}>no unlinked receipts found</Text>
          ) : (
            linkReceiptEntries.map((entry: any) => (
              <TouchableOpacity key={entry.id} style={formStyles.listItem} onPress={() => linkReceiptToRecording(entry)}>
                <Ionicons name="folder-outline" size={18} color={Colors.cyan} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.heading, fontSize: 13, color: Colors.text }} numberOfLines={1}>{entry.note ?? 'untitled'}</Text>
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>{new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                </View>
                <Ionicons name="link-outline" size={14} color={Colors.cyan} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
        <View style={formStyles.actions}>
          <TouchableOpacity style={formStyles.cancelBtn} onPress={() => setLinkReceiptModal(false)}>
            <Text style={formStyles.cancelBtnText}>cancel</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      <PayModal
        visible={payModal}
        onClose={() => setPayModal(false)}
        recording={recording}
        items={items}
        filledPeople={filledPeople}
        step={payStep}
        setStep={setPayStep}
        mode={payMode}
        setMode={setPayMode}
        manualAmount={payManualAmount}
        setManualAmount={setPayManualAmount}
        selectedPeople={paySelectedPeople}
        setSelectedPeople={setPaySelectedPeople}
        accounts={payAccounts}
        account={payAccount}
        setAccount={setPayAccount}
        date={payDate}
        setDate={setPayDate}
        complete={payComplete}
        setComplete={setPayComplete}
        loading={payLoading}
        getAmount={getPayAmount}
        onConfirm={confirmPayment}
      />

      {/* Delete confirm modal */}
      <ConfirmModal
        visible={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="delete recording"
        message={linkedPayable
          ? `this expense is linked to the payable "${linkedPayable.name}". what do you want to do?`
          : linkedReceipt ? 'do you also want to delete the linked receipt and its photos?' : 'this cannot be undone.'}
        actions={linkedPayable ? [
          { label: 'cancel', onPress: () => setDeleteConfirm(false), muted: true },
          { label: 'expense only', onPress: () => confirmDelete(false, false, false), disabled: deleteLoading },
          { label: deleteLoading ? '...' : 'delete both', onPress: () => confirmDelete(true, false, true), destructive: true, disabled: deleteLoading },
        ] : [
          { label: 'cancel', onPress: () => setDeleteConfirm(false), muted: true },
          ...(linkedReceipt ? [{ label: 'keep receipt', onPress: () => confirmDelete(true, false), disabled: deleteLoading }] : []),
          { label: deleteLoading ? '...' : linkedReceipt ? 'delete both' : 'delete', onPress: () => confirmDelete(true, !!linkedReceipt), destructive: true, disabled: deleteLoading },
        ]}
      />

      {/* All people preview modal */}
      <ConfirmModal
        visible={showAllPeopleModal}
        onClose={() => setShowAllPeopleModal(false)}
        title="people"
        actions={[{ label: 'close', onPress: () => setShowAllPeopleModal(false), muted: true }]}
      >
        <View style={[itemStyles.personSelectRow, { paddingBottom: 4 }]}>
          {filledPeople.map((p, i) => (
            <View key={i} style={itemStyles.personChip}>
              <Text style={itemStyles.personChipText}>{p}</Text>
            </View>
          ))}
        </View>
      </ConfirmModal>

      <CollectModal
        visible={collectModal}
        onClose={() => setCollectModal(false)}
        recording={recording}
        items={items}
        filledPeople={filledPeople}
        step={collectStep}
        setStep={setCollectStep}
        mode={collectMode}
        setMode={setCollectMode}
        manualAmount={collectManualAmount}
        setManualAmount={setCollectManualAmount}
        selectedPeople={collectSelectedPeople}
        setSelectedPeople={setCollectSelectedPeople}
        accounts={collectAccounts}
        account={collectAccount}
        setAccount={setCollectAccount}
        date={collectDate}
        setDate={setCollectDate}
        complete={collectComplete}
        setComplete={setCollectComplete}
        loading={collectLoading}
        getAmount={getCollectAmount}
        onConfirm={confirmCollect}
      />

      <ReceivableModal
        visible={receivableModal}
        onClose={() => setReceivableModal(false)}
        recording={recording}
        items={items}
        filledPeople={filledPeople}
        mode={receivableMode}
        setMode={setReceivableMode}
        manualAmount={receivableManualAmount}
        setManualAmount={setReceivableManualAmount}
        selectedPeople={receivableSelectedPeople}
        setSelectedPeople={setReceivableSelectedPeople}
        loading={receivableLoading}
        getAmount={getReceivableAmount}
        onConfirm={confirmCreateReceivable}
      />

      {/* Cooking modal */}
      <ConfirmModal
        visible={cookingModal}
        onClose={() => setCookingModal(false)}
        title="coming soon"
        actions={[{ label: 'close', onPress: () => setCookingModal(false), muted: true }]}
      >
        <Text style={{ fontSize: 36 }}>🍳</Text>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, textAlign: 'center' }}>we're cooking something</Text>
      </ConfirmModal>
      {/* Copied toast */}
      {copiedToast && (
        <View style={pageStyles.toast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
          <Text style={pageStyles.toastText}>link copied to clipboard</Text>
        </View>
      )}

      {/* Add receipt modal */}
      <BottomSheet visible={addReceiptModal} onClose={() => setAddReceiptModal(false)} sub="recording" title="add receipt">
        <View style={accountStyles.photoButtons}>
          <TouchableOpacity style={accountStyles.photoBtn} onPress={addReceiptFromCamera}>
            <Ionicons name="camera-outline" size={28} color={Colors.cyan} />
            <Text style={accountStyles.photoBtnText}>camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={accountStyles.photoBtn} onPress={addReceiptFromGallery}>
            <Ionicons name="images-outline" size={28} color={Colors.text} />
            <Text style={[accountStyles.photoBtnText, { color: Colors.text }]}>gallery</Text>
          </TouchableOpacity>
        </View>
        <View style={formStyles.actions}>
          <TouchableOpacity style={formStyles.cancelBtn} onPress={() => setAddReceiptModal(false)}>
            <Text style={formStyles.cancelBtnText}>cancel</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Hidden WebView for image capture - native only */}
      {captureHtml && Platform.OS !== 'web' && (() => {
        const { WebView } = require('react-native-webview');
        return (
          <WebView
            ref={webviewRef}
            source={{ html: captureHtml }}
            style={{ position: 'absolute', width: 390, height: 1, opacity: 0, top: -9999 }}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            originWhitelist={['*']}
          />
        );
      })()}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // screen-specific only — everything else uses shared style files
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  removeBtn: { padding: 4 },
  addMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  addMoreText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.cyan },
  deleteWarning: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, textAlign: 'center', lineHeight: 18 },
  suggestionBox: { backgroundColor: Colors.white, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginTop: -4, marginBottom: 6, overflow: 'hidden' },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestionText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.text },
  subitemFormRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, marginLeft: 4 },
  subitemFormInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Tag input
  tagInputWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, padding: 8, minHeight: 44, marginBottom: 4 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.cyan, borderRadius: Radius.pill, paddingVertical: 4, paddingLeft: 10, paddingRight: 6 },
  tagChipText: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.white },
  tagInput: { fontFamily: Fonts.mono, fontSize: 14, color: Colors.text, minWidth: 120, flex: 1, padding: 2 },
  // Contacts list
  contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  contactName: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.text },
});










