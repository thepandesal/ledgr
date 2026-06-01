import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, ActivityIndicator, Switch, Animated, Dimensions, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';

const { width } = Dimensions.get('window');

const TYPES = [
  { key: 'expense',    label: 'Expense',    color: '#e74c3c', icon: 'arrow-down-outline' },
  { key: 'income',     label: 'Income',     color: '#00bf63', icon: 'arrow-up-outline' },
  { key: 'savings',    label: 'Savings',    color: '#3498db', icon: 'save-outline' },
  { key: 'receivable', label: 'Receivable', color: '#00bf63', icon: 'arrow-undo-outline' },
  { key: 'payable',    label: 'Payable',    color: '#8a8a8a', icon: 'ellipsis-horizontal-outline' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

export default function AddRecordingScreen() {
  const { spaceId, spaceName, defaultDate } = useLocalSearchParams<{ spaceId: string; spaceName: string; defaultDate: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  const [recName, setRecName] = useState('');
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateInputVal, setDateInputVal] = useState('');
  const [notes, setNotes] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringDate, setRecurringDate] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [categorySuggestions, setCategorySuggestions] = useState<any[]>([]);
  const [accountInput, setAccountInput] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [accountSuggestions, setAccountSuggestions] = useState<any[]>([]);

  const isLoanType = type === 'receivable' || type === 'payable';

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [cats, accs] = await Promise.all([
      supabase.from('categories').select().eq('user_id', user.id).order('name'),
      supabase.from('accounts').select().eq('user_id', user.id).order('account_name'),
    ]);
    if (cats.data) setCategories(cats.data);
    if (accs.data) setAccounts(accs.data);
  };

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  const handleCategoryInput = (val: string) => {
    setCategoryInput(val); setSelectedCategory(null);
    setCategorySuggestions(val.trim() ? categories.filter(c => c.name.toLowerCase().includes(val.toLowerCase())) : []);
  };

  const handleAccountInput = (val: string) => {
    setAccountInput(val); setSelectedAccount(null);
    setAccountSuggestions(val.trim() ? accounts.filter(a => a.account_name.toLowerCase().includes(val.toLowerCase())) : []);
  };

  const handleSave = async () => {
    if (!recName.trim() || !amount) { setError('Name and amount are required.'); return; }
    setLoading(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: err } = await supabase.from('recordings').insert({
        space_id: spaceId, user_id: user!.id, name: recName.trim(), type,
        amount: parseFloat(amount), transaction_date: date,
        notes: notes.trim() || null, category_id: selectedCategory?.id || null, account_id: selectedAccount?.id || null,
        is_recurring: isLoanType ? isRecurring : false,
        recurring_frequency: isLoanType && isRecurring ? frequency : null,
        recurring_days: isLoanType && isRecurring && frequency === 'weekly' ? recurringDays : null,
        recurring_date: isLoanType && isRecurring && ['monthly', 'yearly'].includes(frequency) ? parseInt(recurringDate) : null,
      });
      if (err) throw err;
      handleBack();
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  const toggleDay = (day: number) => setRecurringDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  const selectedType = TYPES.find(t => t.key === type)!;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#8a8a8a" />
          </TouchableOpacity>
          <Text style={styles.title}>new recording</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>recording name</Text>
          <TextInput style={styles.input} placeholder="e.g. Grocery run" placeholderTextColor="#b0b0b0" value={recName} onChangeText={setRecName} autoFocus />

          <Text style={styles.label}>type</Text>
          <View style={styles.typeRow}>
            {TYPES.map(t => (
              <TouchableOpacity key={t.key} style={[styles.typeBtn, type === t.key && { backgroundColor: t.color, borderColor: t.color }]} onPress={() => { setType(t.key); setIsRecurring(false); }}>
                <Ionicons name={t.icon as any} size={14} color={type === t.key ? '#fff' : '#b0b0b0'} />
                <Text style={[styles.typeBtnText, type === t.key && styles.typeBtnTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>amount</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.amountSign, { color: selectedType.color }]}>
              {selectedType.key === 'expense' ? '-' : selectedType.key === 'payable' ? '⋯' : '+'}
            </Text>
            <TextInput style={[styles.input, styles.amountInput]} placeholder="0.00" placeholderTextColor="#b0b0b0" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </View>

          <Text style={styles.label}>transaction date</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => { setDateInputVal(date); setShowDatePicker(true); }}>
            <Ionicons name="calendar-outline" size={18} color="#8a8a8a" />
            <Text style={styles.dateBtnText}>{date}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>category <Text style={styles.optional}>(optional)</Text></Text>
          {selectedCategory ? (
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: selectedCategory.color }]}>
                <Ionicons name={selectedCategory.icon} size={14} color="#1c1d1d" />
                <Text style={styles.badgeText}>{selectedCategory.name}</Text>
                <TouchableOpacity onPress={() => { setSelectedCategory(null); setCategoryInput(''); }}>
                  <Ionicons name="close" size={14} color="#1c1d1d" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <TextInput style={styles.input} placeholder="search categories..." placeholderTextColor="#b0b0b0" value={categoryInput} onChangeText={handleCategoryInput} />
              {categorySuggestions.length > 0 && (
                <View style={styles.dropdown}>
                  {categorySuggestions.map(c => (
                    <TouchableOpacity key={c.id} style={styles.dropdownItem} onPress={() => { setSelectedCategory(c); setCategoryInput(''); setCategorySuggestions([]); }}>
                      <View style={[styles.catDot, { backgroundColor: c.color }]}><Ionicons name={c.icon} size={12} color="#1c1d1d" /></View>
                      <Text style={styles.dropdownText}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          <Text style={styles.label}>account <Text style={styles.optional}>(optional)</Text></Text>
          {selectedAccount ? (
            <View style={styles.badgeRow}>
              <View style={[styles.accountBadge, { backgroundColor: selectedAccount.color }]}>
                <View style={styles.accountBadgeInfo}>
                  <Text style={styles.badgeText}>{selectedAccount.account_name}</Text>
                  <Text style={styles.accountBadgeBank}>{selectedAccount.bank}</Text>
                </View>
                <TouchableOpacity onPress={() => { setSelectedAccount(null); setAccountInput(''); }}>
                  <Ionicons name="close" size={14} color="#1c1d1d" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <TextInput style={styles.input} placeholder="search accounts..." placeholderTextColor="#b0b0b0" value={accountInput} onChangeText={handleAccountInput} />
              {accountSuggestions.length > 0 && (
                <View style={styles.dropdown}>
                  {accountSuggestions.map(a => (
                    <TouchableOpacity key={a.id} style={styles.dropdownItem} onPress={() => { setSelectedAccount(a); setAccountInput(''); setAccountSuggestions([]); }}>
                      <View style={[styles.accountColorDot, { backgroundColor: a.color }]} />
                      <View>
                        <Text style={styles.dropdownText}>{a.account_name}</Text>
                        <Text style={styles.dropdownSub}>{a.bank} · {a.account_type}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          <Text style={styles.label}>notes <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="add a note..." placeholderTextColor="#b0b0b0" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />

          {isLoanType && (
            <>
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>recurring?</Text>
                  <Text style={styles.switchSub}>does this repeat on a schedule?</Text>
                </View>
                <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ true: '#00bf63' }} thumbColor="#fff" />
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
                      <TextInput style={styles.input} placeholder={frequency === 'monthly' ? '1-31' : '1-365'} placeholderTextColor="#b0b0b0" value={recurringDate} onChangeText={setRecurringDate} keyboardType="number-pad" />
                    </>
                  )}
                </>
              )}
            </>
          )}

          <TouchableOpacity style={[styles.saveBtn, (!recName.trim() || !amount) && styles.saveBtnDisabled]} onPress={handleSave} disabled={loading || !recName.trim() || !amount} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>save recording</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerBox}>
            <Text style={styles.pickerTitle}>pick a date</Text>
            <TextInput
              style={styles.pickerInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#b0b0b0"
              value={dateInputVal}
              onChangeText={setDateInputVal}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                const parsed = new Date(dateInputVal);
                if (!isNaN(parsed.getTime())) { setDate(dateInputVal); setShowDatePicker(false); }
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.pickerBtn, { flex: 1, backgroundColor: '#f5f5f5' }]} onPress={() => setShowDatePicker(false)}>
                <Text style={[styles.pickerBtnText, { color: '#8a8a8a' }]}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerBtn, { flex: 1 }]} onPress={() => {
                const parsed = new Date(dateInputVal);
                if (!isNaN(parsed.getTime())) { setDate(dateInputVal); setShowDatePicker(false); }
              }}>
                <Text style={styles.pickerBtnText}>set date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e8e8e8', backgroundColor: '#ffffff' },
  backBtn: { width: 32 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#1c1d1d' },
  body: { padding: 20, gap: 4, paddingBottom: 60 },
  error: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#e74c3c', marginBottom: 8 },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  optional: { fontFamily: 'DMSans_400Regular', color: '#b0b0b0', textTransform: 'none' },
  input: { backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#1c1d1d', borderWidth: 1, borderColor: '#e8e8e8' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#ffffff' },
  typeBtnText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#b0b0b0' },
  typeBtnTextActive: { color: '#fff', fontFamily: 'DMSans_600SemiBold' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountSign: { fontFamily: 'DMSans_700Bold', fontSize: 24 },
  amountInput: { flex: 1 },
  dropdown: { backgroundColor: '#ffffff', borderRadius: 12, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#e8e8e8' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e8e8e8' },
  dropdownText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1c1d1d' },
  dropdownSub: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#b0b0b0', marginTop: 1 },
  catDot: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  accountColorDot: { width: 12, height: 12, borderRadius: 6 },
  badgeRow: { flexDirection: 'row' },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, gap: 8 },
  badgeText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#1c1d1d' },
  accountBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, gap: 10 },
  accountBadgeInfo: { flex: 1 },
  accountBadgeBank: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: 'rgba(0,0,0,0.5)', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#ffffff' },
  chipActive: { backgroundColor: '#00bf63', borderColor: '#00bf63' },
  chipText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#b0b0b0' },
  chipTextActive: { color: '#fff', fontFamily: 'DMSans_600SemiBold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#e8e8e8' },
  switchLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#1c1d1d' },
  switchSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#b0b0b0', marginTop: 2 },
  saveBtn: { backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#fff' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: '#e8e8e8' },
  dateBtnText: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#1c1d1d' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  pickerBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, width: '80%', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  pickerTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#1c1d1d' },
  pickerInput: { backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#1c1d1d', borderWidth: 1, borderColor: '#e8e8e8' },
  pickerBtn: { backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  pickerBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#fff' },
});
