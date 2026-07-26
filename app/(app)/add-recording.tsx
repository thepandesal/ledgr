/**
 * add-recording.tsx
 * Screen for creating or editing a recording.
 * Uses BottomSheet for the entire form.
 */

import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Image, Alert,
  Modal, SafeAreaView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { compressImage, uploadReceiptPhoto } from '../../src/lib/receiptUpload';
import { setPendingFocusDate } from '../../src/lib/focusDate';
import { DC } from '../../src/lib/design';
import { AppFont } from '../../src/lib/fonts';

import {
  BottomSheet,
  FormLabel,
  FormInput,
  FormBlock,
  FormRow,
  SelectorButton,
  SearchableList,
  FormActions,
  MonthPicker,
  Colors,
  Fonts,
  Radius,
  Spacing,
} from '@/components/ui';
import formStyles from '@/components/ui/formStyles';
import { useUser } from '../../src/hooks/useUser';

// --- Constants ---------------------------------------------------------------

const TYPE_GROUPS = [
  {
    label: 'money in',
    types: [
      { key: 'income', label: 'Money In', color: Colors.income, icon: 'arrow-up-outline' },
    ],
  },
  {
    label: 'money out',
    types: [
      { key: 'expense', label: 'Money Out', color: Colors.expense, icon: 'arrow-down-outline' },
    ],
  },
  {
    label: 'does someone owe you this expense?',
    types: [
      { key: 'due', label: 'Receivable', color: Colors.text, icon: 'arrow-undo-outline' },
    ],
  },
  {
    label: 'loan',
    types: [
      { key: 'debt', label: 'Loan', color: Colors.text, icon: 'cash-outline' },
    ],
  },
] as const;

const TYPES: { key: string; label: string; color: string; icon: string }[] = (TYPE_GROUPS as unknown as any[]).flatMap((g: any) => g.types);

// --- Component ---------------------------------------------------------------

