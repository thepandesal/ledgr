import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Animated, Dimensions, ActivityIndicator, TextInput, Share, Platform, Image, Modal,
} from 'react-native';
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
import itemStyles from '@/components/ui/itemStyles';
import { Brand } from '../../src/lib/brand';

const ACCENT      = Brand.color.accent;      // light mint — backgrounds/chips only
const ACCENT_DARK = Brand.color.accentDark;  // #2A7A6F — text/icons on white
const ACCENT_TEXT = Brand.color.accentText;  // dark text ON accent bg
const PAGE        = 25;
const PEACH = '#FFAB91';

const { width } = Dimensions.get('window');

export default function SplitBillDetailScreen() {
  const { splitBillId, name } = useLocalSearchParams<{ splitBillId: string; name: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
  }, []);

  const [editNameModal, setEditNameModal] = useState(false);
  const [editNameVal, setEditNameVal]     = useState('');

  const openEditName = () => { setEditNameVal(String(name)); setEditNameModal(true); };
  const saveEditName = async () => {
    if (!editNameVal.trim()) return;
    await supabase.from('split_bills').update({ name: editNameVal.trim() }).eq('id', splitBillId);
    setEditNameModal(false);
    router.setParams({ name: editNameVal.trim() });
  };

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  // ── Load linked recordings ────────────────────────────────────────────────
  const { userId } = useUser();

  // ── People state ─────────────────────────────────────────────────────────
  const [addPersonModal, setAddPersonModal] = useState(false);
  const [tagInputVal, setTagInputVal] = useState('');
  const [contacts, setContacts] = useState<string[]>([]);

  // ── Receipt state ─────────────────────────────────────────────────────────
  const [linkedReceipt, setLinkedReceipt]   = useState<any>(null);
  const [receiptPhotos, setReceiptPhotos]   = useState<{ id: string; url: string }[]>([]);
  const [addReceiptModal, setAddReceiptModal] = useState(false);
  const [photoModal, setPhotoModal]         = useState(false);
  const [photoModalIndex, setPhotoModalIndex] = useState(0);

  const loadLinkedReceipt = async () => {
    if (!splitBillId) return;
    const { data: entry } = await supabase.from('receipt_entries').select('id, note, created_at').eq('split_bill_id', splitBillId).maybeSingle();
    if (!entry) { setLinkedReceipt(null); setReceiptPhotos([]); return; }
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

  useEffect(() => {
    if (!userId) return;
    supabase.from('contacts').select('name').eq('user_id', userId).order('name')
      .then(({ data }) => { if (data) setContacts(data.map((c: any) => c.name)); });
  }, [userId]);

  const savePerson = async (name: string) => {
    if (!name.trim() || filledPeople.includes(name.trim())) return;
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
    const name = tagInputVal.trim();
    if (name) await savePerson(name);
    setTagInputVal('');
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
      .select('id, name, amount, type, transaction_date, status')
      .eq('user_id', userId)
      .in('type', ['expense', 'due', 'debt', 'income'])
      .order('transaction_date', { ascending: false })
      .limit(200);
    setAllRecordings((data ?? []).filter((r: any) => !linkedIds.includes(r.id)));
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
  const [itemStep, setItemStep]                   = useState<'pick-type' | 'pick-recording' | 'add-items' | 'manual'>('pick-type');
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  const [itemRows, setItemRows]                   = useState<{ name: string; cost: string }[]>([{ name: '', cost: '' }]);
  const [savingItem, setSavingItem]               = useState(false);
  const [manualItemType, setManualItemType]        = useState<'receivable' | 'payable'>('receivable');

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
  const isDeductType = (type: string) => type === 'payable';

  const totalItemsCost = items.reduce((s: number, i: any) => s + Number(i.cost), 0);

  const openAddItem = () => {
    setItemStep('pick-type');
    setSelectedRecording(null);
    setItemRows([{ name: '', cost: '' }]);
    setAddItemModal(true);
  };

  const handlePickRecording = (lr: any) => {
    setSelectedRecording(lr);
    setItemRows([{ name: '', cost: '' }]);
    setItemStep('add-items');
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

  const copyShareLink = () => {
    if (!shareLink) return;
    if (Platform.OS !== 'web') { Share.share({ message: shareLink, url: shareLink }); return; }
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
      // Build per-person totals
      const totals: Record<string, number> = {};
      filledPeople.forEach((p: string) => { totals[p] = 0; });
      items.forEach((item: any) => {
        const d = isDeductType(item.recording_type);
        const pp = (item.people ?? []).length > 0 ? Number(item.cost) / item.people.length : 0;
        (item.people ?? []).forEach((p: string) => { if (totals[p] !== undefined) totals[p] += d ? -pp : pp; });
      });

      const personRows = filledPeople.map((p: string) =>
        `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0">`+
        `<div style="width:32px;height:32px;border-radius:50%;background:#B6E1DE44;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:#2A7A6F">◉</div>`+
        `<span style="font-family:monospace;font-size:13px;color:#425252;flex:1">${p}</span>`+
        `<span style="font-family:monospace;font-size:14px;font-weight:700;color:${totals[p]<0?'#FFAB91':'#2A7A6F'}">`+
        `${totals[p]<0?'-':''}${Math.abs(totals[p]).toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>`
      ).join('');
      const grandTotal = Object.values(totals).reduce((s,v)=>s+v,0);
      const totalRow = `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;background:#B6E1DE44">`+
        `<div style="width:32px;height:32px;border-radius:50%;background:#B6E1DE;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:#2A7A6F">Σ</div>`+
        `<span style="font-family:monospace;font-size:13px;font-weight:700;color:#2A7A6F;flex:1">total</span>`+
        `<span style="font-family:monospace;font-size:14px;font-weight:700;color:#2A7A6F">${grandTotal<0?'-':''}${Math.abs(grandTotal).toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>`;

      const itemsHtml = items.map((item: any) => {
        const d = isDeductType(item.recording_type);
        const peopleStr = (item.people??[]).join(', ');
        const perPerson = item.people?.length > 0 ? Number(item.cost) / item.people.length : 0;
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0">`+
          `<div style="width:32px;height:32px;border-radius:50%;background:${d?'#FFAB9122':'#B6E1DE44'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:${d?'#FFAB91':'#2A7A6F'}">✦</div>`+
          `<div style="flex:1">`+
          `<div style="font-family:monospace;font-size:13px;color:#425252;font-weight:600">${item.name}</div>`+
          (item.people?.length>0?`<div style="font-family:monospace;font-size:10px;color:#929090;margin-top:2px">${item.people.length === 1 ? item.people.length+' person' : item.people.length+' people'} · ${perPerson.toLocaleString('en-US',{minimumFractionDigits:2})} each · ${peopleStr}</div>`:'')+
          `</div>`+
          `<span style="font-family:monospace;font-size:13px;font-weight:700;color:${d?'#FFAB91':'#2A7A6F'}">${d?'-':'+'}${Number(item.cost).toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>`;
      }).join('');

      // Pre-convert QR images to base64 to avoid CORS in html2canvas
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

      const payHtml = accountsWithBase64.map((a: any) => {
        const qrSrc = a.qr_base64 || a.qr_code;
        const qrImg = qrSrc
          ? `<img src="${qrSrc}" width="80" height="80" style="border-radius:8px;object-fit:contain;flex-shrink:0"/>`
          : '';
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f0f0f0">`+
          `<div style="width:32px;height:32px;border-radius:50%;background:#B6E1DE;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:#2A7A6F">■</div>`+
          `<div style="flex:1">`+
          `<div style="font-family:monospace;font-size:14px;font-weight:600;color:#425252">${a.bank??''}</div>`+
          `<div style="font-family:monospace;font-size:10px;color:#929090;margin:2px 0">${a.holder_name??a.account_name??''}</div>`+
          `<div style="font-family:monospace;font-size:13px;font-weight:700;color:#425252">${a.account_number??''}</div>`+
          `</div>${qrImg}</div>`;
      }).join('');

      const sectionLabel = (text: string) =>
        `<div style="font-family:monospace;font-size:10px;font-weight:700;color:#929090;letter-spacing:0.8px;text-transform:uppercase;margin:24px 0 8px">${text}</div>`;

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">`+
        `<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;padding:32px;width:480px}</style>`+
        `</head><body>`+
        `<div style="font-family:monospace;font-size:13px;font-weight:700;color:#2A7A6F;letter-spacing:1px;margin-bottom:16px">LEDGR</div>`+
        `<div style="font-size:26px;font-weight:600;color:#425252;margin-bottom:6px;letter-spacing:-0.5px">${name}</div>`+
        `<div style="font-family:monospace;font-size:11px;color:#929090;margin-bottom:4px">${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>`+
        `<div style="height:1px;background:#f0f0f0;margin:20px 0"></div>`+
        sectionLabel('per person pay')+
        `<div style="border:1px solid #f0f0f0;border-radius:12px;overflow:hidden;margin-bottom:4px">`+
        personRows + totalRow +
        `</div>`+
        sectionLabel('item breakdown')+
        `<div style="border:1px solid #f0f0f0;border-radius:12px;overflow:hidden;margin-bottom:4px">`+
        itemsHtml+
        `</div>`+
        (payHtml ? sectionLabel('payment information')+`<div style="border:1px solid #f0f0f0;border-radius:12px;overflow:hidden">${payHtml}</div>` : '')+
        `<div style="font-family:monospace;font-size:10px;color:#c0c0c0;text-align:center;margin-top:24px">generated by LEDGR</div>`+
        `</body></html>`;

      if (Platform.OS !== 'web') {
        const Print = require('expo-print');
        const Sharing = require('expo-sharing');
        const { uri } = await Print.printToFileAsync({ html, width: 520 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save split bill' });
        }
      } else if (typeof document !== 'undefined') {
        await new Promise<void>((resolve, reject) => {
          if ((window as any).html2canvas) { resolve(); return; }
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = () => resolve(); script.onerror = reject;
          document.head.appendChild(script);
        });
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:520px;height:2000px;border:none;background:#fff';
        document.body.appendChild(iframe);
        iframe.contentDocument!.open();
        iframe.contentDocument!.write(html);
        iframe.contentDocument!.close();
        await new Promise(r => setTimeout(r, 800));
        const body = iframe.contentDocument!.body;
        const canvas = await (window as any).html2canvas(body, {
          scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
          width: 520, windowWidth: 520,
          scrollY: 0, scrollX: 0,
          height: body.scrollHeight, windowHeight: body.scrollHeight,
        });
        document.body.removeChild(iframe);
        canvas.toBlob((blob: Blob | null) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `${String(name).replace(/\s+/g,'-')}-split.png`;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a); URL.revokeObjectURL(url);
        }, 'image/png');
      }
    } catch (e) { console.error('saveAsImage error:', e); }
    setSaveImgLoading(false);
  };

  const { data: linkedRecordings = [], isLoading: loadingRecs } = useQuery({
    queryKey: ['split-bill-recordings', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_bill_recordings')
        .select('id, amount_contributed, recording:recording_id(id, name, amount, type, transaction_date, status, space_id, category_id, linked_recording_id)')
        .eq('split_bill_id', splitBillId)
        .order('created_at');
      return (data ?? []).map((r: any) => ({
        ...r,
        recording: Array.isArray(r.recording) ? r.recording[0] : r.recording,
      }));
    },
    enabled: !!splitBillId,
  });

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
        .select('*')
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
  const [paymentRecord, setPaymentRecord]   = useState(true);
  const [paymentSaving, setPaymentSaving]   = useState(false);

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

  const openPaymentModal = (person: string) => {
    setPaymentPerson(person);
    setPaymentMode('full');
    setPaymentAmount('');
    setPaymentRecord(true);
    setPaymentModal(true);
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
    const paidSoFar = payments
      .filter((p: any) => p.person_name === paymentPerson)
      .reduce((s: number, p: any) => s + Number(p.amount), 0);
    const amount = paymentMode === 'full' ? owed - paidSoFar : parseFloat(paymentAmount || '0');
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

    items.forEach((item: any) => {
      const assignedToMe = (item.people ?? []).includes(paymentPerson);
      if (!assignedToMe) return;
      const pp = Number(item.cost) / item.people.length;
      if (item.recording_id) {
        const rid = item.recording_id;
        // Find the recording details from linkedRecordings
        const lr = linkedRecordings.find((l: any) => l.recording?.id === rid);
        if (!recordingOwed[rid]) recordingOwed[rid] = { amount: 0, rec: lr?.recording };
        recordingOwed[rid].amount += pp;
      } else {
        manualOwed += pp;
      }
    });

    // 3. Sequential assignment — pay recording items first, then manual
    let remaining = amount;
    const today = new Date().toISOString().split('T')[0];

    for (const rid of Object.keys(recordingOwed)) {
      if (remaining <= 0) break;
      const { amount: itemAmount, rec } = recordingOwed[rid];
      if (!rec) continue;
      const credit = Math.min(remaining, itemAmount);
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
    if (remaining > 0 && manualOwed > 0) {
      const manualCredit = Math.min(remaining, manualOwed);
      // FIX 1: check by split_bill_id instead of name so renames don't
      // break the dedup and a new prompt isn't shown after every payment.
      const { data: existingManual } = await supabase
        .from('recordings')
        .select('id')
        .eq('user_id', userId)
        .eq('split_bill_id', splitBillId)
        .is('linked_recording_id', null)
        .limit(1);

      if (!existingManual || existingManual.length === 0) {
        // No existing manual recording — prompt user
        setManualReturnAmount(manualCredit);
        setManualReturnType('return');
        setManualReturnModal(true);
      }
      // If it already exists, silently skip (already tracked)
    }

    setPaymentSaving(false);
    setPaymentModal(false);
    refetchPayments();
    queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
  };
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const typeColor = (type: string) => {
    if (type === 'debt') return PEACH;
    return ACCENT_DARK;
  };

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: Colors.white }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{name}</Text>
          <TouchableOpacity onPress={openEditName} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
            <Ionicons name="create-outline" size={16} color={Colors.muted} />
          </TouchableOpacity>
          <View style={s.totalBadge}>
            <Text style={s.totalBadgeText}>{fmt(totalAmount)}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={{ height: 8 }} />
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>recordings</Text>
            <TouchableOpacity onPress={openAddRecording} style={s.sectionAddBtn}>
              <Ionicons name="add" size={12} color={ACCENT_DARK} />
              <Text style={s.sectionAddText}>add</Text>
            </TouchableOpacity>
          </View>
          {loadingRecs ? (
            <ActivityIndicator color={ACCENT_DARK} />
          ) : linkedRecordings.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={Brand.type.emptyText}>no recordings linked yet</Text>
            </View>
          ) : (
            <View style={s.list}>
              {linkedRecordings.map((lr: any) => {
                  const rec = lr.recording;
                  const isDone =
                    (rec?.type === 'expense' && rec?.status === 'paid') ||
                    (rec?.type === 'due'     && rec?.status === 'paid') ||
                    (rec?.type === 'debt'    && rec?.status === 'paid');
                  const actionable = rec?.type === 'expense' || rec?.type === 'due' || rec?.type === 'debt';
                  return (
                <TouchableOpacity
                  key={lr.id}
                  style={s.recRow}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: lr.recording?.id } } as any)}
                >
                  <View style={[s.recIconWrap, { backgroundColor: ACCENT + '44' }]}>
                    <Ionicons name="receipt-outline" size={16} color={ACCENT_DARK} />
                  </View>
                  <View style={s.recMid}>
                    <Text style={s.recName} numberOfLines={1}>{lr.recording?.name ?? '—'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.recDate}>
                        {lr.recording?.transaction_date
                          ? new Date(lr.recording.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </Text>
                      {isDone && (
                        <View style={{ backgroundColor: ACCENT + '44', borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 9, color: ACCENT_DARK }}>
                            {rec?.type === 'due' ? 'collected' : 'paid'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={[s.recAmount, { color: typeColor(lr.recording?.type ?? '') }]}>
                    {fmt(Number(lr.amount_contributed))}
                  </Text>
                  {actionable && !isDone && (
                    <TouchableOpacity
                      onPress={() => openMarkPaid(lr)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color={ACCENT_DARK} />
                    </TouchableOpacity>
                  )}
                  {rec?.type === 'expense' && rec?.is_due && rec?.status !== 'paid' && (
                    <TouchableOpacity
                      onPress={async () => {
                        await supabase.from('recordings').update({
                          paid_amount: rec.amount,
                          status: 'paid',
                        }).eq('id', rec.id);
                        queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="checkmark-done-circle-outline" size={18} color={ACCENT_DARK} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={async () => {
                      await supabase.from('split_bill_recordings').delete().eq('id', lr.id);
                      queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={14} color={Colors.faint} />
                  </TouchableOpacity>
                </TouchableOpacity>
                  );
                })}
            </View>
          )}

          {/* People */}
          <View style={s.divider} />
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>people</Text>
            <TouchableOpacity onPress={() => { setTagInputVal(''); setAddPersonModal(true); }} style={s.sectionAddBtn}>
              <Ionicons name="add" size={12} color={ACCENT_DARK} />
              <Text style={s.sectionAddText}>add</Text>
            </TouchableOpacity>
          </View>
          {filledPeople.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={Brand.type.emptyText}>no people yet — tap add</Text>
            </View>
          ) : (
            <View style={s.chipWrap}>
              {people.map((p: any) => (
                <View key={p.id} style={s.personChip}>
                  <Text style={s.personChipText}>{p.person_name}</Text>
                  <TouchableOpacity onPress={() => removePerson(p.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close" size={11} color={Colors.muted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Items */}
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>items</Text>
            <TouchableOpacity
              onPress={openAddItem}
              style={[s.sectionAddBtn, filledPeople.length === 0 && { opacity: 0.4 }]}
              disabled={filledPeople.length === 0}
            >
              <Ionicons name="add" size={12} color={ACCENT_DARK} />
              <Text style={s.sectionAddText}>add</Text>
            </TouchableOpacity>
          </View>
          {items.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={Brand.type.emptyText}>{filledPeople.length === 0 ? 'add people first' : 'no items yet'}</Text>
            </View>
          ) : (
            <View style={s.list}>
              {items.map((item: any, idx: number) => {
                const deduct = isDeductType(item.recording_type);
                const perPerson = item.people?.length > 0 ? Number(item.cost) / item.people.length : 0;
                return (
                  <TouchableOpacity key={item.id} style={s.itemCard} onPress={() => openAssign(item)} activeOpacity={0.8}>
                    <Text style={s.itemNum}>{idx + 1}</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                      {item.people?.length > 0 ? (
                <Text style={[s.itemSplit, { color: deduct ? ACCENT_DARK : '#FFAB91' }]}>
                          {deduct ? '-' : '+'}{perPerson.toLocaleString('en-US', { minimumFractionDigits: 2 })} each · {item.people.join(', ')}
                        </Text>
                      ) : (
                        <Text style={[s.itemSplit, { color: Colors.faint }]}>tap to assign people</Text>
                      )}
                    </View>
                    <Text style={[s.itemCost, { color: deduct ? ACCENT_DARK : Colors.text }]}>{deduct ? '-' : ''}{fmt(Number(item.cost))}</Text>
                    <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={14} color={Colors.faint} />
                    </TouchableOpacity>
                  </TouchableOpacity>
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
            <TouchableOpacity onPress={() => setAddReceiptModal(true)} style={s.sectionAddBtn}>
              <Ionicons name="add" size={12} color={ACCENT_DARK} />
              <Text style={s.sectionAddText}>add</Text>
            </TouchableOpacity>
          </View>
          {linkedReceipt && receiptPhotos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
              {receiptPhotos.map((p, idx) => (
                <TouchableOpacity key={p.id} onPress={() => { setPhotoModalIndex(idx); setPhotoModal(true); }} activeOpacity={0.85}>
                  <Image source={{ uri: p.url }} style={{ width: 90, height: 90, borderRadius: Radius.md, backgroundColor: Colors.surface }} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={s.emptyWrap}>
              <Text style={Brand.type.emptyText}>no receipt photos yet</Text>
            </View>
          )}

          {/* Payment history */}
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>payment history</Text>
          </View>
          {filledPeople.length === 0 || items.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={Brand.type.emptyText}>add people and items to see payment history</Text>
            </View>
          ) : (() => {
            const totals = computeTotals();
            return (
            <View style={s.list}>
                {filledPeople.map(p => {
                  const owed = totals[p] ?? 0;
                  const isNegative = owed < 0; // you owe them
                  const absOwed = Math.abs(owed);
                  const paid = payments
                    .filter((pay: any) => pay.person_name === p)
                    .reduce((s: number, pay: any) => s + Number(pay.amount), 0);
                  const remaining = Math.max(0, absOwed - paid);
                  const fullyPaid = absOwed > 0 && paid >= absOwed - 0.01;
                  const pct = absOwed > 0 ? Math.min(paid / absOwed, 1) : 0;
                  return (
                    <View key={p} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 }}>
                      {/* Name row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[s.recName, { flex: 1 }]}>{p}</Text>
                        <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 13, color: isNegative ? PEACH : ACCENT_DARK }}>
                          {isNegative ? 'to pay: ' : 'to collect: '}{fmt(absOwed)}
                        </Text>
                        {!fullyPaid && absOwed > 0 && (
                          <TouchableOpacity
                            onPress={() => openPaymentModal(p)}
                            style={{ marginLeft: 10, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: ACCENT + '44', borderRadius: Radius.pill }}
                          >
                            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: ACCENT_DARK }}>add payment</Text>
                          </TouchableOpacity>
                        )}
                        {fullyPaid && (
                          <View style={{ marginLeft: 10, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: ACCENT + '44', borderRadius: Radius.pill }}>
                            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: ACCENT_DARK }}>settled ✓</Text>
                          </View>
                        )}
                      </View>
                      {/* Progress bar */}
                      {absOwed > 0 && (
                        <>
                          <View style={{ height: 3, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' }}>
                            <View style={{ height: 3, width: `${pct * 100}%` as any, backgroundColor: fullyPaid ? ACCENT_DARK : '#FFAB91', borderRadius: 2 }} />
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontFamily: Brand.font.mono, fontSize: 9, color: Colors.muted }}>{fmt(paid)} paid</Text>
                            {!fullyPaid && <Text style={{ fontFamily: Brand.font.mono, fontSize: 9, color: Colors.muted }}>{fmt(remaining)} left</Text>}
                          </View>
                        </>
                      )}
                      {/* Payment history rows */}
                      {payments.filter((pay: any) => pay.person_name === p).map((pay: any) => (
                        <View key={pay.id} style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4, borderTopWidth: 1, borderTopColor: Colors.border }}>
                          <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted, flex: 1 }}>
                            {new Date(pay.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </Text>
                          <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 11, color: ACCENT_DARK }}>{fmt(Number(pay.amount))}</Text>
                          <TouchableOpacity
                            onPress={async () => {
                              // FIX 2: reverse the return recordings that were
                              // created when this payment was saved, then
                              // recompute paid_amount on each parent recording.
                              const { data: linkedReturns } = await supabase
                                .from('recordings')
                                .select('id, amount, linked_recording_id')
                                .eq('split_bill_payment_id', pay.id);

                              if (linkedReturns && linkedReturns.length > 0) {
                                // Group total credit to reverse per parent recording
                                const creditByParent: Record<string, number> = {};
                                for (const ret of linkedReturns) {
                                  if (ret.linked_recording_id) {
                                    creditByParent[ret.linked_recording_id] =
                                      (creditByParent[ret.linked_recording_id] ?? 0) + Number(ret.amount);
                                  }
                                }

                                // Delete the return recordings first
                                await supabase
                                  .from('recordings')
                                  .delete()
                                  .eq('split_bill_payment_id', pay.id);

                                // Reverse paid_amount on each parent and restore status if needed
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
                                      // Revert status back to unpaid only if it was
                                      // flipped to paid and is no longer fully covered
                                      ...(wasFullyPaid && !stillFullyPaid ? { status: 'unpaid' } : {}),
                                    }).eq('id', parentId);
                                  }
                                }
                              }

                              await supabase.from('split_bill_payments').delete().eq('id', pay.id);
                              refetchPayments();
                              queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
                            }}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={{ marginLeft: 8 }}
                          >
                            <Ionicons name="close" size={12} color={Colors.faint} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {/* Share */}
          <TouchableOpacity style={s.shareBtn} onPress={openShareModal} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={15} color={ACCENT_DARK} />
            <Text style={s.shareBtnText}>share split bill</Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Add item modal */}
      <BottomSheet visible={addItemModal} onClose={() => setAddItemModal(false)} title="add items" height="65%">
        {itemStep === 'pick-type' ? (
          <View style={{ gap: 12 }}>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted, marginBottom: 4 }}>how do you want to add items?</Text>
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
              <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[s.itemFormInput, { flex: 1 }]}
                  placeholder="item name"
                  placeholderTextColor={Colors.faint}
                  value={row.name}
                  onChangeText={v => setItemRows(prev => prev.map((r, idx) => idx === i ? { ...r, name: v } : r))}
                  autoFocus={i === 0}
                />
                <TextInput
                  style={[s.itemFormInput, { width: 90, textAlign: 'right' }]}
                  placeholder="0.00"
                  placeholderTextColor={Colors.faint}
                  value={row.cost}
                  onChangeText={v => setItemRows(prev => prev.map((r, idx) => idx === i ? { ...r, cost: v } : r))}
                  keyboardType="decimal-pad"
                />
                {itemRows.length > 1 && (
                  <TouchableOpacity onPress={() => setItemRows(prev => prev.filter((_, idx) => idx !== i))} style={{ justifyContent: 'center', padding: 4 }}>
                    <Ionicons name="close" size={14} color={Colors.faint} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 }} onPress={() => setItemRows(prev => [...prev, { name: '', cost: '' }])}>
              <Ionicons name="add" size={13} color={ACCENT_DARK} />
              <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: ACCENT_DARK }}>add another</Text>
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
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[s.recDate, { marginBottom: 8 }]}>
              {selectedRecording?.recording?.name} · {selectedRecording?.recording?.type} · {fmt(Number(selectedRecording?.amount_contributed))}
            </Text>
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
                    <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: over ? Colors.expense : ACCENT_DARK }}>{fmt(used)} used</Text>
                    <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: over ? Colors.expense : Colors.muted }}>
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
              <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TextInput
                  style={[s.itemFormInput, { flex: 1 }]}
                  placeholder="item name"
                  placeholderTextColor={Colors.faint}
                  value={row.name}
                  onChangeText={v => setItemRows(prev => prev.map((r, idx) => idx === i ? { ...r, name: v } : r))}
                  autoFocus={i === 0}
                />
                <TextInput
                  style={[s.itemFormInput, { width: 90, textAlign: 'right', color: rowOver ? Colors.expense : Colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={Colors.faint}
                  value={row.cost}
                  onChangeText={v => setItemRows(prev => prev.map((r, idx) => idx === i ? { ...r, cost: v } : r))}
                  keyboardType="decimal-pad"
                />
                {itemRows.length > 1 && (
                  <TouchableOpacity onPress={() => setItemRows(prev => prev.filter((_, idx) => idx !== i))} style={{ justifyContent: 'center', padding: 4 }}>
                    <Ionicons name="close" size={14} color={Colors.faint} />
                  </TouchableOpacity>
                )}
              </View>
              );
            })}
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 }} onPress={() => setItemRows(prev => [...prev, { name: '', cost: '' }])}>
              <Ionicons name="add" size={13} color={ACCENT_DARK} />
              <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: ACCENT_DARK }}>add another</Text>
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
        )}
      </BottomSheet>

      {/* Assign people sheet */}
      <BottomSheet visible={!!assignItem} onClose={() => setAssignItem(null)} title="assign people" height="50%">
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
                <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 11, color: deduct ? ACCENT_DARK : '#FFAB91', marginBottom: 12 }}>
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
      <BottomSheet visible={addPersonModal} onClose={() => setAddPersonModal(false)} title="add people" height="50%">
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
        <Text style={s.contactsLabel}>your contacts</Text>
        <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {contacts.length === 0 && <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.faint }}>no contacts saved yet</Text>}
          {contacts.map((c, i) => {
            const added = filledPeople.includes(c);
            return (
              <TouchableOpacity
                key={i}
                style={[s.contactRow, added && { opacity: 0.35 }]}
                onPress={() => { if (!added) { savePerson(c); } }}
                disabled={added}
              >
                <Text style={s.contactName}>{c}</Text>
                {added
                  ? <Ionicons name="checkmark" size={14} color={Colors.faint} />
                  : <Ionicons name="add" size={14} color={ACCENT_DARK} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={s.doneBtn} onPress={() => setAddPersonModal(false)} activeOpacity={0.8}>
          <Text style={s.doneBtnText}>done</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Add recording modal */}
      <BottomSheet visible={addRecModal} onClose={() => setAddRecModal(false)} title="link a recording" height="70%">
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
            style={{ flex: 1, fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text, paddingVertical: 8 }}
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
              return <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.faint }}>no recordings found</Text>;
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
                          <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 9, color: rec.status === 'paid' || rec.status === 'received' ? ACCENT_DARK : rec.status === 'partial' ? '#FFAB91' : Colors.muted }}>{rec.status}</Text>
                        </View>
                      )}
                      </View>
                      <Text style={[s.recAmount, { color: deduct ? ACCENT_DARK : '#FFAB91' }]}>{fmt(Number(rec.amount))}</Text>
                    </TouchableOpacity>
                  );
                })}
                {!recShowMore && filtered.length > 10 && (
                  <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center' }} onPress={() => setRecShowMore(true)}>
                    <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: ACCENT_DARK }}>
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
      <BottomSheet visible={shareModal} onClose={() => setShareModal(false)} title="share split bill" height="72%">
        {/* Accounts */}
        <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>payment account (optional)</Text>
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
                  <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 13, color: Colors.text }}>{acc.account_name}</Text>
                  <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted }}>{acc.bank} · {acc.account_number}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {shareAccounts.length === 0 && <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.faint, paddingVertical: 8 }}>no accounts found</Text>}
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
                <Text style={[s.modeBtnText, hasChanged && { color: ACCENT_DARK, fontFamily: Brand.font.monoBold }]}>
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
        <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 }}>link</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: shareLink ? ACCENT : Colors.borderMid, borderRadius: Radius.md, paddingHorizontal: 12, gap: 8 }}>
          <Text style={{ flex: 1, fontFamily: Brand.font.mono, fontSize: 11, color: shareLink ? Colors.text : Colors.faint, paddingVertical: 12 }} numberOfLines={1}>
            {shareLink || 'generate a link first'}
          </Text>
          {shareLink ? (
            <TouchableOpacity onPress={copyShareLink} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={shareCopied ? 'checkmark-circle' : 'copy-outline'} size={16} color={shareCopied ? Colors.income : ACCENT} />
            </TouchableOpacity>
          ) : null}
        </View>
        {shareCopied && <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.income, marginTop: 4 }}>copied to clipboard!</Text>}

        {/* Save as image */}
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: saveImgLoading || !shareLink ? 0.4 : 1 }]}
          onPress={saveAsImage}
          disabled={saveImgLoading || !shareLink}
        >
          <Ionicons name="image-outline" size={15} color={Colors.text} />
          <Text style={[s.doneBtnText, { color: Colors.text }]}>{saveImgLoading ? 'generating...' : 'save as image'}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Mark as paid modal */}
      <BottomSheet visible={!!markPaidRec} onClose={() => setMarkPaidRec(null)} title="mark as paid" height="55%">
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
              <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 16 }}>{hint}</Text>
              <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>account</Text>
              <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                {markPaidAccounts.map((acc: any) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}
                    onPress={() => setMarkPaidAccount(acc)}
                  >
                    <Ionicons name={markPaidAccount?.id === acc.id ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={markPaidAccount?.id === acc.id ? ACCENT_DARK : Colors.faint} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 13, color: Colors.text }}>{acc.account_name}</Text>
                      <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted }}>{acc.bank} · {acc.account_number}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {markPaidAccounts.length === 0 && <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.faint }}>no accounts found</Text>}
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
      <BottomSheet visible={paymentModal} onClose={() => setPaymentModal(false)} title="add payment" height="45%">
        {paymentModal && (() => {
          const totals = computeTotals();
          const owed = Math.abs(totals[paymentPerson] ?? 0);
          const isNegative = (totals[paymentPerson] ?? 0) < 0;
          const paid = payments
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
              <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 13, color: isNegative ? PEACH : ACCENT_DARK, marginBottom: 12 }}>
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
              {paymentMode === 'manual' && (
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
              {paymentMode === 'full' && (
                <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 15, color: ACCENT_DARK, marginBottom: 8 }}>{fmt(remaining)}</Text>
              )}
              <TouchableOpacity
                style={[s.doneBtn, { opacity: paymentSaving ? 0.5 : 1 }]}
                onPress={savePayment}
                disabled={paymentSaving}
              >
                <Text style={s.doneBtnText}>{paymentSaving ? 'saving...' : actionLabel}</Text>
              </TouchableOpacity>
            </>
          );
        })()}
      </BottomSheet>

      {/* Add receipt modal */}
      <BottomSheet visible={addReceiptModal} onClose={() => setAddReceiptModal(false)} title="add receipt" height="30%">
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
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 52, right: 24, zIndex: 10 }} onPress={() => setPhotoModal(false)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: photoModalIndex * width, y: 0 }}>
            {receiptPhotos.map((p, i) => (
              <View key={p.id} style={{ width, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
                <Image source={{ uri: p.url }} style={{ width: width - 32, height: width - 32, borderRadius: 12 }} resizeMode="contain" />
                <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 12 }}>{i + 1} / {receiptPhotos.length}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Manual return prompt */}
      <BottomSheet visible={manualReturnModal} onClose={() => setManualReturnModal(false)} title="manual item settlement" height="40%">
        <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text, marginBottom: 16 }}>
          ₱{fmt(manualReturnAmount)} is from a manual item with no linked recording.
        </Text>
        <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>create a recording for this?</Text>
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
      <BottomSheet visible={editNameModal} onClose={() => setEditNameModal(false)} title="rename split bill" height="30%">
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

    </Animated.View>
  );
}

