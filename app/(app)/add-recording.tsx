/**
 * add-recording.tsx
 * Screen for creating or editing a recording.
 * Uses the shared UI design system for consistent form appearance.
 */

import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, ActivityIndicator, Switch, Animated, Dimensions,
  FlatList, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
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

// ─── Constants ───────────────────────────────────────────────────────────────

const { width } = Dimensions.get('window');

const TYPES = [
  { key: 'expense',    label: 'expense',    color: Colors.expense, icon: 'arrow-down-outline' },
  { key: 'income',     label: 'income',     color: Colors.income,  icon: 'arrow-up-outline' },
  { key: 'savings',    label: 'savings',    color: Colors.income,  icon: 'save-outline' },
  { key: 'receivable', label: 'receivable', color: Colors.text,    icon: 'arrow-undo-outline' },
  { key: 'payable',    label: 'payable',    color: Colors.text,    icon: 'ellipsis-horizontal-outline' },
] as const;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

// ─── Component ───────────────────────────────────────────────────────────────

export default function AddRecordingScreen() {
  const { spaceId, spaceName, defaultDate, editId, receiptId } =
    useLocalSearchParams<{ spaceId: string; spaceName: string; defaultDate: string; editId: string; receiptId?: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  // ── Form state ──────────────────────────────────────────────────────────
  const [recName, setRecName]   = useState('');
  const [type, setType]         = useState<string>('expense');
  const [amount, setAmount]     = useState('');
  const [date, setDate]         = useState(defaultDate ?? new Date().toISOString().split('T')[0]);
  const [notes, setNotes]       = useState('');
  const [personName, setPersonName] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // ── Recurring ────────────────────────────────────────────────────────────
  const [isRecurring, setIsRecurring]       = useState(false);
  const [frequency, setFrequency]           = useState('monthly');
  const [recurringDays, setRecurringDays]   = useState<number[]>([]);
  const [recurringDate, setRecurringDate]   = useState('1');

  // ── Picker data ──────────────────────────────────────────────────────────
  const [categories, setCategories]         = useState<any[]>([]);
  const [accounts, setAccounts]             = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedAccount, setSelectedAccount]   = useState<any>(null);

  // ── Picker modals ────────────────────────────────────────────────────────
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal]   = useState(false);

  // ── Receipt ──────────────────────────────────────────────────────────────
  const [receiptPhotos, setReceiptPhotos]         = useState<string[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [selectedReceiptNote, setSelectedReceiptNote] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal]   = useState(false);
  const [unlinkedReceipts, setUnlinkedReceipts]   = useState<any[]>([]);

  // ── Receivable-specific ──────────────────────────────────────────────────
  const [decreasedFromAccount, setDecreasedFromAccount] = useState<any>(null);
  const [receiveToAccount, setReceiveToAccount]         = useState<any>(null);
  const [showDecreasedFromModal, setShowDecreasedFromModal] = useState(false);
  const [showReceiveToModal, setShowReceiveToModal]         = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const isLoanType   = type === 'receivable' || type === 'payable';
  const selectedType = TYPES.find(t => t.key === type)!;

  // ─── Lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
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
        if (rec.categories) setSelectedCategory(rec.categories);
        if (rec.account) setSelectedAccount(rec.account);
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
    const { data } = await supabase.from('receipt_photos').select('storage_path').eq('receipt_id', receiptId);
    if (data) {
      const urls = await Promise.all(data.map(async (p: any) => {
        const { data: signed } = await supabase.storage.from('receipt_entries').createSignedUrl(p.storage_path, 3600);
        return signed?.signedUrl ?? '';
      }));
      setReceiptPhotos(urls.filter(Boolean));
    }
  };

  const openReceiptModal = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('receipt_entries')
      .select('id, note, created_at')
      .eq('user_id', user.id)
      .is('recording_id', null)
      .order('created_at', { ascending: false });
    setUnlinkedReceipts(data ?? []);
    setShowReceiptModal(true);
  };

  // ─── Save ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!recName.trim() || !amount) { setError('name and amount are required.'); return; }
    if (type === 'receivable' && decreasedFromAccount && !decreasedFromAccount.id) {
      setError('invalid decreased from account.'); return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();

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
          payable: 'unpaid', receivable: 'pending',
        };
        const { data: newRec, error: err } = await supabase.from('recordings').insert({
          space_id: spaceId,
          user_id: user!.id,
          name: recName.trim(),
          type,
          amount: parseFloat(amount),
          transaction_date: date,
          notes: notes.trim() || null,
          category_id: selectedCategory?.id || null,
          account_id: type === 'receivable'
            ? receiveToAccount?.id || null
            : selectedAccount?.id || null,
          status: statusMap[type] ?? 'paid',
          person_name: isLoanType ? personName.trim() || null : null,
          is_recurring: isLoanType ? isRecurring : false,
          recurring_frequency: isLoanType && isRecurring ? frequency : null,
          recurring_days: isLoanType && isRecurring && frequency === 'weekly' ? recurringDays : null,
          recurring_date: isLoanType && isRecurring && ['monthly', 'yearly'].includes(frequency)
            ? parseInt(recurringDate) : null,
          decreased_from_account_id: type === 'receivable' ? decreasedFromAccount?.id || null : null,
          receive_to_account_id: type === 'receivable' ? receiveToAccount?.id || null : null,
        }).select('id').single();
        if (err) throw err;

        // Auto-create linked expense for receivable when decreased_from is set
        if (type === 'receivable' && decreasedFromAccount && newRec) {
          await supabase.from('recordings').insert({
            space_id: spaceId,
            user_id: user!.id,
            name: recName.trim(),
            type: 'expense',
            amount: parseFloat(amount),
            transaction_date: date,
            notes: notes.trim() || null,
            category_id: selectedCategory?.id || null,
            account_id: decreasedFromAccount.id,
            status: 'paid',
            linked_recording_id: newRec.id,
          });
        }
      }

      // Link receipt
      if (receiptId) {
        const { data: savedRec } = await supabase.from('recordings').select('id')
          .order('created_at', { ascending: false }).limit(1).single();
        if (savedRec) await supabase.from('receipt_entries').update({ recording_id: savedRec.id }).eq('id', receiptId);
      } else if (!editId && selectedReceiptId) {
        const { data: savedRec } = await supabase.from('recordings').select('id')
          .order('created_at', { ascending: false }).limit(1).single();
        if (savedRec) await supabase.from('receipt_entries').update({ recording_id: savedRec.id }).eq('id', selectedReceiptId);
      }

      setPendingFocusDate(date);
      handleBack();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  // ─── Navigation ─────────────────────────────────────────────────────────

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: true })
      .start(() => router.back());
  };

  const toggleDay = (day: number) =>
    setRecurringDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Animated.View style={[s.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={s.inner}>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.muted} />
          </TouchableOpacity>
          <View>
            <Text style={s.headerSub}>{spaceName?.toLowerCase() ?? ''}</Text>
            <Text style={s.headerTitle}>{editId ? 'edit recording' : 'new recording'}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Receipt reference carousel ── */}
          {receiptPhotos.length > 0 && (
            <View style={s.receiptCarousel}>
              <Text style={s.receiptCarouselLabel}>receipt reference</Text>
              <FlatList
                data={receiptPhotos}
                keyExtractor={(_, i) => String(i)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={s.receiptThumb} resizeMode="cover" />
                )}
              />
            </View>
          )}

          {/* ── Error ── */}
          {error ? <Text style={s.error}>{error}</Text> : null}

          {/* ── Type selector ── */}
          <FormLabel>type</FormLabel>
          <View style={s.typeRow}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[s.typeBtn, type === t.key && { backgroundColor: t.color, borderColor: t.color }]}
                onPress={() => { setType(t.key); setIsRecurring(false); }}
              >
                <Ionicons name={t.icon as any} size={12} color={type === t.key ? Colors.white : Colors.muted} />
                <Text style={[s.typeBtnText, type === t.key && { color: Colors.white, fontFamily: Fonts.monoBold }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Core info block ── */}
          <FormBlock style={s.infoBlockSpaced}>
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

          {/* ── Category picker ── */}
          <FormLabel optional>category</FormLabel>
          <SelectorButton
            placeholder="select category"
            onPress={() => setShowCategoryModal(true)}
            hasValue={!!selectedCategory}
            onClear={() => setSelectedCategory(null)}
          >
            {selectedCategory && (
              <View style={s.selectedItem}>
                <View style={[s.catDot, { backgroundColor: selectedCategory.color }]}>
                  <Ionicons name={selectedCategory.icon} size={11} color={Colors.text} />
                </View>
                <Text style={s.selectedItemText}>{selectedCategory.name}</Text>
              </View>
            )}
          </SelectorButton>

          {/* ── Account picker (hidden for receivable) ── */}
          {type !== 'receivable' && (
            <>
              <FormLabel optional>account</FormLabel>
              <SelectorButton
                placeholder="select account"
                onPress={() => setShowAccountModal(true)}
                hasValue={!!selectedAccount}
                onClear={() => setSelectedAccount(null)}
              >
                {selectedAccount && (
                  <View style={s.selectedItem}>
                    <View style={[s.catDot, { backgroundColor: selectedAccount.color ?? Colors.borderMid }]} />
                    <View>
                      <Text style={s.selectedItemText}>{selectedAccount.account_name}</Text>
                      <Text style={s.selectedItemSub}>{selectedAccount.bank}</Text>
                    </View>
                  </View>
                )}
              </SelectorButton>
            </>
          )}

          {/* ── Notes ── */}
          <FormLabel optional>notes</FormLabel>
          <FormInput
            placeholder="add a note..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          {/* ── Loan-type person field ── */}
          {isLoanType && (
            <>
              <FormLabel optional>
                {type === 'payable' ? 'who are you paying?' : 'who owes you?'}
              </FormLabel>
              <FormInput
                placeholder="e.g. john"
                value={personName}
                onChangeText={setPersonName}
              />
            </>
          )}

          {/* ── Receivable: decreased from + receive to ── */}
          {type === 'receivable' && (
            <>
              <FormLabel optional>decreased from (where you lent from)</FormLabel>
              <SelectorButton
                placeholder="select account"
                onPress={() => setShowDecreasedFromModal(true)}
                hasValue={!!decreasedFromAccount}
                onClear={() => setDecreasedFromAccount(null)}
              >
                {decreasedFromAccount && (
                  <View style={s.selectedItem}>
                    <View style={[s.catDot, { backgroundColor: decreasedFromAccount.color ?? Colors.borderMid }]} />
                    <View>
                      <Text style={s.selectedItemText}>{decreasedFromAccount.account_name}</Text>
                      <Text style={s.selectedItemSub}>{decreasedFromAccount.bank}</Text>
                    </View>
                  </View>
                )}
              </SelectorButton>
              {decreasedFromAccount && (
                <Text style={s.hint}>a linked expense will be created automatically</Text>
              )}

              <FormLabel optional>expecting to receive in</FormLabel>
              <SelectorButton
                placeholder="select account"
                onPress={() => setShowReceiveToModal(true)}
                hasValue={!!receiveToAccount}
                onClear={() => setReceiveToAccount(null)}
              >
                {receiveToAccount && (
                  <View style={s.selectedItem}>
                    <View style={[s.catDot, { backgroundColor: receiveToAccount.color ?? Colors.borderMid }]} />
                    <View>
                      <Text style={s.selectedItemText}>{receiveToAccount.account_name}</Text>
                      <Text style={s.selectedItemSub}>{receiveToAccount.bank}</Text>
                    </View>
                  </View>
                )}
              </SelectorButton>
            </>
          )}

          {/* ── Recurring ── */}
          {isLoanType && (
            <>
              <View style={s.switchRow}>
                <View>
                  <Text style={s.switchLabel}>recurring?</Text>
                  <Text style={s.switchSub}>does this repeat on a schedule?</Text>
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={setIsRecurring}
                  trackColor={{ true: Colors.cyan }}
                  thumbColor={Colors.white}
                />
              </View>
              {isRecurring && (
                <>
                  <FormLabel>frequency</FormLabel>
                  <View style={s.chipRow}>
                    {FREQUENCIES.map(f => (
                      <TouchableOpacity
                        key={f}
                        style={[s.chip, frequency === f && s.chipActive]}
                        onPress={() => setFrequency(f)}
                      >
                        <Text style={[s.chipText, frequency === f && s.chipTextActive]}>{f}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {frequency === 'weekly' && (
                    <>
                      <FormLabel>choose days</FormLabel>
                      <View style={s.chipRow}>
                        {WEEKDAYS.map((day, i) => (
                          <TouchableOpacity
                            key={day}
                            style={[s.chip, recurringDays.includes(i) && s.chipActive]}
                            onPress={() => toggleDay(i)}
                          >
                            <Text style={[s.chipText, recurringDays.includes(i) && s.chipTextActive]}>{day}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  {['monthly', 'yearly'].includes(frequency) && (
                    <>
                      <FormLabel>day of {frequency === 'monthly' ? 'month' : 'year'}</FormLabel>
                      <FormInput
                        placeholder={frequency === 'monthly' ? '1-31' : '1-365'}
                        value={recurringDate}
                        onChangeText={setRecurringDate}
                        keyboardType="number-pad"
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Receipt link ── */}
          <FormLabel optional>receipt</FormLabel>
          <SelectorButton
            placeholder="link a receipt"
            onPress={() => selectedReceiptId ? setSelectedReceiptId(null) : openReceiptModal()}
            hasValue={!!selectedReceiptId}
            onClear={() => setSelectedReceiptId(null)}
          >
            {selectedReceiptId && (
              <View style={s.selectedItem}>
                <Ionicons name="folder-outline" size={16} color={Colors.cyan} />
                <Text style={s.selectedItemText}>{selectedReceiptNote ?? 'receipt linked'}</Text>
              </View>
            )}
          </SelectorButton>

          {/* ── Save button ── */}
          <TouchableOpacity
            style={[s.saveBtn, (!recName.trim() || !amount) && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={loading || !recName.trim() || !amount}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.saveBtnText}>save recording</Text>}
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>

      {/* ── Category picker modal ── */}
      <BottomSheet
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        sub="recording"
        title="category"
        scrollable={false}
      >
        <SearchableList
          items={categories}
          selected={selectedCategory}
          onSelect={c => { setSelectedCategory(c); setShowCategoryModal(false); }}
          keyExtractor={c => c.id}
          labelExtractor={c => c.name}
          renderLeft={(c, sel) => (
            <View style={[s.catDot, { backgroundColor: c.color }]}>
              <Ionicons name={c.icon} size={11} color={Colors.text} />
            </View>
          )}
          emptyText="no categories found"
        />
        <FormActions
          onCancel={() => setShowCategoryModal(false)}
          onConfirm={() => setShowCategoryModal(false)}
          cancelLabel="cancel"
          confirmLabel="done"
        />
      </BottomSheet>

      {/* ── Account picker modal ── */}
      <BottomSheet
        visible={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        sub="recording"
        title="account"
        scrollable={false}
      >
        <SearchableList
          items={accounts}
          selected={selectedAccount}
          onSelect={a => { setSelectedAccount(a); setShowAccountModal(false); }}
          keyExtractor={a => a.id}
          labelExtractor={a => a.account_name}
          subLabelExtractor={a => `${a.bank} · ${a.account_number}`}
          renderLeft={(a, sel) => (
            <View style={[s.catDot, { backgroundColor: a.color ?? Colors.borderMid }]} />
          )}
          emptyText="no accounts found"
        />
        <FormActions
          onCancel={() => setShowAccountModal(false)}
          onConfirm={() => setShowAccountModal(false)}
          cancelLabel="cancel"
          confirmLabel="done"
        />
      </BottomSheet>

      {/* ── Decreased from modal ── */}
      <BottomSheet
        visible={showDecreasedFromModal}
        onClose={() => setShowDecreasedFromModal(false)}
        sub="receivable"
        title="decreased from"
        scrollable={false}
      >
        <SearchableList
          items={accounts}
          selected={decreasedFromAccount}
          onSelect={a => { setDecreasedFromAccount(a); setShowDecreasedFromModal(false); }}
          keyExtractor={a => a.id}
          labelExtractor={a => a.account_name}
          subLabelExtractor={a => `${a.bank} · ${a.account_number}`}
          renderLeft={(a) => (
            <View style={[s.catDot, { backgroundColor: a.color ?? Colors.borderMid }]} />
          )}
          emptyText="no accounts found"
        />
        <FormActions
          onCancel={() => setShowDecreasedFromModal(false)}
          onConfirm={() => setShowDecreasedFromModal(false)}
          cancelLabel="cancel"
          confirmLabel="done"
        />
      </BottomSheet>

      {/* ── Receive to modal ── */}
      <BottomSheet
        visible={showReceiveToModal}
        onClose={() => setShowReceiveToModal(false)}
        sub="receivable"
        title="expecting to receive in"
        scrollable={false}
      >
        <SearchableList
          items={accounts}
          selected={receiveToAccount}
          onSelect={a => { setReceiveToAccount(a); setShowReceiveToModal(false); }}
          keyExtractor={a => a.id}
          labelExtractor={a => a.account_name}
          subLabelExtractor={a => `${a.bank} · ${a.account_number}`}
          renderLeft={(a) => (
            <View style={[s.catDot, { backgroundColor: a.color ?? Colors.borderMid }]} />
          )}
          emptyText="no accounts found"
        />
        <FormActions
          onCancel={() => setShowReceiveToModal(false)}
          onConfirm={() => setShowReceiveToModal(false)}
          cancelLabel="cancel"
          confirmLabel="done"
        />
      </BottomSheet>

      {/* ── Receipt picker modal ── */}
      <BottomSheet
        visible={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        sub="recording"
        title="link a receipt"
        scrollable={false}
      >
        <SearchableList
          items={unlinkedReceipts}
          selected={selectedReceiptId ? { id: selectedReceiptId } as any : null}
          onSelect={r => { setSelectedReceiptId(r.id); setSelectedReceiptNote(r.note ?? 'untitled'); setShowReceiptModal(false); }}
          keyExtractor={r => r.id}
          labelExtractor={r => r.note ?? 'untitled'}
          subLabelExtractor={r => new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          renderLeft={(r, sel) => (
            <Ionicons name="folder-outline" size={16} color={sel ? Colors.white : Colors.cyan} />
          )}
          emptyText="no unlinked receipts found"
        />
        <FormActions
          onCancel={() => setShowReceiptModal(false)}
          onConfirm={() => setShowReceiptModal(false)}
          cancelLabel="cancel"
          confirmLabel="done"
        />
      </BottomSheet>

    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  inner: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 2 },
  headerSub: { fontFamily: Fonts.heading, fontSize: 10, color: Colors.muted },
  headerTitle: { fontFamily: Fonts.display, fontSize: 22, color: Colors.cyan, letterSpacing: -0.5, lineHeight: 26 },

  // Body
  body: {
    paddingHorizontal: Spacing.page,
    paddingTop: Spacing.xl,
    paddingBottom: 60,
    gap: 4,
  },

  // Receipt carousel
  receiptCarousel: { marginBottom: 8 },
  receiptCarouselLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  receiptThumb: { width: 80, height: 80, borderRadius: Radius.md },

  // Error
  error: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.danger, marginBottom: 8 },

  // Type selector
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.surface,
  },
  typeBtnText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },

  // Info block with extra top margin
  infoBlockSpaced: { marginTop: 20 },

  // Inline inputs inside FormRow
  inlineInput: {
    flex: 1,
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  amountRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  amountSign: { fontFamily: Fonts.monoBold, fontSize: 16 },

  // Selected item display inside SelectorButton
  selectedItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedItemText: { fontFamily: Fonts.mono, fontSize: 16, color: Colors.text },
  selectedItemSub: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 1 },

  // Category dot
  catDot: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },

  // Hint text
  hint: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.cyan, marginTop: 4 },

  // Recurring
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchLabel: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text },
  switchSub: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  chipText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  chipTextActive: { color: Colors.white, fontFamily: Fonts.monoBold },

  // Save button
  saveBtn: {
    backgroundColor: Colors.text,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.white },
});
