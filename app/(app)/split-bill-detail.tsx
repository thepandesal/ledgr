import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Animated, Dimensions, ActivityIndicator, TextInput, Share, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase';
import { useUser } from '../../src/hooks/useUser';
import { Colors, Fonts, Radius } from '@/components/ui/theme';
import pageStyles from '@/components/ui/pageStyles';
import BottomSheet from '@/components/ui/BottomSheet';
import itemStyles from '@/components/ui/itemStyles';

const { width } = Dimensions.get('window');

export default function SplitBillDetailScreen() {
  const { splitBillId, name } = useLocalSearchParams<{ splitBillId: string; name: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
  }, []);

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  // ── Load linked recordings ────────────────────────────────────────────────
  const { userId } = useUser();

  // ── People state ─────────────────────────────────────────────────────────
  const [addPersonModal, setAddPersonModal] = useState(false);
  const [tagInputVal, setTagInputVal] = useState('');
  const [contacts, setContacts] = useState<string[]>([]);

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
  const [recTab, setRecTab] = useState<'payable' | 'receivable' | 'expense' | 'income'>('expense');
  const [recSearch, setRecSearch] = useState('');
  const [recDays, setRecDays] = useState<30 | 60 | 180 | 365 | null>(30);
  const [recShowMore, setRecShowMore] = useState(false);

  const REC_TABS: { key: 'payable' | 'receivable' | 'expense' | 'income'; label: string }[] = [
    { key: 'expense', label: 'expense' },
    { key: 'receivable', label: 'receivable' },
    { key: 'payable', label: 'loan' },
    { key: 'income', label: 'income' },
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
      .select('id, name, amount, type, transaction_date')
      .eq('user_id', userId)
      .in('type', ['expense', 'receivable', 'payable', 'income'])
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
  const [itemStep, setItemStep]                   = useState<'pick-recording' | 'add-items'>('pick-recording');
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  const [itemRows, setItemRows]                   = useState<{ name: string; cost: string }[]>([{ name: '', cost: '' }]);
  const [savingItem, setSavingItem]               = useState(false);

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
  const isDeductType = (type: string) =>
    type === 'payable' || type === 'income' || type === 'savings';

  const totalItemsCost = items.reduce((s: number, i: any) => s + Number(i.cost), 0);

  const openAddItem = () => {
    setItemStep('pick-recording');
    setSelectedRecording(null);
    setItemRows([{ name: '', cost: '' }]);
    setAddItemModal(true);
  };

  const handlePickRecording = (lr: any) => {
    setSelectedRecording(lr);
    setItemRows([{ name: '', cost: '' }]);
    setItemStep('add-items');
  };

  const saveItems = async () => {
    const valid = itemRows.filter(r => r.name.trim() && r.cost);
    if (!valid.length) return;
    const recTotal = Number(selectedRecording.amount_contributed);
    const alreadyUsed = items
      .filter((i: any) => i.recording_type === (selectedRecording.recording?.type ?? 'expense'))
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
        .select('id, data')
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
      setShareLink(`https://ledgr.art/split/${shareRow.id}`);
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
    const { data } = await supabase.from('split_shares')
      .insert({ split_bill_id: splitBillId, recording_id: firstRecordingId, data: { account_ids: shareSelectedIds } })
      .select('id').single();
    setShareGenerating(false);
    if (!data) return;
    setShareLink(`https://ledgr.art/split/${data.id}`);
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
        `<div style="display:flex;align-items:center;background:#f5f5f5;border-radius:999px;padding:12px 16px;border:1px solid #e8e8e8;margin-bottom:8px">`+
        `<span style="font-size:13px;color:#425252;flex-shrink:0">${p}</span>`+
        `<div style="flex:1;border-bottom:1px dotted #ccc;margin:0 10px"></div>`+
        `<span style="font-size:13px;font-weight:700;color:${totals[p]<0?'#7fd8cd':'#425252'};flex-shrink:0">`+
        `${totals[p]<0?'-':''}${Math.abs(totals[p]).toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>`
      ).join('');
      const grandTotal = Object.values(totals).reduce((s,v)=>s+v,0);
      const totalRow = `<div style="display:flex;align-items:center;background:#7fd8cd22;border-radius:999px;padding:12px 16px;border:1px solid #7fd8cd;margin-bottom:8px">`+
        `<span style="font-size:13px;font-weight:700;color:#7fd8cd;flex-shrink:0">total</span>`+
        `<div style="flex:1;border-bottom:1px dotted #ccc;margin:0 10px"></div>`+
        `<span style="font-size:13px;font-weight:700;color:#7fd8cd">${grandTotal<0?'-':''}${Math.abs(grandTotal).toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>`;

      const itemsHtml = items.map((item: any) => {
        const d = isDeductType(item.recording_type);
        const chips = (item.people??[]).map((p:string)=>
          `<span style="background:#e8e8e8;border-radius:999px;padding:3px 10px;font-size:10px;color:#425252;margin:2px">${p}</span>`
        ).join('');
        return `<div style="background:#f5f5f5;border-radius:12px;padding:14px;border:1px solid #e8e8e8;margin-bottom:8px">`+
          `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${item.people?.length?'8px':'0'}">`+
          `<span style="font-weight:600;font-size:14px;color:#425252">${item.name}</span>`+
          `<span style="font-size:13px;font-weight:700;color:${d?'#7fd8cd':'#ff7043'}">${d?'-':'+'}${Number(item.cost).toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>`+
          (item.people?.length>0?`<div style="display:flex;flex-wrap:wrap;gap:4px">${chips}</div>`:'')+
          `</div>`;
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
          ? `<img src="${qrSrc}" width="140" height="140" style="border-radius:10px;object-fit:contain"/>`
          : '';
        return `<div style="display:flex;align-items:center;background:#d8efea;border-radius:12px;padding:16px;margin-bottom:8px;gap:12px">`+
          `<div style="flex:1">`+
          `<div style="font-size:15px;font-weight:600;color:#292929">${a.bank??''}</div>`+
          `<div style="font-size:11px;color:#666;margin:2px 0">${a.holder_name??a.account_name??''}</div>`+
          `<div style="font-size:13px;font-weight:700;color:#425252">${a.account_number??''}</div>`+
          `</div>${qrImg}</div>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">`+
        `<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;padding:32px;width:520px}</style>`+
        `</head><body>`+
        `<div style="font-size:28px;font-weight:600;color:#425252;margin-bottom:4px">${name}</div>`+
        `<div style="font-size:11px;color:#999;margin-bottom:28px">${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>`+
        `<div style="font-size:15px;color:#7fd8cd;font-weight:600;margin-bottom:10px">per person pay</div>`+
        personRows + totalRow +
        `<div style="font-size:15px;color:#7fd8cd;font-weight:600;margin:20px 0 10px">item information</div>`+
        itemsHtml +
        (payHtml?`<div style="font-size:15px;color:#7fd8cd;font-weight:600;margin:20px 0 10px">payment information</div>${payHtml}`:'')+
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
        .select('id, amount_contributed, recording:recording_id(id, name, amount, type, transaction_date)')
        .eq('split_bill_id', splitBillId)
        .order('created_at');
      return (data ?? []).map((r: any) => ({
        ...r,
        recording: Array.isArray(r.recording) ? r.recording[0] : r.recording,
      }));
    },
    enabled: !!splitBillId,
  });

  const totalAmount = linkedRecordings.reduce((s: number, r: any) => s + Number(r.amount_contributed), 0);
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const typeColor = (type: string) => {
    if (['income', 'savings', 'return', 'receivable'].includes(type)) return Colors.cyan;
    return '#FFAB91';
  };

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: Colors.white }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} style={pageStyles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={Colors.muted} />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{name}</Text>
          <View style={s.totalBadge}>
            <Text style={s.totalBadgeText}>{fmt(totalAmount)}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Linked Recordings */}
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>recordings</Text>
            <TouchableOpacity onPress={openAddRecording} style={s.sectionAddBtn}>
              <Ionicons name="add" size={14} color={Colors.cyan} />
              <Text style={s.sectionAddText}>add</Text>
            </TouchableOpacity>
          </View>
          {loadingRecs ? (
            <ActivityIndicator color={Colors.cyan} />
          ) : linkedRecordings.length === 0 ? (
            <View style={pageStyles.emptyBox}>
              <Text style={pageStyles.emptyText}>no recordings linked yet</Text>
            </View>
          ) : (
            <View style={s.list}>
              {linkedRecordings.map((lr: any) => (
                <TouchableOpacity
                  key={lr.id}
                  style={s.recRow}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: lr.recording?.id } } as any)}
                >
                  <View style={s.recIconWrap}>
                    <Ionicons name="receipt-outline" size={16} color={Colors.cyan} />
                  </View>
                  <View style={s.recMid}>
                    <Text style={s.recName} numberOfLines={1}>{lr.recording?.name ?? '—'}</Text>
                    <Text style={s.recDate}>
                      {lr.recording?.transaction_date
                        ? new Date(lr.recording.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </Text>
                  </View>
                  <Text style={[s.recAmount, { color: typeColor(lr.recording?.type ?? '') }]}>
                    {fmt(Number(lr.amount_contributed))}
                  </Text>
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
              ))}
            </View>
          )}

          {/* People */}
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>people</Text>
            <TouchableOpacity onPress={() => { setTagInputVal(''); setAddPersonModal(true); }} style={s.sectionAddBtn}>
              <Ionicons name="add" size={14} color={Colors.cyan} />
              <Text style={s.sectionAddText}>add</Text>
            </TouchableOpacity>
          </View>
          {filledPeople.length === 0 ? (
            <View style={pageStyles.emptyBox}>
              <Text style={pageStyles.emptyText}>no people yet — tap add</Text>
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
              style={s.sectionAddBtn}
              disabled={filledPeople.length === 0 || linkedRecordings.length === 0}
            >
              <Ionicons name="add" size={14} color={filledPeople.length === 0 || linkedRecordings.length === 0 ? Colors.faint : Colors.cyan} />
              <Text style={[s.sectionAddText, (filledPeople.length === 0 || linkedRecordings.length === 0) && { color: Colors.faint }]}>add</Text>
            </TouchableOpacity>
          </View>
          {items.length === 0 ? (
            <View style={pageStyles.emptyBox}>
              <Text style={pageStyles.emptyText}>{filledPeople.length === 0 ? 'add people first' : 'no items yet'}</Text>
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
                        <Text style={[s.itemSplit, { color: deduct ? Colors.cyan : '#FFAB91' }]}>
                          {deduct ? '-' : '+'}{perPerson.toLocaleString('en-US', { minimumFractionDigits: 2 })} each · {item.people.join(', ')}
                        </Text>
                      ) : (
                        <Text style={[s.itemSplit, { color: Colors.faint }]}>tap to assign people</Text>
                      )}
                    </View>
                    <Text style={[s.itemCost, { color: deduct ? Colors.cyan : Colors.text }]}>{deduct ? '-' : ''}{fmt(Number(item.cost))}</Text>
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

          {/* Per-person summary */}
          <Text style={s.sectionHeader}>per person summary</Text>
          {filledPeople.length === 0 || items.length === 0 ? (
            <View style={pageStyles.emptyBox}>
              <Text style={pageStyles.emptyText}>add people and items to see summary</Text>
            </View>
          ) : (() => {
            // build per-person totals from items
            const totals: Record<string, number> = {};
            filledPeople.forEach(p => { totals[p] = 0; });
            items.forEach((item: any) => {
              const deduct = isDeductType(item.recording_type);
              const pp = item.people?.length > 0 ? Number(item.cost) / item.people.length : 0;
              (item.people ?? []).forEach((p: string) => {
                if (totals[p] !== undefined) totals[p] += deduct ? -pp : pp;
              });
            });
            const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
            return (
              <View style={s.list}>
                {filledPeople.map(p => (
                  <View key={p} style={s.summaryRow}>
                    <Text style={s.summaryName}>{p}</Text>
                    <View style={s.summaryDots} />
                    <Text style={[s.summaryAmount, totals[p] < 0 && { color: Colors.cyan }]}>
                      {totals[p] < 0 ? '-' : ''}{fmt(Math.abs(totals[p]))}
                    </Text>
                  </View>
                ))}
                <View style={[s.summaryRow, { backgroundColor: Colors.cyan + '18', borderColor: Colors.cyan }]}>
                  <Text style={[s.summaryName, { fontFamily: Fonts.monoBold, color: Colors.cyan }]}>total</Text>
                  <View style={s.summaryDots} />
                  <Text style={[s.summaryAmount, { color: Colors.cyan }]}>{fmt(grandTotal)}</Text>
                </View>
              </View>
            );
          })()}

          {/* Share */}
          <TouchableOpacity style={s.shareBtn} onPress={openShareModal} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={15} color={Colors.muted} />
            <Text style={s.shareBtnText}>share split bill</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>

      {/* Add item modal: step 1 pick recording, step 2 add item rows */}
      <BottomSheet visible={addItemModal} onClose={() => setAddItemModal(false)} title={itemStep === 'pick-recording' ? 'for which recording?' : 'add items'} height="65%">
        {itemStep === 'pick-recording' ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {linkedRecordings.map((lr: any) => {
              const recType = lr.recording?.type ?? '';
              const deduct = isDeductType(recType);
              return (
                <TouchableOpacity key={lr.id} style={s.recPickRow} onPress={() => handlePickRecording(lr)}>
                  <View style={[s.recIconWrap, { backgroundColor: deduct ? Colors.cyan + '22' : '#FFAB9122' }]}>
                    <Ionicons name={recType === 'payable' ? 'cash-outline' : deduct ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={16} color={deduct ? Colors.cyan : '#FFAB91'} />
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
                .filter((i: any) => i.recording_type === (selectedRecording?.recording?.type ?? 'expense'))
                .reduce((s: number, i: any) => s + Number(i.cost), 0);
              const newTotal = itemRows.reduce((s, r) => s + parseFloat(r.cost || '0'), 0);
              const used = alreadyUsed + newTotal;
              const pct = recTotal > 0 ? Math.min(used / recTotal, 1) : 0;
              const over = recTotal > 0 && used > recTotal + 0.01;
              return (
                <View style={{ marginBottom: 12 }}>
                  <View style={{ height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ height: 4, borderRadius: 2, width: `${pct * 100}%` as any, backgroundColor: over ? Colors.expense : Colors.cyan }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: over ? Colors.expense : Colors.cyan }}>{fmt(used)} used</Text>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: over ? Colors.expense : Colors.muted }}>
                      {over ? `${fmt(used - recTotal)} over` : `${fmt(recTotal - used)} left`}
                    </Text>
                  </View>
                </View>
              );
            })()}
            {itemRows.map((row, i) => {
              const recTotal = Number(selectedRecording?.amount_contributed ?? 0);
              const alreadyUsed = items
                .filter((i2: any) => i2.recording_type === (selectedRecording?.recording?.type ?? 'expense'))
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
              <Ionicons name="add" size={13} color={Colors.cyan} />
              <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.cyan }}>add another</Text>
            </TouchableOpacity>
            {(() => {
              const recTotal = Number(selectedRecording?.amount_contributed ?? 0);
              const alreadyUsed = items
                .filter((i: any) => i.recording_type === (selectedRecording?.recording?.type ?? 'expense'))
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
                <Text style={{ fontFamily: Fonts.monoBold, fontSize: 11, color: deduct ? Colors.cyan : '#FFAB91', marginBottom: 12 }}>
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
          {contacts.length === 0 && <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: Colors.faint }}>no contacts saved yet</Text>}
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
                  : <Ionicons name="add" size={14} color={Colors.cyan} />}
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
            style={{ flex: 1, fontFamily: Fonts.mono, fontSize: 13, color: Colors.text, paddingVertical: 8 }}
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
              return <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.faint }}>no recordings found</Text>;
            const visible = filtered.slice(0, recShowMore ? filtered.length : 10);
            return (
              <>
                {visible.map((rec: any) => {
                  const deduct = isDeductType(rec.type);
                  return (
                    <TouchableOpacity key={rec.id} style={s.recPickRow} onPress={() => linkRecording(rec)}>
                      <View style={[s.recIconWrap, { backgroundColor: deduct ? Colors.cyan + '22' : '#FFAB9122' }]}>
                        <Ionicons name={rec.type === 'payable' ? 'cash-outline' : deduct ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={16} color={deduct ? Colors.cyan : '#FFAB91'} />
                      </View>
                      <View style={s.recMid}>
                        <Text style={s.recName} numberOfLines={1}>{rec.name}</Text>
                        <Text style={s.recDate}>{rec.transaction_date ? new Date(rec.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Text>
                      </View>
                      <Text style={[s.recAmount, { color: deduct ? Colors.cyan : '#FFAB91' }]}>{fmt(Number(rec.amount))}</Text>
                    </TouchableOpacity>
                  );
                })}
                {!recShowMore && filtered.length > 10 && (
                  <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center' }} onPress={() => setRecShowMore(true)}>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.cyan }}>
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
        <Text style={{ fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>payment account (optional)</Text>
        <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
          {shareAccounts.map((acc: any) => {
            const sel = shareSelectedIds.includes(acc.id);
            return (
              <TouchableOpacity
                key={acc.id}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}
                onPress={() => setShareSelectedIds(prev => sel ? prev.filter(x => x !== acc.id) : [...prev, acc.id])}
              >
                <Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={sel ? Colors.cyan : Colors.faint} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text }}>{acc.account_name}</Text>
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>{acc.bank} · {acc.account_number}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {shareAccounts.length === 0 && <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.faint, paddingVertical: 8 }}>no accounts found</Text>}
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
                style={[s.modeBtn, { flex: 2, alignItems: 'center', opacity: shareSaving ? 0.5 : 1, borderColor: hasChanged ? Colors.cyan : Colors.borderMid, backgroundColor: hasChanged ? Colors.cyan + '18' : Colors.surface }]}
                onPress={saveShareAccounts}
                disabled={shareSaving || !hasChanged}
              >
                <Text style={[s.modeBtnText, hasChanged && { color: Colors.cyan, fontFamily: Fonts.monoBold }]}>
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
        <Text style={{ fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 }}>link</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: shareLink ? Colors.cyan : Colors.borderMid, borderRadius: Radius.md, paddingHorizontal: 12, gap: 8 }}>
          <Text style={{ flex: 1, fontFamily: Fonts.mono, fontSize: 11, color: shareLink ? Colors.text : Colors.faint, paddingVertical: 12 }} numberOfLines={1}>
            {shareLink || 'generate a link first'}
          </Text>
          {shareLink ? (
            <TouchableOpacity onPress={copyShareLink} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={shareCopied ? 'checkmark-circle' : 'copy-outline'} size={16} color={shareCopied ? Colors.income : Colors.cyan} />
            </TouchableOpacity>
          ) : null}
        </View>
        {shareCopied && <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.income, marginTop: 4 }}>copied to clipboard!</Text>}

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

    </Animated.View>
  );
}

const s = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', paddingRight: 16, paddingBottom: 4, gap: 8 },
  title:      { flex: 1, fontFamily: Fonts.display, fontSize: 24, color: Colors.text, letterSpacing: -0.8 },
  totalBadge: { backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.borderMid },
  totalBadgeText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.cyan },

  scroll: { paddingHorizontal: 16, paddingBottom: 60 },

  sectionHeader: { fontFamily: Fonts.display, fontSize: 15, color: Colors.cyan, marginBottom: 10, marginTop: 24 },

  list:       { gap: 8 },
  recRow:     { backgroundColor: Colors.white, borderRadius: Radius.xl, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  recIconWrap:{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  recMid:     { flex: 1, gap: 2 },
  recName:    { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.text, letterSpacing: 0.1 },
  recDate:    { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  recAmount:  { fontFamily: Fonts.monoBold, fontSize: 15, letterSpacing: -0.4 },

  sectionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 24 },
  sectionAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionAddText:{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.cyan },

  chipWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  personChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingVertical: 6, paddingLeft: 12, paddingRight: 8, borderWidth: 1, borderColor: Colors.borderMid },
  personChipText:{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.text },

  tagInputWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, padding: 8, minHeight: 44, marginBottom: 12 },
  tagChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.cyan, borderRadius: Radius.pill, paddingVertical: 4, paddingLeft: 10, paddingRight: 6 },
  tagChipText:   { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.white },
  tagInput:      { fontFamily: Fonts.mono, fontSize: 16, color: Colors.text, minWidth: 120, flex: 1, padding: 2 },
  contactsLabel: { fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  contactRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  contactName:   { fontFamily: Fonts.mono, fontSize: 13, color: Colors.text },
  itemCard:      { backgroundColor: Colors.white, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid },
  itemNum:        { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.cyan, width: 18 },
  itemName:       { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  itemSplit:      { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  itemCost:       { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  itemsTotalRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, marginTop: 4 },
  itemsTotalLabel:{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  itemsTotalDots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: Colors.faint, marginHorizontal: 8 },
  itemsTotalValue:{ fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.text },
  itemFormRow:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
  itemFormInput:  { fontFamily: Fonts.mono, fontSize: 16, color: Colors.text, backgroundColor: Colors.white, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid },

  summaryRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border },
  summaryName:   { fontFamily: Fonts.mono, fontSize: 13, color: Colors.text, flexShrink: 0 },
  summaryDots:   { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: Colors.faint, marginHorizontal: 10 },
  summaryAmount: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text, flexShrink: 0 },

  shareBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface, marginTop: 24, marginBottom: 8 },
  shareBtnText:  { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.muted },

  recPickRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },

  modeBtn:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  modeBtnActive: { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  modeBtnText:   { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
  modeBtnTextActive: { color: Colors.white, fontFamily: Fonts.monoBold },
  doneBtn:       { backgroundColor: Colors.cyan, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  doneBtnText:   { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.white },
});