const s = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAGE, paddingTop: 16, paddingBottom: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  title:      { flex: 1, fontFamily: Brand.font.display, fontSize: 20, color: Colors.text, letterSpacing: -0.3 },
  totalBadge: { backgroundColor: ACCENT + '44', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  totalBadgeText: { fontFamily: Brand.font.monoBold, fontSize: 12, color: ACCENT_DARK },

  scroll: { paddingBottom: 80, paddingHorizontal: PAGE },
  divider: { height: 8, backgroundColor: Colors.surface, marginHorizontal: -PAGE },

  emptyWrap: { alignItems: 'center', gap: 8, paddingVertical: 16 },

  // ── Section blocks
  sectionBlock: { marginBottom: 4 },
  sectionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingBottom: 8 },
  sectionHeader: { ...Brand.type.sectionHeader },
  sectionAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: ACCENT + '44' },
  sectionAddText:{ fontFamily: Brand.font.heading, fontSize: 11, color: ACCENT_DARK },

  // ── List rows
  list:       {},
  recRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  recIconWrap:{ width: 34, height: 34, borderRadius: 17, backgroundColor: ACCENT + '44', justifyContent: 'center', alignItems: 'center' },
  recMid:     { flex: 1, gap: 2 },
  recName:    { ...Brand.type.cardTitle },
  recDate:    { ...Brand.type.cardMeta },
  recAmount:  { fontFamily: Brand.font.monoBold, fontSize: 14, letterSpacing: -0.3 },

  // ── People chips
  chipWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  personChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ACCENT + '44', borderRadius: Radius.pill, paddingVertical: 5, paddingLeft: 12, paddingRight: 8 },
  personChipText:{ fontFamily: Brand.font.heading, fontSize: 12, color: ACCENT_DARK },

  tagInputWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, padding: 8, minHeight: 44, marginBottom: 12 },
  tagChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: ACCENT + '44', borderRadius: Radius.pill, paddingVertical: 4, paddingLeft: 10, paddingRight: 6 },
  tagChipText:   { fontFamily: Brand.font.monoBold, fontSize: 11, color: ACCENT_DARK },
  tagInput:      { fontFamily: Brand.font.mono, fontSize: 16, color: Colors.text, minWidth: 120, flex: 1, padding: 2 },
  contactsLabel: { ...Brand.type.modalLabel, marginBottom: 6 },
  contactRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  contactName:   { ...Brand.type.cardTitle },

  itemCard:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemNum:        { fontFamily: Brand.font.monoBold, fontSize: 10, color: ACCENT_DARK, backgroundColor: ACCENT + '44', width: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20 },
  itemName:       { ...Brand.type.cardTitle, fontSize: 13 },
  itemSplit:      { ...Brand.type.cardMeta },
  itemCost:       { fontFamily: Brand.font.monoBold, fontSize: 13, letterSpacing: -0.2 },
  itemsTotalRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, backgroundColor: Colors.surface, marginTop: 2 },
  itemsTotalLabel:{ ...Brand.type.cardMeta },
  itemsTotalDots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: Colors.faint, marginHorizontal: 8 },
  itemsTotalValue:{ fontFamily: Brand.font.monoBold, fontSize: 11, color: Colors.text },
  itemFormRow:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
  itemFormInput:  { fontFamily: Brand.font.mono, fontSize: 16, color: Colors.text, backgroundColor: Colors.white, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid },

  summaryRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: PAGE, borderWidth: 1, borderColor: Colors.border },
  summaryName:   { ...Brand.type.cardMeta, color: Colors.text, flexShrink: 0 },
  summaryDots:   { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: Colors.faint, marginHorizontal: 10 },
  summaryAmount: { fontFamily: Brand.font.monoBold, fontSize: 13, color: Colors.text, flexShrink: 0 },

  shareBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: ACCENT, backgroundColor: ACCENT + '44', marginTop: 24, marginBottom: 8 },
  shareBtnText:  { fontFamily: Brand.font.heading, fontSize: 13, color: ACCENT_DARK },

  recPickRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },

  modeBtn:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  modeBtnActive:     { backgroundColor: ACCENT + '44', borderColor: ACCENT },
  modeBtnText:       { fontFamily: Brand.font.mono,     fontSize: 12, color: Colors.muted },
  modeBtnTextActive: { color: ACCENT_DARK, fontFamily: Brand.font.monoBold },
  doneBtn:           { backgroundColor: ACCENT + '44', borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  doneBtnText:       { fontFamily: Brand.font.monoBold, fontSize: 14, color: ACCENT_DARK },
});
