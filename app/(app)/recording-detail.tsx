import GooeyLoader from '@/components/ui/GooeyLoader';
import { BlurView } from 'expo-blur';
import AddItemModal from './AddItemModal';
import { setPendingFocusDate } from '../../src/lib/focusDate';
import { useScreenAnim } from '@/components/ui/ScreenWrapper';
import PageHeader from '@/components/ui/PageHeader';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Dimensions, ScrollView, TextInput, Modal, Platform, Image, Share, Alert, ActivityIndicator } from 'react-native';
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
import MiniNavBar from '@/components/ui/MiniNavBar';
import formStyles from '@/components/ui/formStyles';
import { Colors, Radius } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';
import { DC } from '../../src/lib/design';
import { AppFont } from '../../src/lib/fonts';
import { writeOff } from '../../src/lib/writeOff';

import { useUser } from '../../src/hooks/useUser';
import { useNav } from '../../src/lib/NavContext';
import { useQueryClient } from '@tanstack/react-query';

const ACCENT      = Brand.color.accent;
const ACCENT_DARK = Brand.color.accentDark;
const PEACH       = '#FFAB91';
const PAGE        = 20;

const { width } = Dimensions.get('window');
const MAX_NAME_CHARS = 18;
const MAX_ITEM_NAME = 20;

interface Subitem { id: string; name: string; cost: number; people: string[]; }
interface Item { id: string; name: string; cost: number; people: string[]; subitems: Subitem[]; }

