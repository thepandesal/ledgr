import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, ActivityIndicator, Switch, Animated, Dimensions, Modal, FlatList, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { BlurView } from 'expo-blur';
import { setPendingFocusDate } from './space-detail';

const { width } = Dimensions.get('window');

const TYPES = [
  { key: 'expense',    label: 'expense',    color: '#ed6a6a', icon: 'arrow-down-outline' },
  { key: 'income',     label: 'income',     color: '#2ab671', icon: 'arrow-up-outline' },
  { key: 'savings',    label: 'savings',    color: '#2ab671', icon: 'save-outline' },
  { key: 'receivable', label: 'receivable', color: '#425252', icon: 'arrow-undo-outline' },
  { key: 'payable',    label: 'payable',    color: '#425252', icon: 'ellipsis-horizontal-outline' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

export default function AddRecordingScreen() {
  const { spaceId, spaceName, defaultDate, editId, receiptId } = useLocalSearchParams<{ spaceId: string; spaceName: string; defaultDate: string; editId: string; receiptId?: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  const [recName, setRecName] = useState('');
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateInputVal, setDateInputVal] = useState('');

  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const parsedDate = date ? date.split('-') : ['', '', ''];
  const [pickerMonth, setPickerMonth] = useState(parseInt(parsedDate[1] ?? '1') - 1);
  const [pickerDay, setPickerDay] = useState(parsedDate[2] ?? '');
  const [pickerYear, setPickerYear] = useState(parsedDate[0] ?? '');

  const applyDate = (m: number, d: string, y: string) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    if (y.length === 4 && parseInt(d) > 0 && parseInt(d) <= 31) setDate(`${y}-${mm}-${dd}`);
  };
  const [notes, setNotes] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringDate, setRecurringDate] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [personName, setPersonName] = useState('');
  const [receiptPhotos, setReceiptPhotos] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [accountSearch, setAccountSearch] = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [selectedReceiptNote, setSelectedReceiptNote] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [unlinkedReceipts, setUnlinkedReceipts] = useState<any[]>([]);
  // Receivable-specific
  const [decreasedFromAccount, setDecreasedFromAccount] = useState<any>(null);
  const [receiveToAccount, setReceiveToAccount] = useState<any>(null);
  const [showDecreasedFromModal, setShowDecreasedFromModal] = useState(false);
  const [showReceiveToModal, setShowReceiveToModal] = useState(false);
  const [decreasedSearch, setDecreasedSearch] = useState('');
  const [receiveToSearch, setReceiveToSearch] = useState('');

  const filteredDecreased = decreasedSearch.trim()
    ? accounts.filter(a => a.account_name.toLowerCase().includes(decreasedSearch.toLowerCase()))
    : accounts;
  const filteredReceiveTo = receiveToSearch.trim()
    ? accounts.filter(a => a.account_name.toLowerCase().includes(receiveToSearch.toLowerCase()))
    : accounts;

  const isLoanType = type === 'receivable' || type === 'payable';
  const selectedType = TYPES.find(t => t.key === type)!;

  const filteredCategories = categorySearch.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
    : categories;

  const filteredAccounts = accountSearch.trim()
    ? accounts.filter(a => a.account_name.toLowerCase().includes(accountSearch.toLowerCase()))
    : accounts;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    loadData();
    if (receiptId) loadReceiptPhotos();
  }, []);

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
        setRecName(rec.name); setType(rec.type); setAmount(String(rec.amount));
        setDate(rec.transaction_date); setNotes(rec.notes ?? '');
        setPersonName(rec.person_name ?? '');
        const dp = rec.transaction_date.split('-');
        setPickerMonth(parseInt(dp[1]) - 1);
        setPickerDay(dp[2]);
        setPickerYear(dp[0]);
        if (rec.categories) setSelectedCategory(rec.categories);
        if (rec.account) setSelectedAccount(rec.account);
        if (rec.is_recurring) {
          setIsRecurring(true); setFrequency(rec.recurring_frequency ?? 'monthly');
          setRecurringDays(rec.recurring_days ?? []); setRecurringDate(String(rec.recurring_date ?? 1));
        }
      }
    }
  };

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: true }).start(() => router.back());
  };

  const handleSave = async () => {
    if (!recName.trim() || !amount) { setError('name and amount are required.'); return; }
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (editId) {
        const { error: err } = await supabase.from('recordings').update({
          name: recName.trim(), type, amount: parseFloat(amount),
          transaction_date: date, notes: notes.trim() || null,
          category_id: selectedCategory?.id || null, account_id: selectedAccount?.id || null,
        }).eq('id', editId);
        if (err) throw err;
      } else {
        const statusMap: Record<string, string> = {
          expense: 'paid', income: 'received', savings: 'saved', payable: 'unpaid', receivable: 'pending',
        };
        const { data: newRec, error: err } = await supabase.from('recordings').insert({
          space_id: spaceId, user_id: user!.id, name: recName.trim(), type,
          amount: parseFloat(amount), transaction_date: date,
          notes: notes.trim() || null, category_id: selectedCategory?.id || null,
          account_id: type === 'receivable' ? receiveToAccount?.id || null : selectedAccount?.id || null,
          status: statusMap[type] ?? 'paid',
          person_name: isLoanType ? personName.trim() || null : null,
          is_recurring: isLoanType ? isRecurring : false,
          recurring_frequency: isLoanType && isRecurring ? frequency : null,
          recurring_days: isLoanType && isRecurring && frequency === 'weekly' ? recurringDays : null,
          recurring_date: isLoanType && isRecurring && ['monthly', 'yearly'].includes(frequency) ? parseInt(recurringDate) : null,
          decreased_from_account_id: type === 'receivable' ? decreasedFromAccount?.id || null : null,
          receive_to_account_id: type === 'receivable' ? receiveToAccount?.id || null : null,
        }).select('id').single();
        if (err) throw err;
        // Auto-create linked expense for receivable if decreased_from is set
        if (type === 'receivable' && decreasedFromAccount && newRec) {
          await supabase.from('recordings').insert({
            space_id: spaceId, user_id: user!.id, name: recName.trim(), type: 'expense',
            amount: parseFloat(amount), transaction_date: date,
            notes: notes.trim() || null, category_id: selectedCategory?.id || null,
            account_id: decreasedFromAccount?.id || null,
            status: 'paid',
            linked_recording_id: newRec.id,
          });
        }
      }
      if (receiptId) {
        const { data: savedRec } = await supabase.from('recordings').select('id').order('created_at', { ascending: false }).limit(1).single();
        if (savedRec) await supabase.from('receipt_entries').update({ recording_id: savedRec.id }).eq('id', receiptId);
      } else if (!editId && selectedReceiptId) {
        const { data: savedRec } = await supabase.from('recordings').select('id').order('created_at', { ascending: false }).limit(1).single();
        if (savedRec) await supabase.from('receipt_entries').update({ recording_id: savedRec.id }).eq('id', selectedReceiptId);
      }
      setPendingFocusDate(date);
      handleBack();
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  const openReceiptModal = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('receipt_entries').select('id, note, created_at').eq('user_id', user.id).is('recording_id', null).order('created_at', { ascending: false });
    setUnlinkedReceipts(data ?? []);
    setShowReceiptModal(true);
  };

  const toggleDay = (day: number) => setRecurringDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#8a8a8a" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerSub}>{spaceName?.toLowerCase() ?? ''}</Text>
            <Text style={styles.headerTitle}>{editId ? 'edit recording' : 'new recording'}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {receiptPhotos.length > 0 && (
            <View style={styles.receiptCarousel}>
              <Text style={styles.receiptCarouselLabel}>receipt reference</Text>
              <FlatList
                data={receiptPhotos}
                keyExtractor={(_, i) => String(i)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={styles.receiptThumb} resizeMode="cover" />
                )}
              />
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Type selector */}
          <Text style={styles.label}>type</Text>
          <View style={styles.typeRow}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeBtn, type === t.key && { backgroundColor: t.color, borderColor: t.color }]}
                onPress={() => { setType(t.key); setIsRecurring(false); }}
              >
                <Ionicons name={t.icon as any} size={12} color={type === t.key ? '#fff' : '#929090'} />
                <Text style={[styles.typeBtnText, type === t.key && { color: '#fff', fontFamily: 'RobotoMono_700Bold' }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info block */}
          <View style={[styles.infoBlock, { marginTop: 20 }]}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>name</Text>
              <TextInput
                style={styles.infoInput}
                placeholder="e.g. grocery run"
                placeholderTextColor="#c0c0c0"
                value={recName}
                onChangeText={setRecName}
                autoFocus
              />
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>amount</Text>
              <View style={styles.amountRow}>
                <Text style={[styles.amountSign, { color: selectedType.color }]}>
                  {selectedType.key === 'expense' ? '-' : selectedType.key === 'payable' ? '⋯' : '+'}
                </Text>
                <TextInput
                  style={styles.infoInput}
                  placeholder="0.00"
                  placeholderTextColor="#c0c0c0"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={styles.infoDivider} />
            <View style={[styles.infoRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 8, paddingVertical: 12 }]}>
              <Text style={styles.infoLabel}>date</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: '100%' }}>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.typeBtn, pickerMonth === i && { backgroundColor: '#0ccfcf', borderColor: '#0ccfcf' }]}
                    onPress={() => { setPickerMonth(i); applyDate(i, pickerDay, pickerYear); }}
                  >
                    <Text style={[styles.typeBtnText, pickerMonth === i && { color: '#fff', fontFamily: 'RobotoMono_700Bold' }]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                <TextInput
                  style={[styles.infoInput, { backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#f0f0f0', width: 60 }]}
                  placeholder="dd"
                  placeholderTextColor="#c0c0c0"
                  value={pickerDay}
                  onChangeText={v => { setPickerDay(v); applyDate(pickerMonth, v, pickerYear); }}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <TextInput
                  style={[styles.infoInput, { backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#f0f0f0', width: 80 }]}
                  placeholder="yyyy"
                  placeholderTextColor="#c0c0c0"
                  value={pickerYear}
                  onChangeText={v => { setPickerYear(v); applyDate(pickerMonth, pickerDay, v); }}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>
          </View>

          {/* Category */}
          <Text style={styles.label}>category <Text style={styles.optional}>(optional)</Text></Text>
          <TouchableOpacity style={styles.pickerSelector} onPress={() => { setCategorySearch(''); setShowCategoryModal(true); }}>
            {selectedCategory ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={[styles.catDot, { backgroundColor: selectedCategory.color }]}>
                  <Ionicons name={selectedCategory.icon} size={11} color="#1c1d1d" />
                </View>
                <Text style={styles.pickerSelectorText}>{selectedCategory.name}</Text>
              </View>
            ) : (
              <Text style={styles.pickerSelectorPlaceholder}>select category</Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {selectedCategory && (
                <TouchableOpacity onPress={() => setSelectedCategory(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={14} color="#929090" />
                </TouchableOpacity>
              )}
              <Ionicons name="chevron-down" size={14} color="#c0c0c0" />
            </View>
          </TouchableOpacity>

          {/* Account — hidden for receivable since it uses decreased_from and receive_to */}
          {type !== 'receivable' && (
            <>
              <Text style={styles.label}>account <Text style={styles.optional}>(optional)</Text></Text>
              <TouchableOpacity style={styles.pickerSelector} onPress={() => { setAccountSearch(''); setShowAccountModal(true); }}>
                {selectedAccount ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View style={[styles.catDot, { backgroundColor: selectedAccount.color ?? '#e8e8e8' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerSelectorText}>{selectedAccount.account_name}</Text>
                      <Text style={styles.pickerSelectorSub}>{selectedAccount.bank}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.pickerSelectorPlaceholder}>select account</Text>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {selectedAccount && (
                    <TouchableOpacity onPress={() => setSelectedAccount(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={14} color="#929090" />
                    </TouchableOpacity>
                  )}
                  <Ionicons name="chevron-down" size={14} color="#c0c0c0" />
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Notes */}
          <Text style={styles.label}>notes <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="add a note..."
            placeholderTextColor="#c0c0c0"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          {/* Person */}
          {isLoanType && (
            <>
              <Text style={styles.label}>{type === 'payable' ? 'who are you paying?' : 'who owes you?'} <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput style={styles.input} placeholder="e.g. john" placeholderTextColor="#c0c0c0" value={personName} onChangeText={setPersonName} />
            </>
          )}

          {/* Recurring */}
          {isLoanType && (
            <>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>recurring?</Text>
                  <Text style={styles.switchSub}>does this repeat on a schedule?</Text>
                </View>
                <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ true: '#0ccfcf' }} thumbColor="#fff" />
              </View>
              {isRecurring && (
                <>
                  <Text style={styles.label}>frequency</Text>
                  <View style={styles.chipRow}>
                    {FREQUENCIES.map(f => (
                      <TouchableOpacity key={f} style={[styles.chip, frequency === f && styles.chipActive]} onPress={() => setFrequency(f)}>
                        <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>{f}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {frequency === 'weekly' && (
                    <>
                      <Text style={styles.label}>choose days</Text>
                      <View style={styles.chipRow}>
                        {WEEKDAYS.map((day, i) => (
                          <TouchableOpacity key={day} style={[styles.chip, recurringDays.includes(i) && styles.chipActive]} onPress={() => toggleDay(i)}>
                            <Text style={[styles.chipText, recurringDays.includes(i) && styles.chipTextActive]}>{day}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  {(frequency === 'monthly' || frequency === 'yearly') && (
                    <>
                      <Text style={styles.label}>day of {frequency === 'monthly' ? 'month' : 'year'}</Text>
                      <TextInput style={styles.input} placeholder={frequency === 'monthly' ? '1-31' : '1-365'} placeholderTextColor="#c0c0c0" value={recurringDate} onChangeText={setRecurringDate} keyboardType="number-pad" />
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* Receivable extra fields */}
          {type === 'receivable' && (
            <>
              <Text style={styles.label}>decreased from <Text style={styles.optional}>(where you lent from)</Text></Text>
              <TouchableOpacity style={styles.pickerSelector} onPress={() => { setDecreasedSearch(''); setShowDecreasedFromModal(true); }}>
                {decreasedFromAccount ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View style={[styles.catDot, { backgroundColor: decreasedFromAccount.color ?? '#e8e8e8' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerSelectorText}>{decreasedFromAccount.account_name}</Text>
                      <Text style={styles.pickerSelectorSub}>{decreasedFromAccount.bank}</Text>
                    </View>
                  </View>
                ) : <Text style={styles.pickerSelectorPlaceholder}>select account</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {decreasedFromAccount && <TouchableOpacity onPress={() => setDecreasedFromAccount(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close" size={14} color="#929090" /></TouchableOpacity>}
                  <Ionicons name="chevron-down" size={14} color="#c0c0c0" />
                </View>
              </TouchableOpacity>

              <Text style={styles.label}>expecting to receive in <Text style={styles.optional}>(where you expect it back)</Text></Text>
              <TouchableOpacity style={styles.pickerSelector} onPress={() => { setReceiveToSearch(''); setShowReceiveToModal(true); }}>
                {receiveToAccount ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View style={[styles.catDot, { backgroundColor: receiveToAccount.color ?? '#e8e8e8' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerSelectorText}>{receiveToAccount.account_name}</Text>
                      <Text style={styles.pickerSelectorSub}>{receiveToAccount.bank}</Text>
                    </View>
                  </View>
                ) : <Text style={styles.pickerSelectorPlaceholder}>select account</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {receiveToAccount && <TouchableOpacity onPress={() => setReceiveToAccount(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Ionicons name="close" size={14} color="#929090" /></TouchableOpacity>}
                  <Ionicons name="chevron-down" size={14} color="#c0c0c0" />
                </View>
              </TouchableOpacity>

              {decreasedFromAccount && (
                <Text style={{ fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#0ccfcf', marginTop: 4 }}>a linked expense will be created automatically</Text>
              )}
            </>
          )}

          {/* Receipt */}
          <Text style={styles.label}>receipt <Text style={styles.optional}>(optional)</Text></Text>
          <TouchableOpacity style={styles.pickerSelector} onPress={() => selectedReceiptId ? setSelectedReceiptId(null) : openReceiptModal()}>
            {selectedReceiptId ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="folder-outline" size={16} color="#0ccfcf" />
                <Text style={styles.pickerSelectorText}>{selectedReceiptNote ?? 'receipt linked'}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="receipt-outline" size={16} color="#c0c0c0" />
                <Text style={styles.pickerSelectorPlaceholder}>link a receipt</Text>
              </View>
            )}
            {selectedReceiptId
              ? <Ionicons name="close" size={14} color="#929090" />
              : <Ionicons name="chevron-down" size={14} color="#c0c0c0" />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, (!recName.trim() || !amount) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={loading || !recName.trim() || !amount}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>save recording</Text>}
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} transparent animationType="fade" onRequestClose={() => setShowCategoryModal(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCategoryModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={styles.pickerModal}>
                <Text style={styles.pickerModalTitle}>category</Text>
                <TextInput
                  style={styles.pickerModalSearch}
                  placeholder="search..."
                  placeholderTextColor="#c0c0c0"
                  value={categorySearch}
                  onChangeText={setCategorySearch}
                />
                <ScrollView style={styles.pickerModalList} showsVerticalScrollIndicator={false}>
                  {filteredCategories.length === 0 ? (
                    <Text style={styles.pickerModalEmpty}>no categories found</Text>
                  ) : filteredCategories.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.pickerModalItem, selectedCategory?.id === c.id && styles.pickerModalItemActive]}
                      onPress={() => { setSelectedCategory(c); setShowCategoryModal(false); }}
                    >
                      <View style={[styles.catDot, { backgroundColor: c.color }]}>
                        <Ionicons name={c.icon} size={11} color="#1c1d1d" />
                      </View>
                      <Text style={[styles.pickerModalItemText, selectedCategory?.id === c.id && { color: '#fff', fontFamily: 'RobotoMono_700Bold' }]}>{c.name}</Text>
                      {selectedCategory?.id === c.id && <Ionicons name="checkmark" size={14} color="#fff" style={{ marginLeft: 'auto' }} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.pickerModalCancel} onPress={() => setShowCategoryModal(false)}>
                  <Text style={styles.pickerModalCancelText}>cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* Account Modal */}
      <Modal visible={showAccountModal} transparent animationType="fade" onRequestClose={() => setShowAccountModal(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAccountModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={styles.pickerModal}>
                <Text style={styles.pickerModalTitle}>account</Text>
                <TextInput
                  style={styles.pickerModalSearch}
                  placeholder="search..."
                  placeholderTextColor="#c0c0c0"
                  value={accountSearch}
                  onChangeText={setAccountSearch}
                />
                <ScrollView style={styles.pickerModalList} showsVerticalScrollIndicator={false}>
                  {filteredAccounts.length === 0 ? (
                    <Text style={styles.pickerModalEmpty}>no accounts found</Text>
                  ) : filteredAccounts.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[styles.pickerModalItem, selectedAccount?.id === a.id && styles.pickerModalItemActive]}
                      onPress={() => { setSelectedAccount(a); setShowAccountModal(false); }}
                    >
                      <View style={[styles.catDot, { backgroundColor: a.color ?? '#e8e8e8' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerModalItemText, selectedAccount?.id === a.id && { color: '#fff', fontFamily: 'RobotoMono_700Bold' }]}>{a.account_name}</Text>
                        <Text style={[styles.pickerModalItemSub, selectedAccount?.id === a.id && { color: 'rgba(255,255,255,0.7)' }]}>{a.bank} · {a.account_number}</Text>
                      </View>
                      {selectedAccount?.id === a.id && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.pickerModalCancel} onPress={() => setShowAccountModal(false)}>
                  <Text style={styles.pickerModalCancelText}>cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* Receipt Modal */}
      <Modal visible={showReceiptModal} transparent animationType="fade" onRequestClose={() => setShowReceiptModal(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReceiptModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={styles.pickerModal}>
                <Text style={styles.pickerModalTitle}>link a receipt</Text>
                <ScrollView style={styles.pickerModalList} showsVerticalScrollIndicator={false}>
                  {unlinkedReceipts.length === 0 ? (
                    <Text style={styles.pickerModalEmpty}>no unlinked receipts found</Text>
                  ) : unlinkedReceipts.map(r => (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.pickerModalItem, selectedReceiptId === r.id && styles.pickerModalItemActive]}
                      onPress={() => { setSelectedReceiptId(r.id); setSelectedReceiptNote(r.note ?? 'untitled'); setShowReceiptModal(false); }}
                    >
                      <Ionicons name="folder-outline" size={16} color={selectedReceiptId === r.id ? '#fff' : '#0ccfcf'} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerModalItemText, selectedReceiptId === r.id && { color: '#fff', fontFamily: 'RobotoMono_700Bold' }]}>{r.note ?? 'untitled'}</Text>
                        <Text style={[styles.pickerModalItemSub, selectedReceiptId === r.id && { color: 'rgba(255,255,255,0.7)' }]}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                      </View>
                      {selectedReceiptId === r.id && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.pickerModalCancel} onPress={() => setShowReceiptModal(false)}>
                  <Text style={styles.pickerModalCancelText}>cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* Decreased From Modal */}
      <Modal visible={showDecreasedFromModal} transparent animationType="fade" onRequestClose={() => setShowDecreasedFromModal(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDecreasedFromModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={styles.pickerModal}>
                <Text style={styles.pickerModalTitle}>decreased from</Text>
                <TextInput style={styles.pickerModalSearch} placeholder="search..." placeholderTextColor="#c0c0c0" value={decreasedSearch} onChangeText={setDecreasedSearch} />
                <ScrollView style={styles.pickerModalList} showsVerticalScrollIndicator={false}>
                  {filteredDecreased.map(a => (
                    <TouchableOpacity key={a.id} style={[styles.pickerModalItem, decreasedFromAccount?.id === a.id && styles.pickerModalItemActive]} onPress={() => { setDecreasedFromAccount(a); setShowDecreasedFromModal(false); }}>
                      <View style={[styles.catDot, { backgroundColor: a.color ?? '#e8e8e8' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerModalItemText, decreasedFromAccount?.id === a.id && { color: '#fff', fontFamily: 'RobotoMono_700Bold' }]}>{a.account_name}</Text>
                        <Text style={[styles.pickerModalItemSub, decreasedFromAccount?.id === a.id && { color: 'rgba(255,255,255,0.7)' }]}>{a.bank} · {a.account_number}</Text>
                      </View>
                      {decreasedFromAccount?.id === a.id && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.pickerModalCancel} onPress={() => setShowDecreasedFromModal(false)}>
                  <Text style={styles.pickerModalCancelText}>cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* Receive To Modal */}
      <Modal visible={showReceiveToModal} transparent animationType="fade" onRequestClose={() => setShowReceiveToModal(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReceiveToModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={styles.pickerModal}>
                <Text style={styles.pickerModalTitle}>expecting to receive in</Text>
                <TextInput style={styles.pickerModalSearch} placeholder="search..." placeholderTextColor="#c0c0c0" value={receiveToSearch} onChangeText={setReceiveToSearch} />
                <ScrollView style={styles.pickerModalList} showsVerticalScrollIndicator={false}>
                  {filteredReceiveTo.map(a => (
                    <TouchableOpacity key={a.id} style={[styles.pickerModalItem, receiveToAccount?.id === a.id && styles.pickerModalItemActive]} onPress={() => { setReceiveToAccount(a); setShowReceiveToModal(false); }}>
                      <View style={[styles.catDot, { backgroundColor: a.color ?? '#e8e8e8' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerModalItemText, receiveToAccount?.id === a.id && { color: '#fff', fontFamily: 'RobotoMono_700Bold' }]}>{a.account_name}</Text>
                        <Text style={[styles.pickerModalItemSub, receiveToAccount?.id === a.id && { color: 'rgba(255,255,255,0.7)' }]}>{a.bank} · {a.account_number}</Text>
                      </View>
                      {receiveToAccount?.id === a.id && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.pickerModalCancel} onPress={() => setShowReceiveToModal(false)}>
                  <Text style={styles.pickerModalCancelText}>cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 28, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backBtn: { padding: 2 },
  headerSub: { fontFamily: 'ChillaxMedium', fontSize: 10, color: '#929090' },
  headerTitle: { fontFamily: 'Avenelle', fontSize: 22, color: '#0ccfcf', letterSpacing: -0.5, lineHeight: 26 },
  body: { paddingHorizontal: 32, paddingTop: 20, paddingBottom: 60, gap: 4 },
  receiptCarousel: { marginBottom: 8 },
  receiptCarouselLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  receiptThumb: { width: 80, height: 80, borderRadius: 10 },
  error: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#ed6a6a', marginBottom: 8 },
  label: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 6 },
  optional: { fontFamily: 'RobotoMono_400Regular', color: '#c0c0c0', textTransform: 'none' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#fafafa' },
  typeBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#929090' },
  infoBlock: { backgroundColor: '#fafafa', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: '#f0f0f0' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  infoLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#929090', width: 60, flexShrink: 0 },
  infoInput: { flex: 1, fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252', padding: 0 },
  infoValue: { flex: 1, fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252' },
  infoDivider: { height: 1, backgroundColor: '#f0f0f0' },
  amountRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  amountSign: { fontFamily: 'RobotoMono_700Bold', fontSize: 16 },
  input: { backgroundColor: '#fafafa', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252', borderWidth: 1, borderColor: '#f0f0f0' },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  catDot: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#fafafa' },
  chipActive: { backgroundColor: '#0ccfcf', borderColor: '#0ccfcf' },
  chipText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#929090' },
  chipTextActive: { color: '#fff', fontFamily: 'RobotoMono_700Bold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafafa', borderRadius: 14, padding: 14, marginTop: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  switchLabel: { fontFamily: 'RobotoMono_700Bold', fontSize: 12, color: '#425252' },
  switchSub: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', marginTop: 2 },
  saveBtn: { backgroundColor: '#425252', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#fff' },
  // Picker selector button
  pickerSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafafa', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  pickerSelectorText: { fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252' },
  pickerSelectorSub: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', marginTop: 1 },
  pickerSelectorPlaceholder: { fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#c0c0c0' },
  // Picker modal
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerModal: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, width: 300, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 10 },
  pickerModalTitle: { fontFamily: 'ChillaxMedium', fontSize: 16, color: '#425252' },
  pickerModalSearch: { backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252', borderWidth: 1, borderColor: '#f0f0f0' },
  pickerModalList: { maxHeight: 220 },
  pickerModalEmpty: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#c0c0c0', textAlign: 'center', paddingVertical: 16 },
  pickerModalItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10 },
  pickerModalItemActive: { backgroundColor: '#425252', paddingHorizontal: 10 },
  pickerModalItemText: { fontFamily: 'RobotoMono_400Regular', fontSize: 13, color: '#425252', flex: 1 },
  pickerModalItemSub: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090' },
  pickerModalCancel: { backgroundColor: '#f5f5f5', borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  pickerModalCancelText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#8a8a8a' },
  // Date picker
  pickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, width: '80%', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 10 },
  pickerTitle: { fontFamily: 'ChillaxMedium', fontSize: 16, color: '#425252' },
  pickerInput: { backgroundColor: '#fafafa', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252', borderWidth: 1, borderColor: '#f0f0f0' },
  pickerBtn: { backgroundColor: '#425252', borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  pickerBtnText: { fontFamily: 'RobotoMono_700Bold', fontSize: 12, color: '#fff' },
});
