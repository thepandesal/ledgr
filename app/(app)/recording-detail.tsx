import AddItemModal from './AddItemModal';
import { setPendingFocusDate } from './space-detail';
import { useScreenAnim } from '@/components/ui/ScreenWrapper';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Dimensions, ScrollView, TextInput, Modal, Platform, Image, Share, Alert } from 'react-native';
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
import CollectDueModal from '@/components/modals/CollectDueModal';
import ShareModal from '@/components/modals/ShareModal';
import ReceivableModal from '@/components/modals/ReceivableModal';
import formStyles from '@/components/ui/formStyles';
import { Colors, Radius } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';
import { writeOff } from '../../src/lib/writeOff';

import { useUser } from '../../src/hooks/useUser';

const ACCENT      = Brand.color.accent;
const ACCENT_DARK = Brand.color.accentDark;
const PEACH       = '#FFAB91';
const PAGE        = 20;

const { width } = Dimensions.get('window');
const MAX_NAME_CHARS = 18;
const MAX_ITEM_NAME = 20;

interface Subitem { id: string; name: string; cost: number; people: string[]; }
interface Item { id: string; name: string; cost: number; people: string[]; subitems: Subitem[]; }

export default function RecordingDetailScreen() {
  const { recordingId } = useLocalSearchParams<{ recordingId: string }>();
  const router = useRouter();
  const { slideAnim, handleBack } = useScreenAnim();
  const webviewRef = useRef<any>(null);
  const { defaultCurrency, userId, userName } = useUser();

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
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editCategories, setEditCategories] = useState<any[]>([]);
  const [editAmount, setEditAmount] = useState('');
  const [editAmountLocked, setEditAmountLocked] = useState(false);
  const [editError, setEditError] = useState('');
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
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
  const [splitBillPayments, setSplitBillPayments] = useState<any[]>([]);
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

  // Collect due payment (expense tagged as due, no split bill)
  const [collectDueModal, setCollectDueModal] = useState(false);
  const [collectDueAmount, setCollectDueAmount] = useState('');
  const [collectDueDate, setCollectDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [collectDueComplete, setCollectDueComplete] = useState<boolean | null>(null);
  const [collectDueLoading, setCollectDueLoading] = useState(false);
  const [collectDueSpaceId, setCollectDueSpaceId] = useState<string | null>(null);
  const [collectDueChargeToSpace, setCollectDueChargeToSpace] = useState(false);
  const [collectDueChargeSpaceId, setCollectDueChargeSpaceId] = useState<string | null>(null);
  const [collectDueChargeAccountId, setCollectDueChargeAccountId] = useState<string | null>(null);
  const [collectDueChargeCategoryId, setCollectDueChargeCategoryId] = useState<string | null>(null);
  const [collectDueChargeAccounts, setCollectDueChargeAccounts] = useState<any[]>([]);
  const [collectDueChargeCategories, setCollectDueChargeCategories] = useState<any[]>([]);

  // Shared spaces for space picker
  const [availableSpaces, setAvailableSpaces] = useState<{ id: string; name: string }[]>([]);

  // Space overrides for pay/collect modals
  const [collectSpaceId, setCollectSpaceId] = useState<string | null>(null);
  const [paySpaceId, setPaySpaceId] = useState<string | null>(null);

  // Mark as complete state
  const [markCompleteModal, setMarkCompleteModal] = useState(false);
  const [markCompleteMode, setMarkCompleteMode] = useState<'as-is' | 'full' | 'manual'>('as-is');
  const [markCompleteAmount, setMarkCompleteAmount] = useState('');
  const [markCompleteLoading, setMarkCompleteLoading] = useState(false);

  // Cancel due state
  const [cancelDueConfirm, setCancelDueConfirm] = useState(false);
  const [cancelDueLoading, setCancelDueLoading] = useState(false);

  // Write-off state
  const [writeOffModal, setWriteOffModal] = useState(false);
  const [writeOffReason, setWriteOffReason] = useState('');
  const [writeOffLoading, setWriteOffLoading] = useState(false);

  // Overpayment state
  const [overpaymentModal, setOverpaymentModal] = useState(false);
  const [overpaymentAmount, setOverpaymentAmount] = useState(0);

  const confirmOverpaymentIncome = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('recordings').insert({
      user_id: user.id,
      space_id: recording?.space_id ?? null,
      name: `${recording?.name ?? 'recording'} · overpayment`,
      type: 'income',
      amount: overpaymentAmount,
      transaction_date: new Date().toISOString().split('T')[0],
      status: 'received',
    });
    setOverpaymentModal(false);
  };

  const confirmWriteOff = async () => {
    if (!recording) return;
    setWriteOffLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const remaining = Math.max(0, Number(recording.amount) - Number(recording.paid_amount ?? 0));
      await writeOff({
        parentRecordingId: recordingId as string,
        parentName: recording.name,
        amount: remaining,
        spaceId: recording.space_id ?? null,
        userId: user.id,
        reason: writeOffReason,
      });
      setRecording((prev: any) => ({ ...prev, status: 'paid' }));
      setWriteOffModal(false);
      setWriteOffReason('');
      loadPaymentData();
    } catch (e) { /* write-off failed silently */ }
    finally { setWriteOffLoading(false); }
  };

  // Create receivable from expense
  const [receivableModal, setReceivableModal] = useState(false);
  const [receivableMode, setReceivableMode] = useState<'full' | 'manual' | 'split'>('full');
  const [receivableManualAmount, setReceivableManualAmount] = useState('');
  const [receivableSelectedPeople, setReceivableSelectedPeople] = useState<string[]>([]);
  const [receivableLoading, setReceivableLoading] = useState(false);

  // Tag a friend
  const [tagFriendModal, setTagFriendModal] = useState(false);
  const [tagFriends, setTagFriends] = useState<{ id: string; name: string }[]>([]);
  const [tagSelectedFriend, setTagSelectedFriend] = useState<{ id: string; name: string } | null>(null);
  const [tagAmount, setTagAmount] = useState('');
  const [tagLoading, setTagLoading] = useState(false);
  const [tagError, setTagError] = useState('');
  const [existingTags, setExistingTags] = useState<any[]>([]);

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
  const [chargedFromSplitBill, setChargedFromSplitBill] = useState<{ id: string; name: string } | null>(null);
  const [relatedSplitBillPayments, setRelatedSplitBillPayments] = useState<any[]>([]);
  const [splitBillModal, setSplitBillModal] = useState(false);
  const [splitBillName, setSplitBillName] = useState('');
  const [existingSplitBills, setExistingSplitBills] = useState<any[]>([]);


  const loadRelatedSplitBillPayments = async () => {
    if (!recordingId) return;
    const { data } = await supabase
      .from('split_bill_payments')
      .select('id, person_name, amount, created_at, status')
      .eq('charged_recording_id', recordingId)
      .order('created_at', { ascending: false });
    setRelatedSplitBillPayments(data ?? []);
    // Load the split bill this expense was charged from
    if (data && data.length > 0) {
      const { data: rec } = await supabase.from('recordings').select('split_bill_id').eq('id', recordingId).single();
      if (rec?.split_bill_id) {
        const { data: sb } = await supabase.from('split_bills').select('id, name').eq('id', rec.split_bill_id).single();
        if (sb) setChargedFromSplitBill(sb);
      }
    }
  };

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
    const billName = splitBillName.trim() || recording.name;
    const { data: bill } = await supabase.from('split_bills')
      .insert({ user_id: user.id, name: billName })
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
    setSplitBillName(recording?.name ?? '');
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
      handleBack();
    } catch (e) { /* delete failed silently */ }
    finally { setDeleteLoading(false); }
  };

  useEffect(() => {
    Promise.all([
      loadRecording(),
      loadContacts(),
      loadPeople(),
      loadItems(),
      loadLinkedReceipt(),
      loadLinkedSplitBill(),
      loadRelatedSplitBillPayments(),
      loadAvailableSpaces(),
      supabase.from('split_shares').select('id').eq('recording_id', recordingId).maybeSingle()
        .then(({ data }) => { if (data) setShareRowId(data.id); }),
    ]).then(() => loadPaymentData());
  }, []);

  useFocusEffect(useCallback(() => {
    loadRecording();
    loadPaymentData();
  }, [recordingId]));

  const loadPaymentData = async () => {
    if (!recordingId) return;
    const { data: rec } = await supabase.from('recordings').select('type, linked_recording_id').eq('id', recordingId).single();
    if (!rec) return;

    // Always load split bill payments if this recording is linked to a split bill
    const { data: sbrRow } = await supabase
      .from('split_bill_recordings')
      .select('split_bill_id')
      .eq('recording_id', recordingId)
      .maybeSingle();
    if (sbrRow?.split_bill_id) {
      const { data: sbp } = await supabase
        .from('split_bill_payments')
        .select('id, person_name, amount, created_at')
        .eq('split_bill_id', sbrRow.split_bill_id)
        .order('created_at', { ascending: false });
      setSplitBillPayments(sbp ?? []);
    } else {
      setSplitBillPayments([]);
    }

    if (rec.type === 'debt' || rec.type === 'due') {
      const paymentType = rec.type === 'debt' ? 'expense' : 'return';
      const { data: payments } = await supabase.from('recordings')
        .select('id, name, amount, transaction_date, is_write_off, payment_to, payment_from_account_id, accounts:payment_from_account_id(account_name, bank)')
        .eq('linked_recording_id', recordingId).eq('type', paymentType).order('transaction_date', { ascending: false });
      const { data: writeOffPayments } = await supabase.from('recordings')
        .select('id, name, amount, transaction_date, is_write_off')
        .eq('linked_recording_id', recordingId).eq('is_write_off', true)
        .order('transaction_date', { ascending: false });
      const allPayments = [...(payments ?? []), ...(writeOffPayments ?? [])]
        .sort((a, b) => (b.transaction_date ?? '').localeCompare(a.transaction_date ?? ''));
      if (allPayments.length > 0) {
        setLinkedPayments(allPayments);
        // Load breakdowns for all payment records to build per-person status
        const paymentIds = (payments ?? []).map((p: any) => p.id);
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
      const { data: returnPayments } = await supabase.from('recordings')
        .select('id, name, amount, transaction_date, is_write_off, payment_to, payment_from_account_id, accounts:payment_from_account_id(account_name, bank)')
        .eq('linked_recording_id', recordingId).eq('type', 'return').order('transaction_date', { ascending: false });
      const { data: writeOffPayments } = await supabase.from('recordings')
        .select('id, name, amount, transaction_date, is_write_off')
        .eq('linked_recording_id', recordingId).eq('is_write_off', true)
        .order('transaction_date', { ascending: false });
      const allPayments = [...(returnPayments ?? []), ...(writeOffPayments ?? [])]
        .sort((a, b) => (b.transaction_date ?? '').localeCompare(a.transaction_date ?? ''));
      if (allPayments.length > 0) {
        setLinkedPayments(allPayments);
        const totalCollected = (returnPayments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
        setRecording((prev: any) => prev ? { ...prev, paid_amount: totalCollected } : prev);
      }
      const { data: recv } = await supabase.from('recordings').select('id, name').eq('linked_recording_id', recordingId).eq('type', 'due').maybeSingle();
      if (recv) setLinkedReceivable(recv);
    }
  };

  const openMarkCompleteModal = () => {
    setMarkCompleteMode('as-is');
    setMarkCompleteAmount('');
    setMarkCompleteModal(true);
  };

  const confirmMarkComplete = async () => {
    if (!recording) return;
    setMarkCompleteLoading(true);
    try {
      const total = Number(recording.amount);
      if (markCompleteMode === 'manual') {
        const overrideAmt = parseFloat(markCompleteAmount || '0') || 0;
        if (overrideAmt <= 0) { setMarkCompleteLoading(false); return; }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setMarkCompleteLoading(false); return; }
        await supabase.from('recordings').insert({
          user_id: user.id,
          space_id: recording.space_id,
          name: recording.name,
          type: 'return',
          amount: overrideAmt,
          transaction_date: new Date().toISOString().split('T')[0],
          status: 'received',
          linked_recording_id: recordingId,
          category_id: recording.category_id ?? null,
        });
        await supabase.from('recordings').update({ paid_amount: overrideAmt, status: 'paid' }).eq('id', recordingId);
        setRecording((prev: any) => ({ ...prev, paid_amount: overrideAmt, status: 'paid' }));
      } else if (markCompleteMode === 'full') {
        await supabase.from('recordings').update({ paid_amount: total, status: 'paid' }).eq('id', recordingId);
        setRecording((prev: any) => ({ ...prev, paid_amount: total, status: 'paid' }));
      } else {
        // as-is: keep paid_amount, just mark paid
        await supabase.from('recordings').update({ status: 'paid' }).eq('id', recordingId);
        setRecording((prev: any) => ({ ...prev, status: 'paid' }));
      }
      setMarkCompleteModal(false);
      loadPaymentData();
    } catch (e) { /* mark complete failed silently */ }
    finally { setMarkCompleteLoading(false); }
  };

  const openCollectDueModal = async () => {
    setCollectDueAmount('');
    setCollectDueDate(new Date().toISOString().split('T')[0]);
    setCollectDueComplete(null);
    setCollectDueSpaceId(recording?.space_id ?? null);
    setCollectDueChargeToSpace(false);
    setCollectDueChargeSpaceId(null);
    setCollectDueChargeAccountId(null);
    setCollectDueChargeCategoryId(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const [{ data: accs }, { data: cats }] = await Promise.all([
        supabase.from('accounts').select('id, account_name, bank').eq('user_id', user.id).order('account_name'),
        supabase.from('categories').select('id, name').eq('user_id', user.id).order('name'),
      ]);
      setCollectDueChargeAccounts(accs ?? []);
      setCollectDueChargeCategories(cats ?? []);
    }
    setCollectDueModal(true);
  };

  const confirmCollectDue = async () => {
    if (!recording || collectDueComplete === null) return;
    const amount = parseFloat(collectDueAmount || '0') || 0;
    if (amount <= 0) return;
    setCollectDueLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const prevPaid = Number(recording.paid_amount ?? 0);
      const total = Number(recording.amount ?? 0);
      const newPaid = prevPaid + amount;
      const cappedPaid = Math.min(newPaid, total);
      const excess = newPaid - total;
      const newStatus = collectDueComplete ? 'paid' : 'partial';
      // Create a return recording for the collection
      await supabase.from('recordings').insert({
        user_id: user.id,
        space_id: collectDueSpaceId ?? recording.space_id,
        name: recording.name,
        type: 'return',
        amount,
        transaction_date: collectDueDate,
        status: 'received',
        linked_recording_id: recordingId,
        category_id: recording.category_id ?? null,
      });
      await supabase.from('recordings').update({ paid_amount: cappedPaid, status: newStatus }).eq('id', recordingId);
      setRecording((prev: any) => ({ ...prev, paid_amount: cappedPaid, status: newStatus }));
      // Charge to space
      if (collectDueChargeToSpace && collectDueChargeSpaceId) {
        const today = collectDueDate;
        const { data: existingArr } = await supabase
          .from('recordings')
          .select('id, amount')
          .eq('linked_recording_id', recordingId)
          .eq('space_id', collectDueChargeSpaceId)
          .eq('type', 'expense')
          .limit(1);
        const existing = existingArr?.[0] ?? null;
        if (existing) {
          await supabase.from('recordings').update({ amount: Number(existing.amount) + amount, transaction_date: today }).eq('id', existing.id);
        } else {
          await supabase.from('recordings').insert({
            user_id: user.id,
            space_id: collectDueChargeSpaceId,
            name: recording.name,
            type: 'expense',
            amount,
            transaction_date: today,
            status: 'paid',
            linked_recording_id: recordingId,
            account_id: collectDueChargeAccountId || null,
            category_id: collectDueChargeCategoryId || null,
          });
        }
      }
      setCollectDueModal(false);
      loadPaymentData();
      syncTaggedExpenses(cappedPaid, newStatus);
      if (excess > 0.01) {
        setOverpaymentAmount(Math.round(excess * 100) / 100);
        setOverpaymentModal(true);
      }
    } catch (e) { /* collect due failed silently */ }
    finally { setCollectDueLoading(false); }
  };

  const confirmCancelDue = async () => {
    setCancelDueLoading(true);
    try {
      await supabase.from('recordings').update({ is_due: false, paid_amount: 0, status: 'unpaid' }).eq('id', recordingId);
      setRecording((prev: any) => ({ ...prev, is_due: false, paid_amount: 0, status: 'unpaid' }));
      setCancelDueConfirm(false);
    } catch (e) { /* cancel due failed silently */ }
    finally { setCancelDueLoading(false); }
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
    setCollectSpaceId(recording?.space_id ?? null);
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
        space_id: collectSpaceId ?? recording.space_id,
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
      const total = Number(recording.amount ?? 0);
      const newPaid = prevPaid + amount;
      const cappedPaid = Math.min(newPaid, total);
      const excess = newPaid - total;
      await supabase.from('recordings').update({
        status: collectComplete ? 'paid' : 'partial',
        paid_amount: cappedPaid,
      }).eq('id', recordingId);
      setRecording((prev: any) => ({ ...prev, status: collectComplete ? 'paid' : 'partial', paid_amount: cappedPaid }));
      setCollectModal(false);
      loadPaymentData();
      if (excess > 0.01) {
        setOverpaymentAmount(Math.round(excess * 100) / 100);
        setOverpaymentModal(true);
      }
    } catch (e) { /* collect failed silently */ }
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
    setPaySpaceId(recording?.space_id ?? null);
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
        space_id: paySpaceId ?? recording.space_id,
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
      const total = Number(recording.amount ?? 0);
      const newPaid = prevPaid + amount;
      const cappedPaid = Math.min(newPaid, total);
      const excess = newPaid - total;
      await supabase.from('recordings').update({
        status: payComplete ? 'paid' : 'partial',
        paid_amount: cappedPaid,
      }).eq('id', recordingId);
      setRecording((prev: any) => ({ ...prev, status: payComplete ? 'paid' : 'partial', paid_amount: cappedPaid }));
      setPayModal(false);
      loadPaymentData();
      if (excess > 0.01) {
        setOverpaymentAmount(Math.round(excess * 100) / 100);
        setOverpaymentModal(true);
      }
    } catch (e) { /* payment failed silently */ }
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
    setReceivableLoading(true);
    try {
      // Just tag the expense as due — no separate recording created
      await supabase.from('recordings').update({ is_due: true }).eq('id', recordingId);
      setRecording((prev: any) => ({ ...prev, is_due: true }));
      setReceivableModal(false);
      setReceivableMode('full');
      setReceivableManualAmount('');
      setReceivableSelectedPeople([]);
    } catch (e) { /* receivable failed silently */ }
    finally { setReceivableLoading(false); }
  };

  const loadExistingShare = async () => {
    // no-op: share data is now fetched live on the share page
  };

  const openTagFriendModal = async () => {
    setTagError('');
    setTagAmount(String(recording?.amount ?? ''));
    setTagSelectedFriend(null);
    const { data } = await supabase.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted').or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
    if (!data) { setTagFriends([]); setTagFriendModal(true); return; }
    const friendIds = data.map((r: any) => r.requester_id === userId ? r.receiver_id : r.requester_id);
    const names = await Promise.all(friendIds.map(async (id: string) => {
      const { data: n } = await supabase.rpc('get_user_display_name', { user_id: id });
      return { id, name: n ?? 'unknown' };
    }));
    setTagFriends(names);
    const { data: tags } = await supabase.from('recording_tags').select('tagged_user_id').eq('recording_id', recordingId).in('status', ['pending', 'accepted']);
    setExistingTags(tags ?? []);
    setTagFriendModal(true);
  };

  const confirmTagFriend = async () => {
    if (!tagSelectedFriend || !tagAmount) return;
    setTagLoading(true); setTagError('');
    try {
      const amount = parseFloat(tagAmount);
      if (isNaN(amount) || amount <= 0) { setTagError('enter a valid amount'); setTagLoading(false); return; }
      const alreadyTagged = existingTags.some((t: any) => t.tagged_user_id === tagSelectedFriend.id);
      if (alreadyTagged) { setTagError('this friend is already tagged'); setTagLoading(false); return; }
      await supabase.from('recording_tags').insert({ recording_id: recordingId, tagger_user_id: userId, tagged_user_id: tagSelectedFriend.id, amount, status: 'pending' });
      await supabase.from('notifications').insert({ user_id: tagSelectedFriend.id, type: 'expense_tag', title: `${userName || 'Someone'} tagged you in an expense`, body: 'Tap Requests in Notifications to view and respond.', data: { recordingId, taggerName: userName }, status: 'new', is_read: false });
      setTagFriendModal(false);
      const { data: tags } = await supabase.from('recording_tags').select('tagged_user_id').eq('recording_id', recordingId).in('status', ['pending', 'accepted']);
      setExistingTags(tags ?? []);
    } catch (e: any) { setTagError(e.message ?? 'something went wrong'); }
    finally { setTagLoading(false); }
  };

  const syncTaggedExpenses = async (totalPaid: number, status: string) => {
    if (!recordingId || !userId) return;
    try {
      const { data: tags } = await supabase.from('recording_tags').select('*').eq('recording_id', recordingId).eq('status', 'accepted');
      if (!tags || tags.length === 0) return;
      for (const tag of tags) {
        if (tag.mirrored_expense_id) {
          await supabase.from('recordings').update({ amount: totalPaid, status: status === 'paid' ? 'paid' : 'partial' }).eq('id', tag.mirrored_expense_id);
        } else {
          const { data: newExp } = await supabase.from('recordings').insert({ user_id: tag.tagged_user_id, name: recording?.name ?? 'tagged expense', type: 'expense', amount: totalPaid, transaction_date: new Date().toISOString().split('T')[0], status: status === 'paid' ? 'paid' : 'partial', currency: recording?.currency ?? 'PHP', notes: `from ${userName || 'someone'} · auto-recorded`, is_tagged: true }).select('id').single();
          if (newExp?.id) await supabase.from('recording_tags').update({ mirrored_expense_id: newExp.id }).eq('id', tag.id);
        }
        await supabase.from('notifications').insert({ user_id: tag.tagged_user_id, type: 'tag_payment_update', title: `${userName || 'Someone'} logged a payment`, body: `${recording?.name ?? 'expense'} · ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })} paid so far`, data: { recordingId, tagId: tag.id }, status: 'new', is_read: false });
      }
    } catch (e) { console.warn('[tag] sync failed:', e); }
  };

  useEffect(() => {
    if (!recordingId || !userId) return;
    supabase.from('recording_tags').select('tagged_user_id').eq('recording_id', recordingId).in('status', ['pending', 'accepted']).then(({ data }) => setExistingTags(data ?? []));
  }, [recordingId, userId]);

  const addReceiptFromCamera = async () => {
    try {
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
    } catch (e: any) {
      if (e?.message === 'RECEIPT_LIMIT_REACHED') {
        Alert.alert('monthly limit reached', 'you\'ve used all 10 free receipt photo uploads this month. resets on the 1st.');
      }
    }
  };

  const addReceiptFromGallery = async () => {
    try {
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
    } catch (e: any) {
      if (e?.message === 'RECEIPT_LIMIT_REACHED') {
        Alert.alert('monthly limit reached', 'you\'ve used all 10 free receipt photo uploads this month. resets on the 1st.');
      }
    }
  };

  const loadLinkedReceipt = async () => {
    if (!recordingId) return;
    const { data: entry } = await supabase.from('receipt_entries').select('id, note, created_at').eq('recording_id', recordingId).maybeSingle();
    if (!entry) return;
    setLinkedReceipt(entry);
    const { data: photos } = await supabase.from('receipt_photos').select('id, storage_path, url').eq('entry_id', entry.id).order('created_at').limit(5);
    if (photos) {
      const resolved = await Promise.all(photos.map(async (p: any) => {
        if (p.url) return { id: p.id, url: p.url };
        const { data: signed } = await supabase.storage.from('receipts').createSignedUrl(p.storage_path, 3600);
        return { id: p.id, url: signed?.signedUrl ?? '' };
      }));
      setReceiptPhotos(resolved.filter(p => p.url));
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

  const loadAvailableSpaces = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: ownSpaces }, { data: members }] = await Promise.all([
      supabase.from('spaces').select('id, name').eq('user_id', user.id).order('name'),
      supabase.from('space_members').select('space_id, role').eq('user_id', user.id).eq('status', 'accepted').in('role', ['owner', 'co-owner']),
    ]);
    const sharedIds = (members ?? []).map((m: any) => m.space_id);
    let sharedSpaces: any[] = [];
    if (sharedIds.length > 0) {
      const { data } = await supabase.from('spaces').select('id, name').in('id', sharedIds).order('name');
      sharedSpaces = data ?? [];
    }
    const all = [...(ownSpaces ?? []), ...sharedSpaces];
    const seen = new Set<string>();
    setAvailableSpaces(all.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; }));
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
    const paymentHtml = data.payment.length > 0 ? `
      <h3 style="font-size:14px;color:#7fd8cd;margin:24px 0 10px">payment information</h3>
      ${data.payment.map(acc => `
      <div style="background:#fafafa;border-radius:12px;padding:14px;border:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-size:15px;font-weight:600;color:#425252">${acc.accountName}</div>
          <div style="font-family:monospace;font-size:11px;color:#929090">${acc.bank}</div>
          <div style="font-family:monospace;font-weight:bold;font-size:13px;color:#425252">${acc.accountNumber}</div>
        </div>
        ${acc.qrCode ? `<img src="${acc.qrCode}" width="80" height="80" style="border-radius:8px"/>` : ''}
      </div>`).join('')}
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
    } catch (e) { /* webview capture failed silently */ }
    finally { setShareLoading(false); }
  };


  const openEditModal = async () => {
    setEditDate(recording?.transaction_date ?? '');
    setEditAccountId(recording?.account_id ?? '');
    setEditName(recording?.name ?? '');
    setEditNotes(recording?.notes ?? '');
    setEditCategoryId(recording?.category_id ?? null);
    setEditAmount(String(recording?.amount ?? ''));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: accs }, { data: cats }, { data: linked }] = await Promise.all([
      supabase.from('accounts').select().eq('user_id', user.id).order('account_name'),
      supabase.from('categories').select().eq('user_id', user.id).order('name'),
      supabase.from('recordings').select('id').eq('linked_recording_id', recordingId).limit(1),
    ]);
    if (accs) setEditAccounts(accs);
    if (cats) setEditCategories(cats);
    // Lock amount if any linked recordings exist (payments, returns, etc.)
    setEditAmountLocked((linked ?? []).length > 0);
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editDate) return;
    setEditError('');
    const updates: any = {
      name: editName.trim() || recording?.name,
      transaction_date: editDate,
      account_id: editAccountId || null,
      category_id: editCategoryId || null,
      notes: editNotes.trim() || null,
    };
    if (!editAmountLocked && editAmount && parseFloat(editAmount) > 0) {
      updates.amount = parseFloat(editAmount);
    }
    const { error } = await supabase.from('recordings').update(updates).eq('id', recordingId);
    if (error) { setEditError(error.message); return; }
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

  const formatDate = (d: string) => { if (!d) return '—'; const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };

  const typeLabel = (type: string, status: string) => {
    if (recording?.is_write_off) return 'Write-off';
    if (type === 'debt') {
      if (status === 'paid')    return 'Debt · Paid';
      if (status === 'partial') return 'Debt · Partially Paid';
      return 'Debt · Unpaid';
    }
    if (type === 'due') {
      if (status === 'paid')    return 'Due · Collected';
      if (status === 'partial') return 'Due · Partially Paid';
      return 'Due · Unpaid';
    }
    if (type === 'return') return 'Return';
    if (type === 'expense' && recording?.is_due) {
      const paid = Number(recording?.paid_amount ?? 0);
      const total = Number(recording?.amount ?? 0);
      const collected = total > 0 && paid >= total - 0.01;
      const partial   = paid > 0 && !collected;
      if (collected) return 'Expense · Collected';
      if (partial)   return 'Expense · Due · Partial';
      return 'Expense · Due';
    }
    return { expense: 'Expense', income: 'Income' }[type] ?? type;
  };

          const isPayableLocked = recording?.type === 'debt' && (recording?.status === 'partial' || recording?.status === 'paid');
  const isReceivableLocked = recording?.type === 'due' && (recording?.status === 'partial' || recording?.status === 'paid');
  const isSplitLocked = isPayableLocked || isReceivableLocked;

  const PREVIEW_LIMIT = 4;
  const visiblePeople = filledPeople.slice(0, PREVIEW_LIMIT);
  const extraCount = filledPeople.length - PREVIEW_LIMIT;

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: Colors.white }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={rd.header}>
          <TouchableOpacity onPress={handleBack} style={rd.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color="#B6E1DE" />
          </TouchableOpacity>
          <Text style={rd.title} numberOfLines={1}>{truncate(recording?.name ?? '', MAX_NAME_CHARS).toLowerCase()}</Text>
          <TouchableOpacity onPress={openEditModal} style={{ padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="create-outline" size={16} color="#B6E1DE" />
          </TouchableOpacity>
          <View style={rd.amountBadge}>
            <Text style={[rd.amountBadgeText, { color: amountColor() }]}>{displayAmount()}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={rd.scroll} showsVerticalScrollIndicator={false}>
          <View style={{ height: 8 }} />
          {/* Summary grid */}
          <View style={rd.summaryGrid}>
            <View style={rd.summaryCell}>
              <Text style={rd.summaryLabel}>amount</Text>
              <Text style={[rd.summaryValue, { color: amountColor() }]}>
                {Number(recording?.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted }}> {defaultCurrency}</Text>
              </Text>
            </View>
            <View style={rd.summaryCell}>
              <Text style={rd.summaryLabel}>type</Text>
              <Text style={rd.summaryValue}>{typeLabel(recording?.type ?? '', recording?.status ?? '')}</Text>
            </View>
            <View style={rd.summaryCell}>
              <Text style={rd.summaryLabel}>date</Text>
              <Text style={rd.summaryValue}>{formatDate(recording?.transaction_date)}</Text>
            </View>
            <View style={rd.summaryCell}>
              <Text style={rd.summaryLabel}>status</Text>
              <Text style={rd.summaryValue}>{recording?.status ?? '—'}</Text>
            </View>
            {(recording?.is_due || recording?.type === 'due' || recording?.type === 'debt') && (
              <View style={rd.summaryCell}>
                <Text style={rd.summaryLabel}>{recording?.type === 'debt' ? 'paid' : 'collected'}</Text>
                <Text style={rd.summaryValue}>
                  {Number(recording?.paid_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}/{Number(recording?.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
            <View style={rd.summaryCell}>
              <Text style={rd.summaryLabel}>category</Text>
              <Text style={rd.summaryValue}>{recording?.categories?.name ?? '—'}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={rd.divider} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 12 }} contentContainerStyle={{ paddingHorizontal: PAGE, gap: 8 }}>
            {recording?.type === 'expense' && !linkedPayable && !linkedReceivable && !recording?.is_due && (
              <TouchableOpacity style={rd.actionChip} onPress={() => { setReceivableMode('full'); setReceivableManualAmount(''); setReceivableSelectedPeople([]); setReceivableModal(true); }}>
                <Ionicons name="arrow-undo-outline" size={13} color={ACCENT_DARK} />
                <Text style={rd.actionChipText}>tag as due</Text>
              </TouchableOpacity>
            )}
            {recording?.type === 'expense' && recording?.is_due && (
              <TouchableOpacity style={rd.actionChip} onPress={openTagFriendModal}>
                <Ionicons name="person-add-outline" size={13} color={ACCENT_DARK} />
                <Text style={rd.actionChipText}>tag a friend{existingTags.length > 0 ? ` (${existingTags.length})` : ''}</Text>
              </TouchableOpacity>
            )}
            {recording?.type === 'expense' && recording?.is_due && (() => {
              const total = Number(recording.amount);
              const paid  = Number(recording.paid_amount ?? 0);
              const fullyCollected = paid >= total - 0.01;
              const nothingCollected = paid <= 0;
              return fullyCollected ? (
                <View style={[rd.actionChip, { backgroundColor: Colors.successBg }]}>
                  <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                  <Text style={[rd.actionChipText, { color: Colors.success }]}>fully collected</Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={rd.actionChip}
                    onPress={() => {
                      if (linkedSplitBill) {
                        router.push({ pathname: '/(app)/split-bill-detail', params: { splitBillId: linkedSplitBill.id, name: linkedSplitBill.name } } as any);
                      } else {
                        openCollectDueModal();
                      }
                    }}
                  >
                    <Ionicons name="arrow-down-circle-outline" size={13} color={ACCENT_DARK} />
                    <Text style={rd.actionChipText}>collect payment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={rd.actionChip} onPress={openMarkCompleteModal}>
                    <Ionicons name="checkmark-done-circle-outline" size={13} color={ACCENT_DARK} />
                    <Text style={rd.actionChipText}>mark as complete</Text>
                  </TouchableOpacity>
                  {nothingCollected && (
                    <TouchableOpacity
                      style={[rd.actionChip, { backgroundColor: Colors.dangerBg }]}
                      onPress={() => setCancelDueConfirm(true)}
                    >
                      <Ionicons name="close-circle-outline" size={13} color={Colors.danger} />
                      <Text style={[rd.actionChipText, { color: Colors.danger }]}>cancel due</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
            {recording?.type === 'debt' && recording?.status !== 'paid' && (
              <TouchableOpacity style={rd.actionChip} onPress={openPayModal}>
                <Ionicons name="cash-outline" size={13} color={ACCENT_DARK} />
                <Text style={rd.actionChipText}>pay debt</Text>
              </TouchableOpacity>
            )}
            {recording?.type === 'debt' && recording?.status === 'paid' && (
              <View style={[rd.actionChip, { backgroundColor: Colors.successBg }]}>
                <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                <Text style={[rd.actionChipText, { color: Colors.success }]}>fully paid</Text>
              </View>
            )}
            {recording?.type === 'due' && recording?.status !== 'paid' && (
              <TouchableOpacity style={rd.actionChip} onPress={openCollectModal}>
                <Ionicons name="arrow-down-circle-outline" size={13} color={ACCENT_DARK} />
                <Text style={rd.actionChipText}>collect</Text>
              </TouchableOpacity>
            )}
            {recording?.type === 'due' && recording?.status === 'paid' && (
              <View style={[rd.actionChip, { backgroundColor: Colors.successBg }]}>
                <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                <Text style={[rd.actionChipText, { color: Colors.success }]}>fully collected</Text>
              </View>
            )}
            <TouchableOpacity style={[rd.actionChip, { backgroundColor: Colors.dangerBg }]} onPress={() => setDeleteConfirm(true)}>
              <Ionicons name="trash-outline" size={13} color={Colors.danger} />
              <Text style={[rd.actionChipText, { color: Colors.danger }]}>delete</Text>
            </TouchableOpacity>
            {/* Write-off chip — visible when there is an unpaid remainder */}
            {(() => {
              const isWriteOffable =
                (recording?.type === 'due' || recording?.type === 'debt' ||
                 (recording?.type === 'expense' && recording?.is_due)) &&
                recording?.status !== 'paid';
              const remaining = Math.max(0, Number(recording?.amount ?? 0) - Number(recording?.paid_amount ?? 0));
              if (!isWriteOffable || remaining <= 0) return null;
              return (
                <TouchableOpacity
                  style={[rd.actionChip, { backgroundColor: '#92909022', borderWidth: 1, borderColor: '#92909044' }]}
                  onPress={() => { setWriteOffReason(''); setWriteOffModal(true); }}
                >
                  <Ionicons name="close-circle-outline" size={13} color={Colors.muted} />
                  <Text style={[rd.actionChipText, { color: Colors.muted }]}>write off</Text>
                </TouchableOpacity>
              );
            })()}
          </ScrollView>

          {/* Receipt */}
          <View style={rd.divider} />
          <View style={rd.sectionRow}>
            <Text style={rd.sectionHeader}>receipt</Text>
            <TouchableOpacity style={rd.sectionAddBtn} onPress={() => setAddReceiptModal(true)}>
              <Ionicons name="add" size={12} color={ACCENT_DARK} />
              <Text style={rd.sectionAddText}>add</Text>
            </TouchableOpacity>
          </View>
          {linkedReceipt ? (
            <View style={{ paddingHorizontal: PAGE }}>
              {receiptPhotos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                  {receiptPhotos.map((p, idx) => (
                    <TouchableOpacity key={p.id} onPress={() => { setPhotoModalIndex(idx); setPhotoModal(true); }} activeOpacity={0.85}>
                      <Image source={{ uri: p.url }} style={{ width: 90, height: 90, borderRadius: Radius.md, backgroundColor: Colors.surface }} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={rd.emptyWrap}><Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted }}>loading photos...</Text></View>
              )}
              <TouchableOpacity style={rd.recRow} onPress={() => router.push({ pathname: '/(app)/receipt-detail', params: { receiptId: linkedReceipt.id } } as any)}>
                <View style={rd.recIconWrap}><Ionicons name="receipt-outline" size={14} color={ACCENT_DARK} /></View>
                <Text style={[rd.recName, { flex: 1 }]}>view full receipt</Text>
                <Ionicons name="chevron-forward" size={13} color={Colors.muted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={rd.emptyWrap}><Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted }}>no receipt attached</Text></View>
          )}

          {/* Other Information */}
          <View style={rd.divider} />
          <View style={rd.sectionRow}>
            <Text style={rd.sectionHeader}>other information</Text>
          </View>
          <View style={{ paddingHorizontal: PAGE }}>
            <View style={rd.infoRow}>
              <Text style={rd.infoLabel}>account</Text>
              <Text style={rd.infoValue}>{truncate(recording?.account?.account_name ?? '—', 20)}</Text>
            </View>
            <View style={rd.infoRow}>
              <Text style={rd.infoLabel}>{recording?.type === 'debt' ? 'paying' : 'owes you'}</Text>
              <Text style={rd.infoValue}>{recording?.person_name ?? '—'}</Text>
            </View>
            <View style={rd.infoRow}>
              <Text style={rd.infoLabel}>notes</Text>
              <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.text, lineHeight: 18, flex: 1, textAlign: 'right' }}>{recording?.notes ?? '—'}</Text>
            </View>
            {linkedPayable && (
              <TouchableOpacity style={rd.infoRow} onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: linkedPayable.id } } as any)}>
                <Text style={rd.infoLabel}>{recording?.type === 'return' ? 'linked due' : 'linked debt'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[rd.infoValue, { color: ACCENT_DARK }]}>{truncate(linkedPayable.name, 16)}</Text>
                  <Ionicons name="chevron-forward" size={11} color={ACCENT_DARK} />
                </View>
              </TouchableOpacity>
            )}
            {linkedReceivable && (
              <TouchableOpacity style={rd.infoRow} onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: linkedReceivable.id } } as any)}>
                <Text style={rd.infoLabel}>linked receivable</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[rd.infoValue, { color: ACCENT_DARK }]}>{truncate(linkedReceivable.name, 16)}</Text>
                  <Ionicons name="chevron-forward" size={11} color={ACCENT_DARK} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Payments / Collections */}
          {(recording?.type === 'debt' || recording?.type === 'due' || (recording?.type === 'expense' && linkedPayments.length > 0)) && linkedPayments.length > 0 && (
            <>
              <View style={rd.divider} />
              <View style={rd.sectionRow}>
                <Text style={rd.sectionHeader}>{recording.type === 'due' ? 'collections' : 'collections'}</Text>
              </View>
              <View style={{ paddingHorizontal: PAGE }}>
                {linkedPayments.map((p: any, i: number) => (
                  <TouchableOpacity key={p.id} style={[rd.recRow, p.is_write_off && { opacity: 0.6 }]} onPress={() => !p.is_write_off && router.push({ pathname: '/(app)/recording-detail', params: { recordingId: p.id } } as any)}>
                    <View style={[rd.recIconWrap, p.is_write_off && { backgroundColor: Colors.surface }]}>
                      <Ionicons name={p.is_write_off ? 'close-circle-outline' : 'cash-outline'} size={14} color={p.is_write_off ? Colors.muted : ACCENT_DARK} />
                    </View>
                    <View style={rd.recMid}>
                      <Text style={[rd.recName, p.is_write_off && { color: Colors.muted }]}>{Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      <Text style={rd.recDate}>{formatDate(p.transaction_date)}{p.accounts?.account_name ? ` · ${p.accounts.account_name}` : ''}</Text>
                      {p.is_write_off && <Text style={{ fontFamily: Brand.font.mono, fontSize: 9, color: Colors.muted }}>write-off</Text>}
                      {p.payment_to && !p.is_write_off && <Text style={[rd.recDate, { color: ACCENT_DARK }]}>{p.payment_to}</Text>}
                    </View>
                    {!p.is_write_off && <Ionicons name="chevron-forward" size={13} color={Colors.muted} />}
                  </TouchableOpacity>
                ))}
              </View>
              {personPayStatus.length > 0 && (
                <>
                  <View style={rd.sectionRow}>
                    <Text style={rd.sectionHeader}>per person status</Text>
                  </View>
                  <View style={{ paddingHorizontal: PAGE }}>
                    {personPayStatus.map((s, i) => {
                      const fullyPaid = s.total > 0 && s.paid >= s.total - 0.01;
                      const partial = s.paid > 0 && !fullyPaid;
                      const statusColor = fullyPaid ? ACCENT_DARK : partial ? ACCENT_DARK : Colors.muted;
                      return (
                        <View key={s.person} style={rd.recRow}>
                          <Ionicons name={fullyPaid ? 'checkmark-circle' : partial ? 'ellipse' : 'ellipse-outline'} size={16} color={statusColor} />
                          <View style={rd.recMid}>
                            <Text style={rd.recName}>{s.person}</Text>
                            <Text style={rd.recDate}>{s.paid > 0 ? `${s.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })} of ${s.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `owes ${s.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}</Text>
                          </View>
                          <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 11, color: statusColor }}>{fullyPaid ? 'paid' : partial ? 'partial' : 'unpaid'}</Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          )}

          {/* Split bill collections */}
          {splitBillPayments.length > 0 && (
            <>
              <View style={rd.divider} />
              <View style={rd.sectionRow}>
                <Text style={rd.sectionHeader}>split bill collections</Text>
              </View>
              <View style={{ paddingHorizontal: PAGE }}>
                {splitBillPayments.map((p: any) => (
                  <View key={p.id} style={rd.recRow}>
                    <View style={rd.recIconWrap}><Ionicons name="person-outline" size={14} color={ACCENT_DARK} /></View>
                    <View style={rd.recMid}>
                      <Text style={rd.recName}>{p.person_name}</Text>
                      <Text style={rd.recDate}>{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    </View>
                    <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 13, color: ACCENT_DARK }}>
                      {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Split bill */}
          <View style={rd.divider} />
          <View style={rd.sectionRow}>
            <Text style={rd.sectionHeader}>split bill</Text>
            {!linkedSplitBill && (
              <TouchableOpacity style={rd.sectionAddBtn} onPress={openSplitBillModal}>
                <Ionicons name="add" size={12} color={ACCENT_DARK} />
                <Text style={rd.sectionAddText}>link</Text>
              </TouchableOpacity>
            )}
          </View>
          {linkedSplitBill ? (
            <View style={{ paddingHorizontal: PAGE }}>
              <TouchableOpacity style={rd.recRow} onPress={() => router.push({ pathname: '/(app)/split-bill-detail', params: { splitBillId: linkedSplitBill.id, name: linkedSplitBill.name } } as any)}>
                <View style={rd.recIconWrap}><Ionicons name="people-outline" size={14} color={ACCENT_DARK} /></View>
                <View style={rd.recMid}>
                  <Text style={rd.recName}>{linkedSplitBill.name}</Text>
                  <Text style={rd.recDate}>
                    {recording?.type === 'expense' && recording?.split_bill_id && !recording?.linked_recording_id
                      ? 'charged from this split bill'
                      : `contributed ${Number(recording?.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={13} color={Colors.muted} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={rd.emptyWrap}><Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted }}>no split bill linked</Text></View>
          )}
          {/* Related records — payments charged to this expense from a split bill */}
          {relatedSplitBillPayments.length > 0 && (
            <>
              <View style={rd.divider} />
              <View style={rd.sectionRow}>
                <Text style={rd.sectionHeader}>related records</Text>
              </View>
              <View style={{ paddingHorizontal: PAGE }}>
                {relatedSplitBillPayments.map((p: any) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[rd.recRow, p.status === 'cancelled' && { opacity: 0.45 }]}
                    onPress={() => {
                      if (chargedFromSplitBill) {
                        router.push({ pathname: '/(app)/split-bill-detail', params: { splitBillId: chargedFromSplitBill.id, name: chargedFromSplitBill.name } } as any);
                      }
                    }}
                    activeOpacity={chargedFromSplitBill ? 0.7 : 1}
                  >
                    <View style={rd.recIconWrap}>
                      <Ionicons name={p.status === 'cancelled' ? 'close-circle-outline' : 'people-outline'} size={14} color={p.status === 'cancelled' ? Colors.muted : ACCENT_DARK} />
                    </View>
                    <View style={rd.recMid}>
                      <Text style={[rd.recName, p.status === 'cancelled' && { textDecorationLine: 'line-through', color: Colors.muted }]}>
                        {p.person_name}
                      </Text>
                      <Text style={rd.recDate}>
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {p.status === 'cancelled' ? ' · cancelled' : ''}
                        {chargedFromSplitBill ? ` · ${chargedFromSplitBill.name}` : ''}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 13, color: p.status === 'cancelled' ? Colors.muted : ACCENT_DARK }}>
                      {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    {chargedFromSplitBill && p.status !== 'cancelled' && (
                      <Ionicons name="chevron-forward" size={13} color={Colors.faint} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <View style={{ height: 20 }} />

        </ScrollView>
      </SafeAreaView>

      {/* Split bill modal */}
      <BottomSheet visible={splitBillModal} onClose={() => setSplitBillModal(false)} title="split bill">
        <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>split bill name</Text>
        <TextInput
          style={{ fontFamily: Brand.font.mono, fontSize: 15, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 12 }}
          value={splitBillName}
          onChangeText={setSplitBillName}
          placeholder={recording?.name ?? 'split bill name'}
          placeholderTextColor={Colors.faint}
          autoFocus
        />
        <TouchableOpacity style={[rd.doneBtn, { opacity: !splitBillName.trim() ? 0.4 : 1 }]} onPress={createAndLinkSplitBill} disabled={!splitBillName.trim()}>
          <Ionicons name="add-circle-outline" size={15} color={ACCENT_DARK} />
          <Text style={rd.doneBtnText}>create new split bill</Text>
        </TouchableOpacity>

      </BottomSheet>

      {tooltip && (
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setTooltip(null)} activeOpacity={1}>
          <View style={rd.tooltip}>
            <Text style={rd.tooltipText}>{tooltip.name}</Text>
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
        spaces={availableSpaces}
        spaceId={paySpaceId}
        setSpaceId={setPaySpaceId}
        defaultSpaceId={recording?.space_id ?? null}
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
        spaces={availableSpaces}
        spaceId={collectSpaceId}
        setSpaceId={setCollectSpaceId}
        defaultSpaceId={recording?.space_id ?? null}
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

      <CollectDueModal
        visible={collectDueModal}
        onClose={() => setCollectDueModal(false)}
        recordingName={recording?.name ?? ''}
        recordingAmount={Number(recording?.amount ?? 0)}
        amount={collectDueAmount}
        setAmount={setCollectDueAmount}
        date={collectDueDate}
        setDate={setCollectDueDate}
        complete={collectDueComplete}
        setComplete={setCollectDueComplete}
        loading={collectDueLoading}
        onConfirm={confirmCollectDue}
        spaces={availableSpaces}
        spaceId={collectDueSpaceId}
        setSpaceId={setCollectDueSpaceId}
        defaultSpaceId={recording?.space_id ?? null}
        chargeToSpace={collectDueChargeToSpace}
        setChargeToSpace={setCollectDueChargeToSpace}
        chargeSpaceId={collectDueChargeSpaceId}
        setChargeSpaceId={setCollectDueChargeSpaceId}
        chargeAccounts={collectDueChargeAccounts}
        chargeAccountId={collectDueChargeAccountId}
        setChargeAccountId={setCollectDueChargeAccountId}
        chargeCategories={collectDueChargeCategories}
        chargeCategoryId={collectDueChargeCategoryId}
        setChargeCategoryId={setCollectDueChargeCategoryId}
      />

      <ConfirmModal
        visible={cancelDueConfirm}
        onClose={() => setCancelDueConfirm(false)}
        title="cancel due tag"
        message="this will remove the due tag from this expense. any collections will also be reset."
        actions={[
          { label: 'keep', onPress: () => setCancelDueConfirm(false), muted: true },
          { label: cancelDueLoading ? '...' : 'cancel due', onPress: confirmCancelDue, destructive: true, disabled: cancelDueLoading },
        ]}
      />

      {/* Mark as complete modal */}
      <BottomSheet visible={markCompleteModal} onClose={() => setMarkCompleteModal(false)} title="mark as complete" height="45%">
        {markCompleteModal && (() => {
          const total = Number(recording?.amount ?? 0);
          const collected = Number(recording?.paid_amount ?? 0);
          const remaining = Math.max(0, total - collected);
          return (
            <>
              <View style={{ gap: 6, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted }}>total amount</Text>
                  <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 12, color: Colors.text }}>{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted }}>already collected</Text>
                  <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 12, color: ACCENT_DARK }}>{collected.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted }}>remaining</Text>
                  <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 12, color: remaining > 0 ? PEACH : ACCENT_DARK }}>{remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {(['as-is', 'full', 'manual'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={{ paddingVertical: 9, paddingHorizontal: 12, flex: 1, alignItems: 'center', borderRadius: Radius.pill, borderWidth: 1, borderColor: markCompleteMode === m ? ACCENT : Colors.borderMid, backgroundColor: markCompleteMode === m ? ACCENT + '44' : Colors.surface }}
                    onPress={() => setMarkCompleteMode(m)}
                  >
                    <Text style={{ fontFamily: markCompleteMode === m ? Brand.font.monoBold : Brand.font.mono, fontSize: 11, color: markCompleteMode === m ? ACCENT_DARK : Colors.muted }}>
                      {m === 'as-is' ? 'as is' : m === 'full' ? 'full amount' : 'manual'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {markCompleteMode === 'manual' && (
                <>
                  <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 6 }}>enter total collected amount (creates a return recording)</Text>
                  <TextInput
                    style={[rd.doneBtn, { backgroundColor: Colors.surface, paddingVertical: 12, paddingHorizontal: 14, fontFamily: Brand.font.monoBold, fontSize: 15, color: Colors.text, textAlign: 'right', marginTop: 0 }]}
                    placeholder={total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    placeholderTextColor={Colors.faint}
                    value={markCompleteAmount}
                    onChangeText={setMarkCompleteAmount}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                </>
              )}
              <TouchableOpacity
                style={[rd.doneBtn, { opacity: markCompleteLoading || (markCompleteMode === 'manual' && !markCompleteAmount) ? 0.4 : 1 }]}
                onPress={confirmMarkComplete}
                disabled={markCompleteLoading || (markCompleteMode === 'manual' && !markCompleteAmount)}
              >
                <Text style={rd.doneBtnText}>{markCompleteLoading ? 'saving...' : 'confirm complete'}</Text>
              </TouchableOpacity>
            </>
          );
        })()}
      </BottomSheet>


      {copiedToast && (
        <View style={rd.toast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
          <Text style={rd.toastText}>link copied to clipboard</Text>
        </View>
      )}

      {/* Add receipt modal */}
      <BottomSheet visible={addReceiptModal} onClose={() => setAddReceiptModal(false)} sub="recording" title="add receipt" height="30%">
        <TouchableOpacity style={rd.doneBtn} onPress={addReceiptFromCamera}>
          <Ionicons name="camera-outline" size={18} color={ACCENT_DARK} />
          <Text style={rd.doneBtnText}>camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[rd.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]} onPress={addReceiptFromGallery}>
          <Ionicons name="images-outline" size={18} color={Colors.text} />
          <Text style={[rd.doneBtnText, { color: Colors.text }]}>gallery</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Edit recording modal */}
      <BottomSheet visible={editModal} onClose={() => { setEditModal(false); setEditError(''); }} sub="recording" title="edit recording">
        <View style={formStyles.block}>
          {editError ? <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.expense, marginBottom: 8 }}>{editError}</Text> : null}
          <View style={formStyles.blockRow}>
            <Text style={formStyles.blockLabel}>name</Text>
            <TextInput style={formStyles.inlineInput} placeholder="recording name" placeholderTextColor={Colors.faint} value={editName} onChangeText={setEditName} />
          </View>
          <View style={formStyles.blockDivider} />
          <View style={formStyles.blockRow}>
            <Text style={formStyles.blockLabel}>amount</Text>
            {editAmountLocked
              ? <Text style={[formStyles.inlineInput, { color: Colors.muted }]}>{editAmount} · locked (has linked records)</Text>
              : <TextInput style={formStyles.inlineInput} placeholder="0.00" placeholderTextColor={Colors.faint} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" />}
          </View>
          <View style={formStyles.blockDivider} />
          <View style={formStyles.blockRow}>
            <Text style={formStyles.blockLabel}>date</Text>
            <TextInput style={formStyles.inlineInput} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.faint} value={editDate} onChangeText={setEditDate} />
          </View>
          <View style={formStyles.blockDivider} />
          <TouchableOpacity style={formStyles.blockRow} onPress={() => setShowEditCategoryModal(true)}>
            <Text style={formStyles.blockLabel}>category</Text>
            <Text style={[formStyles.inlineInput, { color: editCategoryId ? Colors.text : Colors.faint }]}>
              {editCategoryId ? (editCategories.find(c => c.id === editCategoryId)?.name ?? 'select') : 'optional'}
            </Text>
            <Ionicons name="chevron-down" size={13} color={Colors.faint} />
          </TouchableOpacity>
          <View style={formStyles.blockDivider} />
          <View style={formStyles.blockRow}>
            <Text style={formStyles.blockLabel}>notes</Text>
            <TextInput style={[formStyles.inlineInput, { flex: 1 }]} placeholder="optional" placeholderTextColor={Colors.faint} value={editNotes} onChangeText={setEditNotes} multiline />
          </View>
          <View style={formStyles.blockDivider} />
          <View style={[formStyles.blockRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
            <Text style={formStyles.blockLabel}>bank / account</Text>
            <ScrollView style={{ maxHeight: 180, width: '100%' }} showsVerticalScrollIndicator={false}>
              {editAccounts.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10, ...(editAccountId === acc.id ? { backgroundColor: ACCENT + '44', borderRadius: Radius.md, paddingHorizontal: 8 } : {}) }}
                  onPress={() => setEditAccountId(acc.id)}
                >
                  <Ionicons name={editAccountId === acc.id ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={editAccountId === acc.id ? ACCENT_DARK : Colors.faint} />
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

      {/* Edit category picker */}
      <BottomSheet visible={showEditCategoryModal} onClose={() => setShowEditCategoryModal(false)} sub="recording" title="category">
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}
            onPress={() => { setEditCategoryId(null); setShowEditCategoryModal(false); }}
          >
            <Ionicons name={!editCategoryId ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={!editCategoryId ? ACCENT_DARK : Colors.faint} />
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.muted }}>none</Text>
          </TouchableOpacity>
          {editCategories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}
              onPress={() => { setEditCategoryId(cat.id); setShowEditCategoryModal(false); }}
            >
              <Ionicons name={editCategoryId === cat.id ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={editCategoryId === cat.id ? ACCENT_DARK : Colors.faint} />
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: cat.color, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name={cat.icon} size={11} color={Colors.text} />
              </View>
              <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text }}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>

      {/* Photo carousel modal */}
      <Modal visible={photoModal} transparent animationType="fade" onRequestClose={() => setPhotoModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
          {/* Close button */}
          <TouchableOpacity style={{ position: 'absolute', top: 52, right: 24, zIndex: 10 }} onPress={() => setPhotoModal(false)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>

          {/* Image — vertically centered */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Image
              source={{ uri: receiptPhotos[photoModalIndex]?.url ?? '' }}
              style={{ width: width - 32, height: width - 32, borderRadius: 12 }}
              resizeMode="contain"
            />
          </View>

          {/* Left arrow */}
          {photoModalIndex > 0 && (
            <TouchableOpacity
              onPress={() => setPhotoModalIndex(i => i - 1)}
              style={{ position: 'absolute', left: 16, top: '50%' as any, marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Right arrow */}
          {photoModalIndex < receiptPhotos.length - 1 && (
            <TouchableOpacity
              onPress={() => setPhotoModalIndex(i => i + 1)}
              style={{ position: 'absolute', right: 16, top: '50%' as any, marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Dot indicators */}
          {receiptPhotos.length > 1 && (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 48 }}>
              {receiptPhotos.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setPhotoModalIndex(i)}>
                  <View style={{
                    width: i === photoModalIndex ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === photoModalIndex ? '#fff' : 'rgba(255,255,255,0.35)',
                  }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </Modal>

      {/* Overpayment modal */}
      <BottomSheet visible={overpaymentModal} onClose={() => setOverpaymentModal(false)} title="overpayment detected">
        <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text, marginBottom: 4 }}>
          {overpaymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} was paid over the full amount.
        </Text>
        <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 16 }}>
          the recording has been marked as fully paid. what would you like to do with the excess?
        </Text>
        <TouchableOpacity style={rd.doneBtn} onPress={confirmOverpaymentIncome}>
          <Text style={rd.doneBtnText}>record as income</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[rd.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]} onPress={() => setOverpaymentModal(false)}>
          <Text style={[rd.doneBtnText, { color: Colors.muted }]}>ignore</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Tag friend modal */}
      <BottomSheet visible={tagFriendModal} onClose={() => { setTagFriendModal(false); setTagError(''); }} title="tag a friend">
        {tagError ? <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.expense, marginBottom: 8 }}>{tagError}</Text> : null}
        <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>amount they owe</Text>
        <TextInput
          style={{ fontFamily: Brand.font.monoBold, fontSize: 16, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 16 }}
          value={tagAmount} onChangeText={setTagAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={Colors.faint}
        />
        <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>select friend</Text>
        {tagFriends.length === 0 ? (
          <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.muted, marginBottom: 16 }}>no friends yet — add friends in Contacts first</Text>
        ) : (
          <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
            {tagFriends.map(f => {
              const alreadyTagged = existingTags.some((t: any) => t.tagged_user_id === f.id);
              return (
                <TouchableOpacity key={f.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10, opacity: alreadyTagged ? 0.4 : 1 }} onPress={() => !alreadyTagged && setTagSelectedFriend(f)} disabled={alreadyTagged}>
                  <Ionicons name={tagSelectedFriend?.id === f.id ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={tagSelectedFriend?.id === f.id ? ACCENT_DARK : Colors.faint} />
                  <Text style={{ fontFamily: Brand.font.heading, fontSize: 14, color: Colors.text, flex: 1 }}>{f.name}</Text>
                  {alreadyTagged && <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted }}>already tagged</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        <TouchableOpacity style={[rd.doneBtn, { marginTop: 16, opacity: (!tagSelectedFriend || !tagAmount || tagLoading) ? 0.4 : 1 }]} onPress={confirmTagFriend} disabled={!tagSelectedFriend || !tagAmount || tagLoading}>
          {tagLoading ? <ActivityIndicator color={ACCENT_DARK} size="small" /> : <Text style={rd.doneBtnText}>send tag request</Text>}
        </TouchableOpacity>
      </BottomSheet>

      {/* Write-off modal */}
      <BottomSheet visible={writeOffModal} onClose={() => setWriteOffModal(false)} title="write off">
        {writeOffModal && (() => {
          const remaining = Math.max(0, Number(recording?.amount ?? 0) - Number(recording?.paid_amount ?? 0));
          return (
            <>
              <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text, marginBottom: 4 }}>
                {recording?.name}
              </Text>
              <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 15, color: Colors.muted, marginBottom: 4 }}>
                {remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} will be written off
              </Text>
              <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 16 }}>
                this records the unpaid remainder as a bad debt expense and marks the original as paid. the write-off will appear in your expenses under the "Write-offs" category.
              </Text>
              <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>reason (optional)</Text>
              <TextInput
                style={{ fontFamily: Brand.font.mono, fontSize: 15, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 4 }}
                placeholder="e.g. person stopped responding"
                placeholderTextColor={Colors.faint}
                value={writeOffReason}
                onChangeText={setWriteOffReason}
                autoFocus
              />
              <TouchableOpacity
                style={[rd.doneBtn, { marginTop: 12, backgroundColor: '#92909022', opacity: writeOffLoading ? 0.5 : 1 }]}
                onPress={confirmWriteOff}
                disabled={writeOffLoading}
              >
                <Text style={[rd.doneBtnText, { color: Colors.muted }]}>{writeOffLoading ? 'writing off...' : 'confirm write-off'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[rd.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]}
                onPress={() => setWriteOffModal(false)}
              >
                <Text style={[rd.doneBtnText, { color: Colors.muted }]}>cancel</Text>
              </TouchableOpacity>
            </>
          );
        })()}
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

