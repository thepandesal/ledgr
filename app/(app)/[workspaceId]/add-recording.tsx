import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Switch, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { createRecording } from '@/services/db';

const TYPES = ['Purchase', 'Income', 'Savings', 'Payment'];
const CATEGORIES = ['Food', 'Transport', 'Utilities', 'Rent', 'Entertainment', 'Health', 'Shopping', 'Subscriptions', 'Fitness', 'Others'];
const CURRENCIES = ['PHP', 'USD', 'EUR', 'JPY', 'GBP', 'AUD', 'SGD', 'CAD'];
const FREQUENCIES = ['weekly', 'monthly', 'yearly'];

export default function AddRecordingScreen() {
  const { workspaceId, name, currency: wsCurrency } = useLocalSearchParams<{ workspaceId: string; name: string; currency: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [recName, setRecName] = useState('');
  const [type, setType] = useState('Purchase');
  const [category, setCategory] = useState('Food');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(wsCurrency ?? 'PHP');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!recName.trim() || !amount) { setError('Name and amount are required.'); return; }
    setLoading(true);
    setError('');
    try {
      await createRecording({
        workspace_id: workspaceId!,
        name: recName.trim(),
        type,
        category,
        amount: parseFloat(amount),
        currency,
        date,
        is_recurring: isRecurring,
        recurring_frequency: isRecurring ? frequency : undefined,
      });
      router.back();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save recording.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>New Recording</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} placeholder="e.g. Grocery run" placeholderTextColor={Colors.textMuted}
          value={recName} onChangeText={setRecName} />

        <Text style={styles.label}>Type</Text>
        <View style={styles.chipRow}>
          {TYPES.map((t) => (
            <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => setType(t)}>
              <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Amount</Text>
            <TextInput style={styles.input} placeholder="0.00" placeholderTextColor={Colors.textMuted}
              value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </View>
          <View style={{ width: Spacing.md }} />
          <View style={{ flex: 0.6 }}>
            <Text style={styles.label}>Currency</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {CURRENCIES.map((c) => (
                  <TouchableOpacity key={c} style={[styles.chip, currency === c && styles.chipActive]} onPress={() => setCurrency(c)}>
                    <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        <Text style={styles.label}>Date</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textMuted} />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Recurring</Text>
          <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ true: Colors.primary }} />
        </View>

        {isRecurring && (
          <>
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.chipRow}>
              {FREQUENCIES.map((f) => (
                <TouchableOpacity key={f} style={[styles.chip, frequency === f && styles.chipActive]} onPress={() => setFrequency(f)}>
                  <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={[styles.saveBtn, (!recName.trim() || !amount) && styles.saveBtnDisabled]}
          onPress={handleSave} disabled={loading || !recName.trim() || !amount}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Save Recording</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
  },
  backBtn: { width: 32 },
  title: { fontFamily: Fonts.bodyBold, fontSize: 18, color: Colors.text, fontWeight: '700' },
  body: { padding: Spacing.lg, gap: Spacing.xs, paddingBottom: 60 },
  error: { fontFamily: Fonts.body, fontSize: 13, color: Colors.error, marginBottom: Spacing.sm },
  label: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: Fonts.body, fontSize: 15, color: Colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.text },
  chipTextActive: { color: Colors.white },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  switchLabel: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.text, fontWeight: '600' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.xl },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: 16, color: Colors.white, fontWeight: '600' },
});
