import AddItemModal from './AddItemModal';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Dimensions, ScrollView, TextInput, Modal, Share, Linking, Platform, Clipboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { BlurView } from 'expo-blur';

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
  const [cookingModal, setCookingModal] = useState(false);
  const [saveImageModal, setSaveImageModal] = useState(false);
  const [shareAccounts, setShareAccounts] = useState<any[]>([]);
  const [shareSelectedAccount, setShareSelectedAccount] = useState<any>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [captureHtml, setCaptureHtml] = useState<string | null>(null);
  const webviewRef = useRef<any>(null);
  const [copiedToast, setCopiedToast] = useState(false);
  const [tooltip, setTooltip] = useState<{ name: string } | null>(null);
  const [contacts, setContacts] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState<number | null>(null);
  const [deletePersonConfirm, setDeletePersonConfirm] = useState<{ idx: number; name: string; affectedItems: number } | null>(null);

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

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    loadRecording();
    loadContacts();
    loadPeople();
    loadItems();
  }, []);

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
    if (data && data.length > 0) setPeople(data.map((r: any) => r.person_name));
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: accs } = await supabase.from('accounts').select().eq('user_id', user.id).order('account_name');
    if (accs) setShareAccounts(accs);
    // default to recording's account
    const recAccount = accs?.find((a: any) => a.id === recording?.account_id) ?? accs?.[0] ?? null;
    setShareSelectedAccount(recAccount);
    setSaveImageModal(true);
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
      payment: shareSelectedAccount ? { accountName: shareSelectedAccount.account_name, bank: shareSelectedAccount.bank, accountNumber: shareSelectedAccount.account_number, qrCode: shareSelectedAccount.qr_code ?? null } : null,
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
      <h3 style="font-size:14px;color:#0ccfcf;margin:24px 0 10px">payment information</h3>
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
      <div style="font-size:18px;color:#0ccfcf;margin-bottom:8px">ledgr</div>
      <div style="font-size:24px;color:#425252;font-weight:600;margin-bottom:4px">${data.recordingName}</div>
      <div style="font-family:monospace;font-size:20px;color:${amtColor};margin-bottom:2px">${data.recordingAmount.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
      <div style="font-family:monospace;font-size:11px;color:#929090;margin-bottom:24px">${data.date}</div>
      <h3 style="font-size:14px;color:#0ccfcf;margin:0 0 10px">per person pay</h3>
      <div style="background:#fafafa;border-radius:12px;padding:8px 16px;border:1px solid #f0f0f0;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">${perPersonRows}</table>
      </div>
      <h3 style="font-size:14px;color:#0ccfcf;margin:0 0 10px">item information</h3>
      ${itemsHtml}
      ${paymentHtml}
      <div style="font-family:monospace;font-size:10px;color:#c0c0c0;text-align:center;margin-top:24px">generated by ledgr</div>
    </body></html>`;
  };

  const generateShare = async () => {
    if (!recording) return;
    setShareLoading(true);
    try {
      const shareData = buildShareData();
      // Upsert — same link forever per recording
      const { data: row, error } = await supabase
        .from('split_shares')
        .upsert({ recording_id: recordingId, data: shareData }, { onConflict: 'recording_id' })
        .select().single();
      if (error || !row) throw error;
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ledgr-six.vercel.app';
      const shareUrl = `${baseUrl}/split/${row.id}`;
      setSaveImageModal(false);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        Clipboard.setString(shareUrl);
      }
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch (e: any) { console.log(e); } finally { setShareLoading(false); }
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
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: true }).start(() => router.back());
  };

  const openPeopleModal = () => {
    if (people.length === 0) setPeople(['', '', '']);
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
    const filled = people.filter(p => p.trim());
    // delete existing and reinsert
    await supabase.from('bill_splits').delete().eq('recording_id', recordingId);
    if (filled.length > 0) {
      await supabase.from('bill_splits').insert(
        filled.map(name => ({ recording_id: recordingId, user_id: user.id, person_name: name.trim() }))
      );
    }
    // save new contacts
    for (const p of filled) await saveContact(p);
    setAddPersonModal(false);
    setSuggestions([]);
    setActiveSuggestionIdx(null);
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
      setItems(prev => [...prev, ...newItems]);
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

  const deleteItem = async (id: string) => {
    await supabase.from('split_items').delete().eq('id', id);
    setItems(prev => prev.filter(item => item.id !== id));
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

const truncate = (str: string, max: number) => str && str.length > max ? str.slice(0, max) + '...' : str;

  const amountColor = () => {
    if (!recording) return '#929090';
    if (recording.type === 'expense') return '#ed6a6a';
    if (recording.type === 'income' || recording.type === 'savings') return '#2ab671';
    return '#425252';
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const typeLabel = (type: string, status: string) => {
    if (type === 'payable') return `Payable · ${status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid'}`;
    if (type === 'receivable') return `Receivable · ${status === 'received' ? 'Received' : status === 'partial' ? 'Partial' : 'Pending'}`;
    return { expense: 'Expense', income: 'Income', savings: 'Savings' }[type] ?? type;
  };

  const PREVIEW_LIMIT = 4;
  const visiblePeople = filledPeople.slice(0, PREVIEW_LIMIT);
  const extraCount = filledPeople.length - PREVIEW_LIMIT;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#8a8a8a" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.titleBlock}>
            <Text style={styles.recordingsLabel}>recordings</Text>
            <View style={styles.titleRow}>
              <Text style={styles.recordingName} numberOfLines={1} ellipsizeMode="tail">
                {truncate(recording?.name ?? '', MAX_NAME_CHARS).toLowerCase()}
              </Text>
              <Text style={[styles.amount, { color: amountColor() }]}>
                {recording ? Number(recording.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setCookingModal(true)}>
              <Ionicons name="receipt-outline" size={15} color="#425252" />
              <Text style={styles.actionBtnText}>upload / view receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => setCookingModal(true)}>
              <Ionicons name="trash-outline" size={15} color="#ed6a6a" />
              <Text style={[styles.actionBtnText, { color: '#ed6a6a' }]}>delete</Text>
            </TouchableOpacity>
          </View>

          {/* Information */}
          <Text style={styles.sectionHeader}>information</Text>
          <View style={styles.infoBlock}>
            <InfoRow label="Date of transaction" value={formatDate(recording?.transaction_date)} />
            <InfoRow label="Transaction type" value={typeLabel(recording?.type ?? '', recording?.status ?? '')} />
            <InfoRow label="Bank / Account" value={truncate(recording?.account?.account_name ?? '—', 16)} />
          </View>

          {/* Split bill */}
          <Text style={styles.sectionHeader}>split bill</Text>
          <View style={styles.splitBtnGrid}>
            {[
              { icon: 'add-circle-outline', label: 'add item', onPress: () => {
                const total = items.reduce((s, i) => s + i.cost, 0);
                const recAmt = recording ? Number(recording.amount) : 0;
                if (filledPeople.length > 0 && !(Math.abs(total - recAmt) < 0.01 && recAmt > 0)) setAddItemModal(true);
              }, disabled: filledPeople.length === 0 || (Math.abs(items.reduce((s, i) => s + i.cost, 0) - (recording ? Number(recording.amount) : 0)) < 0.01 && items.length > 0) },
              { icon: 'people-outline', label: 'add people', onPress: () => openPeopleModal(), disabled: false },
              { icon: 'share-outline', label: 'share', onPress: () => openSaveImage(), disabled: filledPeople.length === 0 || items.length === 0 || items.every(i => i.subitems.length === 0) },
              { icon: 'person-add-outline', label: 'save person', onPress: () => setCookingModal(true), disabled: false },
            ].map(b => (
              <TouchableOpacity
                key={b.label}
                style={[styles.splitBtn, b.disabled && styles.splitBtnDisabled]}
                onPress={b.onPress}
                activeOpacity={b.disabled ? 1 : 0.8}
              >
                <Ionicons name={b.icon as any} size={16} color={b.disabled ? '#c0c0c0' : '#425252'} />
                <Text style={[styles.splitBtnText, b.disabled && { color: '#c0c0c0' }]}>{b.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* People */}
          <Text style={styles.peopleHeader}>people</Text>
          <View style={styles.peopleContainer}>
            {filledPeople.length === 0 ? (
              <Text style={styles.peoplePlaceholder}>no people added yet</Text>
            ) : (
              <View style={styles.peopleChips}>
                {visiblePeople.map((person, i) => (
                  <View key={i} style={styles.personChip}>
                    <Text style={styles.personChipText}>{person}</Text>
                    <TouchableOpacity onPress={() => requestDeletePerson(people.findIndex(p => p === person))} style={styles.personChipDelete}>
                      <Ionicons name="close" size={10} color="#929090" />
                    </TouchableOpacity>
                  </View>
                ))}
                {extraCount > 0 && (
                  <View style={styles.personChip}>
                    <Text style={styles.personChipText}>+{extraCount} more</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Items */}
          <Text style={styles.sectionHeader}>items</Text>
          {(() => {
            const totalItemsCost = items.reduce((s, i) => s + i.cost, 0);
            const recordingAmount = recording ? Number(recording.amount) : 0;
            const isFullyAllocated = Math.abs(totalItemsCost - recordingAmount) < 0.01 && recordingAmount > 0;
            return (
              <>
                {items.length === 0 ? (
                  <View style={styles.cookingBox}>
                    <Text style={styles.cookingText}>no items yet</Text>
                  </View>
                ) : (
                  <View style={styles.itemsList}>
                    {items.map((item, idx) => {
                      return (
                        <View key={item.id}>
                          <View style={styles.itemCard}>
                            <Text style={styles.itemNumber}>{idx + 1}</Text>
                            <View style={styles.itemMiddle}>
                              <Text style={styles.itemName} numberOfLines={1}>{truncate(item.name, MAX_ITEM_NAME)}</Text>
                              <Text style={styles.itemCost}>{item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                            </View>
                            {item.subitems.length === 0 && item.people.length > 0 && (
                              <View style={styles.itemRight}>
                                <View style={styles.itemPeopleRow}>
                                  {(item.people ?? []).slice(0, 3).map((p, pi) => (
                                    <TouchableOpacity key={pi} style={styles.personCircle} onPress={() => setTooltip(tooltip?.name === p ? null : { name: p })}>
                                      <Text style={styles.personCircleLetter}>{p[0]?.toUpperCase()}</Text>
                                    </TouchableOpacity>
                                  ))}
                                  {(item.people?.length ?? 0) > 3 && (
                                    <View style={styles.personCircleExtra}>
                                      <Text style={styles.personCircleLetter}>+{item.people.length - 3}</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={styles.itemSplit}>
                                  {item.people.length} {item.people.length === 1 ? 'person' : 'people'}, {(item.cost / item.people.length).toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                                </Text>
                              </View>
                            )}
                            <TouchableOpacity style={styles.addSubitemBtn} onPress={() => openEditSubitems(item)}>
                              <Ionicons name="add" size={13} color="#0ccfcf" />
                              <Text style={styles.addSubitemBtnText}>subitem</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.itemDelete}>
                              <Ionicons name="close" size={14} color="#c0c0c0" />
                            </TouchableOpacity>
                          </View>
                          {item.subitems.map(sub => {
                            const perPerson = sub.people.length > 0 ? sub.cost / sub.people.length : 0;
                            return (
                              <View key={sub.id} style={styles.subitemCard}>
                                <Text style={styles.subitemArrow}>↳</Text>
                                <View style={styles.itemMiddle}>
                                  <Text style={styles.subitemName} numberOfLines={1}>{truncate(sub.name, MAX_ITEM_NAME)}</Text>
                                  <Text style={styles.subitemCostText}>{sub.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                                </View>
                                <View style={styles.itemRight}>
                                  <View style={styles.itemPeopleRow}>
                                    {(sub.people ?? []).slice(0, 3).map((p, pi) => (
                                      <TouchableOpacity key={pi} style={styles.personCircle} onPress={() => setTooltip(tooltip?.name === p ? null : { name: p })}>
                                        <Text style={styles.personCircleLetter}>{p[0]?.toUpperCase()}</Text>
                                      </TouchableOpacity>
                                    ))}
                                    {(sub.people?.length ?? 0) > 3 && (
                                      <View style={styles.personCircleExtra}>
                                        <Text style={styles.personCircleLetter}>+{(sub.people?.length ?? 0) - 3}</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={styles.itemSplit}>
                                    {sub.people.length} {sub.people.length === 1 ? 'person' : 'people'}, {perPerson.toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                                  </Text>
                                </View>
                                <TouchableOpacity onPress={() => deleteSubitem(item.id, sub.id)} style={styles.itemDelete}>
                                  <Ionicons name="close" size={12} color="#c0c0c0" />
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                    <View style={styles.itemsTotalRow}>
                      <Text style={styles.itemsTotalLabel}>total allocated</Text>
                      <View style={styles.itemsTotalDots} />
                      <Text style={[styles.itemsTotalValue, isFullyAllocated && { color: '#2ab671' }]}>
                        {totalItemsCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} / {recordingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>
                )}
                {isFullyAllocated && (
                  <Text style={styles.allocatedNote}>all amount allocated</Text>
                )}
              </>
            );
          })()}

        </ScrollView>
      </SafeAreaView>

      {/* Tooltip */}
      {tooltip && (
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setTooltip(null)} activeOpacity={1}>
          <View style={styles.tooltip}>
            <Text style={styles.tooltipText}>{tooltip.name}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Add people modal */}
      <Modal visible={addPersonModal} transparent animationType="fade" onRequestClose={() => setAddPersonModal(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAddPersonModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>people</Text>
                <ScrollView style={{ width: '100%', maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                  {people.map((p, i) => (
                    <View key={i}>
                      <View style={styles.personRow}>
                        <TextInput
                          style={styles.personInput}
                          placeholder={`person ${i + 1}`}
                          placeholderTextColor="#c0c0c0"
                          value={p}
                          onChangeText={v => updatePerson(i, v)}
                          returnKeyType="next"
                        />
                        {people.length > 1 && (
                          <TouchableOpacity onPress={() => requestDeletePerson(i)} style={styles.removeBtn}>
                            <Ionicons name="close" size={14} color="#929090" />
                          </TouchableOpacity>
                        )}
                      </View>
                      {activeSuggestionIdx === i && suggestions.length > 0 && (
                        <View style={styles.suggestionBox}>
                          {suggestions.map((s, si) => (
                            <TouchableOpacity key={si} style={styles.suggestionItem} onPress={() => pickSuggestion(i, s)}>
                              <Text style={styles.suggestionText}>{s}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.addMoreBtn} onPress={addPerson}>
                  <Ionicons name="add" size={13} color="#0ccfcf" />
                  <Text style={styles.addMoreText}>add more</Text>
                </TouchableOpacity>
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f5f5f5' }]} onPress={() => setAddPersonModal(false)}>
                    <Text style={[styles.modalBtnText, { color: '#8a8a8a' }]}>cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtn} onPress={savePeopleAndClose}>
                    <Text style={styles.modalBtnText}>done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>
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
      <Modal visible={!!editSubitemsItemId} transparent animationType="fade" onRequestClose={() => setEditSubitemsItemId(null)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditSubitemsItemId(null)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={styles.modalBox}>
                {(() => {
                  const item = items.find(i => i.id === editSubitemsItemId);
                  if (!item) return null;
                  const totalSubs = item.subitems.length + editSubitemForms.filter(s => s.name.trim()).length;
                  const equalCost = totalSubs > 0 ? item.cost / totalSubs : item.cost;
                  return (
                    <>
                      <Text style={styles.modalTitle}>add subitems</Text>
                      <Text style={styles.subitemRemaining}>
                        {item.name} · {item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Text>
                      {item.subitems.length > 0 && (
                        <Text style={styles.subitemRemaining}>
                          {item.subitems.length} existing · will become {equalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                        </Text>
                      )}
                      <ScrollView style={{ width: '100%', maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                        {editSubitemForms.map((sub, i) => (
                          <View key={i} style={styles.subitemFormRow}>
                            <Text style={styles.subitemArrow}>↳</Text>
                            <View style={{ flex: 1, gap: 6 }}>
                              <View style={styles.subitemFormInputRow}>
                                <TextInput
                                  style={styles.subitemFormInput}
                                  placeholder="subitem name"
                                  placeholderTextColor="#c0c0c0"
                                  value={sub.name}
                                  onChangeText={v => updateEditSubitemForm(i, v)}
                                  autoFocus={i === 0}
                                />
                                {sub.name.trim() && (
                                  <Text style={styles.subitemAutoHint}>
                                    {equalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </Text>
                                )}
                                {editSubitemForms.length > 1 && (
                                  <TouchableOpacity onPress={() => removeEditSubitemForm(i)} style={styles.removeBtn}>
                                    <Ionicons name="close" size={12} color="#c0c0c0" />
                                  </TouchableOpacity>
                                )}
                              </View>
                              <View style={styles.itemPeopleSelect}>
                                {filledPeople.map((p, pi) => {
                                  const sel = sub.people.includes(p);
                                  return (
                                    <TouchableOpacity key={pi} style={[styles.personSelectChip, sel && styles.personSelectChipActive]} onPress={() => toggleEditSubitemPerson(i, p)}>
                                      <Text style={[styles.personSelectText, sel && styles.personSelectTextActive]}>{p}</Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                      <TouchableOpacity style={styles.addMoreBtn} onPress={addEditSubitemForm}>
                        <Ionicons name="add" size={11} color="#0ccfcf" />
                        <Text style={styles.addMoreText}>add more</Text>
                      </TouchableOpacity>
                      <View style={styles.modalBtns}>
                        <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f5f5f5' }]} onPress={() => setEditSubitemsItemId(null)}>
                          <Text style={[styles.modalBtnText, { color: '#8a8a8a' }]}>cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.modalBtn, editSubitemForms.every(s => !s.name.trim()) && { opacity: 0.4 }]}
                          onPress={saveEditSubitems}
                          disabled={editSubitemForms.every(s => !s.name.trim())}
                        >
                          <Text style={styles.modalBtnText}>save</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  );
                })()}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* Delete person confirm */}
      <Modal visible={!!deletePersonConfirm} transparent animationType="fade" onRequestClose={() => setDeletePersonConfirm(null)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDeletePersonConfirm(null)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>remove person</Text>
                <Text style={styles.deleteWarning}>
                  <Text style={{ fontFamily: 'RobotoMono_700Bold' }}>{deletePersonConfirm?.name}</Text>
                  {` is included in ${deletePersonConfirm?.affectedItems} item${deletePersonConfirm?.affectedItems === 1 ? '' : 's'}. removing them will update those splits.`}
                </Text>
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f5f5f5' }]} onPress={() => setDeletePersonConfirm(null)}>
                    <Text style={[styles.modalBtnText, { color: '#8a8a8a' }]}>cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ed6a6a' }]} onPress={confirmDeletePerson}>
                    <Text style={styles.modalBtnText}>remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* Save image modal */}
      <Modal visible={saveImageModal} transparent animationType="fade" onRequestClose={() => setSaveImageModal(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSaveImageModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>share split</Text>
                <Text style={styles.subitemRemaining}>choose payment account</Text>
                <ScrollView style={{ width: '100%', maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                  {shareAccounts.map((acc: any) => (
                    <TouchableOpacity
                      key={acc.id}
                      style={[styles.accountOption, shareSelectedAccount?.id === acc.id && styles.accountOptionActive]}
                      onPress={() => setShareSelectedAccount(acc)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.accountOptionName, shareSelectedAccount?.id === acc.id && { color: '#fff' }]}>{acc.account_name}</Text>
                        <Text style={[styles.accountOptionBank, shareSelectedAccount?.id === acc.id && { color: 'rgba(255,255,255,0.7)' }]}>{acc.bank} · {acc.account_number}</Text>
                      </View>
                      {shareSelectedAccount?.id === acc.id && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                  {shareAccounts.length === 0 && (
                    <Text style={[styles.subitemRemaining, { textAlign: 'center', marginVertical: 8 }]}>no accounts saved</Text>
                  )}
                </ScrollView>

                <View style={styles.shareOptionsRow}>
                  <TouchableOpacity
                    style={styles.shareOptionBtn}
                    onPress={generateShare}
                    disabled={shareLoading}
                  >
                    <Ionicons name="link-outline" size={18} color="#0ccfcf" />
                    <Text style={styles.shareOptionText}>{shareLoading ? 'saving...' : 'save & share link'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.shareOptionBtn}
                    onPress={saveAsImage}
                    disabled={shareLoading}
                  >
                    <Ionicons name="image-outline" size={18} color="#425252" />
                    <Text style={[styles.shareOptionText, { color: '#425252' }]}>{shareLoading ? 'saving...' : 'save as pdf'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.modalBtn, { width: '100%', backgroundColor: '#f5f5f5' }]} onPress={() => setSaveImageModal(false)}>
                  <Text style={[styles.modalBtnText, { color: '#8a8a8a' }]}>cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* Cooking modal */}
      <Modal visible={cookingModal} transparent animationType="fade" onRequestClose={() => setCookingModal(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCookingModal(false)}>
            <View style={styles.modalBox}>
              <Text style={{ fontSize: 36 }}>🍳</Text>
              <Text style={styles.cookingText}>we're cooking something</Text>
            </View>
          </TouchableOpacity>
        </BlurView>
      </Modal>
      {/* Copied toast */}
      {copiedToast && (
        <View style={styles.toast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.toastText}>link copied to clipboard</Text>
        </View>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <View style={infoStyles.dots} />
      <Text style={infoStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  label: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#929090', flexShrink: 0 },
  dots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: '#c0c0c0', marginHorizontal: 8 },
  value: { fontFamily: 'RobotoMono_700Bold', fontSize: 11, color: '#425252', flexShrink: 0, maxWidth: 130 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  backBtn: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 4 },
  scroll: { paddingHorizontal: 32, paddingBottom: 60 },
  titleBlock: { marginBottom: 16 },
  recordingsLabel: { fontFamily: 'ChillaxMedium', fontSize: 11, color: '#929090', marginBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  recordingName: { fontFamily: 'Avenelle', fontSize: 26, color: '#425252', lineHeight: 30, letterSpacing: -1, flex: 1 },
  amount: { fontFamily: 'RobotoMono_400Regular', fontSize: 20, flexShrink: 0 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#fafafa' },
  actionBtnDanger: { borderColor: '#fde8e8', backgroundColor: '#fff8f8' },
  actionBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#425252' },
  sectionHeader: { fontFamily: 'ChillaxMedium', fontSize: 15, color: '#0ccfcf', letterSpacing: -0.5, marginBottom: 10, marginTop: 4 },
  infoBlock: { backgroundColor: '#fafafa', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 24 },
  splitBtnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  splitBtn: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#fafafa' },
  splitBtnDisabled: { opacity: 0.4 },
  splitBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#425252' },
  peopleHeader: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090', textAlign: 'center', marginBottom: 10 },
  peopleContainer: { borderWidth: 1, borderColor: '#929090', borderStyle: 'dashed', borderRadius: 14, padding: 14, marginBottom: 24, minHeight: 56, justifyContent: 'center' },
  peoplePlaceholder: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#c0c0c0', textAlign: 'center' },
  peopleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0f0f0', borderRadius: 999, paddingVertical: 5, paddingLeft: 12, paddingRight: 8 },
  personChipText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#425252' },
  personChipDelete: { padding: 2 },
  itemsList: { gap: 10, marginBottom: 24 },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ffffff', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#929090' },
  itemNumber: { fontFamily: 'RobotoMono_700Bold', fontSize: 12, color: '#0ccfcf', width: 18, flexShrink: 0 },
  itemMiddle: { flex: 1, gap: 2 },
  itemName: { fontFamily: 'RobotoMono_700Bold', fontSize: 12, color: '#425252' },
  itemCost: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#929090' },
  itemRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  itemPeopleRow: { flexDirection: 'row', gap: 3 },
  personCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#0ccfcf', justifyContent: 'center', alignItems: 'center' },
  personCircleExtra: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#c0c0c0', justifyContent: 'center', alignItems: 'center' },
  personCircleLetter: { fontFamily: 'RobotoMono_700Bold', fontSize: 9, color: '#fff' },
  itemSplit: { fontFamily: 'RobotoMono_400Regular', fontSize: 9, color: '#929090' },
  itemDelete: { padding: 4, flexShrink: 0 },
  itemsTotalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, marginTop: 4 },
  itemsTotalLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', flexShrink: 0 },
  itemsTotalDots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: '#c0c0c0', marginHorizontal: 8 },
  itemsTotalValue: { fontFamily: 'RobotoMono_700Bold', fontSize: 10, color: '#425252', flexShrink: 0 },
  allocatedNote: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#2ab671', textAlign: 'center', marginTop: 4, marginBottom: 8 },
  addSubitemBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#0ccfcf', flexShrink: 0 },
  addSubitemBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 9, color: '#0ccfcf' },
  subitemCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffffff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#f0f0f0', marginTop: 4, marginLeft: 28 },
  subitemArrow: { fontSize: 12, color: '#c0c0c0', flexShrink: 0 },
  subitemName: { fontFamily: 'RobotoMono_700Bold', fontSize: 10, color: '#425252' },
  subitemCostText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#425252' },
  cookingBox: { borderRadius: 14, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#fafafa', padding: 20, alignItems: 'center', marginBottom: 24 },
  cookingText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090', textAlign: 'center' },
  tooltip: { position: 'absolute', top: '50%', alignSelf: 'center', backgroundColor: '#425252', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  tooltipText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#fff' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, width: 300, gap: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontFamily: 'ChillaxMedium', fontSize: 16, color: '#425252', alignSelf: 'flex-start' },
  modalBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtn: { flex: 1, backgroundColor: '#425252', borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  modalBtnText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#fff' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  personInput: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252', borderWidth: 1, borderColor: '#e8e8e8' },
  removeBtn: { padding: 4 },
  addMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  addMoreText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#0ccfcf' },
  deleteWarning: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090', textAlign: 'center', lineHeight: 18 },
  suggestionBox: { backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#f0f0f0', marginTop: -4, marginBottom: 6, overflow: 'hidden' },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestionText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#425252' },
  itemFormSection: { marginBottom: 12 },
  itemFormSectionDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 10 },
  subitemFormRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, marginLeft: 4 },
  subitemFormInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subitemFormInput: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontFamily: 'RobotoMono_400Regular', fontSize: 14, color: '#425252', borderWidth: 1, borderColor: '#f0f0f0' },
  subitemAutoHint: { fontFamily: 'RobotoMono_700Bold', fontSize: 10, color: '#0ccfcf', flexShrink: 0 },
  itemFormRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemFormBlock: { width: '100%', backgroundColor: '#fafafa', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: '#f0f0f0' },
  itemFormInput: { paddingVertical: 10, fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252' },
  itemFormDivider: { height: 1, backgroundColor: '#f0f0f0' },
  itemFormLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', textTransform: 'uppercase', letterSpacing: 0.5, alignSelf: 'flex-start' },
  itemPeopleSelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: '100%' },
  personSelectChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#fafafa' },
  personSelectChipActive: { backgroundColor: '#0ccfcf', borderColor: '#0ccfcf' },
  personSelectText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#929090' },
  personSelectTextActive: { color: '#fff', fontFamily: 'RobotoMono_700Bold' },
  subitemRemaining: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', alignSelf: 'flex-start' },
  toast: { position: 'absolute', bottom: 48, alignSelf: 'center', backgroundColor: '#425252', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  toastText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#fff' },
  shareOptionsRow: { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 4 },
  shareOptionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0', backgroundColor: '#fafafa' },
  shareOptionText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#0ccfcf' },
  accountOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 6, backgroundColor: '#fafafa' },
  accountOptionActive: { backgroundColor: '#425252', borderColor: '#425252' },
  accountOptionName: { fontFamily: 'ChillaxMedium', fontSize: 13, color: '#425252' },
  accountOptionBank: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090' },
  subitemError: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#ed6a6a', alignSelf: 'flex-start' },
  splitPreview: { fontFamily: 'RobotoMono_700Bold', fontSize: 12, color: '#0ccfcf', alignSelf: 'flex-start' },
});





