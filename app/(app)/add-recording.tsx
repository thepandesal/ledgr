import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, ActivityIndicator, Switch, Animated, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

const { width } = Dimensions.get('window');

const TYPES = [
  { key: 'expense',    label: 'Expense',    color: '#e74c3c', icon: 'arrow-down-outline' },
  { key: 'income',     label: 'Income',     color: '#00bf63', icon: 'arrow-up-outline' },
  { key: 'savings',    label: 'Savings',    color: '#3498db', icon: 'save-outline' },
  { key: 'receivable', label: 'Receivable', color: '#e74c3c', icon: 'arrow-undo-outline' },
  { key: 'payable',    label: 'Payable',    color: '#00bf63', icon: 'arrow-redo-outline' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

export default function AddRecordingScreen() {
  const { spaceId, spaceName } = useLocalSearchParams<{ spaceId: string; spaceName: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  const [recName, setRecName] = useState('');
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringDate, setRecurringDate] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleSave = async () => {
    if (!recName.trim() || !amount) { setError('Name and amount are required.'); return; }
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: err } = await supabase.from('recordings').insert({
        space_id: spaceId,
        user_id: user!.id,
        name: recName.trim(),
        type,
        amount: parseFloat(amount),
        transaction_date: date,
        notes: notes.trim() || null,
        category_id: categoryId || null,
        account_id: accountId || null,
        is_recurring: isLoanType ? isRecurring : false,
        recurring_frequency: isLoanType && isRecurring ? frequency : null,
        recurring_days: isLoanType && isRecurring && frequency === 'weekly' ? recurringDays : null,
        recurring_date: isLoanType && isRecurring && ['monthly', 'yearly'].includes(frequency) ? parseInt(recurringDate) : null,
      });
      if (err) throw err;
      handleBack();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const toggleDay = (day: number) => {
    setRecurringDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const selectedType = TYPES.find(t => t.key === type)!;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={styles.title}>new recording</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Name */}
          <Text style={styles.label}>recording name</Text>
          <TextInput style={styles.input} placeholder="e.g. Grocery run" placeholderTextColor="rgba(255,255,255,0.3)"
            value={recName} onChangeText={setRecName} autoFocus />

          {/* Type */}
          <Text style={styles.label}>type</Text>
          <View style={styles.typeRow}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeBtn, type === t.key && { backgroundColor: t.color, borderColor: t.color }]}
                onPress={() => { setType(t.key); setIsRecurring(false); }}
              >
                <Ionicons name={t.icon as any} size={14} color={type === t.key ? '#fff' : 'rgba(255,255,255,0.5)'} />
                <Text style={[styles.typeBtnText, type === t.key && styles.typeBtnTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount */}
          <Text style={styles.label}>amount</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.amountSign, { color: selectedType.color }]}>{selectedType.key === 'income' || selectedType.key === 'payable' ? '+' : '-'}</Text>
            <TextInput style={[styles.input, styles.amountInput]} placeholder="0.00" placeholderTextColor="rgba(255,255,255,0.3)"
              value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </View>

          {/* Date */}
          <Text style={styles.label}>transaction date</Text>
          <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="rgba(255,255,255,0.3)"
            value={date} onChangeText={setDate} />

          {/* Category */}
          {categories.length > 0 && (
            <>
              <Text style={styles.label}>category <Text style={styles.optional}>(optional)</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                <TouchableOpacity style={[styles.chip, !categoryId && styles.chipActive]} onPress={() => setCategoryId('')}>
                  <Text style={[styles.chipText, !categoryId && styles.chipTextActive]}>none</Text>
                </TouchableOpacity>
                {categories.map(c => (
                  <TouchableOpacity key={c.id} style={[styles.chip, categoryId === c.id && { backgroundColor: c.color, borderColor: c.color }]} onPress={() => setCategoryId(c.id)}>
                    <Ionicons name={c.icon} size={12} color={categoryId === c.id ? '#1c1d1d' : 'rgba(255,255,255,0.5)'} />
                    <Text style={[styles.chipText, categoryId === c.id && { color: '#1c1d1d', fontFamily: 'DMSans_600SemiBold' }]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Account */}
          {accounts.length > 0 && (
            <>
              <Text style={styles.label}>account <Text style={styles.optional}>(optional)</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                <TouchableOpacity style={[styles.chip, !accountId && styles.chipActive]} onPress={() => setAccountId('')}>
                  <Text style={[styles.chipText, !accountId && styles.chipTextActive]}>none</Text>
                </TouchableOpacity>
                {accounts.map(a => (
                  <TouchableOpacity key={a.id} style={[styles.chip, accountId === a.id && { backgroundColor: a.color, borderColor: a.color }]} onPress={() => setAccountId(a.id)}>
                    <Text style={[styles.chipText, accountId === a.id && { color: '#1c1d1d', fontFamily: 'DMSans_600SemiBold' }]}>{a.account_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Notes */}
          <Text style={styles.label}>notes <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="add a note..." placeholderTextColor="rgba(255,255,255,0.3)"
            value={notes} onChangeText={setNotes} multiline numberOfLines={3} />

          {/* Recurring (only for receivable/payable) */}
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
                      <TextInput style={styles.input} placeholder={frequency === 'monthly' ? '1-31' : '1-365'}
                        placeholderTextColor="rgba(255,255,255,0.3)" value={recurringDate}
                        onChangeText={setRecurringDate} keyboardType="number-pad" />
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c1d1d', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2a2b2b' },
  backBtn: { width: 32 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#fff' },
  body: { padding: 20, gap: 4, paddingBottom: 60 },
  error: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#e74c3c', marginBottom: 8 },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  optional: { fontFamily: 'DMSans_400Regular', color: 'rgba(255,255,255,0.3)', textTransform: 'none' },
  input: { backgroundColor: '#242525', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#fff', borderWidth: 1, borderColor: '#3a3b3b' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: '#3a3b3b', backgroundColor: '#242525' },
  typeBtnText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  typeBtnTextActive: { color: '#fff', fontFamily: 'DMSans_600SemiBold' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountSign: { fontFamily: 'DMSans_700Bold', fontSize: 24 },
  amountInput: { flex: 1 },
  chipScroll: { gap: 8, paddingBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#3a3b3b', backgroundColor: '#242525' },
  chipActive: { backgroundColor: '#00bf63', borderColor: '#00bf63' },
  chipText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  chipTextActive: { color: '#fff', fontFamily: 'DMSans_600SemiBold' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#242525', borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#3a3b3b' },
  switchLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#fff' },
  switchSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  saveBtn: { backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#fff' },
});