export default function RecordingDetailScreen({ recordingId: propRecordingId, onClose }: { recordingId?: string; onClose?: () => void }) {
  const params = useLocalSearchParams<{ recordingId: string }>();
  const recordingId = propRecordingId ?? params.recordingId;
  const router = useRouter();
  const { slideAnim, handleBack: handleBackAnim } = useScreenAnim();
  const handleBack = onClose ?? handleBackAnim;
  const webviewRef = useRef<any>(null);
  const { defaultCurrency, userId, userName } = useUser();
  const { openRecording, openSplitBill } = useNav();
  const queryClient = useQueryClient();

  // Tag a friend state
  const [tagFriendModal, setTagFriendModal] = useState(false);
  const [tagFriends, setTagFriends] = useState<{ id: string; name: string }[]>([]);
  const [tagSelectedFriend, setTagSelectedFriend] = useState<{ id: string; name: string } | null>(null);
  const [tagAmount, setTagAmount] = useState('');
  const [tagLoading, setTagLoading] = useState(false);
  const [tagError, setTagError] = useState('');
  const [existingTags, setExistingTags] = useState<any[]>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [friendDebtAccepted, setFriendDebtAccepted] = useState(false);
  const [friendTagDeclined, setFriendTagDeclined] = useState(false);

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

  // isOwner derived from recording data (not state — avoids timing issues)
  const isOwner = !!recording && recording.user_id === userId;

  // Cancel due state
  const [cancelDueConfirm, setCancelDueConfirm] = useState(false);
  const [cancelDueLoading, setCancelDueLoading] = useState(false);

  // Write-off state
  const [writeOffModal, setWriteOffModal] = useState(false);
  const [writeOffReason, setWriteOffReason] = useState('');
  const [writeOffLoading, setWriteOffLoading] = useState(false);

  // Owes-you edit state
  const [owesYouEditModal, setOwesYouEditModal] = useState(false);
  const [owesYouFriends, setOwesYouFriends] = useState<{ id: string; name: string }[]>([]);
  const [owesYouContacts, setOwesYouContacts] = useState<string[]>([]);
  const [owesYouSearch, setOwesYouSearch] = useState('');
  const [owesYouLoading, setOwesYouLoading] = useState(false);

  const cleanupTaggedDebt = async (friendUserId: string, sourceRecId: string, reason: 'removed' | 'cancelled' | 'deleted') => {
    try {
      await supabase.rpc('untag_friend', {
        p_recording_id: sourceRecId,
        p_friend_user_id: friendUserId,
        p_recording_name: recording?.name ?? 'expense',
      });
    } catch {}
  };

  // ── Helper: settle B's debt (write-off / mark complete) ───────────────────
  const settleTaggedDebt = async (friendUserId: string, sourceRecId: string, reason: 'written_off' | 'completed') => {
    const bodyMap = {
      written_off: `"${recording?.name}" — the debt has been written off. you're cleared.`,
      completed: `"${recording?.name}" — the expense has been marked as complete. you're cleared.`,
    };
    await supabase.from('notifications').insert({
      user_id: friendUserId,
      type: 'tag_payment_update',
      title: reason === 'written_off' ? 'debt written off' : 'expense settled',
      body: bodyMap[reason],
      message: bodyMap[reason],
      data: { sourceRecordingId: sourceRecId },
      status: 'new',
      is_read: false,
    });
  };

  const openOwesYouEdit = async () => {
    setOwesYouSearch('');
    setOwesYouLoading(true);
    setOwesYouEditModal(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setOwesYouLoading(false); return; }
    const [{ data: contacts }, { data: friendships }] = await Promise.all([
      supabase.from('contacts').select('name').eq('user_id', user.id).order('name'),
      supabase.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted').or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`),
    ]);
    const friendIds = (friendships ?? []).map((f: any) => f.requester_id === user.id ? f.receiver_id : f.requester_id);
    const friends = (await Promise.all(friendIds.map(async (id: string) => {
      const { data: n } = await supabase.rpc('get_user_display_name', { user_id: id });
      return n ? { id, name: n as string } : null;
    }))).filter(Boolean) as { id: string; name: string }[];
    setOwesYouFriends(friends);
    setOwesYouContacts((contacts ?? []).map((c: any) => c.name));
    setOwesYouLoading(false);
  };

  const saveOwesYouPerson = async (name: string, friendUserId: string | null) => {
    const prevFriendId = recording?.tagged_friend_user_id;
    const hasPaid = Number(recording?.paid_amount ?? 0) > 0;
    if (hasPaid && prevFriendId) return;
    if (prevFriendId && prevFriendId !== friendUserId) {
      await cleanupTaggedDebt(prevFriendId, recordingId as string, 'removed');
    }
    await supabase.from('recordings').update({
      person_name: name,
      tagged_friend_user_id: friendUserId,
    }).eq('id', recordingId);
    setRecording((prev: any) => ({ ...prev, person_name: name, tagged_friend_user_id: friendUserId }));
    setFriendDebtAccepted(false);
    setFriendTagDeclined(false);
    setTagsLoaded(false);
    if (friendUserId && friendUserId !== prevFriendId) {
      try {
        await supabase.rpc('tag_friend_auto', {
          p_recording_id: recordingId,
          p_owner_id: userId,
          p_owner_name: userName,
          p_friend_user_id: friendUserId,
          p_recording_name: recording.name,
          p_amount: Number(recording.amount),
          p_currency: recording.currency ?? defaultCurrency,
          p_transaction_date: recording.transaction_date ?? null,
          p_category_id: recording.category_id ?? null,
        });
      } catch {}
    }
    setOwesYouEditModal(false);
  };

  const removeOwesYouPerson = async () => {
    const hasPaid = Number(recording?.paid_amount ?? 0) > 0;
    if (hasPaid) return;
    if (recording?.tagged_friend_user_id) {
      await cleanupTaggedDebt(recording.tagged_friend_user_id, recordingId as string, 'removed');
    }
    await supabase.from('recordings').update({
      person_name: null,
      tagged_friend_user_id: null,
    }).eq('id', recordingId);
    setRecording((prev: any) => ({ ...prev, person_name: null, tagged_friend_user_id: null }));
    setOwesYouEditModal(false);
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
      // Settle B's debt if tagged
      if (recording.tagged_friend_user_id) {
        await settleTaggedDebt(recording.tagged_friend_user_id, recordingId as string, 'written_off');
      }
      setWriteOffModal(false);
      setWriteOffReason('');
      loadPaymentData();
    } catch (e) { /* write-off failed silently */ }
    finally { setWriteOffLoading(false); }
  };

  // Reset tag states when recording changes (e.g. person removed and re-tagged)
  useEffect(() => {
    if (!recording?.tagged_friend_user_id) {
      setFriendDebtAccepted(false);
      setFriendTagDeclined(false);
      setTagsLoaded(false);
    }
  }, [recording?.tagged_friend_user_id]);
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
    openSplitBill(bill.id, bill.name);
  };

  const linkToExistingSplitBill = async (bill: any) => {
    await supabase.from('split_bill_recordings').insert({
      split_bill_id: bill.id, recording_id: recordingId, amount_contributed: recording?.amount ?? 0,
    });
    setSplitBillModal(false);
    openSplitBill(bill.id, bill.name);
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
  const [showAddChoice, setShowAddChoice] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoDeleteConfirm, setPhotoDeleteConfirm] = useState(false);

  const confirmDelete = async (keepLinked: boolean, deleteReceipt = false, deletePayable = false, forceDeleteAll = false) => {
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
      // Clean up tagged friend's debt
      if (recording?.tagged_friend_user_id) {
        await cleanupTaggedDebt(recording.tagged_friend_user_id, recordingId as string, 'deleted');
      }
      // If deleting a return recording, adjust the parent's paid_amount first
      if (recording?.type === 'return' && recording?.linked_recording_id) {
        const { data: parentRec } = await supabase
          .from('recordings')
          .select('paid_amount, amount')
          .eq('id', recording.linked_recording_id)
          .single();
        if (parentRec) {
          const newPaid = Math.max(0, Number(parentRec.paid_amount ?? 0) - Number(recording.amount ?? 0));
          await supabase.from('recordings').update({
            paid_amount: newPaid,
            status: newPaid <= 0 ? 'unpaid' : 'partial',
          }).eq('id', recording.linked_recording_id);
        }
      }

      // If force delete all, remove all linked return recordings (collections)
      if (forceDeleteAll) {
        await supabase.from('recordings').delete().eq('linked_recording_id', recordingId).eq('type', 'return');
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
      queryClient.invalidateQueries({ queryKey: ['recordings-panel', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-summary-v2', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-recent', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-loans', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-receivables', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-spaces', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-totals', userId] });
      queryClient.invalidateQueries({ queryKey: ['spaces-panel', userId] });
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
      // Pre-load edit modal data
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        Promise.all([
          supabase.from('accounts').select().eq('user_id', user.id).order('account_name'),
          supabase.from('categories').select().eq('user_id', user.id).order('name'),
          supabase.from('recordings').select('id').eq('linked_recording_id', recordingId).limit(1),
          supabase.from('split_items').select('id').eq('recording_id', recordingId).limit(1),
          supabase.from('split_bill_recordings').select('id').eq('recording_id', recordingId).limit(1),
        ]).then(([{ data: accs }, { data: cats }, { data: linked }, { data: splitItems }, { data: splitBillRecs }]) => {
          if (accs) setEditAccounts(accs);
          if (cats) setEditCategories(cats);
          const hasPayments = (linked ?? []).length > 0;
          const hasSplitItems = (splitItems ?? []).length > 0 || (splitBillRecs ?? []).length > 0;
          setEditAmountLocked(hasPayments || hasSplitItems);
        });
      }),
    ]).then(() => loadPaymentData());
  }, []);

  useFocusEffect(useCallback(() => {
    loadRecording();
    loadPaymentData();
    if (recordingId && userId) {
      Promise.all([
        supabase.from('recordings').select('id').eq('source_recording_id', recordingId).eq('type', 'debt').maybeSingle(),
        supabase.from('notifications').select('data').eq('type', 'expense_tag').eq('data->>sourceRecordingId', recordingId).in('status', ['new', 'saw']),
      ]).then(([{ data: debt }, { data: pending }]) => {
        const accepted = !!debt;
        const hasPending = (pending ?? []).length > 0;
        setFriendDebtAccepted(accepted);
        setExistingTags(pending ?? []);
        setFriendTagDeclined(!accepted && !hasPending);
      });
    }
  }, [recordingId]));

  // Realtime listener for tag status changes (B accepts/declines)
  useEffect(() => {
    if (!recordingId || !userId) return;
    const channel = supabase
      .channel(`tag-status-${recordingId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'recordings',
      }, (payload) => {
        const r = payload.new as any;
        if (r.source_recording_id === recordingId && r.type === 'debt') {
          setFriendDebtAccepted(true);
          setFriendTagDeclined(false);
          setTagsLoaded(true);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'recordings',
      }, (payload) => {
        const r = payload.old as any;
        if (r.source_recording_id === recordingId && r.type === 'debt') {
          setFriendDebtAccepted(false);
          // Re-check if there's still a pending notification
          supabase.from('notifications').select('data')
            .eq('type', 'expense_tag')
            .eq('data->>sourceRecordingId', recordingId)
            .in('status', ['new', 'saw'])
            .then(({ data }) => {
              setExistingTags(data ?? []);
              setFriendTagDeclined((data ?? []).length === 0);
            });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
      }, (payload) => {
        const n = payload.new as any;
        if (n.type === 'expense_tag' && n.data?.sourceRecordingId === recordingId) {
          if (!['new', 'saw'].includes(n.status)) {
            // Notification was opened (declined) — re-check debt
            supabase.from('recordings').select('id')
              .eq('source_recording_id', recordingId)
              .eq('type', 'debt')
              .maybeSingle()
              .then(({ data: debt }) => {
                setFriendDebtAccepted(!!debt);
                setFriendTagDeclined(!debt);
                setExistingTags([]);
              });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [recordingId, userId]);

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
      // Settle B's debt if tagged
      if (recording.tagged_friend_user_id) {
        await settleTaggedDebt(recording.tagged_friend_user_id, recordingId as string, 'completed');
      }
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
    if (!recording) return;
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
      const isOverpayment = excess > 0.01;
      const newStatus = collectDueComplete || isOverpayment ? 'paid' : 'partial';
      // Create or increment the return recording for the collection
      const { data: existingReturn } = await supabase
        .from('recordings')
        .select('id, amount')
        .eq('linked_recording_id', recordingId)
        .eq('type', 'return')
        .eq('user_id', user.id)
        .maybeSingle();
      if (existingReturn) {
        await supabase.from('recordings').update({
          amount: Number(existingReturn.amount) + amount,
          transaction_date: collectDueDate,
        }).eq('id', existingReturn.id);
      } else {
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
      }
      await supabase.from('recordings').update({ paid_amount: cappedPaid, status: newStatus }).eq('id', recordingId);
      setRecording((prev: any) => ({ ...prev, paid_amount: cappedPaid, status: newStatus }));

      // Sync to friend's payable if this recording has a tagged friend
      if (recording.tagged_friend_user_id) {
        const { data: friendPayable } = await supabase
          .from('recordings')
          .select('id, paid_amount, amount, space_id')
          .eq('source_recording_id', recordingId)
          .eq('type', 'debt')
          .maybeSingle();
        if (friendPayable) {
          const fPrevPaid = Number(friendPayable.paid_amount ?? 0);
          const fTotal = Number(friendPayable.amount ?? 0);
          // Always cap B's side at original debt amount regardless of overpayment
          const cappedAmount = Math.min(amount, fTotal);
          const fNewPaid = Math.min(fPrevPaid + cappedAmount, fTotal);
          const fNewStatus = fNewPaid >= fTotal - 0.01 ? 'paid' : fNewPaid > 0 ? 'partial' : 'unpaid';
          await supabase.from('recordings').update({ paid_amount: fNewPaid, status: fNewStatus }).eq('id', friendPayable.id);
          const { data: existingExpense } = await supabase
            .from('recordings')
            .select('id, amount')
            .eq('linked_recording_id', friendPayable.id)
            .eq('type', 'expense')
            .maybeSingle();
          if (existingExpense) {
            await supabase.from('recordings').update({ amount: Number(existingExpense.amount) + cappedAmount }).eq('id', existingExpense.id);
          } else {
            await supabase.from('recordings').insert({
              user_id: recording.tagged_friend_user_id,
              space_id: friendPayable.space_id ?? null,
              name: recording.name,
              type: 'expense',
              amount: cappedAmount,
              transaction_date: collectDueDate,
              status: 'paid',
              linked_recording_id: friendPayable.id,
              category_id: recording.category_id ?? null,
            });
          }
          // Notify B
          const remaining = Math.max(0, fTotal - fNewPaid);
          await supabase.from('notifications').insert({
            user_id: recording.tagged_friend_user_id,
            type: 'tag_payment_update',
            title: fNewStatus === 'paid' ? 'debt fully settled' : 'payment collected',
            body: fNewStatus === 'paid'
              ? `"${recording.name}" — your debt has been fully collected.`
              : `"${recording.name}" — ${cappedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} collected. remaining: ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`,
            message: '',
            data: { sourceRecordingId: recordingId },
            status: 'new',
            is_read: false,
          });
        }
      }

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
      // Record overpayment as income on A's side (no approval needed)
      if (isOverpayment) {
        await supabase.from('recordings').insert({
          user_id: user.id,
          space_id: recording.space_id ?? null,
          name: `${recording.name} · overpayment`,
          type: 'income',
          amount: Math.round(excess * 100) / 100,
          transaction_date: collectDueDate,
          status: 'received',
          currency: recording.currency ?? defaultCurrency,
        });
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'tag_payment_update',
          title: 'overpayment detected',
          body: `"${recording.name}" — ${Math.round(excess * 100) / 100} over the amount. recorded as income.`,
          message: '',
          data: { sourceRecordingId: recordingId },
          status: 'new',
          is_read: false,
        });
      }
      setCollectDueModal(false);
      loadPaymentData();
    } catch (e) { /* collect due failed silently */ }
    finally { setCollectDueLoading(false); }
  };

  const confirmCancelDue = async () => {
    const hasPaid = Number(recording?.paid_amount ?? 0) > 0;
    if (hasPaid) return;
    setCancelDueLoading(true);
    try {
      if (recording?.tagged_friend_user_id) {
        await cleanupTaggedDebt(recording.tagged_friend_user_id, recordingId as string, 'cancelled');
      }
      await supabase.from('recordings').update({
        is_due: false, paid_amount: 0, status: 'paid',
        tagged_friend_user_id: null, person_name: null,
      }).eq('id', recordingId);
      setRecording((prev: any) => ({ ...prev, is_due: false, paid_amount: 0, status: 'paid', tagged_friend_user_id: null, person_name: null }));
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

      // Create or increment the return recording
      const { data: existingReturn } = await supabase
        .from('recordings')
        .select('id, amount')
        .eq('linked_recording_id', recordingId)
        .eq('type', 'return')
        .eq('user_id', user.id)
        .maybeSingle();
      let newRec: any = null;
      if (existingReturn) {
        await supabase.from('recordings').update({
          amount: Number(existingReturn.amount) + amount,
          transaction_date: collectDate,
        }).eq('id', existingReturn.id);
        newRec = existingReturn;
      } else {
        const { data: inserted } = await supabase.from('recordings').insert({
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
        newRec = inserted;
      }

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

      // Sync to friend's payable if this recording has a tagged friend
      if (recording.tagged_friend_user_id) {
        const { data: friendPayable } = await supabase
          .from('recordings')
          .select('id, paid_amount, amount, space_id')
          .eq('source_recording_id', recordingId)
          .eq('type', 'debt')
          .maybeSingle();
        if (friendPayable) {
          const fPrevPaid = Number(friendPayable.paid_amount ?? 0);
          const fTotal = Number(friendPayable.amount ?? 0);
          const fNewPaid = Math.min(fPrevPaid + amount, fTotal);
          const fNewStatus = collectComplete ? 'paid' : fNewPaid > 0 ? 'partial' : 'unpaid';
          await supabase.from('recordings').update({ paid_amount: fNewPaid, status: fNewStatus }).eq('id', friendPayable.id);
          const { data: existingExpense } = await supabase
            .from('recordings')
            .select('id, amount')
            .eq('linked_recording_id', friendPayable.id)
            .eq('type', 'expense')
            .maybeSingle();
          if (existingExpense) {
            await supabase.from('recordings').update({ amount: Number(existingExpense.amount) + amount }).eq('id', existingExpense.id);
          } else {
            await supabase.from('recordings').insert({
              user_id: recording.tagged_friend_user_id,
              space_id: friendPayable.space_id ?? null,
              name: recording.name,
              type: 'expense',
              amount,
              transaction_date: collectDate,
              status: 'paid',
              linked_recording_id: friendPayable.id,
              category_id: recording.category_id ?? null,
            });
          }
          // Notify B of the collection
          const remaining = Math.max(0, fTotal - fNewPaid);
          await supabase.from('notifications').insert({
            user_id: recording.tagged_friend_user_id,
            type: 'tag_payment_update',
            title: collectComplete ? 'debt fully settled' : 'payment collected',
            body: collectComplete
              ? `"${recording.name}" — your debt has been fully collected.`
              : `"${recording.name}" — ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} collected. remaining: ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`,
            message: '',
            data: { sourceRecordingId: recordingId },
            status: 'new',
            is_read: false,
          });
        }
      }

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
      await supabase.from('recordings').update({ is_due: true, status: 'unpaid', paid_amount: 0 }).eq('id', recordingId);
      setRecording((prev: any) => ({ ...prev, is_due: true, status: 'unpaid', paid_amount: 0 }));
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
    setTagSelectedFriend(null);
    console.log('[tag] recording.amount:', recording?.amount);
    setTagAmount(String(recording?.amount ?? ''));
    const { data } = await supabase.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted').or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
    if (!data) { setTagFriends([]); setTagFriendModal(true); return; }
    const friendIds = data.map((r: any) => r.requester_id === userId ? r.receiver_id : r.requester_id);
    const names = await Promise.all(friendIds.map(async (id: string) => {
      const { data: n } = await supabase.rpc('get_user_display_name', { user_id: id });
      return { id, name: n ?? 'unknown' };
    }));
    // Filter out friends already shared with
    const sharedWith: string[] = (recording?.shared_with as string[]) ?? [];
    setTagFriends(names.filter(f => !sharedWith.includes(f.id) && !existingTags.some(t => t.data?.friendId === f.id)));
    const { data: existing } = await supabase
      .from('notifications')
      .select('data')
      .eq('type', 'expense_tag')
      .eq('data->>sourceRecordingId', recordingId)
      .in('status', ['new', 'saw']);
    setExistingTags(existing ?? []);
    setTagFriendModal(true);
  };

  const confirmTagFriend = async () => {
    console.log('[tag] confirmTagFriend called — friend:', tagSelectedFriend?.id, 'amount:', tagAmount);
    if (!tagSelectedFriend || !tagAmount) {
      console.log('[tag] blocked — missing friend or amount');
      return;
    }
    setTagLoading(true); setTagError('');
    try {
      const amount = parseFloat(tagAmount);
      if (isNaN(amount) || amount <= 0) { setTagError('enter a valid amount'); setTagLoading(false); return; }
      // Share directly — no request/accept needed
      const { data: rec } = await supabase
        .from('recordings')
        .select('shared_with')
        .eq('id', recordingId)
        .single();
      const sharedWith: string[] = (rec?.shared_with as string[]) ?? [];
      if (!sharedWith.includes(tagSelectedFriend.id)) {
        await supabase.from('recordings').update({
          shared_with: [...sharedWith, tagSelectedFriend.id],
        }).eq('id', recordingId);
      }
      setTagFriendModal(false);
      setExistingTags([...existingTags, { data: { friendId: tagSelectedFriend.id } }]);
    } catch (e: any) { setTagError(e.message ?? 'something went wrong'); }
    finally { setTagLoading(false); }
  };

  useEffect(() => {
    if (!recordingId || !userId) return;

    Promise.all([
      supabase.from('recordings').select('id')
        .eq('source_recording_id', recordingId)
        .eq('type', 'debt')
        .maybeSingle(),
      supabase.from('notifications').select('data')
        .eq('type', 'expense_tag')
        .eq('data->>sourceRecordingId', recordingId)
        .in('status', ['new', 'saw']),
    ]).then(([{ data: debt }, { data: pending }]) => {
      const accepted = !!debt;
      const hasPending = (pending ?? []).length > 0;
      setFriendDebtAccepted(accepted);
      setExistingTags(pending ?? []);
      // declined = friend was tagged, no debt created, no pending notification
      setFriendTagDeclined(!accepted && !hasPending);
      setTagsLoaded(true);
    });
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
        setAddReceiptModal(false);
        setUploadingPhoto(true);
        const compressed = await compressImage(result.assets[0].uri);
        await uploadReceiptPhoto(compressed, entryId);
        await loadLinkedReceipt();
        setUploadingPhoto(false);
      }
    } catch (e: any) {
      setUploadingPhoto(false);
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
        setAddReceiptModal(false);
        setUploadingPhoto(true);
        for (const asset of result.assets) {
          const compressed = await compressImage(asset.uri);
          await uploadReceiptPhoto(compressed, entryId);
        }
        await loadLinkedReceipt();
        setUploadingPhoto(false);
      }
    } catch (e: any) {
      setUploadingPhoto(false);
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
    if (data) {
      setRecording({
        ...data,
        categories: Array.isArray(data.categories) ? data.categories[0] : data.categories,
        account: Array.isArray(data.account) ? data.account[0] : data.account,
      });
    }
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


  const openEditModal = () => {
    setEditDate(recording?.transaction_date ?? '');
    setEditAccountId(recording?.account_id ?? '');
    setEditName(recording?.name ?? '');
    setEditNotes(recording?.notes ?? '');
    setEditCategoryId(recording?.category_id ?? null);
    setEditAmount(String(recording?.amount ?? ''));
    setEditError('');
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

  // Due status label for the status cell (expense with is_due shows due status, not expense status)
  const displayStatus = () => {
    if (!recording) return '—';
    if (recording.type === 'expense' && recording.is_due) {
      const paid = Number(recording.paid_amount ?? 0);
      const total = Number(recording.amount ?? 0);
      if (paid >= total - 0.01 && total > 0) return 'collected';
      if (paid > 0) return 'partial';
      return 'pending';
    }
    return recording.status ?? '—';
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
        <PageHeader
          title={recording?.name ?? ''}
          onBack={handleBack}
          titleColor="#9cd7d2"
        />

        <ScrollView contentContainerStyle={rd.scroll} showsVerticalScrollIndicator={false} style={{ backgroundColor: Colors.white }}>
          <View style={{ height: 8 }} />

          {/* Info card */}
          <View style={rd.infoCard}>
            <View style={rd.amountRow}>
              <Text style={[rd.amountValue, { color: amountColor() }]}>
                {Number(recording?.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
              <TouchableOpacity style={rd.actionsBtn} onPress={() => setShowAddChoice(true)} activeOpacity={0.8}>
                <Ionicons name="ellipsis-horizontal" size={16} color="#111111" />
              </TouchableOpacity>
            </View>

            <View style={rd.infoGrid}>
              <View style={rd.infoCell}>
                <Text style={rd.infoCellLabel}>Date</Text>
                <Text style={rd.infoCellValue}>{formatDate(recording?.transaction_date)}</Text>
              </View>
              <View style={rd.infoCell}>
                <Text style={rd.infoCellLabel}>Category</Text>
                <Text style={rd.infoCellValue} numberOfLines={1}>{recording?.categories?.name ?? '—'}</Text>
              </View>
              <View style={rd.infoCell}>
                <Text style={rd.infoCellLabel}>Type</Text>
                {(() => {
                  const label = typeLabel(recording?.type ?? '', recording?.status ?? '');
                  const isOut = ['expense', 'debt', 'payment'].includes(recording?.type ?? '');
                  const badgeColor = isOut ? '#FFAB91' : '#9cd7d2';
                  return (
                    <View style={[rd.typeBadge, { backgroundColor: badgeColor + '22' }]}>
                      <Text style={[rd.typeBadgeText, { color: badgeColor }]}>{label}</Text>
                    </View>
                  );
                })()}
              </View>
              <View style={rd.infoCell}>
                <Text style={rd.infoCellLabel}>Status</Text>
                <Text style={rd.infoCellValue}>{displayStatus()}</Text>
              </View>
              <View style={rd.infoCell}>
                <Text style={rd.infoCellLabel}>Account</Text>
                <Text style={rd.infoCellValue} numberOfLines={1}>{recording?.account?.account_name ?? '—'}</Text>
              </View>
              <View style={rd.infoCell}>
                <Text style={rd.infoCellLabel}>Owes You</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={rd.infoCellValue} numberOfLines={1}>{recording?.person_name ?? '—'}</Text>
                  {linkedSplitBill && <Ionicons name="lock-closed-outline" size={10} color={Colors.muted} />}
                </View>
              </View>
            </View>

            {(recording?.notes ?? '').trim() ? (
              <View style={rd.notesBlock}>
                <Text style={rd.notesLabel}>Notes</Text>
                <Text style={rd.notesValue}>{recording?.notes}</Text>
              </View>
            ) : null}
          </View>

          {/* SPLIT BILL section — disabled for manual due/owes recordings */}
          {!((recording?.type === 'debt' || recording?.type === 'due' || recording?.is_due) && !linkedSplitBill) && (
            <View style={rd.sectionDivider} />
          )}
          {!((recording?.type === 'debt' || recording?.type === 'due' || recording?.is_due) && !linkedSplitBill) && (
            <View style={rd.sectionRow}>
              <Text style={rd.sectionLabel}>Split Bill</Text>
              <TouchableOpacity style={rd.sectionBtn} onPress={() => linkedSplitBill ? openSplitBill(linkedSplitBill.id, linkedSplitBill.name) : openSplitBillModal()} activeOpacity={0.8}>
                <Text style={rd.sectionBtnText}>{linkedSplitBill ? 'View' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* RECEIPTS section */}
          <View style={rd.sectionRow}>
            <Text style={rd.sectionLabel}>Receipts</Text>
            <TouchableOpacity style={rd.sectionBtn} onPress={() => receiptPhotos.length > 0 ? (setPhotoModalIndex(0), setPhotoModal(true)) : setAddReceiptModal(true)} activeOpacity={0.8}>
              <Text style={rd.sectionBtnText}>{receiptPhotos.length > 0 ? `View (${receiptPhotos.length})` : 'Add'}</Text>
            </TouchableOpacity>
          </View>

          {/* section divider */}

          {/* Payments / Collections */}
          {(recording?.type === 'debt' || recording?.type === 'due' || (recording?.type === 'expense' && linkedPayments.length > 0)) && linkedPayments.length > 0 && (
            <>
              <View style={rd.sectionDivider} />
              <View style={rd.sectionRow}>
                <Text style={rd.sectionLabel}>Collections</Text>
              </View>
              <View style={{ paddingHorizontal: DC.pagePadding }}>
                {linkedPayments.map((p: any, i: number) => (
                  <TouchableOpacity key={p.id} style={[rd.recRow, p.is_write_off && { opacity: 0.6 }]} onPress={() => !p.is_write_off && openRecording(p.id)}>
                    <View style={[rd.recIconWrap, p.is_write_off && { backgroundColor: DC.cardBg }]}>
                      <Ionicons name={p.is_write_off ? 'close-circle-outline' : 'cash-outline'} size={14} color={DC.pageText} />
                    </View>
                    <View style={rd.recMid}>
                      <Text style={[rd.recName, p.is_write_off && { color: Colors.muted }]}>{Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      <Text style={rd.recDate}>{formatDate(p.transaction_date)}{p.accounts?.account_name ? ` · ${p.accounts.account_name}` : ''}</Text>
                      {p.is_write_off && <Text style={{ fontFamily: AppFont.regular, fontSize: 9, color: DC.pageTextMuted }}>write-off</Text>}
                      {p.payment_to && !p.is_write_off && <Text style={[rd.recDate, { color: DC.accent1 }]}>{p.payment_to}</Text>}
                    </View>
                    {!p.is_write_off && <Ionicons name="chevron-forward" size={13} color={Colors.muted} />}
                  </TouchableOpacity>
                ))}
              </View>
              {personPayStatus.length > 0 && (
                <>
                  <View style={rd.sectionRow}>
                    <Text style={rd.sectionLabel}>Per Person Status</Text>
                  </View>
                  <View style={{ paddingHorizontal: DC.pagePadding }}>
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
                          <Text style={{ fontFamily: AppFont.semiBold, fontSize: 11, color: statusColor }}>{fullyPaid ? 'paid' : partial ? 'partial' : 'unpaid'}</Text>
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
              <View style={rd.sectionDivider} />
              <View style={rd.sectionRow}>
                <Text style={rd.sectionLabel}>Split Bill Collections</Text>
              </View>
              <View style={{ paddingHorizontal: DC.pagePadding }}>
                {splitBillPayments.map((p: any) => (
                  <View key={p.id} style={rd.recRow}>
                    <View style={rd.recIconWrap}><Ionicons name="person-outline" size={14} color={DC.pageText} /></View>
                    <View style={rd.recMid}>
                      <Text style={rd.recName}>{p.person_name}</Text>
                      <Text style={rd.recDate}>{new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    </View>
                    <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: DC.accent1 }}>
                      {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Related records — payments charged to this expense from a split bill */}
          {relatedSplitBillPayments.length > 0 && (
            <>
              <View style={rd.sectionDivider} />
              <View style={rd.sectionRow}>
                <Text style={rd.sectionLabel}>Related Records</Text>
              </View>
              <View style={{ paddingHorizontal: DC.pagePadding }}>
                {relatedSplitBillPayments.map((p: any) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[rd.recRow, p.status === 'cancelled' && { opacity: 0.45 }]}
                    onPress={() => {
                      if (chargedFromSplitBill) {
                        openSplitBill(chargedFromSplitBill.id, chargedFromSplitBill.name);
                      }
                    }}
                    activeOpacity={chargedFromSplitBill ? 0.7 : 1}
                  >
                    <View style={rd.recIconWrap}>
                      <Ionicons name={p.status === 'cancelled' ? 'close-circle-outline' : 'people-outline'} size={14} color={DC.pageText} />
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
                    <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: p.status === 'cancelled' ? DC.pageTextMuted : DC.accent1 }}>
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

      {/* Actions bottom sheet */}
      <BottomSheet visible={showAddChoice} onClose={() => setShowAddChoice(false)} title="actions">
        {isOwner && (
          <TouchableOpacity style={rd.choiceRow} activeOpacity={0.8} onPress={() => { setShowAddChoice(false); openEditModal(); }}>
            <View style={[rd.choiceIcon, { backgroundColor: DC.accent1 + '22' }]}><Ionicons name="create-outline" size={20} color={DC.accent1} /></View>
            <View style={{ flex: 1 }}><Text style={rd.choiceTitle}>Edit Recording</Text><Text style={rd.choiceSub}>Change name, date, amount, category</Text></View>
            <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
          </TouchableOpacity>
        )}
        {!isOwner && recording?.status === 'paid' && (
          <TouchableOpacity style={rd.choiceRow} activeOpacity={0.8} onPress={() => { setShowAddChoice(false); router.push({ pathname: '/(app)/add-recording', params: { name: recording?.name, amount: String(recording?.amount ?? ''), spaceId: recording?.space_id, date: recording?.transaction_date, type: 'expense' } } as any); }}>
            <View style={[rd.choiceIcon, { backgroundColor: DC.accent1 + '22' }]}><Ionicons name="download-outline" size={20} color={DC.accent1} /></View>
            <View style={{ flex: 1 }}><Text style={rd.choiceTitle}>Save to My Account</Text><Text style={rd.choiceSub}>Create an expense in your own space</Text></View>
            <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
          </TouchableOpacity>
        )}
        {isOwner && recording?.type === 'expense' && !linkedPayable && !linkedReceivable && !recording?.is_due && !recording?.person_name && !linkedSplitBill && (
          <TouchableOpacity style={rd.choiceRow} activeOpacity={0.8} onPress={() => { setShowAddChoice(false); setReceivableMode('full'); setReceivableManualAmount(''); setReceivableSelectedPeople([]); setReceivableModal(true); }}>
            <View style={[rd.choiceIcon, { backgroundColor: DC.accent1 + '22' }]}><Ionicons name="arrow-undo-outline" size={20} color={DC.accent1} /></View>
            <View style={{ flex: 1 }}><Text style={rd.choiceTitle}>Tag as Due</Text><Text style={rd.choiceSub}>Mark this expense as collectible</Text></View>
            <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
          </TouchableOpacity>
        )}
        {isOwner && recording?.type === 'expense' && recording?.is_due && !recording?.tagged_friend_user_id && (recording?.shared_with ?? []).length === 0 && existingTags.length === 0 && (
          <TouchableOpacity style={rd.choiceRow} activeOpacity={0.8} onPress={() => { setShowAddChoice(false); openTagFriendModal(); }}>
            <View style={[rd.choiceIcon, { backgroundColor: DC.accent1 + '22' }]}><Ionicons name="person-add-outline" size={20} color={DC.accent1} /></View>
            <View style={{ flex: 1 }}><Text style={rd.choiceTitle}>Tag a Friend</Text><Text style={rd.choiceSub}>Send a debt request to a friend</Text></View>
            <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
          </TouchableOpacity>
        )}
        {isOwner && recording?.type === 'expense' && recording?.is_due && (() => {
          const paid = Number(recording.paid_amount ?? 0);
          const total = Number(recording.amount ?? 0);
          if (paid >= total - 0.01) return null;
          return (
            <TouchableOpacity style={rd.choiceRow} activeOpacity={0.8} onPress={() => { setShowAddChoice(false); linkedSplitBill ? openSplitBill(linkedSplitBill.id, linkedSplitBill.name) : openCollectDueModal(); }}>
              <View style={[rd.choiceIcon, { backgroundColor: DC.accent1 + '22' }]}><Ionicons name="arrow-down-circle-outline" size={20} color={DC.accent1} /></View>
              <View style={{ flex: 1 }}><Text style={rd.choiceTitle}>Collect Payment</Text><Text style={rd.choiceSub}>Record a collection for this due</Text></View>
              <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
            </TouchableOpacity>
          );
        })()}
        {isOwner && recording?.type === 'debt' && recording?.status !== 'paid' && !recording?.is_tagged && (
          <TouchableOpacity style={rd.choiceRow} activeOpacity={0.8} onPress={() => { setShowAddChoice(false); openPayModal(); }}>
            <View style={[rd.choiceIcon, { backgroundColor: DC.accent1 + '22' }]}><Ionicons name="cash-outline" size={20} color={DC.accent1} /></View>
            <View style={{ flex: 1 }}><Text style={rd.choiceTitle}>Pay Debt</Text><Text style={rd.choiceSub}>Record a payment for this debt</Text></View>
            <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
          </TouchableOpacity>
        )}
        {isOwner && recording?.type === 'due' && recording?.status !== 'paid' && (
          <TouchableOpacity style={rd.choiceRow} activeOpacity={0.8} onPress={() => { setShowAddChoice(false); openCollectModal(); }}>
            <View style={[rd.choiceIcon, { backgroundColor: DC.accent1 + '22' }]}><Ionicons name="arrow-down-circle-outline" size={20} color={DC.accent1} /></View>
            <View style={{ flex: 1 }}><Text style={rd.choiceTitle}>Collect</Text><Text style={rd.choiceSub}>Record a collection for this due</Text></View>
            <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
          </TouchableOpacity>
        )}
        {isOwner && (() => {
          const isWriteOffable = (recording?.type === 'due' || recording?.type === 'debt' || (recording?.type === 'expense' && recording?.is_due)) && recording?.status !== 'paid';
          const remaining = Math.max(0, Number(recording?.amount ?? 0) - Number(recording?.paid_amount ?? 0));
          if (!isWriteOffable || remaining <= 0) return null;
          return (
            <TouchableOpacity style={rd.choiceRow} activeOpacity={0.8} onPress={() => { setShowAddChoice(false); setWriteOffReason(''); setWriteOffModal(true); }}>
              <View style={[rd.choiceIcon, { backgroundColor: DC.cardBg }]}><Ionicons name="close-circle-outline" size={20} color={DC.pageTextMuted} /></View>
              <View style={{ flex: 1 }}><Text style={rd.choiceTitle}>Write Off</Text><Text style={rd.choiceSub}>Record the unpaid remainder as bad debt</Text></View>
              <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
            </TouchableOpacity>
          );
        })()}
        {isOwner && (
          <TouchableOpacity style={rd.choiceRow} activeOpacity={0.8} onPress={() => { setShowAddChoice(false); setDeleteConfirm(true); }}>
            <View style={[rd.choiceIcon, { backgroundColor: Colors.dangerBg }]}><Ionicons name="trash-outline" size={20} color={Colors.danger} /></View>
            <View style={{ flex: 1 }}><Text style={[rd.choiceTitle, { color: Colors.danger }]}>Delete</Text><Text style={rd.choiceSub}>Permanently remove this recording</Text></View>
          </TouchableOpacity>
        )}
      </BottomSheet>
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
        message={(() => {
          const hasPaid = Number(recording?.paid_amount ?? 0) > 0;
          const isTaggedDebt = recording?.is_tagged && recording?.tagged_by_user_id;
          if (isTaggedDebt && hasPaid) return 'this debt has payments collected against it. you cannot delete it.';
          if (isTaggedDebt) return 'deleting this will notify the original person that you removed the debt.';
          if (hasPaid) return `this expense has ${Number(recording?.paid_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} collected. deleting will also remove all collection records. this cannot be undone.`;
          if (linkedPayable) return `this expense is linked to the payable "${linkedPayable.name}". what do you want to do?`;
          if (linkedReceipt) return 'do you also want to delete the linked receipt and its photos?';
          return 'this cannot be undone.';
        })()}
        actions={(() => {
          const hasPaid = Number(recording?.paid_amount ?? 0) > 0;
          const isTaggedDebt = recording?.is_tagged && recording?.tagged_by_user_id;
          if (isTaggedDebt && hasPaid) return [
            { label: 'ok', onPress: () => setDeleteConfirm(false), muted: true },
          ];
          if (hasPaid) return [
            { label: 'cancel', onPress: () => setDeleteConfirm(false), muted: true },
            { label: deleteLoading ? '...' : 'delete everything', onPress: () => confirmDelete(true, !!linkedReceipt, false, true), destructive: true, disabled: deleteLoading },
          ];
          if (linkedPayable) return [
            { label: 'cancel', onPress: () => setDeleteConfirm(false), muted: true },
            { label: 'expense only', onPress: () => confirmDelete(false, false, false), disabled: deleteLoading },
            { label: deleteLoading ? '...' : 'delete both', onPress: () => confirmDelete(true, false, true), destructive: true, disabled: deleteLoading },
          ];
          return [
            { label: 'cancel', onPress: () => setDeleteConfirm(false), muted: true },
            ...(linkedReceipt ? [{ label: 'keep receipt', onPress: () => confirmDelete(true, false), disabled: deleteLoading }] : []),
            { label: deleteLoading ? '...' : linkedReceipt ? 'delete both' : 'delete', onPress: () => confirmDelete(true, !!linkedReceipt), destructive: true, disabled: deleteLoading },
          ];
        })()}
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
        recordingPaidAmount={Number(recording?.paid_amount ?? 0)}
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
        message={Number(recording?.paid_amount ?? 0) > 0
          ? 'cannot cancel — payments have already been collected against this due.'
          : recording?.tagged_friend_user_id
            ? 'this will cancel the due tag, remove the pending request from your friend, and delete their debt if they already accepted.'
            : 'this will remove the due tag from this expense.'}
        actions={Number(recording?.paid_amount ?? 0) > 0 ? [
          { label: 'ok', onPress: () => setCancelDueConfirm(false), muted: true },
        ] : [
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

      {/* Edit recording modal — new recording modal design */}
      <Modal visible={editModal} animationType="slide" transparent statusBarTranslucent onRequestClose={() => { setEditModal(false); setEditError(''); }}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.88)' }}>
            <View style={{ flex: 1, paddingHorizontal: DC.pagePadding, paddingTop: 16 }}>

              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16 }}>
                <Text style={{ fontFamily: AppFont.bold, fontSize: 22, color: DC.accent1, letterSpacing: -0.5 }}>Edit Recording</Text>
                <TouchableOpacity onPress={() => { setEditModal(false); setEditError(''); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: AppFont.bold, fontSize: 14, color: DC.pageText }}>✕</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
                {editError ? <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.expense }}>{editError}</Text> : null}

                {/* Name */}
                <View style={em.field}>
                  <Text style={em.label}>Name</Text>
                  <TextInput style={em.input} placeholder="recording name" placeholderTextColor={Colors.faint} value={editName} onChangeText={setEditName} autoFocus />
                </View>

                {/* Amount */}
                <View style={em.field}>
                  <Text style={em.label}>Amount {editAmountLocked && <Text style={{ color: Colors.muted, textTransform: 'none', fontFamily: AppFont.regular }}>(locked)</Text>}</Text>
                  <TextInput style={[em.input, editAmountLocked && { color: Colors.muted }]} placeholder="0.00" placeholderTextColor={Colors.faint} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" editable={!editAmountLocked} />
                </View>

                {/* Date */}
                <View style={em.field}>
                  <Text style={em.label}>Date</Text>
                  <TextInput style={em.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.faint} value={editDate} onChangeText={setEditDate} />
                </View>

                {/* Category */}
                <View style={em.field}>
                  <Text style={em.label}>Category</Text>
                  <TouchableOpacity style={em.selector} onPress={() => setShowEditCategoryModal(true)} activeOpacity={0.8}>
                    <Text style={[em.selectorText, !editCategoryId && { color: Colors.faint }]}>
                      {editCategoryId ? (editCategories.find(c => c.id === editCategoryId)?.name ?? 'select') : 'optional'}
                    </Text>
                    <Ionicons name="chevron-down" size={13} color={Colors.faint} />
                  </TouchableOpacity>
                </View>

                {/* Notes */}
                <View style={em.field}>
                  <Text style={em.label}>Notes</Text>
                  <TextInput style={[em.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="optional" placeholderTextColor={Colors.faint} value={editNotes} onChangeText={setEditNotes} multiline />
                </View>

                {/* Account */}
                <View style={em.field}>
                  <Text style={em.label}>Account</Text>
                  {editAccounts.length === 0 ? (
                    <View style={{ height: 80 }}><GooeyLoader size={36} /></View>
                  ) : (
                    <View style={em.accountList}>
                      <TouchableOpacity
                        style={[em.accountRow, !editAccountId && em.accountRowActive]}
                        onPress={() => setEditAccountId('')}
                      >
                        <Ionicons name={!editAccountId ? 'radio-button-on' : 'radio-button-off'} size={16} color={!editAccountId ? DC.accent1 : Colors.faint} />
                        <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>none</Text>
                      </TouchableOpacity>
                      {editAccounts.map(acc => (
                        <TouchableOpacity key={acc.id} style={[em.accountRow, editAccountId === acc.id && em.accountRowActive]} onPress={() => setEditAccountId(acc.id)}>
                          <Ionicons name={editAccountId === acc.id ? 'radio-button-on' : 'radio-button-off'} size={16} color={editAccountId === acc.id ? DC.accent1 : Colors.faint} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: DC.pageText }}>{acc.account_name}</Text>
                            <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted }}>{acc.bank}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Save */}
                <TouchableOpacity
                  style={[rd.doneBtn, !editDate && { opacity: 0.4 }]}
                  onPress={saveEdit}
                  disabled={!editDate}
                  activeOpacity={0.8}
                >
                  <Text style={rd.doneBtnText}>Save Changes</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

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

      {/* Photo viewer modal */}
      <Modal visible={photoModal} transparent animationType="fade" onRequestClose={() => setPhotoModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: DC.photoViewerBg }}>

          {/* 1. Header */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: DC.pagePadding, paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontFamily: "MuseoModerno_Regular", fontSize: 11, color: DC.pageTextMuted, letterSpacing: 2 }}>LEDGR</Text>
              <Text style={{ fontFamily: AppFont.bold, fontSize: 15, color: DC.pageText }} numberOfLines={1}>{recording?.name ?? ""}</Text>
            </View>
            <TouchableOpacity onPress={() => setPhotoModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ position: "absolute", right: DC.pagePadding }}>
              <Ionicons name="close" size={22} color={DC.pageText} />
            </TouchableOpacity>
          </View>

          {/* 2. Photo + arrows â€” fixed height container */}
          <View style={{ height: 420, justifyContent: "center", alignItems: "center", position: "relative" }}>
            <TouchableOpacity onPress={() => setPhotoModalIndex(i => i - 1)} disabled={photoModalIndex === 0} style={{ position: "absolute", left: 12, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: DC.photoViewerNav, justifyContent: "center", alignItems: "center", opacity: photoModalIndex === 0 ? 0.3 : 1 }}>
              <Ionicons name="chevron-back" size={20} color={DC.pageText} />
            </TouchableOpacity>
            <Image source={{ uri: receiptPhotos[photoModalIndex]?.url ?? "" }} style={{ width: width - 80, height: 400, borderRadius: 12 }} resizeMode="contain" />
            <TouchableOpacity onPress={() => setPhotoModalIndex(i => i + 1)} disabled={photoModalIndex === receiptPhotos.length - 1} style={{ position: "absolute", right: 12, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: DC.photoViewerNav, justifyContent: "center", alignItems: "center", opacity: photoModalIndex === receiptPhotos.length - 1 ? 0.3 : 1 }}>
              <Ionicons name="chevron-forward" size={20} color={DC.pageText} />
            </TouchableOpacity>
          </View>

          {/* 3. Action buttons */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, paddingVertical: 16 }}>
            <TouchableOpacity style={{ backgroundColor: DC.btnBg, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 10 }} activeOpacity={0.8} onPress={() => { setAddReceiptModal(true); }}>
              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: DC.btnText }}>Add More</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ backgroundColor: DC.photoViewerDeleteBg, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 10 }} activeOpacity={0.8} onPress={() => setPhotoDeleteConfirm(true)}>
              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: DC.photoViewerDeleteText }}>Delete</Text>
            </TouchableOpacity>
          </View>

          {/* 4. Dot indicators */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingBottom: 12 }}>
            {receiptPhotos.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setPhotoModalIndex(i)}>
                <View style={{ width: i === photoModalIndex ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === photoModalIndex ? DC.accent1 : DC.cardBorder }} />
              </TouchableOpacity>
            ))}
          </View>

          {/* 5. Thumbnail strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DC.pagePadding, gap: 8, paddingBottom: 16 }}>
            {receiptPhotos.map((p, i) => (
              <TouchableOpacity key={p.id} onPress={() => setPhotoModalIndex(i)} activeOpacity={0.8}>
                <Image source={{ uri: p.url }} style={{ width: 64, height: 64, borderRadius: 8, borderWidth: i === photoModalIndex ? 2 : 0, borderColor: DC.accent1 }} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Photo delete confirm */}
          {photoDeleteConfirm && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
              <View style={{ backgroundColor: Colors.white, borderRadius: Radius.xl, padding: 24, marginHorizontal: DC.pagePadding, width: '80%' }}>
                <Text style={{ fontFamily: AppFont.bold, fontSize: 15, color: DC.pageText, marginBottom: 8 }}>Delete Photo?</Text>
                <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: DC.pageTextMuted, marginBottom: 20 }}>This photo will be permanently removed.</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: DC.btnBg, alignItems: 'center' }} onPress={() => setPhotoDeleteConfirm(false)} activeOpacity={0.8}>
                    <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: DC.btnText }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: DC.photoViewerDeleteBg, alignItems: 'center' }}
                    activeOpacity={0.8}
                    onPress={async () => {
                      setPhotoDeleteConfirm(false);
                      const photo = receiptPhotos[photoModalIndex];
                      if (!photo) return;
                      const { data: p } = await supabase.from('receipt_photos').select('storage_path').eq('id', photo.id).single();
                      if (p?.storage_path) await supabase.storage.from('receipts').remove([p.storage_path]);
                      await supabase.from('receipt_photos').delete().eq('id', photo.id);
                      const next = receiptPhotos.filter(r => r.id !== photo.id);
                      setReceiptPhotos(next);
                      if (next.length === 0) { setPhotoModal(false); }
                      else setPhotoModalIndex(Math.min(photoModalIndex, next.length - 1));
                    }}
                  >
                    <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: DC.photoViewerDeleteText }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Floating upload loading overlay */}
          {uploadingPhoto && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' as any }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: Radius.xl, padding: 20 }}>
                <ActivityIndicator size="large" color={DC.accent1} />
                <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: DC.pageTextMuted, marginTop: 8 }}>Uploading...</Text>
              </View>
            </View>
          )}

        </SafeAreaView>
      </Modal>

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
              const alreadyTagged = existingTags.some((t: any) => t.data?.friendId === f.id);
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

      {/* Owes-you edit modal */}
      <BottomSheet visible={owesYouEditModal} onClose={() => setOwesYouEditModal(false)} title="who owes you">
        {owesYouLoading ? (
          <ActivityIndicator color={ACCENT_DARK} style={{ marginTop: 20 }} />
        ) : (
          <>
            <TextInput
              style={{ fontFamily: Brand.font.mono, fontSize: 14, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 16 }}
              placeholder="search..."
              placeholderTextColor={Colors.faint}
              value={owesYouSearch}
              onChangeText={setOwesYouSearch}
              autoFocus
            />
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {(() => {
                const q = owesYouSearch.toLowerCase();
                const filteredFriends = owesYouFriends.filter(f => f.name.toLowerCase().includes(q));
                const filteredContacts = owesYouContacts.filter(n => n.toLowerCase().includes(q));
                return (
                  <>
                    {filteredFriends.length > 0 && (
                      <>
                        <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>friends</Text>
                        {filteredFriends.map(f => (
                          <TouchableOpacity key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }} onPress={() => saveOwesYouPerson(f.name, f.id)} activeOpacity={0.75}>
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: ACCENT + '33', alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name="people-outline" size={14} color={ACCENT_DARK} />
                            </View>
                            <Text style={{ fontFamily: Brand.font.mono, fontSize: 14, color: Colors.text, flex: 1 }}>{f.name}</Text>
                            {recording?.person_name === f.name && <Ionicons name="checkmark" size={14} color={ACCENT_DARK} />}
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                    {filteredContacts.length > 0 && (
                      <>
                        <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: filteredFriends.length > 0 ? 16 : 0, marginBottom: 8 }}>manual contacts</Text>
                        {filteredContacts.map(n => (
                          <TouchableOpacity key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }} onPress={() => saveOwesYouPerson(n, null)} activeOpacity={0.75}>
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderMid }}>
                              <Ionicons name="person-outline" size={14} color={Colors.muted} />
                            </View>
                            <Text style={{ fontFamily: Brand.font.mono, fontSize: 14, color: Colors.text, flex: 1 }}>{n}</Text>
                            {recording?.person_name === n && <Ionicons name="checkmark" size={14} color={ACCENT_DARK} />}
                          </TouchableOpacity>
                        ))}
                      </>
                    )}
                    {filteredFriends.length === 0 && filteredContacts.length === 0 && (
                      <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.muted, textAlign: 'center', paddingVertical: 24 }}>
                        {owesYouSearch ? 'no results' : 'no contacts yet'}
                      </Text>
                    )}
                  </>
                );
              })()}
            </ScrollView>
            {recording?.person_name && (
              <TouchableOpacity
                style={[rd.doneBtn, { backgroundColor: Number(recording?.paid_amount ?? 0) > 0 ? Colors.surface : Colors.dangerBg, marginTop: 16, opacity: Number(recording?.paid_amount ?? 0) > 0 ? 0.4 : 1 }]}
                onPress={removeOwesYouPerson}
                disabled={Number(recording?.paid_amount ?? 0) > 0}
              >
                <Ionicons name="person-remove-outline" size={14} color={Number(recording?.paid_amount ?? 0) > 0 ? Colors.muted : Colors.danger} />
                <Text style={[rd.doneBtnText, { color: Number(recording?.paid_amount ?? 0) > 0 ? Colors.muted : Colors.danger }]}>
                  {Number(recording?.paid_amount ?? 0) > 0 ? 'cannot remove — payment collected' : 'remove person'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
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

      {/* Loading overlay — shown while recording data is fetching */}
      {!recording && (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <GooeyLoader />
        </BlurView>
      )}

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
  scroll:     { paddingBottom: 100, backgroundColor: Colors.white },

  // Info card
  infoCard: { marginHorizontal: DC.pagePadding, borderRadius: 16, backgroundColor: '#F8F8F8', padding: 16, marginTop: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  amountValue: { fontFamily: AppFont.bold, fontSize: 28, letterSpacing: -0.5 },
  actionsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eeeeee', alignItems: 'center', justifyContent: 'center' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoCell: { width: '46%', gap: 2 },
  infoCellLabel: { fontFamily: AppFont.regular, fontSize: 10, color: '#999999', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoCellValue: { fontFamily: AppFont.semiBold, fontSize: 13, color: '#111111' },
  typeBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { fontFamily: AppFont.semiBold, fontSize: 11 },
  notesBlock: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eeeeee', gap: 4 },
  notesLabel: { fontFamily: AppFont.semiBold, fontSize: 10, color: '#999999', textTransform: 'uppercase', letterSpacing: 0.5 },
  notesValue: { fontFamily: AppFont.regular, fontSize: 13, color: '#111111', lineHeight: 18 },

  // Choice rows (actions sheet)
  choiceRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: DC.cardBorder },
  choiceIcon:  { width: 40, height: 40, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  choiceTitle: { fontFamily: AppFont.semiBold, fontSize: 14, color: DC.pageText },
  choiceSub:   { fontFamily: AppFont.regular, fontSize: 11, color: DC.pageTextMuted, marginTop: 2 },

  // Hero (kept for compat but unused)
  heroBlock:  { paddingHorizontal: DC.pagePadding, paddingTop: 12, paddingBottom: 4 },
  heroLabel:  { fontFamily: Brand.font.monoBold, fontSize: 10, color: ACCENT_DARK, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  heroDate:   { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginTop: 1 },

  // Summary grid
  summaryGrid:  { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: DC.pagePadding, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  summaryCell:  { width: '50%', paddingVertical: 8, paddingRight: 8 },
  summaryLabel: { fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 3 },
  summaryValue: { fontFamily: Brand.font.monoBold, fontSize: 13, color: Colors.text },

  // Section headers
  sectionDivider: { height: 1, backgroundColor: DC.cardBorder, marginHorizontal: DC.pagePadding, marginVertical: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingTop: 20, paddingBottom: 6 },
  sectionLabel: { fontFamily: AppFont.bold, fontSize: 12, color: '#999999', textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: '#9cd7d222' },
  sectionBtnText: { fontFamily: AppFont.semiBold, fontSize: 12, color: '#5dc4bb' },

  // Section rows
  sectionRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingTop: 20, paddingBottom: 8 },
  sectionHeader:  { ...Brand.type.sectionHeader },
  sectionAddBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: ACCENT + '44' },
  sectionAddText: { fontFamily: Brand.font.heading, fontSize: 11, color: ACCENT_DARK },

  // List rows
  recRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  recIconWrap:{ width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  recMid:     { flex: 1, gap: 2 },
  recName:    { fontFamily: AppFont.semiBold, fontSize: 13, color: DC.pageText },
  recDate:    { fontFamily: AppFont.regular, fontSize: 10, color: DC.pageTextMuted },

  // Info rows
  infoRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoLabel:  { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, width: 80, flexShrink: 0 },
  infoValue:  { fontFamily: Brand.font.monoBold, fontSize: 12, color: Colors.text, flex: 1, textAlign: 'right' },

  // Action chips
  actionChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: ACCENT + '44' },
  actionChipText: { fontFamily: Brand.font.heading, fontSize: 11, color: ACCENT_DARK },

  // Empty
  emptyWrap:  { alignItems: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: DC.pagePadding },

  // Done button
  doneBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: DC.btnBg, borderRadius: Radius.pill, paddingVertical: 14, marginTop: 8, borderWidth: DC.btnBorderWidth },
  doneBtnText: { fontFamily: AppFont.semiBold, fontSize: 13, color: DC.btnText },

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

const em = StyleSheet.create({
  field:       { gap: 6 },
  label:       { fontFamily: AppFont.semiBold, fontSize: 11, color: DC.pageTextMuted, textTransform: 'uppercase' as const, letterSpacing: 0.6 },
  input:       { fontFamily: AppFont.regular, fontSize: 16, color: DC.pageText, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },
  selector:    { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },
  selectorText:{ fontFamily: AppFont.regular, fontSize: 16, color: DC.pageText },
  accountList: { borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.lg, overflow: 'hidden' as const },
  accountRow:  { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  accountRowActive: { backgroundColor: DC.pageActionBg },
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