const rd = StyleSheet.create({
  // Container
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAGE, paddingTop: 16, paddingBottom: 16, gap: 10, backgroundColor: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: '#333' },
  backBtn:    { width: 34, height: 34, borderRadius: 17, backgroundColor: '#B6E1DE22', alignItems: 'center', justifyContent: 'center' },
  title:      { flex: 1, fontFamily: Brand.font.display, fontSize: 20, color: '#B6E1DE', letterSpacing: -0.3, textAlign: 'center' },
  amountBadge:     { backgroundColor: '#B6E1DE22', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  amountBadgeText: { fontFamily: Brand.font.monoBold, fontSize: 13 },
  scroll:     { paddingBottom: 80 },

  // Hero (kept for compat but unused)
  heroBlock:  { paddingHorizontal: PAGE, paddingTop: 12, paddingBottom: 4 },
  heroLabel:  { fontFamily: Brand.font.monoBold, fontSize: 10, color: ACCENT_DARK, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  heroDate:   { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginTop: 1 },

  // Summary grid
  summaryGrid:  { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: PAGE, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  summaryCell:  { width: '50%', paddingVertical: 8, paddingRight: 8 },
  summaryLabel: { fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 3 },
  summaryValue: { fontFamily: Brand.font.monoBold, fontSize: 13, color: Colors.text },

  // Divider
  divider:    { height: 8, backgroundColor: Colors.surface, marginHorizontal: -PAGE },

  // Section rows
  sectionRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAGE, paddingTop: 20, paddingBottom: 8 },
  sectionHeader:  { ...Brand.type.sectionHeader },
  sectionAddBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: ACCENT + '44' },
  sectionAddText: { fontFamily: Brand.font.heading, fontSize: 11, color: ACCENT_DARK },

  // List rows
  recRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  recIconWrap:{ width: 34, height: 34, borderRadius: 17, backgroundColor: ACCENT + '44', justifyContent: 'center', alignItems: 'center' },
  recMid:     { flex: 1, gap: 2 },
  recName:    { fontFamily: Brand.font.monoBold, fontSize: 13, color: Colors.text },
  recDate:    { fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted },

  // Info rows
  infoRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel:  { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, width: 80, flexShrink: 0 },
  infoValue:  { fontFamily: Brand.font.monoBold, fontSize: 12, color: Colors.text, flex: 1, textAlign: 'right' },

  // Action chips
  actionChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: ACCENT + '44' },
  actionChipText: { fontFamily: Brand.font.heading, fontSize: 11, color: ACCENT_DARK },

  // Empty
  emptyWrap:  { alignItems: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: PAGE },

  // Done button
  doneBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT + '44', borderRadius: Radius.pill, paddingVertical: 14, marginTop: 8 },
  doneBtnText: { fontFamily: Brand.font.monoBold, fontSize: 13, color: ACCENT_DARK },

  // Toast
  toast:      { position: 'absolute', bottom: 48, alignSelf: 'center', backgroundColor: Colors.text, borderRadius: Radius.pill, paddingVertical: 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  toastText:  { fontFamily: Brand.font.mono, fontSize: 12, color: Colors.white },

  // Tooltip
  tooltip:     { position: 'absolute', top: '50%', alignSelf: 'center', backgroundColor: Colors.text, borderRadius: Radius.sm, paddingVertical: 6, paddingHorizontal: 12 },
  tooltipText: { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.white },

  // Tag input (people modal)
  tagInputWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, padding: 8, minHeight: 44, marginBottom: 12 },
  tagChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: ACCENT + '44', borderRadius: Radius.pill, paddingVertical: 4, paddingLeft: 10, paddingRight: 6 },
  tagChipText:  { fontFamily: Brand.font.monoBold, fontSize: 11, color: ACCENT_DARK },
  tagInput:     { fontFamily: Brand.font.mono, fontSize: 16, color: Colors.text, minWidth: 120, flex: 1, padding: 2 },
  contactsLabel:{ ...Brand.type.modalLabel, marginBottom: 6 },
  contactRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  contactName:  { fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text },
});

const styles = StyleSheet.create({
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
});










