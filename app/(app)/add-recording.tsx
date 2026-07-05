/**
 * add-recording.tsx
 * Screen for creating or editing a recording.
 * Uses BottomSheet for the entire form.
 */

import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Switch, FlatList, Image, Alert,
  Modal, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { compressImage, uploadReceiptPhoto } from '../../src/lib/receiptUpload';
import { setPendingFocusDate } from './space-detail';

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

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_GROUPS = [
  {
    label: 'money out',
    types: [
      { key: 'expense',            label: 'expense',            color: Colors.expense, icon: 'arrow-down-outline' },
    ],
  },
  {
    label: 'money in',
    types: [
      { key: 'income',             label: 'income',             color: Colors.income,  icon: 'arrow-up-outline' },
      { key: 'savings',            label: 'savings',            color: Colors.income,  icon: 'save-outline' },
    ],
  },
  {
    label: 'loan',
    types: [
      { key: 'payable',            label: 'payable',            color: Colors.text,    icon: 'ellipsis-horizontal-outline' },
    ],
  },
  {
    label: 'receivable',
    types: [
      { key: 'receivable',         label: 'receivable',         color: Colors.text,    icon: 'arrow-undo-outline' },
      { key: 'expense_receivable', label: 'expense + receivable', color: Colors.cyan,  icon: 'git-branch-outline' },
    ],
  },
] as const;

const TYPES = TYPE_GROUPS.flatMap(g => g.types);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

// ─── Component ───────────────────────────────────────────────────────────────

