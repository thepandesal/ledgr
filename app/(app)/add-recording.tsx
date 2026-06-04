import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, ActivityIndicator, Switch, Animated, Dimensions, Modal, FlatList, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { BlurView } from 'expo-blur';

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
  const [personName, setPersonName] = useState('');
  const [receiptPhotos, setReceiptPhotos] = useState<string[]>([]);

  const isLoanType = type === 'receivable' || type === 'payable';
  const selectedType = TYPES.find(t => t.key === type)!;

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

  const handleCategoryInput = (val: string) => {
    setCategoryInput(val); setSelectedCategory(null);
    setCategorySuggestions(val.trim() ? categories.filter(c => c.name.toLowerCase().includes(val.toLowerCase())) : []);
  };

  const handleAccountInput = (val: string) => {
    setAccountInput(val); setSelectedAccount(null);
    setAccountSuggestions(val.trim() ? accounts.filter(a => a.account_name.toLowerCase().includes(val.toLowerCase())) : []);
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
        const { error: err } = await supabase.from('recordings').insert({
          space_id: spaceId, user_id: user!.id, name: recName.trim(), type,
          amount: parseFloat(amount), transaction_date: date,
          notes: notes.trim() || null, category_id: selectedCategory?.id || null,
          account_id: selectedAccount?.id || null, status: statusMap[type] ?? 'paid',
          person_name: isLoanType ? personName.trim() || null : null,
          is_recurring: isLoanType ? isRecurring : false,
          recurring_frequency: isLoanType && isRecurring ? frequency : null,
          recurring_days: isLoanType && isRecurring && frequency === 'weekly' ? recurringDays : null,
          recurring_date: isLoanType && isRecurring && ['monthly', 'yearly'].includes(frequency) ? parseInt(recurringDate) : null,
        });
        if (err) throw err;
      }
      // Link receipt if coming from receipt screen
      if (receiptId) {
        const { data: savedRec } = await supabase.from('recordings').select('id').order('created_at', { ascending: false }).limit(1).single();
        if (savedRec) await supabase.from('receipt_entries').update({ recording_id: savedRec.id }).eq('id', receiptId);
      }
      handleBack();
    } catch (e: any) { setError(e.message); setLoading(false); }
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

          {/* Receipt photo carousel */}
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
          <View style={styles.infoBlock}>
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
            <TouchableOpacity style={styles.infoRow} onPress={() => { setDateInputVal(date); setShowDatePicker(true); }}>
              <Text style={styles.infoLabel}>date</Text>
              <Text style={styles.infoValue}>{date}</Text>
            </TouchableOpacity>
          </View>

          {/* Category */}
          <Text style={styles.label}>category <Text style={styles.optional}>(optional)</Text></Text>
          {selectedCategory ? (
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: selectedCategory.color }]}>
                <Ionicons name={selectedCategory.icon} size={12} color="#1c1d1d" />
                <Text style={styles.badgeText}>{selectedCategory.name}</Text>
                <TouchableOpacity onPress={() => { setSelectedCategory(null); setCategoryInput(''); }}>
                  <Ionicons name="close" size={12} color="#1c1d1d" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <TextInput style={styles.input} placeholder="search categories..." placeholderTextColor="#c0c0c0" value={categoryInput} onChangeText={handleCategoryInput} />
              {categorySuggestions.length > 0 && (
                <View style={styles.dropdown}>
                  {categorySuggestions.map(c => (
                    <TouchableOpacity key={c.id} style={styles.dropdownItem} onPress={() => { setSelectedCategory(c); setCategoryInput(''); setCategorySuggestions([]); }}>
                      <View style={[styles.catDot, { backgroundColor: c.color }]}><Ionicons name={c.icon} size={11} color="#1c1d1d" /></View>
                      <Text style={styles.dropdownText}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Account */}
          <Text style={styles.label}>account <Text style={styles.optional}>(optional)</Text></Text>
          {selectedAccount ? (
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: selectedAccount.color }]}>
                <Text style={styles.badgeText}>{selectedAccount.account_name}</Text>
                <Text style={[styles.badgeText, { fontFamily: 'RobotoMono_400Regular', fontSize: 10 }]}>· {selectedAccount.bank}</Text>
                <TouchableOpacity onPress={() => { setSelectedAccount(null); setAccountInput(''); }}>
                  <Ionicons name="close" size={12} color="#1c1d1d" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <TextInput style={styles.input} placeholder="search accounts..." placeholderTextColor="#c0c0c0" value={accountInput} onChangeText={handleAccountInput} />
              {accountSuggestions.length > 0 && (
                <View style={styles.dropdown}>
                  {accountSuggestions.map(a => (
                    <TouchableOpacity key={a.id} style={styles.dropdownItem} onPress={() => { setSelectedAccount(a); setAccountInput(''); setAccountSuggestions([]); }}>
                      <View style={[styles.catDot, { backgroundColor: a.color }]} />
                      <View>
                        <Text style={styles.dropdownText}>{a.account_name}</Text>
                        <Text style={styles.dropdownSub}>{a.bank}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Notes */}
          <Text style={styles.label}>notes <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="add a note..." placeholderTextColor="#c0c0c0" value={notes} onChangeText={setNotes} multiline numberOfLines={3} />

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

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
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
  dropdown: { backgroundColor: '#fafafa', borderRadius: 10, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#f0f0f0' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dropdownText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#425252' },
  dropdownSub: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', marginTop: 1 },
  catDot: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  badgeRow: { flexDirection: 'row' },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, gap: 6 },
  badgeText: { fontFamily: 'RobotoMono_700Bold', fontSize: 11, color: '#1c1d1d' },
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
  pickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, width: '80%', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 10 },
  pickerTitle: { fontFamily: 'ChillaxMedium', fontSize: 16, color: '#425252' },
  pickerInput: { backgroundColor: '#fafafa', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252', borderWidth: 1, borderColor: '#f0f0f0' },
  pickerBtn: { backgroundColor: '#425252', borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  pickerBtnText: { fontFamily: 'RobotoMono_700Bold', fontSize: 12, color: '#fff' },
});