export default function AddRecordingScreen({ inlineProps }: {
  inlineProps?: { spaceId?: string; spaceName?: string; defaultDate: string; onClose: () => void; categoryId?: string; categoryName?: string };
}) {
  const params = useLocalSearchParams<{ spaceId: string; spaceName: string; defaultDate: string; editId: string; receiptId?: string }>();
  const router = useRouter();

  const propSpaceId   = inlineProps?.spaceId   ?? params.spaceId;
  const propSpaceName = inlineProps?.spaceName ?? params.spaceName;
  const propCategoryId   = inlineProps?.categoryId;
  const propCategoryName = inlineProps?.categoryName;
  const defaultDate = inlineProps?.defaultDate ?? params.defaultDate;
  const editId    = params.editId;
  const receiptId = params.receiptId;
  const handleClose = inlineProps?.onClose ?? (() => router.back());
  const { defaultCurrency, userId } = useUser();
  const [currency, setCurrency] = useState(defaultCurrency);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  // Space picker (when no space pre-set)
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(propSpaceId || null);
  const [selectedSpaceName, setSelectedSpaceName] = useState<string>(propSpaceName || '');
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const needsSpacePicker = !propSpaceId;

  // Use selectedSpaceId for saving
  const spaceId = selectedSpaceId || null;
  const spaceName = selectedSpaceName;

  const CURRENCIES = [
    'PHP','USD','EUR','GBP','JPY','AUD','CAD','SGD','MYR','IDR',
    'THB','VND','KRW','CNY','INR','HKD','NZD','CHF','BRL','MXN',
  ];

  // ── Multi-item state ──────────────────────────────────────────────────
  type RecItem = {
    id: string; name: string; amount: string; category: any; account: any;
    person: string; personUserId: string | null; isReceivable: boolean; photos: string[];
  };
  const newItem = (): RecItem => ({
    id: Math.random().toString(36).slice(2),
    name: "", amount: "", category: null, account: null,
    person: "", personUserId: null, isReceivable: false, photos: [],
  });
  const [items, setItems] = useState<RecItem[]>([newItem()]);
  const updateItem = (id: string, patch: Partial<RecItem>) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  const addItem    = () => setItems(prev => [...prev, newItem()]);
  const removeItem = (id: string) => setItems(prev => prev.length > 1 ? prev.filter(it => it.id !== id) : prev);

  // Legacy state for editId and shared fields
  const [type, setType] = useState<string>("income");
  const [date, setDate]         = useState(defaultDate ?? new Date().toISOString().split("T")[0]);
  const [notes, setNotes]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [spaceBudget, setSpaceBudget] = useState<number | null>(null);
  const [spaceSpent, setSpaceSpent] = useState<number>(0);
  // Legacy single-item aliases for editId save path
  const recName = items[0]?.name ?? "";
  const amount  = items[0]?.amount ?? "";
  const personName = items[0]?.person ?? "";
  const selectedCategory = items[0]?.category;
  const selectedAccount  = items[0]?.account;
  const selectedFriendUserId = items[0]?.personUserId ?? null;

  // -- Picker data ----------------------------------------------------------
  const [categories, setCategories]           = useState<any[]>([]);
  const [accounts, setAccounts]               = useState<any[]>([]);


  const [personSuggestions, setPersonSuggestions] = useState<string[]>([]);

  // -- Picker modals --------------------------------------------------------
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal]   = useState(false);
  const [activePickerItemId, setActivePickerItemId] = useState<string>('');

  // -- Receipt photos --------------------------------------------------------
  const [receiptPhotos, setReceiptPhotos] = useState<string[]>([]);

  // -- Receivable-specific --------------------------------------------------
  const [decreasedFromAccount, setDecreasedFromAccount] = useState<any>(null);
  const [receiveToAccount, setReceiveToAccount]         = useState<any>(null);
  const [showDecreasedFromModal, setShowDecreasedFromModal] = useState(false);
  const [showReceiveToModal, setShowReceiveToModal]         = useState(false);
  const [linkedExpense, setLinkedExpense]               = useState<any>(null);
  const [showExpenseModal, setShowExpenseModal]         = useState(false);
  const [expenseList, setExpenseList]                   = useState<any[]>([]);

  // -- Person picker ---------------------------------------------------------
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [friendSuggestions, setFriendSuggestions] = useState<string[]>([]);
  const [friendIdMap, setFriendIdMap] = useState<Record<string, string>>({}); // name -> userId
  const [contactSuggestions, setContactSuggestions] = useState<string[]>([]);
  const [personSearch, setPersonSearch] = useState('');
  const [showAllFriends, setShowAllFriends] = useState(false);
  const [showAllContacts, setShowAllContacts] = useState(false);


  // -- Type dropdown ---------------------------------------------------------
  const [showTypeModal, setShowTypeModal] = useState(false);

  // -- Sub-type toggles ----------------------------------------------------
  const [expenseIsReceivable, setExpenseIsReceivable] = useState(false);
  const [incomeIsLoan, setIncomeIsLoan]               = useState(false);

  // -- Singular toggles -----------------------------------------------------
  const [useSingularAccount, setUseSingularAccount] = useState(false);
  const [singularAccount, setSingularAccount]       = useState<any>(null);
  const [showSingularAccountModal, setShowSingularAccountModal] = useState(false);
  const [useSingularPerson, setUseSingularPerson]   = useState(false);
  const [singularPerson, setSingularPerson]         = useState('');
  const [singularPersonUserId, setSingularPersonUserId] = useState<string | null>(null);

  // -- Derived --------------------------------------------------------------
  const isLoanType  = type === 'debt';
  const isReceivableType = type === 'due';
  const isComboType = false;
  const [receivableIsExpense, setReceivableIsExpense] = useState(false);
  const selectedType = (TYPES.find(t => t.key === type) ?? TYPES[0]) as { key: string; label: string; color: string; icon: string };

  const queryClient = useQueryClient();
  const savingRef = useRef(false);

  // --- Lifecycle ---------------------------------------------------------
  useEffect(() => {
    loadData();
    if (receiptId) loadReceiptPhotos();
  }, []);

  // --- Data loading -------------------------------------------------------

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [cats, accs] = await Promise.all([
      supabase.from('categories').select().eq('user_id', user.id).order('name'),
      supabase.from('accounts').select().eq('user_id', user.id).order('account_name'),
    ]);
    if (cats.data) {
      setCategories(cats.data);
      // Pre-set category if coming from a category filter
      if (propCategoryId && propCategoryName) {
        const cat = cats.data.find((c: any) => c.id === propCategoryId);
        if (cat) setItems(prev => prev.map((it, i) => i === 0 ? { ...it, category: cat } : it));
      }
    }
    if (accs.data) setAccounts(accs.data);

    // Load spaces for picker if no space pre-set
    if (needsSpacePicker) {
      const { data: sp } = await supabase.from('spaces').select('id, name').eq('user_id', user.id).neq('is_active', false).order('sort_order', { ascending: true, nullsFirst: false });
      setSpaces(sp ?? []);
    }

    // Load person suggestions: manual contacts + friends
    const [{ data: contactsData }, { data: friendships }] = await Promise.all([
      supabase.from('contacts').select('name').eq('user_id', user.id).order('name'),
      supabase.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted').or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`),
    ]);
    const contactNames = (contactsData ?? []).map((c: any) => c.name);
    const friendIds = (friendships ?? []).map((f: any) => f.requester_id === user.id ? f.receiver_id : f.requester_id);
    const friendEntries = await Promise.all(friendIds.map(async (id: string) => {
      const { data: n } = await supabase.rpc('get_user_display_name', { user_id: id });
      return n ? { id, name: n as string } : null;
    }));
    const validFriends = friendEntries.filter(Boolean) as { id: string; name: string }[];
    const idMap: Record<string, string> = {};
    validFriends.forEach(f => { idMap[f.name] = f.id; });
    setFriendIdMap(idMap);
    const friendNames = validFriends.map(f => f.name);
    setFriendSuggestions(friendNames);
    setContactSuggestions(contactNames);
    const allNames = [...new Set([...friendNames, ...contactNames])].sort();
    setPersonSuggestions(allNames);

    // Load space budget if adding a new expense
    if (!editId && spaceId) {
      const { data: space } = await supabase.from('spaces').select('budget').eq('id', spaceId).single();
      if (space?.budget) {
        setSpaceBudget(space.budget);
        const { data: recs } = await supabase.from('recordings').select('amount').eq('space_id', spaceId).eq('type', 'expense');
        if (recs) setSpaceSpent(recs.reduce((s: number, r: any) => s + Number(r.amount), 0));
      }
    }

    if (editId) {
      const { data: rec } = await supabase
        .from('recordings')
        .select('*, categories:category_id(id,name,color,icon), account:account_id(id,account_name,bank,color)')
        .eq('id', editId).single();
      if (rec) {
        updateItem(items[0].id, { name: rec.name });
        setType(rec.type);
        updateItem(items[0].id, { amount: String(rec.amount) });
        setDate(rec.transaction_date);
        setNotes(rec.notes ?? '');
        updateItem(items[0].id, { person: rec.person_name ?? '' });
        if (rec.currency) setCurrency(rec.currency);
        if (rec.categories) updateItem(items[0].id, { category: Array.isArray(rec.categories) ? rec.categories[0] : rec.categories });
        if (rec.account) updateItem(items[0].id, { account: Array.isArray(rec.account) ? rec.account[0] : rec.account });
      }
    }
  };

  const loadReceiptPhotos = async () => {
    // Load photos from the existing receipt entry so they display as a preview
    const { data } = await supabase.from('receipt_photos').select('storage_path, url').eq('entry_id', receiptId);
    if (data) {
      const urls = await Promise.all(data.map(async (p: any) => {
        if (p.url) return p.url;
        const { data: signed } = await supabase.storage.from('receipts').createSignedUrl(p.storage_path, 3600);
        return signed?.signedUrl ?? '';
      }));
      setReceiptPhotos(urls.filter(Boolean));
    }
  };

  // --- Receipt capture ----------------------------------------------------

  const addFromCamera = async (itemId: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      updateItem(itemId, { photos: [...(items.find(i => i.id === itemId)?.photos ?? []), result.assets[0].uri] });
    }
  };

  const addFromGallery = async (itemId: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1, base64: false });
    if (!result.canceled) {
      const uris = await Promise.all(result.assets.map(async (a) => {
        if (typeof window !== 'undefined' && a.uri.startsWith('blob:')) {
          const blob = await fetch(a.uri).then(r => r.blob());
          return await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
        return a.uri;
      }));
      const existing = items.find(i => i.id === itemId)?.photos ?? [];
      updateItem(itemId, { photos: [...existing, ...uris] });
    }
  };

  const removePhoto = (itemId: string, index: number) =>
    updateItem(itemId, { photos: (items.find(i => i.id === itemId)?.photos ?? []).filter((_, i) => i !== index) });

  // --- Save ---------------------------------------------------------------

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    const invalid = items.find(it => !it.name.trim() || !it.amount);
    if (invalid) { setError("name and amount are required for all items."); return; }
    setLoading(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setError('not logged in'); setLoading(false); return; }
      const statusMap: Record<string, string> = {
        income: 'received',
        expense: 'paid',
        due: 'unpaid',
        debt: 'unpaid',
      };
      if (editId) {
        const it = items[0];
        const { error: err } = await supabase.from("recordings").update({
          name: it.name.trim(), type, amount: parseFloat(it.amount),
          transaction_date: date, notes: notes.trim() || null,
          category_id: it.category?.id || null, account_id: it.account?.id || null, currency,
        }).eq("id", editId);
        if (err) throw err;
      } else {
        for (const it of items) {
          const effectiveAccount = useSingularAccount ? singularAccount : it.account;
          const effectivePerson  = useSingularPerson  ? singularPerson  : it.person;
          const effectivePersonId = useSingularPerson ? singularPersonUserId : it.personUserId;
          // expense + isReceivable = expense with is_due
          // due + receivableIsExpense = expense with is_due
          const isDue = (type === 'expense' && it.isReceivable) || (type === 'due' && receivableIsExpense);
          const dbType = isDue ? 'expense' : type;
          const { data: newRec, error: err } = await supabase.from("recordings").insert({
            space_id: spaceId || null,
            user_id: user!.id,
            name: it.name.trim(),
            type: dbType,
            amount: parseFloat(it.amount),
            transaction_date: date,
            notes: notes.trim() || null,
            category_id: it.category?.id || null,
            account_id: effectiveAccount?.id || null,
            status: isDue ? 'unpaid' : (statusMap[type] ?? 'paid'),
            is_due: isDue || undefined,
            person_name: (type === 'debt' || type === 'due' || isDue) ? effectivePerson || null : null,
            tagged_friend_user_id: (type === 'debt' || type === 'due' || isDue) ? effectivePersonId || null : null,
            currency,
          }).select("id").single();
          if (err) throw err;
          if (newRec?.id && it.photos.length > 0) {
            const { data: entry, error: entryErr } = await supabase.from("receipt_entries").insert({ user_id: user.id, note: it.name.trim(), recording_id: newRec.id }).select().single();
            if (entryErr) throw entryErr;
            if (entry?.id) {
              for (const uri of it.photos) {
                const compressed = await compressImage(uri);
                try {
                  await uploadReceiptPhoto(compressed, entry.id);
                } catch (uploadErr: any) {
                  if (uploadErr?.message === 'RECEIPT_LIMIT_REACHED') {
                    setError('monthly receipt limit reached.');
                    break;
                  }
                  throw uploadErr;
                }
              }
            }
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['home-people', user.id] });
      queryClient.invalidateQueries({ queryKey: ['home-spaces', user.id] });
      queryClient.invalidateQueries({ queryKey: ['home-recent', user.id] });
      setPendingFocusDate(date);
      handleClose();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      savingRef.current = false;
    }
  };

  const openExpensePicker = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('recordings')
      .select('id, name, amount, transaction_date')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .order('transaction_date', { ascending: false })
      .limit(50);
    setExpenseList(data ?? []);
    setShowExpenseModal(true);
  };

  // --- Render -------------------------------------------------------------

  return (
    <Modal visible animationType="slide" transparent statusBarTranslucent onRequestClose={handleClose}>
      <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
      <View style={s.overlay}>
      <SafeAreaView style={s.sheet}>
        <View style={{ flex: 1, paddingHorizontal: DC.pagePadding, paddingTop: 16 }}>
          {/* Header */}

          <View style={s.header}>
            <Text style={s.headerTitle}>{editId ? 'Edit Recording' : 'New Recording'}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <View style={s.headerClose}>
                <Text style={s.headerCloseText}>✕</Text>
              </View>
            </TouchableOpacity>
          </View>



          <View style={s.frozenSection}>
            <TouchableOpacity style={s.frozenRow} onPress={() => setShowTypeModal(true)} activeOpacity={0.8}>
              <Text style={s.frozenLabel}>Type</Text>
              <View style={s.frozenPill}>
                <Text style={s.frozenPillText}>{selectedType.label.charAt(0).toUpperCase() + selectedType.label.slice(1)}</Text>
                <Ionicons name="chevron-down" size={13} color={DC.pageText} />
              </View>
            </TouchableOpacity>
            {needsSpacePicker && (
              <TouchableOpacity style={s.frozenRow} onPress={() => setShowSpaceModal(true)} activeOpacity={0.8}>
                <Text style={s.frozenLabel}>Space</Text>
                <View style={s.frozenPill}>
                  <Text style={s.frozenPillText}>{selectedSpaceName || 'None (Uncategorized)'}</Text>
                  <Ionicons name="chevron-down" size={13} color={DC.pageText} />
                </View>
              </TouchableOpacity>
            )}
 <View style={s.frozenRow}>
 <Text style={s.frozenLabel}>Singular account?</Text>
 <View style={[s.yesNoRow, { flex: 1 }]}>
 <TouchableOpacity style={[s.yesNoBtn, useSingularAccount && s.yesNoBtnActive]} onPress={() => setUseSingularAccount(true)} activeOpacity={0.8}>
 <Text style={[s.yesNoBtnText, useSingularAccount && s.yesNoBtnTextActive]}>Yes</Text>
              </TouchableOpacity>
 <TouchableOpacity style={[s.yesNoBtn, !useSingularAccount && s.yesNoBtnActive]} onPress={() => { setUseSingularAccount(false); setSingularAccount(null); }} activeOpacity={0.8}>
 <Text style={[s.yesNoBtnText, !useSingularAccount && s.yesNoBtnTextActive]}>No</Text>
              </TouchableOpacity>
              </View>
            </View>
            {useSingularAccount && (
              <TouchableOpacity style={s.frozenRow} onPress={() => setShowSingularAccountModal(true)} activeOpacity={0.8}>
                <Text style={s.frozenLabel}>Account</Text>
                <View style={s.frozenPill}>
                  <Text style={s.frozenPillText}>{singularAccount ? singularAccount.account_name : 'Select'}</Text>
                  <Ionicons name="chevron-down" size={13} color={DC.pageText} />
                </View>
              </TouchableOpacity>
            )}
            {(isLoanType || isReceivableType || (type === 'expense' && singularPerson)) && (
              <TouchableOpacity style={s.frozenRow} onPress={() => { setActivePickerItemId('singular'); setShowPersonModal(true); }} activeOpacity={0.8}>
                <Text style={s.frozenLabel}>{isLoanType ? 'Paying' : 'Owes You'}</Text>
                <View style={s.frozenPill}>
                  <Text style={s.frozenPillText}>{singularPerson || 'Select'}</Text>
                  <Ionicons name="chevron-down" size={13} color={DC.pageText} />
                </View>
              </TouchableOpacity>
            )}
            {isReceivableType && (
              <View style={s.frozenRow}>
                <Text style={s.frozenLabel}>Is this an expense?</Text>
                <View style={[s.yesNoRow, { flex: 1 }]}>
                  <TouchableOpacity style={[s.yesNoBtn, receivableIsExpense && s.yesNoBtnActive]} onPress={() => setReceivableIsExpense(true)} activeOpacity={0.8}>
                    <Text style={[s.yesNoBtnText, receivableIsExpense && s.yesNoBtnTextActive]}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.yesNoBtn, !receivableIsExpense && s.yesNoBtnActive]} onPress={() => setReceivableIsExpense(false)} activeOpacity={0.8}>
                    <Text style={[s.yesNoBtnText, !receivableIsExpense && s.yesNoBtnTextActive]}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: DC.cardBorder, marginTop: 14, marginBottom: 22, marginHorizontal: -DC.pagePadding }} />

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: 32, gap: 8 }} style={{ flex: 1 }}>

      {/* -- Receipt reference carousel -- */}
      {/* Error */}
      {error ? <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.expense, marginBottom: 8 }}>{error}</Text> : null}

      {/* Item cards */}
      {items.map((item, idx) => (
        <View key={item.id} style={s.itemCard}>
          {/* Card header with remove button */}
          <View style={s.itemCardHeader}>
            <Text style={s.itemCardNum}>Item {idx + 1}</Text>
            {items.length > 1 && (
              <TouchableOpacity onPress={() => removeItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={DC.pageTextMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Name */}
          <View style={s.itemRow}>
            <Text style={s.itemLabel}>Name <Text style={{ color: '#FF5757' }}>*</Text></Text>
            <TextInput
              style={s.itemInput}
              placeholder="e.g. grocery run"
              placeholderTextColor={Colors.faint}
              value={item.name}
              onChangeText={v => updateItem(item.id, { name: v })}
            />
          </View>

          {/* Amount */}
          <View style={s.itemRow}>
            <Text style={s.itemLabel}>Amount <Text style={{ color: '#FF5757' }}>*</Text></Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
              <TouchableOpacity onPress={() => setShowCurrencyModal(true)} style={s.currencyPill}>
                <Text style={s.currencyPillText}>{currency}</Text>
              </TouchableOpacity>
              <TextInput
                style={[s.itemInput, { textAlign: "right", flex: 1, minWidth: 0 }]}
                placeholder="0.00"
                placeholderTextColor={DC.inputPlaceholder}
                value={item.amount}
                onChangeText={v => updateItem(item.id, { amount: v })}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Category */}
          {propCategoryId ? (
            <View style={s.itemRow}>
              <Text style={s.itemLabel}>Category</Text>
              <View style={[s.itemPill, { opacity: 0.6 }]}>
                <Text style={s.itemPillText}>{item.category?.name ?? propCategoryName ?? 'Loading...'}</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.itemRow} onPress={() => { setActivePickerItemId(item.id); setShowCategoryModal(true); }} activeOpacity={0.8}>
              <Text style={s.itemLabel}>Category <Text style={{ color: Colors.muted, fontSize: 9, fontFamily: AppFont.regular }}>(optional)</Text></Text>
              <View style={s.itemPill}>
                <Text style={s.itemPillText}>{item.category ? item.category.name : "Select"}</Text>
                <Ionicons name="chevron-down" size={13} color={DC.pageText} />
              </View>
            </TouchableOpacity>
          )}

          {/* Account — hidden if singular account */}
          {!useSingularAccount && (
            <TouchableOpacity style={s.itemRow} onPress={() => { setActivePickerItemId(item.id); setShowAccountModal(true); }} activeOpacity={0.8}>
              <Text style={s.itemLabel}>Account <Text style={{ color: Colors.muted, fontSize: 9, fontFamily: AppFont.regular }}>(optional)</Text></Text>
              <View style={s.itemPill}>
                <Text style={s.itemPillText}>{item.account ? item.account.account_name : "Select"}</Text>
                <Ionicons name="chevron-down" size={13} color={DC.pageText} />
              </View>
            </TouchableOpacity>
          )}

          {/* Receivable per item + Owes You */}
          {type === 'expense' && (
            <View style={s.itemRow}>
              <Text style={s.itemLabel}>Does someone owe you this expense? <Text style={{ color: '#FF5757' }}>*</Text></Text>
              <View style={[s.yesNoRow, { flex: 1 }]}>
                <TouchableOpacity style={[s.yesNoBtn, item.isReceivable && s.yesNoBtnActive]} onPress={() => updateItem(item.id, { isReceivable: true })} activeOpacity={0.8}>
                  <Text style={[s.yesNoBtnText, item.isReceivable && s.yesNoBtnTextActive]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.yesNoBtn, !item.isReceivable && s.yesNoBtnActive]} onPress={() => updateItem(item.id, { isReceivable: false })} activeOpacity={0.8}>
                  <Text style={[s.yesNoBtnText, !item.isReceivable && s.yesNoBtnTextActive]}>No</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {/* Person - loan/receivable types */}
          {(isLoanType || isReceivableType || (type === 'expense' && item.isReceivable)) && !useSingularPerson && (
            <TouchableOpacity style={s.itemRow} onPress={() => { setActivePickerItemId(item.id); setShowPersonModal(true); }} activeOpacity={0.8}>
              <Text style={s.itemLabel}>{isLoanType ? 'Paying' : 'Owes You'} <Text style={{ color: Colors.muted, fontSize: 9, fontFamily: AppFont.regular }}>(optional)</Text></Text>
              <View style={s.itemPill}>
                <Text style={s.itemPillText}>{item.person || 'Select'}</Text>
                <Ionicons name="chevron-down" size={13} color={DC.pageText} />
              </View>
            </TouchableOpacity>
          )}
          {/* Receipts */}
          <View style={[s.itemRow, { borderBottomWidth: 0 }]}>
            <Text style={s.itemLabel}>Receipts <Text style={{ color: Colors.muted, fontSize: 9, fontFamily: AppFont.regular }}>(optional)</Text></Text>
            <View style={[s.yesNoRow, { flex: 1 }]}>
              <TouchableOpacity style={s.yesNoBtn} onPress={() => addFromCamera(item.id)} activeOpacity={0.8}>
                <Text style={s.yesNoBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.yesNoBtn} onPress={() => addFromGallery(item.id)} activeOpacity={0.8}>
                <Text style={s.yesNoBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
          {item.photos.length > 0 && (
            <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {item.photos.map((uri, i) => (
                  <View key={i} style={s.photoThumbWrap}>
                    <Image source={{ uri }} style={s.receiptThumb} resizeMode="cover" />
                    <TouchableOpacity style={s.photoRemoveBtn} onPress={() => removePhoto(item.id, i)}>
                      <Ionicons name="close-circle" size={18} color={Colors.text} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      ))}
      {/* + Add new */}
      <TouchableOpacity style={s.addNewBtn} onPress={addItem} activeOpacity={0.8}>
        <Text style={s.addNewBtnText}>+ Add new</Text>
      </TouchableOpacity>

      {/* Save button */}
      <TouchableOpacity
        style={[s.saveBtn, items.some(it => !it.name.trim() || !it.amount) && s.saveBtnDisabled]}
        onPress={handleSave}
        disabled={loading || items.some(it => !it.name.trim() || !it.amount)}
        activeOpacity={0.8}
      >
        {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={s.saveBtnText}>Save {items.length > 1 ? `${items.length} Recordings` : "Recording"}</Text>}
      </TouchableOpacity>

      <BottomSheet visible={showCurrencyModal} onClose={() => setShowCurrencyModal(false)} title="currency" height="50%">
        <ScrollView showsVerticalScrollIndicator={false}>
          {CURRENCIES.map(c => (
            <TouchableOpacity
              key={c}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border }}
              onPress={() => { setCurrency(c); setShowCurrencyModal(false); }}
            >
              <Text style={{ fontFamily: currency === c ? AppFont.semiBold : AppFont.regular, fontSize: DC.chipFontSize, color: DC.pageText }}>{c}</Text>
              {currency === c && <Ionicons name="checkmark" size={16} color={Colors.cyan} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={showTypeModal} onClose={() => setShowTypeModal(false)} sub="recording" title="select type">
        <ScrollView showsVerticalScrollIndicator={false}>
          {TYPE_GROUPS.map(group => (
            <View key={group.label} style={{ marginBottom: 16 }}>
              <Text style={{ fontFamily: AppFont.bold, fontSize: 10, color: DC.pageTextMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>{group.label}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {group.types.map((t: any) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[s.chip, type === t.key && s.chipActive]}
                    onPress={() => { setType(t.key); setExpenseIsReceivable(false); setIncomeIsLoan(false); setReceivableIsExpense(false); setShowTypeModal(false); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.chipText, type === t.key && s.chipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </BottomSheet>

      {/* Category picker modal */}
      <BottomSheet visible={showCategoryModal} onClose={() => setShowCategoryModal(false)} sub="recording" title="category">
        <SearchableList
          items={categories}
          selected={activePickerItemId === "singular" ? null : items.find(i => i.id === activePickerItemId)?.category}
          onSelect={c => {
            if (activePickerItemId === "singular") { /* no-op for singular */ }
            else updateItem(activePickerItemId, { category: c });
            setShowCategoryModal(false);
          }}
          keyExtractor={c => c.id} labelExtractor={c => c.name}
          renderLeft={(c) => (
            <View style={[s.catDot, { backgroundColor: c.color }]}>
              <Ionicons name={c.icon} size={11} color={Colors.text} />
            </View>
          )}
          emptyText="no categories found"
        />
        <FormActions onCancel={() => setShowCategoryModal(false)} onConfirm={() => setShowCategoryModal(false)} cancelLabel="cancel" confirmLabel="done" />
      </BottomSheet>
      {/* Account picker modal - per item */}
      <BottomSheet visible={showAccountModal} onClose={() => setShowAccountModal(false)} sub="recording" title="account">
        <SearchableList
          items={accounts}
          selected={items.find(i => i.id === activePickerItemId)?.account}
          onSelect={a => { updateItem(activePickerItemId, { account: a }); setShowAccountModal(false); }}
          keyExtractor={a => a.id} labelExtractor={a => a.account_name}
          subLabelExtractor={a => a.bank}
          subLabel2Extractor={a => a.holder_name}
          renderLeft={(a) => <Ionicons name="card-outline" size={22} color={DC.pageText} />}
          emptyText="no accounts found"
        />
        <FormActions onCancel={() => setShowAccountModal(false)} onConfirm={() => setShowAccountModal(false)} cancelLabel="cancel" confirmLabel="done" />
      </BottomSheet>
      {/* Singular account picker modal */}
      <BottomSheet visible={showSingularAccountModal} onClose={() => setShowSingularAccountModal(false)} sub="recording" title="account">
        <SearchableList
          items={accounts} selected={singularAccount}
          onSelect={a => { setSingularAccount(a); setShowSingularAccountModal(false); }}
          keyExtractor={a => a.id} labelExtractor={a => a.account_name}
          subLabelExtractor={a => a.bank}
          subLabel2Extractor={a => a.holder_name}
          renderLeft={(a) => <Ionicons name="card-outline" size={22} color={DC.pageText} />}
          emptyText="no accounts found"
        />
        <FormActions onCancel={() => setShowSingularAccountModal(false)} onConfirm={() => setShowSingularAccountModal(false)} cancelLabel="cancel" confirmLabel="done" />
      </BottomSheet>

      <BottomSheet visible={showDecreasedFromModal} onClose={() => setShowDecreasedFromModal(false)} sub="receivable" title="decreased from">
        <SearchableList
          items={accounts} selected={decreasedFromAccount}
          onSelect={a => { setDecreasedFromAccount(a); setShowDecreasedFromModal(false); }}
          keyExtractor={a => a.id} labelExtractor={a => a.account_name}
          subLabelExtractor={a => `${a.bank} � ${a.account_number}`}
          renderLeft={(a) => <View style={[s.catDot, { backgroundColor: a.color ?? Colors.borderMid }]} />}
          emptyText="no accounts found"
        />
        <FormActions onCancel={() => setShowDecreasedFromModal(false)} onConfirm={() => setShowDecreasedFromModal(false)} cancelLabel="cancel" confirmLabel="done" />
      </BottomSheet>

      {/* -- Receive to modal -- */}
      <BottomSheet visible={showReceiveToModal} onClose={() => setShowReceiveToModal(false)} sub="receivable" title="expecting to receive in">
        <SearchableList
          items={accounts} selected={receiveToAccount}
          onSelect={a => { setReceiveToAccount(a); setShowReceiveToModal(false); }}
          keyExtractor={a => a.id} labelExtractor={a => a.account_name}
          subLabelExtractor={a => `${a.bank} � ${a.account_number}`}
          renderLeft={(a) => <View style={[s.catDot, { backgroundColor: a.color ?? Colors.borderMid }]} />}
          emptyText="no accounts found"
        />
        <FormActions onCancel={() => setShowReceiveToModal(false)} onConfirm={() => setShowReceiveToModal(false)} cancelLabel="cancel" confirmLabel="done" />
      </BottomSheet>

      {/* -- Expense picker modal -- */}
      <BottomSheet visible={showExpenseModal} onClose={() => setShowExpenseModal(false)} sub="receivable" title="link to expense">
        <SearchableList
          items={expenseList}
          selected={linkedExpense}
          onSelect={e => {
            setLinkedExpense(e);
            if (!items[0].name.trim()) updateItem(items[0].id, { name: e.name });
            if (!items[0].amount) updateItem(items[0].id, { amount: String(e.amount) });
            setShowExpenseModal(false);
          }}
          keyExtractor={e => e.id}
          labelExtractor={e => e.name}
          subLabelExtractor={e => `${Number(e.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} � ${e.transaction_date}`}
          renderLeft={() => <Ionicons name="receipt-outline" size={14} color={Colors.expense} />}
          emptyText="no expenses found"
        />
        <FormActions onCancel={() => setShowExpenseModal(false)} onConfirm={() => setShowExpenseModal(false)} cancelLabel="cancel" confirmLabel="done" />
      </BottomSheet>

      </ScrollView>
      </View>

      {/* -- All modals outside ScrollView -- */}
      {/* Person picker modal */}
      <BottomSheet visible={showPersonModal} onClose={() => { setShowPersonModal(false); setPersonSearch(""); setShowAllFriends(false); setShowAllContacts(false); }} title="select person">
        <TextInput
          style={{ fontFamily: AppFont.regular, fontSize: 14, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 16 }}
          placeholder="search..."
          placeholderTextColor={Colors.faint}
          value={personSearch}
          onChangeText={setPersonSearch}
          autoFocus
        />
        {(() => {
          const query = personSearch.toLowerCase();
          const filteredFriends = friendSuggestions.filter(n => n.toLowerCase().includes(query));
          const filteredContacts = contactSuggestions.filter(n => n.toLowerCase().includes(query));
          const visibleFriends = showAllFriends ? filteredFriends : filteredFriends.slice(0, 3);
          const visibleContacts = showAllContacts ? filteredContacts : filteredContacts.slice(0, 3);
          const selectPerson = (name: string, userId: string | null) => {
            if (activePickerItemId === "singular") {
              setSingularPerson(name); setSingularPersonUserId(userId);
            } else {
              updateItem(activePickerItemId, { person: name, personUserId: userId });
            }
            setShowPersonModal(false); setPersonSearch(""); setShowAllFriends(false); setShowAllContacts(false);
          };
          return (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
              {filteredFriends.length > 0 && (
                <>
                  <Text style={{ fontFamily: AppFont.bold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>friends</Text>
                  {visibleFriends.map(n => (
                    <TouchableOpacity key={n} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }} onPress={() => selectPerson(n, friendIdMap[n] ?? null)} activeOpacity={0.75}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.cyan + "33", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="people-outline" size={14} color={Colors.cyan} />
                      </View>
                      <Text style={{ fontFamily: AppFont.regular, fontSize: 14, color: Colors.text, flex: 1 }}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                  {filteredFriends.length > 3 && !showAllFriends && (
                    <TouchableOpacity onPress={() => setShowAllFriends(true)} style={{ paddingVertical: 10 }}>
                      <Text style={{ fontFamily: AppFont.bold, fontSize: 12, color: Colors.cyan }}>show {filteredFriends.length - 3} more</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              {filteredContacts.length > 0 && (
                <>
                  <Text style={{ fontFamily: AppFont.bold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: "uppercase", marginTop: filteredFriends.length > 0 ? 16 : 0, marginBottom: 8 }}>contacts</Text>
                  {visibleContacts.map(n => (
                    <TouchableOpacity key={n} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }} onPress={() => selectPerson(n, null)} activeOpacity={0.75}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Colors.borderMid }}>
                        <Ionicons name="person-outline" size={14} color={Colors.muted} />
                      </View>
                      <Text style={{ fontFamily: AppFont.regular, fontSize: 14, color: Colors.text, flex: 1 }}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                  {filteredContacts.length > 3 && !showAllContacts && (
                    <TouchableOpacity onPress={() => setShowAllContacts(true)} style={{ paddingVertical: 10 }}>
                      <Text style={{ fontFamily: AppFont.bold, fontSize: 12, color: Colors.cyan }}>show {filteredContacts.length - 3} more</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              {filteredFriends.length === 0 && filteredContacts.length === 0 && (
                <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted, textAlign: "center", paddingVertical: 24 }}>
                  {personSearch ? "no results found" : "no contacts yet"}
                </Text>
              )}
            </ScrollView>
          );
        })()}
        <FormActions onCancel={() => { setShowPersonModal(false); setPersonSearch(""); setShowAllFriends(false); setShowAllContacts(false); }} onConfirm={() => { setShowPersonModal(false); setPersonSearch(""); }} cancelLabel="cancel" confirmLabel="done" />
      </BottomSheet>


      {/* Space picker modal */}
      {needsSpacePicker && (
        <BottomSheet visible={showSpaceModal} onClose={() => setShowSpaceModal(false)} title="select space">
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 }}
            onPress={() => { setSelectedSpaceId(null); setSelectedSpaceName(''); setShowSpaceModal(false); }}
            activeOpacity={0.7}
          >
            <Ionicons name={!selectedSpaceId ? 'radio-button-on' : 'radio-button-off'} size={18} color={!selectedSpaceId ? DC.accent1 : Colors.faint} />
            <Text style={{ fontFamily: AppFont.regular, fontSize: 14, color: Colors.muted }}>None (Uncategorized)</Text>
          </TouchableOpacity>
          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
            {spaces.map((sp: any) => (
              <TouchableOpacity
                key={sp.id}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 }}
                onPress={() => { setSelectedSpaceId(sp.id); setSelectedSpaceName(sp.name); setShowSpaceModal(false); }}
                activeOpacity={0.7}
              >
                <Ionicons name={selectedSpaceId === sp.id ? 'radio-button-on' : 'radio-button-off'} size={18} color={selectedSpaceId === sp.id ? DC.accent1 : Colors.faint} />
                <Text style={{ fontFamily: AppFont.regular, fontSize: 14, color: Colors.text }}>{sp.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </BottomSheet>
      )}

      </SafeAreaView>
      </View>
    </Modal>
  );
}

// --- Styles ------------------------------------------------------------------


const s = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────
  overlay:         { flex: 1 },
  sheet:           { flex: 1, backgroundColor: 'rgba(255,255,255,0.82)' },

  // ── Header ──────────────────────────────────────────────────────────────
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: DC.modalRowPadding, paddingTop: DC.modalRowPadding / 2 },
  headerTitle:     { fontFamily: AppFont.bold, fontSize: DC.modalTitleSize - 2, color: DC.accent1, letterSpacing: -0.5 },
  headerClose:     { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  headerCloseText: { fontFamily: AppFont.bold, fontSize: 14, color: DC.pageText },

  // ── Frozen section rows ─────────────────────────────────────────────────
  frozenSection:   { marginBottom: 0 },
  frozenRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: DC.modalRowPadding / 2, gap: DC.modalPadding / 2 },
  frozenLabel:     { fontFamily: AppFont.semiBold, fontSize: DC.dropdownFontSize, color: DC.pageTextMuted, width: 90 },
  frozenPill:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: DC.modalInputBg, borderRadius: DC.modalInputRadius, borderWidth: DC.cardBorderWidth, borderColor: DC.cardBorder, paddingHorizontal: DC.dropdownPaddingH, paddingVertical: DC.dropdownPaddingV },
  frozenPillText:  { fontFamily: AppFont.medium, fontSize: DC.dropdownFontSize, color: DC.dropdownTextColor },

  yesNoRow:           { flexDirection: 'row', gap: DC.modalPadding / 4 },
  yesNoBtn:           { flex: 1, alignItems: 'center', paddingVertical: DC.togglePaddingV + 2, borderRadius: DC.toggleRadius, borderWidth: DC.cardBorderWidth, borderColor: DC.cardBorder, backgroundColor: DC.toggleInactiveBg },
  yesNoBtnActive:     { backgroundColor: DC.toggleActiveBg, borderColor: DC.toggleActiveBg },
  yesNoBtnText:       { fontFamily: AppFont.medium, fontSize: DC.toggleFontSize, color: DC.toggleInactiveText },
  yesNoBtnTextActive: { fontFamily: AppFont.semiBold, fontSize: DC.toggleFontSize, color: DC.toggleActiveText },

  // ── Item cards ──────────────────────────────────────────────────────────
  itemCard:        { borderWidth: DC.cardBorderWidth, borderColor: DC.cardBorder, borderRadius: DC.cardRadius / 2, marginBottom: DC.cardGap / 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.6)', paddingTop: DC.modalRowPadding / 2, paddingBottom: DC.modalRowPadding / 2 },
  itemCardHeader:  { display: 'none' as any },
  itemCardNum:     { display: 'none' as any },
  itemRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DC.modalPadding / 2, paddingVertical: DC.modalRowPadding / 2, gap: DC.modalPadding / 2 },
  itemLabel:       { fontFamily: AppFont.semiBold, fontSize: DC.rowLabelSize - 1, color: DC.pageTextMuted, width: 80 },
  itemInput:       { flex: 1, minWidth: 0, fontFamily: AppFont.regular, fontSize: DC.inputFontSize - 1, color: DC.inputTextColor, textAlign: 'right', backgroundColor: DC.inputBg, borderRadius: DC.inputRadius, borderWidth: DC.inputBorderWidth, borderColor: DC.inputBorder, paddingHorizontal: DC.inputPaddingH, paddingVertical: DC.inputPaddingV / 2 },
  itemPill:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: DC.chipBg, borderRadius: DC.chipRadius, borderWidth: DC.cardBorderWidth, borderColor: DC.chipBorder, paddingHorizontal: DC.chipPaddingH, paddingVertical: DC.chipPaddingV },
  itemPillText:    { fontFamily: AppFont.regular, fontSize: DC.chipFontSize, color: DC.chipInactiveText },
  currencyPill:    { backgroundColor: DC.chipBg, borderRadius: DC.chipRadius, borderWidth: DC.cardBorderWidth, borderColor: DC.chipBorder, paddingHorizontal: DC.chipPaddingH - 4, paddingVertical: DC.chipPaddingV },
  currencyPillText:{ fontFamily: AppFont.semiBold, fontSize: DC.chipFontSize - 1, color: DC.chipInactiveText },

  addNewBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: DC.modalPadding / 4, backgroundColor: DC.btnBg, borderRadius: DC.dropdownRadius, borderWidth: DC.btnBorderWidth, paddingVertical: DC.modalRowPadding, paddingHorizontal: DC.modalPadding * 2, marginBottom: DC.cardGap / 2, alignSelf: 'center' as const },
  addNewBtnText:   { fontFamily: AppFont.medium, fontSize: DC.rowLabelSize, color: DC.btnText },

  photoThumbWrap:  { position: 'relative', marginRight: DC.cardGap / 2 },
  photoRemoveBtn:  { position: 'absolute', top: -6, right: -6, backgroundColor: DC.pageBg, borderRadius: 99 },
  receiptThumb:    { width: 64, height: 64, borderRadius: DC.cardRadius / 4 },

  catDot:          { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  chipRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: DC.cardGap / 2 },
  chip:            { paddingHorizontal: DC.chipPaddingH, paddingVertical: DC.chipPaddingV, borderRadius: DC.chipRadius, borderWidth: DC.cardBorderWidth, borderColor: DC.chipBorder, backgroundColor: DC.chipBg },
  chipActive:      { backgroundColor: DC.chipActiveBg, borderColor: DC.chipActiveBg },
  chipText:        { fontFamily: AppFont.regular, fontSize: DC.chipFontSize, color: DC.chipInactiveText },
  chipTextActive:  { fontFamily: AppFont.semiBold, fontSize: DC.chipFontSize, color: DC.chipActiveText },
  photoBtn:        { flexDirection: 'row', alignItems: 'center', gap: DC.modalPadding / 4, paddingHorizontal: DC.dropdownPaddingH, paddingVertical: DC.dropdownPaddingV, borderRadius: DC.cardRadius / 4, backgroundColor: DC.btnBg, borderWidth: DC.btnBorderWidth },
  photoBtnText:    { fontFamily: AppFont.medium, fontSize: DC.dropdownFontSize, color: DC.btnText },
  saveBtn:         { backgroundColor: DC.accent1, borderRadius: DC.cardRadius / 4, paddingVertical: DC.inputPaddingV + 4, alignItems: 'center' as const, marginTop: DC.cardGap / 2 },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText:     { fontFamily: AppFont.semiBold, fontSize: DC.inputFontSize + 1, color: DC.pageBg },
  suggestionChip:     { paddingHorizontal: DC.dropdownPaddingH - 4, paddingVertical: DC.dropdownPaddingV - 2, borderRadius: DC.dropdownRadius, backgroundColor: DC.cardBg, borderWidth: DC.cardBorderWidth, borderColor: DC.cardBorder },
  suggestionChipText: { fontFamily: AppFont.regular, fontSize: DC.dropdownFontSize - 1, color: DC.pageText },
});
