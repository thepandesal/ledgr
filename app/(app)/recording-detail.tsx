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
import { Colors, Radius } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';

const ACCENT      = Brand.color.accent;
const ACCENT_DARK = Brand.color.accentDark;
const PEACH       = '#FFAB91';

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
  const [photoModal, setPhotoModal] = useState(false);
  const [photoModalIndex, setPhotoModalIndex] = useState(0);
  const [editModal, setEditModal] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const [editAccounts, setEditAccounts] = useState<any[]>([]);
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
  const [linkedReceivable, setLinkedReceivable] = useState<any>(null);
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

  // ── Linked split bill ────────────────────────────────────────────────────
  const [linkedSplitBill, setLinkedSplitBill] = useState<{ id: string; name: string } | null>(null);
  const [splitBillModal, setSplitBillModal] = useState(false);
  const [existingSplitBills, setExistingSplitBills] = useState<any[]>([]);

  const loadLinkedSplitBill = async () => {
    if (!recordingId) return;
    const { data } = await supabase
      .from('split_bill_recordings')
      .select('split_bill_id, split_bills(id, name)')
      .eq('recording_id', recordingId)
      .maybeSingle();
    if (data?.split_bills) {
      const sb = Array.isArray(data.split_bills) ? data.split_bills[0] : data.split_bills;
      if (sb) setLinkedSplitBill(sb);
    }
  };

  const createAndLinkSplitBill = async () => {
    if (!recording) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: bill } = await supabase.from('split_bills')
      .insert({ user_id: user.id, name: recording.name })
      .select('id, name').single();
    if (!bill) return;
    await supabase.from('split_bill_recordings').insert({
      split_bill_id: bill.id, recording_id: recordingId, amount_contributed: recording.amount,
    });
    setSplitBillModal(false);
    router.push({ pathname: '/(app)/split-bill-detail', params: { splitBillId: bill.id, name: bill.name } } as any);
  };

  const linkToExistingSplitBill = async (bill: any) => {
    await supabase.from('split_bill_recordings').insert({
      split_bill_id: bill.id, recording_id: recordingId, amount_contributed: recording?.amount ?? 0,
    });
    setSplitBillModal(false);
    router.push({ pathname: '/(app)/split-bill-detail', params: { splitBillId: bill.id, name: bill.name } } as any);
  };

  const openSplitBillModal = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('split_bills').select('id, name').eq('user_id', user.id).order('created_at', { ascending: false });
    setExistingSplitBills(data ?? []);
    setSplitBillModal(true);
  };

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
    loadLinkedSplitBill();
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

    if (rec.type === 'debt' || rec.type === 'due') {
      const paymentType = rec.type === 'debt' ? 'expense' : 'return';
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
    } else if (rec.type === 'expense') {
      const { data: incomePayments } = await supabase.from('recordings')
        .select('id, name, amount, transaction_date, payment_to, payment_from_account_id, accounts:payment_from_account_id(account_name, bank)')
        .eq('linked_recording_id', recordingId).eq('type', 'income').order('transaction_date', { ascending: false });
      if (incomePayments && incomePayments.length > 0) {
        setLinkedPayments(incomePayments);
        const totalCollected = incomePayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
        setRecording((prev: any) => prev ? { ...prev, paid_amount: totalCollected } : prev);
      }
      const { data: recv } = await supabase.from('recordings').select('id, name').eq('linked_recording_id', recordingId).eq('type', 'due').maybeSingle();
      if (recv) setLinkedReceivable(recv);
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
        status: collectComplete ? 'paid' : 'partial',
        paid_amount: newPaid,
      }).eq('id', recordingId);
      setRecording((prev: any) => ({ ...prev, status: collectComplete ? 'paid' : 'partial', paid_amount: newPaid }));
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
        type: 'due',
        amount,
        transaction_date: recording.transaction_date,
        status: 'unpaid',
        account_id: recording.account_id ?? null,
        category_id: recording.category_id ?? null,
        linked_recording_id: recordingId,
      }).select('id').single();
      // Tag the parent expense as is_due
      await supabase.from('recordings').update({ is_due: true }).eq('id', recordingId);
      setRecording((prev: any) => ({ ...prev, is_due: true }));
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
        const { data: entry } = await supabase.from('receipt_entries').insert({ user_id: user.id, note, recording_id: recordingId }).select().maybeSingle();
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
        const { data: entry } = await supabase.from('receipt_entries').insert({ user_id: user.id, note, recording_id: recordingId }).select().maybeSingle();
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
    const { data: entry } = await supabase.from('receipt_entries').select('id, note, created_at').eq('recording_id', recordingId).maybeSingle();
    if (!entry) return;
    setLinkedReceipt(entry);
    const { data: photos } = await supabase.from('receipt_photos').select('id, storage_path, url').eq('entry_id', entry.id).order('created_at').limit(5);
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
    if (data) setRecording({
      ...data,
      categories: Array.isArray(data.categories) ? data.categories[0] : data.categories,
      account: Array.isArray(data.account) ? data.account[0] : data.account,
    });
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

  const openEditModal = async () => {
    setEditDate(recording?.transaction_date ?? '');
    setEditAccountId(recording?.account_id ?? '');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: accs } = await supabase.from('accounts').select().eq('user_id', user.id).order('account_name');
    if (accs) setEditAccounts(accs);
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editDate) return;
    await supabase.from('recordings').update({
      transaction_date: editDate,
      account_id: editAccountId || null,
    }).eq('id', recordingId);
    setEditModal(false);
    loadRecording();
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
    if (recording.type === 'expense' && !recording.is_due) return PEACH;
    if (recording.type === 'debt') return PEACH;
    if (recording.type === 'income' || recording.type === 'return') return ACCENT_DARK;
    if (recording.type === 'due' || (recording.type === 'expense' && recording.is_due)) {
      const remaining = Number(recording.amount) - Number(recording.paid_amount ?? 0);
      return remaining <= 0 ? ACCENT_DARK : PEACH;
    }
    return Colors.text;
  };

  const displayAmount = () => {
    if (!recording) return '—';
    if (recording.is_due || recording.type === 'due') {
      const remaining = Math.max(0, Number(recording.amount) - Number(recording.paid_amount ?? 0));
      return remaining.toLocaleString('en-US', { minimumFractionDigits: 2 });
    }
    return Number(recording.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const typeLabel = (type: string, status: string) => {
    if (type === 'debt') return `Debt · ${status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid'}`;
    if (type === 'due')  return `Due · ${status === 'paid' ? 'Collected' : status === 'partial' ? 'Partial' : 'Unpaid'}`;
    if (type === 'return') return 'Return';
    if (type === 'expense' && recording?.is_due) return 'Expense · Due';
    return { expense: 'Expense', income: 'Income' }[type] ?? type;
  };

          const isPayableLocked = recording?.type === 'debt' && (recording?.status === 'partial' || recording?.status === 'paid');
  const isReceivableLocked = recording?.type === 'due' && (recording?.status === 'partial' || recording?.status === 'paid');
  const isSplitLocked = isPayableLocked || isReceivableLocked;

  const PREVIEW_LIMIT = 4;
  const visiblePeople = filledPeople.slice(0, PREVIEW_LIMIT);
  const extraCount = filledPeople.length - PREVIEW_LIMIT;

  return (
    <Animated.View style={[pageStyles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={pageStyles.inner}>
        <TouchableOpacity onPress={handleBack} style={pageStyles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={openEditModal} style={{ position: 'absolute', top: 14, right: 28, zIndex: 20, padding: 6 }}>
          <Ionicons name="create-outline" size={20} color={Colors.muted} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={pageStyles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={[pageStyles.titleBlock, { marginBottom: 20 }]}>
            <Text style={{ fontFamily: Brand.font.body, fontSize: 13, color: Colors.muted, marginBottom: 4 }}>recordings</Text>
            <Text style={{ fontFamily: Brand.font.display, fontSize: 32, color: Colors.text, letterSpacing: -0.5 }} numberOfLines={2}>
              {truncate(recording?.name ?? '', MAX_NAME_CHARS).toLowerCase()}
            </Text>
            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 22, color: amountColor(), marginTop: 4 }}>
              {displayAmount()}
            </Text>
            {recording?.is_due && Number(recording?.paid_amount ?? 0) > 0 && (
              <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginTop: 2 }}>
                original: {Number(recording.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} · collected: {Number(recording.paid_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            )}
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginTop: 4 }}>
              {formatDate(recording?.transaction_date)} · {typeLabel(recording?.type ?? '', recording?.status ?? '')}
            </Text>
            {recording?.is_due && Number(recording?.amount) > 0 && (() => {
              const total = Number(recording.amount);
              const paid = Number(recording.paid_amount ?? 0);
              const pct = Math.min(paid / total, 1);
              const fullyCollected = paid >= total - 0.01;
              return (
                <View style={{ marginTop: 10, gap: 4 }}>
                  <View style={{ height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ height: 4, width: `${pct * 100}%` as any, backgroundColor: fullyCollected ? ACCENT_DARK : PEACH, borderRadius: 2 }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted }}>
                      {paid.toLocaleString('en-US', { minimumFractionDigits: 2 })} collected
                    </Text>
                    {fullyCollected
                      ? <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: ACCENT_DARK }}>fully collected ✓</Text>
                      : <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted }}>{Math.max(0, total - paid).toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining</Text>
                    }
                  </View>
                </View>
              );
            })()}
          </View>

          {/* Action buttons */}
          <View style={pageStyles.actionRow}>
          {recording?.type === 'expense' && !linkedPayable && !linkedReceivable && (
              <TouchableOpacity style={pageStyles.actionBtn} onPress={() => {
                setReceivableMode('full');
                setReceivableManualAmount('');
                setReceivableSelectedPeople([]);
                setReceivableModal(true);
              }}>
                <Ionicons name="arrow-undo-outline" size={15} color={Colors.text} />
                <Text style={pageStyles.actionBtnText}>tag as due</Text>
              </TouchableOpacity>
            )}
            {recording?.type === 'debt' && recording?.status !== 'paid' && (
              <TouchableOpacity style={pageStyles.actionBtn} onPress={openPayModal}>
                <Ionicons name="cash-outline" size={15} color={Colors.text} />
                <Text style={pageStyles.actionBtnText}>pay debt</Text>
              </TouchableOpacity>
            )}
            {recording?.type === 'debt' && recording?.status === 'paid' && (
              <View style={[pageStyles.actionBtn, pageStyles.actionBtnSuccess]}>
                <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                <Text style={[pageStyles.actionBtnText, { color: Colors.success }]}>fully paid</Text>
              </View>
            )}
            {recording?.type === 'due' && recording?.status !== 'paid' && (
              <TouchableOpacity style={pageStyles.actionBtn} onPress={openCollectModal}>
                <Ionicons name="arrow-down-circle-outline" size={15} color={Colors.text} />
                <Text style={pageStyles.actionBtnText}>collect</Text>
              </TouchableOpacity>
            )}
            {recording?.type === 'due' && recording?.status === 'paid' && (
              <View style={[pageStyles.actionBtn, pageStyles.actionBtnSuccess]}>
                <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                <Text style={[pageStyles.actionBtnText, { color: Colors.success }]}>fully collected</Text>
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
              {receiptPhotos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {receiptPhotos.map((p, idx) => (
                    <TouchableOpacity key={p.id} onPress={() => { setPhotoModalIndex(idx); setPhotoModal(true); }} activeOpacity={0.85}>
                      <Image source={{ uri: p.url }} style={[accountStyles.receiptThumb, { backgroundColor: Colors.input }]} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.faint, marginTop: 8 }}>loading photos...</Text>
              )}
              <TouchableOpacity
                style={[pageStyles.actionBtn, { marginTop: 10 }]}
                onPress={() => router.push({ pathname: '/(app)/receipt-detail', params: { receiptId: linkedReceipt.id } } as any)}
              >
                <Ionicons name="arrow-forward-circle-outline" size={15} color={ACCENT_DARK} />
                <Text style={[pageStyles.actionBtnText, { color: ACCENT_DARK }]}>go to receipt</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Information */}
          <Text style={[pageStyles.sectionHeader, { fontFamily: Brand.font.display }]}>information</Text>
          <View style={pageStyles.infoBlock}>
            <InfoRow label="Date of transaction" value={formatDate(recording?.transaction_date)} />
            <InfoRow label="Transaction type" value={typeLabel(recording?.type ?? '', recording?.status ?? '')} />
            <InfoRow label="Bank / Account" value={truncate(recording?.account?.account_name ?? '—', 16)} />
            {recording?.notes ? (
              <>
                <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 2 }} />
                <View style={{ paddingVertical: 8 }}>
                  <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted, marginBottom: 4 }}>Notes</Text>
                  <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.text, lineHeight: 18 }}>{recording.notes}</Text>
                </View>
              </>
            ) : null}
            {linkedPayable && (
              <>
                <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 2 }} />
                <InfoRow label={recording?.type === 'return' ? 'linked due' : 'linked debt'} value={truncate(linkedPayable.name, 16)} />
              </>
            )}
            {linkedReceivable && (
              <>
                <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 2 }} />
                <InfoRow label="linked receivable" value={truncate(linkedReceivable.name, 16)} />
              </>
            )}
          </View>
          {linkedPayable && (
            <TouchableOpacity style={pageStyles.linkedBtn} onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: linkedPayable.id } } as any)}>
              <Ionicons name="link-outline" size={12} color={Colors.muted} />
              <Text style={pageStyles.linkedBtnText}>{recording?.type === 'return' ? 'view due' : 'view debt'}</Text>
              <Ionicons name="arrow-forward" size={11} color={Colors.muted} />
            </TouchableOpacity>
          )}
          {linkedReceivable && (
            <TouchableOpacity style={pageStyles.linkedBtn} onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: linkedReceivable.id } } as any)}>
              <Ionicons name="link-outline" size={12} color={Colors.muted} />
              <Text style={pageStyles.linkedBtnText}>view receivable</Text>
              <Ionicons name="arrow-forward" size={11} color={Colors.muted} />
            </TouchableOpacity>
          )}

          {/* Payment/collection history */}
          {(recording?.type === 'debt' || recording?.type === 'due' || (recording?.type === 'expense' && linkedPayments.length > 0)) && linkedPayments.length > 0 && (
            <>
              <Text style={[pageStyles.sectionHeader, { fontFamily: Brand.font.display }]}>{recording.type === 'due' ? 'collections' : recording.type === 'expense' ? 'collections' : 'payments'}</Text>
              <View style={pageStyles.infoBlock}>
                {linkedPayments.map((p: any, i: number) => (
                  <TouchableOpacity key={p.id} onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: p.id } } as any)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 11, color: PEACH }}>
                          {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                        <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted }}>
                          {formatDate(p.transaction_date)} · {p.accounts?.account_name ?? '—'}
                        </Text>
                        {p.payment_to && (
                          <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: ACCENT_DARK, marginTop: 2 }}>
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
                  <Text style={[pageStyles.sectionHeader, { fontFamily: Brand.font.display }]}>per person status</Text>
                  <View style={pageStyles.infoBlock}>
                    {personPayStatus.map((s, i) => {
                      const fullyPaid = s.total > 0 && s.paid >= s.total - 0.01;
                      const partial = s.paid > 0 && !fullyPaid;
                      const statusColor = fullyPaid ? ACCENT_DARK : partial ? ACCENT_DARK : Colors.muted;
                      return (
                        <View key={s.person}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                            <Ionicons
                              name={fullyPaid ? 'checkmark-circle' : partial ? 'ellipse' : 'ellipse-outline'}
                              size={16} color={statusColor}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 12, color: Colors.text }}>{s.person}</Text>
                              <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted }}>
                                {s.paid > 0
                                  ? `${s.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })} of ${s.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                  : `owes ${s.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                              </Text>
                            </View>
                            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 11, color: statusColor }}>
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
          <Text style={[pageStyles.sectionHeader, { fontFamily: Brand.font.display }]}>split bill</Text>
          {linkedSplitBill ? (
            <TouchableOpacity
              style={[pageStyles.linkedBtn, { borderColor: ACCENT, backgroundColor: ACCENT + '44' }]}
              onPress={() => router.push({ pathname: '/(app)/split-bill-detail', params: { splitBillId: linkedSplitBill.id, name: linkedSplitBill.name } } as any)}
            >
              <Ionicons name="people-outline" size={14} color={ACCENT_DARK} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 12, color: ACCENT_DARK }}>{linkedSplitBill.name}</Text>
                <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted }}>
                  contributed {Number(recording?.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={13} color={ACCENT_DARK} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={pageStyles.actionBtn} onPress={openSplitBillModal}>
              <Ionicons name="people-outline" size={15} color={Colors.text} />
              <Text style={pageStyles.actionBtnText}>split bill</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </SafeAreaView>

      {/* Split bill modal */}
      <BottomSheet visible={splitBillModal} onClose={() => setSplitBillModal(false)} title="split bill" height="50%">
        <TouchableOpacity style={[pageStyles.actionBtn, { marginBottom: 16, borderColor: ACCENT, backgroundColor: ACCENT + '44' }]} onPress={createAndLinkSplitBill}>
          <Ionicons name="add-circle-outline" size={15} color={ACCENT_DARK} />
          <Text style={[pageStyles.actionBtnText, { color: ACCENT_DARK }]}>create new split bill</Text>
        </TouchableOpacity>
        {existingSplitBills.length > 0 && (
          <>
            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>add to existing</Text>
            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              {existingSplitBills.map((bill: any) => (
                <TouchableOpacity key={bill.id} style={[pageStyles.actionBtn, { marginBottom: 8, justifyContent: 'flex-start', borderColor: ACCENT, backgroundColor: ACCENT + '44' }]} onPress={() => linkToExistingSplitBill(bill)}>
                  <Ionicons name="people-outline" size={15} color={ACCENT_DARK} />
                  <Text style={[pageStyles.actionBtnText, { color: ACCENT_DARK }]}>{bill.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </BottomSheet>

      {/* Tooltip */}
      {tooltip && (
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setTooltip(null)} activeOpacity={1}>
          <View style={pageStyles.tooltip}>
            <Text style={pageStyles.tooltipText}>{tooltip.name}</Text>
          </View>
        </TouchableOpacity>
      )}

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
                <Ionicons name="folder-outline" size={18} color={ACCENT_DARK} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Brand.font.heading, fontSize: 13, color: Colors.text }} numberOfLines={1}>{entry.note ?? 'untitled'}</Text>
                  <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted }}>{new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                </View>
                <Ionicons name="link-outline" size={14} color={ACCENT_DARK} />
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
            <Ionicons name="camera-outline" size={28} color={ACCENT_DARK} />
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

      {/* Edit recording modal */}
      <BottomSheet visible={editModal} onClose={() => setEditModal(false)} sub="recording" title="edit recording">
        <View style={formStyles.block}>
          <View style={formStyles.blockRow}>
            <Text style={formStyles.blockLabel}>date</Text>
            <TextInput
              style={formStyles.inlineInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.faint}
              value={editDate}
              onChangeText={setEditDate}
            />
          </View>
          <View style={formStyles.blockDivider} />
          <View style={[formStyles.blockRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
            <Text style={formStyles.blockLabel}>bank / account</Text>
            <ScrollView style={{ maxHeight: 180, width: '100%' }} showsVerticalScrollIndicator={false}>
              {editAccounts.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
                    editAccountId === acc.id && { backgroundColor: ACCENT + '44', borderRadius: Radius.md, paddingHorizontal: 8 }]}
                  onPress={() => setEditAccountId(acc.id)}
                >
                  <Ionicons name={editAccountId === acc.id ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={editAccountId === acc.id ? ACCENT_DARK : Colors.faint} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Brand.font.heading, fontSize: 13, color: Colors.text }}>{acc.account_name}</Text>
                    <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted }}>{acc.bank} · {acc.account_number}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
        <View style={formStyles.actions}>
          <TouchableOpacity style={formStyles.cancelBtn} onPress={() => setEditModal(false)}>
            <Text style={formStyles.cancelBtnText}>cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[formStyles.primaryBtn, !editDate && { opacity: 0.4 }]} onPress={saveEdit} disabled={!editDate}>
            <Text style={formStyles.primaryBtnText}>save</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Photo carousel modal */}
      <Modal visible={photoModal} transparent animationType="fade" onRequestClose={() => setPhotoModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 52, right: 24, zIndex: 10 }} onPress={() => setPhotoModal(false)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: photoModalIndex * width, y: 0 }}
          >
            {receiptPhotos.map((p, i) => (
              <View key={p.id} style={{ width, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
                <Image source={{ uri: p.url }} style={{ width: width - 32, height: width - 32, borderRadius: 12 }} resizeMode="contain" />
                <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>{i + 1} / {receiptPhotos.length}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

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
  addMoreText: { fontFamily: Brand.font.mono, fontSize: 11, color: ACCENT_DARK },
  deleteWarning: { fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted, textAlign: 'center', lineHeight: 18 },
  suggestionBox: { backgroundColor: Colors.white, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginTop: -4, marginBottom: 6, overflow: 'hidden' },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestionText: { fontFamily: Brand.font.mono, fontSize: 12, color: Colors.text },
  subitemFormRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, marginLeft: 4 },
  subitemFormInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Tag input
  tagInputWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, padding: 8, minHeight: 44, marginBottom: 4 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: ACCENT + '44', borderRadius: Radius.pill, paddingVertical: 4, paddingLeft: 10, paddingRight: 6 },
  tagChipText: { fontFamily: Brand.font.monoBold, fontSize: 11, color: ACCENT_DARK },
  tagInput: { fontFamily: Brand.font.mono, fontSize: 14, color: Colors.text, minWidth: 120, flex: 1, padding: 2 },
  // Contacts list
  contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  contactName: { fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text },
});










