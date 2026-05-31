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
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { getSession } from '@/services/auth';
import { createWorkspace } from '@/services/db';

const CURRENCIES = ['PHP', 'USD', 'EUR', 'JPY', 'GBP', 'AUD', 'SGD', 'CAD'];

export default function CreateWorkspaceScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { session } = await getSession();
      if (!session?.user?.id) throw new Error('Not authenticated');
      const workspace = await createWorkspace(session.user.id, name.trim(), currency);
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>New Space</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Name */}
        <Text style={styles.label}>Space Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Household, Trip to Japan"
          placeholderTextColor={Colors.textMuted}
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={50}
        />

        {/* Currency */}
        <Text style={styles.label}>Default Currency</Text>
        <View style={styles.currencyGrid}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.currencyChip, currency === c && styles.currencyChipActive]}
              onPress={() => setCurrency(c)}
            >
              <Text style={[styles.currencyText, currency === c && styles.currencyTextActive]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createBtn, !name.trim() && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!name.trim() || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.createBtnText}>Create Space</Text>
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
  backBtn: { width: 32, alignItems: 'flex-start' },
  title: { fontFamily: Fonts.bodyBold, fontSize: 18, color: Colors.text, fontWeight: '700' },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.text,
  },
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  currencyChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  currencyChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  currencyText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  currencyTextActive: { color: Colors.white },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 16,
    color: Colors.white,
    fontWeight: '600',
  },
});
