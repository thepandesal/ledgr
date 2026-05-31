import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { createAccount } from '@/services/db';

const ACCOUNT_TYPES = ['bank', 'credit_card', 'atm', 'savings'];
const BANKS = ['BDO', 'BPI', 'Metrobank', 'Maybank', 'GCash', 'PayMaya', 'Other'];

export default function AddAccountScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [type, setType] = useState('bank');
  const [bank, setBank] = useState('BDO');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !bank.trim()) {
      Alert.alert('Error', 'Name and bank are required');
      return;
    }

    setLoading(true);
    try {
      if (!session?.user?.id) throw new Error('Not authenticated');
      await createAccount({
        user_id: session.user.id,
        type,
        bank_name: bank,
        name: name.trim(),
        balance: type === 'atm' ? parseFloat(balance) : undefined,
        due_date: type === 'credit_card' ? parseInt(dueDate) : undefined,
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message ?? 'Failed to create account');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Account</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Account Type</Text>
        <View style={styles.chipRow}>
          {ACCOUNT_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, type === t && styles.chipActive]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.chipText, type === t && styles.chipTextActive]}>
                {t === 'credit_card' ? 'Credit Card' : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Bank</Text>
        <View style={styles.chipRow}>
          {BANKS.map((b) => (
            <TouchableOpacity
              key={b}
              style={[styles.chip, bank === b && styles.chipActive]}
              onPress={() => setBank(b)}
            >
              <Text style={[styles.chipText, bank === b && styles.chipTextActive]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Account Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. My Savings"
          placeholderTextColor={Colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        {type === 'atm' && (
          <>
            <Text style={styles.label}>Balance</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              value={balance}
              onChangeText={setBalance}
              keyboardType="decimal-pad"
            />
          </>
        )}

        {type === 'credit_card' && (
          <>
            <Text style={styles.label}>Due Date (Day of Month)</Text>
            <TextInput
              style={styles.input}
              placeholder="15"
              placeholderTextColor={Colors.textMuted}
              value={dueDate}
              onChangeText={setDueDate}
              keyboardType="number-pad"
              maxLength={2}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, (!name.trim() || !bank.trim()) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading || !name.trim() || !bank.trim()}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Add Account</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: { width: 32 },
  title: { fontFamily: Fonts.bodyBold, fontSize: 18, color: Colors.text, fontWeight: '700' },
  body: { padding: Spacing.lg, gap: Spacing.xs, paddingBottom: 60 },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.text },
  chipTextActive: { color: Colors.white },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.text,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 16,
    color: Colors.white,
    fontWeight: '600',
  },
});