export default function AddRecordingScreen({ inlineProps }: {
  inlineProps?: { spaceId: string; spaceName: string; defaultDate: string; onClose: () => void };
}) {
  const params = useLocalSearchParams<{ spaceId: string; spaceName: string; defaultDate: string; editId: string; receiptId?: string }>();
  const router = useRouter();

  const spaceId   = inlineProps?.spaceId   ?? params.spaceId;
  const spaceName = inlineProps?.spaceName ?? params.spaceName;
  const defaultDate = inlineProps?.defaultDate ?? params.defaultDate;
  const editId    = params.editId;
  const receiptId = params.receiptId;
  const handleClose = inlineProps?.onClose ?? (() => router.back());

  // ── Form state ──────────────────────────────────────────────────────────
  const [recName, setRecName]   = useState('');
  const [type, setType]         = useState<string>('expense');
  const [amount, setAmount]     = useState('');
  const [date, setDate]         = useState(defaultDate ?? new Date().toISOString().split('T')[0]);
  const [notes, setNotes]       = useState('');
  const [personName, setPersonName] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [spaceBudget, setSpaceBudget] = useState<number | null>(null);
  const [spaceSpent, setSpaceSpent] = useState<number>(0);

  // ── Recurring ────────────────────────────────────────────────────────────
  const [isRecurring, setIsRecurring]     = useState(false);
  const [frequency, setFrequency]         = useState('monthly');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringDate, setRecurringDate] = useState('1');

  // ── Loan calculator (for due/debt recurring) ─────────────────────────────
  const [loanMode, setLoanMode]           = useState<'months' | 'installment'>('months');
  const [loanMonths, setLoanMonths]       = useState('');
  const [loanInstallment, setLoanInstallment] = useState('');
  const [loanStartDate, setLoanStartDate] = useState(defaultDate ?? new Date().toISOString().split('T')[0]);
  const [loanDayOfMonth, setLoanDayOfMonth] = useState(1);
  const [loanEndDateOverride, setLoanEndDateOverride] = useState('');

  // Derived loan values
  const loanTotal = parseFloat(amount || '0') || 0;
  const computedInstallment = loanMode === 'months' && loanMonths
    ? loanTotal / parseInt(loanMonths)
    : parseFloat(loanInstallment || '0') || 0;
  const computedMonths = loanMode === 'installment' && computedInstallment > 0
    ? Math.ceil(loanTotal / computedInstallment)
    : parseInt(loanMonths || '0') || 0;
  const finalInstallment = computedMonths > 0 && loanTotal > 0
    ? loanTotal - Math.floor(loanTotal / computedInstallment) * computedInstallment > 0.01
      ? loanTotal - (computedMonths - 1) * computedInstallment
      : computedInstallment
    : 0;
  const autoEndDate = (() => {
    if (!loanStartDate || computedMonths <= 0) return '';
    const d = new Date(loanStartDate + 'T00:00:00');
    d.setMonth(d.getMonth() + computedMonths - 1);
    d.setDate(loanDayOfMonth);
    return d.toISOString().split('T')[0];
  })();
  const isLoanCalc = isRecurring && (effectiveType === 'due' || effectiveType === 'debt' || effectiveType === 'payable' || effectiveType === 'receivable');

  // ── Picker data ──────────────────────────────────────────────────────────
  const [categories, setCategories]           = useState<any[]>([]);
  const [accounts, setAccounts]               = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedAccount, setSelectedAccount]   = useState<any>(null);

  // ── Picker modals ────────────────────────────────────────────────────────
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal]   = useState(false);

  // ── Receipt photos ────────────────────────────────────────────────────────
  const [receiptPhotos, setReceiptPhotos] = useState<string[]>([]);

  // ── Receivable-specific ──────────────────────────────────────────────────
  const [decreasedFromAccount, setDecreasedFromAccount] = useState<any>(null);
  const [receiveToAccount, setReceiveToAccount]         = useState<any>(null);
  const [showDecreasedFromModal, setShowDecreasedFromModal] = useState(false);
  const [showReceiveToModal, setShowReceiveToModal]         = useState(false);
  const [linkedExpense, setLinkedExpense]               = useState<any>(null);
  const [showExpenseModal, setShowExpenseModal]         = useState(false);
  const [expenseList, setExpenseList]                   = useState<any[]>([]);

  // ── Type dropdown ─────────────────────────────────────────────────────────
  const [showTypeModal, setShowTypeModal] = useState(false);

  // ── Sub-type toggles ────────────────────────────────────────────────────
  const [expenseIsReceivable, setExpenseIsReceivable] = useState(false);
  const [incomeIsLoan, setIncomeIsLoan]               = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const effectiveType = type === 'expense' && expenseIsReceivable ? 'expense_receivable'
                      : type === 'income'  && incomeIsLoan        ? 'payable'
                      : type;
  const isLoanType   = effectiveType === 'receivable' || effectiveType === 'payable';
  const isComboType  = effectiveType === 'expense_receivable';
  const selectedType = TYPES.find(t => t.key === type)!;
  const showRecurringToggle = isLoanType || effectiveType === 'due' || effectiveType === 'debt' || effectiveType === 'expense';

  // ─── Lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
    if (receiptId) loadReceiptPhotos();
  }, []);

  // ─── Data loading ───────────────────────────────────────────────────────

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [cats, accs] = await Promise.all([
      supabase.from('categories').select().eq('user_id', user.id).order('name'),
      supabase.from('accounts').select().eq('user_id', user.id).order('account_name'),
    ]);
    if (cats.data) setCategories(cats.data);
    if (accs.data) setAccounts(accs.data);

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
        setRecName(rec.name);
        setType(rec.type);
        setAmount(String(rec.amount));
        setDate(rec.transaction_date);
        setNotes(rec.notes ?? '');
        setPersonName(rec.person_name ?? '');
        if (rec.categories) setSelectedCategory(Array.isArray(rec.categories) ? rec.categories[0] : rec.categories);
        if (rec.account) setSelectedAccount(Array.isArray(rec.account) ? rec.account[0] : rec.account);
        if (rec.is_recurring) {
          setIsRecurring(true);
          setFrequency(rec.recurring_frequency ?? 'monthly');
          setRecurringDays(rec.recurring_days ?? []);
          setRecurringDate(String(rec.recurring_date ?? 1));
        }
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

  // ─── Receipt capture ────────────────────────────────────────────────────

  const addFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setReceiptPhotos(prev => [...prev, result.assets[0].uri]);
    }
  };

  const addFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1, base64: false });
    if (!result.canceled) {
      // On web, blob: URIs get revoked after the picker closes.
      // Convert to data: URLs immediately so they survive until save.
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
      setReceiptPhotos(prev => [...prev, ...uris]);
    }
  };

  const removePhoto = (index: number) =>
    setReceiptPhotos(prev => prev.filter((_, i) => i !== index));

  // ─── Save ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!recName.trim() || !amount) { setError('name and amount are required.'); return; }
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // ── Recurring loan/due/debt → insert into recurring_records ──
      if (isRecurring && isLoanCalc && !editId) {
        if (!loanStartDate || computedMonths <= 0 || computedInstallment <= 0) {
          setError('please complete the loan calculator fields.'); setLoading(false); return;
        }
        const { error: err } = await supabase.from('recurring_records').insert({
          user_id: user!.id,
          space_id: spaceId || null,
          name: recName.trim(),
          type: effectiveType,
          total_amount: loanTotal,
          installment_amount: Math.round(computedInstallment * 100) / 100,
          months: computedMonths,
          start_date: loanStartDate,
          end_date: loanEndDateOverride || autoEndDate || null,
          day_of_month: loanDayOfMonth,
          category_id: selectedCategory?.id || null,
        });
        if (err) throw err;
        setPendingFocusDate(loanStartDate);
        handleClose();
        return;
      }

      if (editId) {
        const { error: err } = await supabase.from('recordings').update({
          name: recName.trim(), type, amount: parseFloat(amount),
          transaction_date: date, notes: notes.trim() || null,
          category_id: selectedCategory?.id || null,
          account_id: selectedAccount?.id || null,
        }).eq('id', editId);
        if (err) throw err;
      } else {
        const statusMap: Record<string, string> = {
          expense: 'paid', income: 'received', savings: 'saved',
          payable: 'unpaid', receivable: 'pending', expense_receivable: 'paid',
        };

        if (isComboType) {
          // Create expense first
          const { data: expRec, error: expErr } = await supabase.from('recordings').insert({
            space_id: spaceId, user_id: user!.id,
            name: recName.trim(), type: 'expense',
            amount: parseFloat(amount), transaction_date: date,
            notes: notes.trim() || null,
            category_id: selectedCategory?.id || null,
            account_id: selectedAccount?.id || null,
            status: 'paid',
            is_due: true,
            person_name: personName.trim() || null,
          }).select('id').single();
          if (expErr) throw expErr;
          // Create receivable linked to expense
          const { error: recErr } = await supabase.from('recordings').insert({
            space_id: spaceId, user_id: user!.id,
            name: recName.trim(), type: 'receivable',
            amount: parseFloat(amount), transaction_date: date,
            notes: notes.trim() || null,
            category_id: selectedCategory?.id || null,
            account_id: receiveToAccount?.id || null,
            status: 'pending',
            person_name: personName.trim() || null,
            linked_recording_id: expRec!.id,
          });
          if (recErr) throw recErr;
          setPendingFocusDate(date);
          handleClose();
          return;
        }
        const { data: newRec, error: err } = await supabase.from('recordings').insert({
          space_id: spaceId,
          user_id: user!.id,
          name: recName.trim(),
          type: effectiveType,
          amount: parseFloat(amount),
          transaction_date: date,
          notes: notes.trim() || null,
          category_id: selectedCategory?.id || null,
          account_id: effectiveType === 'receivable'
            ? receiveToAccount?.id || null
            : selectedAccount?.id || null,
          status: statusMap[effectiveType] ?? 'paid',
          person_name: isLoanType ? personName.trim() || null : null,
          is_recurring: isLoanType ? isRecurring : false,
          recurring_frequency: isLoanType && isRecurring ? frequency : null,
          recurring_days: isLoanType && isRecurring && frequency === 'weekly' ? recurringDays : null,
          recurring_date: isLoanType && isRecurring && ['monthly', 'yearly'].includes(frequency)
            ? parseInt(recurringDate) : null,
          linked_recording_id: effectiveType === 'receivable' && linkedExpense ? linkedExpense.id : null,
          decreased_from_account_id: effectiveType === 'receivable' ? decreasedFromAccount?.id || null : null,
          receive_to_account_id: effectiveType === 'receivable' ? receiveToAccount?.id || null : null,
        }).select('id').single();
        if (err) throw err;

        if (effectiveType === 'receivable' && decreasedFromAccount && newRec) {
          await supabase.from('recordings').insert({
            space_id: spaceId, user_id: user!.id, name: recName.trim(),
            type: 'expense', amount: parseFloat(amount), transaction_date: date,
            notes: notes.trim() || null, category_id: selectedCategory?.id || null,
            account_id: decreasedFromAccount.id, status: 'paid',
            linked_recording_id: newRec.id,
          });
        }

        // Handle receipt linkage after saving
        if (newRec?.id) {
          if (receiptId) {
            // Launched from an existing receipt — link that entry to this new recording
            await supabase.from('receipt_entries').update({ recording_id: newRec.id }).eq('id', receiptId);
          } else if (receiptPhotos.length > 0) {
            // New receipt photos were added inline — create a new entry and upload them
            const { data: { user: u } } = await supabase.auth.getUser();
            const note = recName.trim();
            const { data: entry } = await supabase.from('receipt_entries')
              .insert({ user_id: u!.id, note, recording_id: newRec.id })
              .select().single();
            if (entry?.id) {
              for (const uri of receiptPhotos) {
                const compressed = await compressImage(uri);
                await uploadReceiptPhoto(compressed, entry.id);
              }
            }
          }
        }
      }

      setPendingFocusDate(date);
      handleClose();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
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

  const toggleDay = (day: number) =>
    setRecurringDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Modal visible animationType="fade" transparent onRequestClose={handleClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={handleClose} />
      <View style={s.centeredWrap} pointerEvents="box-none">
      <View style={s.card}>
          {/* Header */}
          <View style={formStyles.header}>
            <View>
              {spaceName ? <Text style={formStyles.headerSub}>{spaceName.toLowerCase()}</Text> : null}
              <Text style={formStyles.headerTitle}>{editId ? 'edit recording' : 'new recording'}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color="#929090" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: 32, gap: 8 }} style={{ flex: 1 }}>

      {/* ── Receipt reference carousel ── */}
      {receiptPhotos.length > 0 && (
        <FlatList
          data={receiptPhotos}
          keyExtractor={(_, i) => String(i)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 12 }}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} style={s.receiptThumb} resizeMode="cover" />
          )}
        />
      )}

      {/* ── Error ── */}
      {error ? <Text style={formStyles.errorText}>{error}</Text> : null}

      {/* ── Core info block ── */}
      <FormBlock>
        <FormRow label="type">
          <TouchableOpacity style={s.typeDropRow} onPress={() => setShowTypeModal(true)} activeOpacity={0.8}>
            <View style={[s.catDot, { backgroundColor: selectedType.color + '22' }]}>
              <Ionicons name={selectedType.icon as any} size={11} color={selectedType.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {TYPE_GROUPS.find(g => g.types.some((t: any) => t.key === type))?.label}
              </Text>
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text }}>{selectedType.label}</Text>
            </View>
            <Ionicons name="chevron-down" size={13} color={Colors.faint} />
          </TouchableOpacity>
        </FormRow>
        {type === 'expense' && (
          <FormRow label="receivable?">
            <Switch value={expenseIsReceivable} onValueChange={setExpenseIsReceivable} trackColor={{ true: Colors.cyan, false: Colors.borderMid }} thumbColor={Colors.white} />
          </FormRow>
        )}
        {type === 'income' && (
          <FormRow label="is a loan?">
            <Switch value={incomeIsLoan} onValueChange={setIncomeIsLoan} trackColor={{ true: Colors.cyan, false: Colors.borderMid }} thumbColor={Colors.white} />
          </FormRow>
        )}
        <FormRow label="name">
          <TextInput
            style={s.inlineInput}
            placeholder="e.g. grocery run"
            placeholderTextColor={Colors.faint}
            value={recName}
            onChangeText={setRecName}
            autoFocus
          />
        </FormRow>
        <FormRow label="amount">
          <View style={s.amountRow}>
            <Text style={[s.amountSign, { color: selectedType.color }]}>
              {selectedType.key === 'expense' ? '-' : selectedType.key === 'payable' ? '⋯' : '+'}
            </Text>
            <TextInput
              style={s.inlineInput}
              placeholder="0.00"
              placeholderTextColor={Colors.faint}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>
        </FormRow>
        <FormRow label="date" stacked>
          <MonthPicker date={date} onChange={setDate} />
        </FormRow>
      </FormBlock>

      {/* ── Category + Account block ── */}
      <FormBlock>
        <FormRow label="category">
          <TouchableOpacity style={s.typeDropRow} onPress={() => setShowCategoryModal(true)} activeOpacity={0.8}>
            {selectedCategory ? (
              <>
                <View style={[s.catDot, { backgroundColor: selectedCategory.color }]}>
                  <Ionicons name={selectedCategory.icon} size={11} color={Colors.text} />
                </View>
                <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.text, flex: 1 }}>{selectedCategory.name}</Text>
                <TouchableOpacity onPress={() => setSelectedCategory(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={13} color={Colors.muted} />
                </TouchableOpacity>
              </>
            ) : (
              <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.faint, flex: 1 }}>optional</Text>
            )}
            <Ionicons name="chevron-down" size={13} color={Colors.faint} />
          </TouchableOpacity>
        </FormRow>
        {type !== 'receivable' && (
          <FormRow label="account">
            <TouchableOpacity style={s.typeDropRow} onPress={() => setShowAccountModal(true)} activeOpacity={0.8}>
              {selectedAccount ? (
                <>
                  <View style={[s.catDot, { backgroundColor: selectedAccount.color ?? Colors.borderMid }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.text }}>{selectedAccount.account_name}</Text>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>{selectedAccount.bank}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedAccount(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={13} color={Colors.muted} />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.faint, flex: 1 }}>optional</Text>
              )}
              <Ionicons name="chevron-down" size={13} color={Colors.faint} />
            </TouchableOpacity>
          </FormRow>
        )}
      </FormBlock>

      {/* ── Loan-type person field ── */}
      {isLoanType && (
        <FormBlock>
          <FormRow label={type === 'payable' ? 'paying' : 'owes you'}>
            <TextInput
              style={s.inlineInput}
              placeholder="e.g. john"
              placeholderTextColor={Colors.faint}
              value={personName}
              onChangeText={setPersonName}
            />
          </FormRow>
        </FormBlock>
      )}

      {/* ── Combo type extra fields ── */}
      {isComboType && (
        <FormBlock>
          <FormRow label="owes you">
            <TextInput style={s.inlineInput} placeholder="e.g. john" placeholderTextColor={Colors.faint} value={personName} onChangeText={setPersonName} />
          </FormRow>
        </FormBlock>
      )}

      {/* ── Receivable extra fields ── */}
      {type === 'receivable' && (
        <FormBlock>
          <FormRow label="linked">
            <TouchableOpacity style={s.typeDropRow} onPress={openExpensePicker} activeOpacity={0.8}>
              {linkedExpense ? (
                <>
                  <Ionicons name="receipt-outline" size={13} color={Colors.expense} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.text }}>{linkedExpense.name}</Text>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>{Number(linkedExpense.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} · {linkedExpense.transaction_date}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setLinkedExpense(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={13} color={Colors.muted} />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.faint, flex: 1 }}>link an expense (optional)</Text>
              )}
              <Ionicons name="chevron-down" size={13} color={Colors.faint} />
            </TouchableOpacity>
          </FormRow>
          <FormRow label="lent from">
            <TouchableOpacity style={s.typeDropRow} onPress={() => setShowDecreasedFromModal(true)} activeOpacity={0.8}>
              {decreasedFromAccount ? (
                <>
                  <View style={[s.catDot, { backgroundColor: decreasedFromAccount.color ?? Colors.borderMid }]} />
                  <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.text, flex: 1 }}>{decreasedFromAccount.account_name}</Text>
                  <TouchableOpacity onPress={() => setDecreasedFromAccount(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={13} color={Colors.muted} />
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.faint, flex: 1 }}>optional</Text>
              )}
              <Ionicons name="chevron-down" size={13} color={Colors.faint} />
            </TouchableOpacity>
          </FormRow>
        </FormBlock>
      )}

      {/* ── Recurring ── */}
      {showRecurringToggle && (
        <>
          <View style={s.switchRow}>
            <View>
              <Text style={s.switchLabel}>recurring</Text>
              <Text style={s.switchSub}>repeats on a schedule</Text>
            </View>
            <Switch value={isRecurring} onValueChange={v => { setIsRecurring(v); }} trackColor={{ true: Colors.cyan }} thumbColor={Colors.white} />
          </View>
          {isRecurring && isLoanCalc && (
            <FormBlock>
              {/* Mode toggle */}
              <FormRow label="mode" stacked>
                <View style={s.chipRow}>
                  {(['months', 'installment'] as const).map(m => (
                    <TouchableOpacity key={m} style={[s.chip, loanMode === m && s.chipActive]} onPress={() => setLoanMode(m)}>
                      <Text style={[s.chipText, loanMode === m && s.chipTextActive]}>
                        {m === 'months' ? 'I know the months' : 'I know the installment'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FormRow>
              {/* Months or installment input */}
              {loanMode === 'months' ? (
                <FormRow label="months">
                  <TextInput style={s.inlineInput} placeholder="e.g. 12" placeholderTextColor={Colors.faint} value={loanMonths} onChangeText={setLoanMonths} keyboardType="number-pad" />
                </FormRow>
              ) : (
                <FormRow label="monthly amount">
                  <TextInput style={s.inlineInput} placeholder="e.g. 5000" placeholderTextColor={Colors.faint} value={loanInstallment} onChangeText={setLoanInstallment} keyboardType="decimal-pad" />
                </FormRow>
              )}
              {/* Start date */}
              <FormRow label="start date" stacked>
                <MonthPicker date={loanStartDate} onChange={setLoanStartDate} />
              </FormRow>
              {/* Day of month chips */}
              <FormRow label="day of month" stacked>
                <View style={s.chipRow}>
                  {[1,5,10,15,20,25,28].map(d => (
                    <TouchableOpacity key={d} style={[s.chip, loanDayOfMonth === d && s.chipActive]} onPress={() => setLoanDayOfMonth(d)}>
                      <Text style={[s.chipText, loanDayOfMonth === d && s.chipTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FormRow>
              {/* Summary card */}
              {computedMonths > 0 && computedInstallment > 0 && (
                <View style={s.loanSummary}>
                  <View style={s.loanSummaryRow}>
                    <Text style={s.loanSummaryLabel}>monthly installment</Text>
                    <Text style={s.loanSummaryValue}>{computedInstallment.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View style={s.loanSummaryRow}>
                    <Text style={s.loanSummaryLabel}>total months</Text>
                    <Text style={s.loanSummaryValue}>{computedMonths}</Text>
                  </View>
                  {Math.abs(finalInstallment - computedInstallment) > 0.01 && (
                    <View style={s.loanSummaryRow}>
                      <Text style={s.loanSummaryLabel}>final installment</Text>
                      <Text style={[s.loanSummaryValue, { color: Colors.pending }]}>{finalInstallment.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                    </View>
                  )}
                  <View style={s.loanSummaryRow}>
                    <Text style={s.loanSummaryLabel}>estimated end date</Text>
                    <Text style={s.loanSummaryValue}>{loanEndDateOverride || autoEndDate || '—'}</Text>
                  </View>
                </View>
              )}
              {/* End date override */}
              <FormRow label="end date (override)" stacked>
                <MonthPicker date={loanEndDateOverride || autoEndDate} onChange={setLoanEndDateOverride} />
              </FormRow>
            </FormBlock>
          )}
          {isRecurring && !isLoanCalc && (
            <FormBlock>
              <FormRow label="frequency" stacked>
                <View style={s.chipRow}>
                  {FREQUENCIES.map(f => (
                    <TouchableOpacity key={f} style={[s.chip, frequency === f && s.chipActive]} onPress={() => setFrequency(f)}>
                      <Text style={[s.chipText, frequency === f && s.chipTextActive]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </FormRow>
              {frequency === 'weekly' && (
                <FormRow label="days" stacked>
                  <View style={s.chipRow}>
                    {WEEKDAYS.map((day, i) => (
                      <TouchableOpacity key={day} style={[s.chip, recurringDays.includes(i) && s.chipActive]} onPress={() => toggleDay(i)}>
                        <Text style={[s.chipText, recurringDays.includes(i) && s.chipTextActive]}>{day}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </FormRow>
              )}
              {['monthly', 'yearly'].includes(frequency) && (
                <FormRow label={frequency === 'monthly' ? 'day' : 'day #'}>
                  <TextInput
                    style={s.inlineInput}
                    placeholder={frequency === 'monthly' ? '1–31' : '1–365'}
                    placeholderTextColor={Colors.faint}
                    value={recurringDate}
                    onChangeText={setRecurringDate}
                    keyboardType="number-pad"
                  />
                </FormRow>
              )}
            </FormBlock>
          )}
        </>
      )}

      {/* ── Notes ── */}
      <FormBlock>
        <FormRow label="notes" stacked>
          <TextInput
            style={[s.inlineInput, { minHeight: 36 }]}
            placeholder="optional"
            placeholderTextColor={Colors.faint}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </FormRow>
      </FormBlock>

      {/* ── Receipt ── */}
      <View style={s.receiptRow}>
        <Text style={s.receiptLabel}>receipt</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={s.photoBtn} onPress={addFromCamera}>
            <Ionicons name="camera-outline" size={14} color={Colors.cyan} />
            <Text style={s.photoBtnText}>camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.photoBtn} onPress={addFromGallery}>
            <Ionicons name="images-outline" size={14} color={Colors.muted} />
            <Text style={[s.photoBtnText, { color: Colors.muted }]}>gallery</Text>
          </TouchableOpacity>
        </View>
      </View>
      {receiptPhotos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8 }}>
          {receiptPhotos.map((uri, i) => (
            <View key={i} style={s.photoThumbWrap}>
              <Image source={{ uri }} style={s.receiptThumb} resizeMode="cover" />
              <TouchableOpacity style={s.photoRemoveBtn} onPress={() => removePhoto(i)}>
                <Ionicons name="close-circle" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Budget indicator ── */}
      {type === 'expense' && spaceBudget && (
        (() => {
          const enteredAmt = parseFloat(amount || '0') || 0;
          const remaining = spaceBudget - spaceSpent - enteredAmt;
          const pct = Math.min((spaceSpent + enteredAmt) / spaceBudget, 1);
          const overBudget = remaining < 0;
          const barColor = overBudget ? Colors.expense : pct >= 0.8 ? Colors.pending : Colors.income;
          const fmt = (n: number) => {
            const abs = Math.abs(n);
            if (abs >= 1_000_000) return (abs / 1_000_000).toFixed(1) + 'M';
            if (abs >= 1_000) return (abs / 1_000).toFixed(1) + 'k';
            return Math.round(abs).toString();
          };
          return (
            <View style={s.budgetWrap}>
              <View style={s.budgetLabelRow}>
                <Text style={s.budgetLabel}>budget remaining</Text>
                <Text style={[s.budgetValue, overBudget && { color: Colors.expense }]}>
                  {overBudget ? `-${fmt(remaining)}` : fmt(remaining)}
                </Text>
              </View>
              <View style={s.budgetTrack}>
                <View style={[s.budgetFill, { width: `${pct * 100}%` as any, backgroundColor: barColor }]} />
              </View>
              {overBudget && <Text style={s.budgetOver}>this will exceed your budget</Text>}
            </View>
          );
        })()
      )}

      {/* ── Save button ── */}
      <TouchableOpacity
        style={[s.saveBtn, (!recName.trim() || !amount) && s.saveBtnDisabled]}
        onPress={handleSave}
        disabled={loading || !recName.trim() || !amount}
        activeOpacity={0.8}
      >
        {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={s.saveBtnText}>save recording</Text>}
      </TouchableOpacity>
      <BottomSheet visible={showTypeModal} onClose={() => setShowTypeModal(false)} sub="recording" title="select type">
        <ScrollView showsVerticalScrollIndicator={false}>
          {TYPE_GROUPS.map(group => (
            <View key={group.label} style={{ marginBottom: 16 }}>
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 9, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>{group.label}</Text>
              {group.types.map((t: any) => (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: Radius.lg, marginBottom: 6, borderWidth: 1 },
                    type === t.key
                      ? { backgroundColor: t.color + '22', borderColor: t.color }
                      : { backgroundColor: Colors.surface, borderColor: Colors.border },
                  ]}
                  onPress={() => { setType(t.key); setIsRecurring(false); setExpenseIsReceivable(false); setIncomeIsLoan(false); setShowTypeModal(false); }}
                >
                  <View style={[s.catDot, { backgroundColor: t.color + '33' }]}>
                    <Ionicons name={t.icon as any} size={13} color={t.color} />
                  </View>
                  <Text style={{ fontFamily: type === t.key ? Fonts.monoBold : Fonts.mono, fontSize: 13, color: type === t.key ? t.color : Colors.text }}>
                    {t.label}
                  </Text>
                  {type === t.key && <Ionicons name="checkmark" size={14} color={t.color} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </BottomSheet>

      {/* ── Category picker modal ── */}
      <BottomSheet visible={showCategoryModal} onClose={() => setShowCategoryModal(false)} sub="recording" title="category">
        <SearchableList
          items={categories} selected={selectedCategory}
          onSelect={c => { setSelectedCategory(c); setShowCategoryModal(false); }}
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

      {/* ── Account picker modal ── */}
      <BottomSheet visible={showAccountModal} onClose={() => setShowAccountModal(false)} sub="recording" title="account">
        <SearchableList
          items={accounts} selected={selectedAccount}
          onSelect={a => { setSelectedAccount(a); setShowAccountModal(false); }}
          keyExtractor={a => a.id} labelExtractor={a => a.account_name}
          subLabelExtractor={a => `${a.bank} · ${a.account_number}`}
          renderLeft={(a) => <View style={[s.catDot, { backgroundColor: a.color ?? Colors.borderMid }]} />}
          emptyText="no accounts found"
        />
        <FormActions onCancel={() => setShowAccountModal(false)} onConfirm={() => setShowAccountModal(false)} cancelLabel="cancel" confirmLabel="done" />
      </BottomSheet>

      {/* ── Decreased from modal ── */}
      <BottomSheet visible={showDecreasedFromModal} onClose={() => setShowDecreasedFromModal(false)} sub="receivable" title="decreased from">
        <SearchableList
          items={accounts} selected={decreasedFromAccount}
          onSelect={a => { setDecreasedFromAccount(a); setShowDecreasedFromModal(false); }}
          keyExtractor={a => a.id} labelExtractor={a => a.account_name}
          subLabelExtractor={a => `${a.bank} · ${a.account_number}`}
          renderLeft={(a) => <View style={[s.catDot, { backgroundColor: a.color ?? Colors.borderMid }]} />}
          emptyText="no accounts found"
        />
        <FormActions onCancel={() => setShowDecreasedFromModal(false)} onConfirm={() => setShowDecreasedFromModal(false)} cancelLabel="cancel" confirmLabel="done" />
      </BottomSheet>

      {/* ── Receive to modal ── */}
      <BottomSheet visible={showReceiveToModal} onClose={() => setShowReceiveToModal(false)} sub="receivable" title="expecting to receive in">
        <SearchableList
          items={accounts} selected={receiveToAccount}
          onSelect={a => { setReceiveToAccount(a); setShowReceiveToModal(false); }}
          keyExtractor={a => a.id} labelExtractor={a => a.account_name}
          subLabelExtractor={a => `${a.bank} · ${a.account_number}`}
          renderLeft={(a) => <View style={[s.catDot, { backgroundColor: a.color ?? Colors.borderMid }]} />}
          emptyText="no accounts found"
        />
        <FormActions onCancel={() => setShowReceiveToModal(false)} onConfirm={() => setShowReceiveToModal(false)} cancelLabel="cancel" confirmLabel="done" />
      </BottomSheet>

      {/* ── Expense picker modal ── */}
      <BottomSheet visible={showExpenseModal} onClose={() => setShowExpenseModal(false)} sub="receivable" title="link to expense">
        <SearchableList
          items={expenseList}
          selected={linkedExpense}
          onSelect={e => {
            setLinkedExpense(e);
            if (!recName.trim()) setRecName(e.name);
            if (!amount) setAmount(String(e.amount));
            setShowExpenseModal(false);
          }}
          keyExtractor={e => e.id}
          labelExtractor={e => e.name}
          subLabelExtractor={e => `${Number(e.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} · ${e.transaction_date}`}
          renderLeft={() => <Ionicons name="receipt-outline" size={14} color={Colors.expense} />}
          emptyText="no expenses found"
        />
        <FormActions onCancel={() => setShowExpenseModal(false)} onConfirm={() => setShowExpenseModal(false)} cancelLabel="cancel" confirmLabel="done" />
      </BottomSheet>

      </ScrollView>
      </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  centeredWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    pointerEvents: 'box-none',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    paddingBottom: 0,
  },
  photoThumbWrap:  { position: 'relative', marginRight: 8 },
  photoRemoveBtn:  { position: 'absolute', top: -6, right: -6, backgroundColor: Colors.white, borderRadius: 99 },
  receiptThumb:    { width: 64, height: 64, borderRadius: Radius.md },
  typeDropRow:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoBlockSpaced: { marginTop: 0 },
  inlineInput:     { flex: 1, fontFamily: Fonts.mono, fontSize: 16, color: Colors.text, padding: 0 },
  amountRow:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  amountSign:      { fontFamily: Fonts.monoBold, fontSize: 16 },
  catDot:          { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, marginTop: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  switchLabel:     { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text },
  switchSub:       { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  chipRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:            { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  chipActive:      { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  chipText:        { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  chipTextActive:  { color: Colors.white, fontFamily: Fonts.monoBold },
  receiptRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  receiptLabel:    { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  photoBtn:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  photoBtnText:    { fontFamily: Fonts.mono, fontSize: 11, color: Colors.cyan },
  saveBtn:         { backgroundColor: Colors.cyan, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:     { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  budgetWrap:      { gap: 6, padding: 14, backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginTop: 10 },
  budgetLabelRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetLabel:     { fontFamily: 'ChillaxRegular', fontSize: 11, color: Colors.muted, letterSpacing: 0.3 },
  budgetValue:     { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.text, letterSpacing: 0.2 },
  budgetTrack:     { height: 6, backgroundColor: Colors.border, borderRadius: Radius.pill, overflow: 'hidden' },
  budgetFill:      { height: '100%', borderRadius: Radius.pill },
  budgetOver:      { fontFamily: Fonts.mono, fontSize: 10, color: Colors.expense, letterSpacing: 0.2 },
  loanSummary:     { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 12, gap: 8, marginTop: 8, borderWidth: 1, borderColor: Colors.borderMid },
  loanSummaryRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loanSummaryLabel:{ fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  loanSummaryValue:{ fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text },
});

