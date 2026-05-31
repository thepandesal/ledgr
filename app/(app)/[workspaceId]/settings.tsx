import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { updateWorkspace, deleteWorkspace } from '@/services/db';

const CURRENCIES = ['PHP', 'USD', 'EUR', 'JPY', 'GBP', 'AUD', 'SGD', 'CAD'];

export default function WorkspaceSettingsScreen() {
  const { workspaceId, name: initialName, currency: initialCurrency } = useLocalSearchParams<{ workspaceId: string; name: string; currency: string }>();
  const router = useRouter();
  const [name, setName] = useState(initialName ?? '');
  const [currency, setCurrency] = useState(initialCurrency ?? 'PHP');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await updateWorkspace(workspaceId!, { name: name.trim(), currency });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Space', 'This will permanently delete this workspace and all its data. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteWorkspace(workspaceId!);
            router.replace('/(app)/workspaces');
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Space Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={50} />

      <Text style={styles.label}>Default Currency</Text>
      <View style={styles.chipRow}>
        {CURRENCIES.map((c) => (
          <TouchableOpacity key={c} style={[styles.chip, currency === c && styles.chipActive]} onPress={() => setCurrency(c)}>
            <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]} onPress={handleSave} disabled={loading || !name.trim()}>
        {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={18} color={Colors.error} />
        <Text style={styles.deleteBtnText}>Delete Space</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, gap: Spacing.xs, paddingBottom: 60 },
  label: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: Fonts.body, fontSize: 15, color: Colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.text },
  chipTextActive: { color: Colors.white },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.xl },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: 16, color: Colors.white, fontWeight: '600' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.error },
  deleteBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.error, fontWeight: '600' },
});
