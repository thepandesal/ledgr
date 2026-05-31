import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { fetchRecordings, deleteRecording } from '@/services/db';

const TYPE_ICONS: Record<string, any> = {
  Purchase: 'cart-outline',
  Income: 'trending-up-outline',
  Savings: 'save-outline',
  Payment: 'card-outline',
};

export default function RecordingsScreen() {
  const { workspaceId, name, currency } = useLocalSearchParams<{ workspaceId: string; name: string; currency: string }>();
  const router = useRouter();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!workspaceId) return;
    setLoading(true);
    fetchRecordings(workspaceId)
      .then(setRecordings)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [workspaceId]);

  const handleDelete = async (id: string) => {
    await deleteRecording(id);
    load();
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={recordings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.iconWrap}>
                <Ionicons name={TYPE_ICONS[item.type] ?? 'ellipse-outline'} size={18} color={Colors.primary} />
              </View>
              <View style={styles.info}>
                <Text style={styles.recordingName}>{item.name}</Text>
                <Text style={styles.meta}>{item.type} · {item.category} · {new Date(item.date).toLocaleDateString()}</Text>
              </View>
              <View style={styles.right}>
                <Text style={[styles.amount, item.type === 'Income' && styles.income]}>
                  {item.type === 'Income' ? '+' : '-'}{item.currency} {Number(item.amount).toLocaleString()}
                </Text>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={16} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="list-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyTitle}>No recordings yet</Text>
              <Text style={styles.emptySubtitle}>Tap + to add your first recording</Text>
            </View>
          }
        />
      )}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/(app)/${workspaceId}/add-recording?name=${name}&currency=${currency}` as any)}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  info: { flex: 1 },
  recordingName: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: Colors.text, fontWeight: '600' },
  meta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: Colors.error, fontWeight: '600' },
  income: { color: Colors.primary },
  deleteBtn: { padding: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 18, color: Colors.text, fontWeight: '600' },
  emptySubtitle: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
});
