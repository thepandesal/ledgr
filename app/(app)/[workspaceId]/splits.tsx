import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { fetchSplits } from '@/services/db';

export default function SplitsScreen() {
  const { workspaceId, name, currency } = useLocalSearchParams<{ workspaceId: string; name: string; currency: string }>();
  const router = useRouter();
  const [splits, setSplits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    fetchSplits(workspaceId).then(setSplits).catch(console.error).finally(() => setLoading(false));
  }, [workspaceId]);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={splits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const paid = item.split_participants?.filter((p: any) => p.status === 'paid').length ?? 0;
            const total = item.split_participants?.length ?? 0;
            return (
              <TouchableOpacity style={styles.card} activeOpacity={0.7}>
                <View style={styles.iconWrap}>
                  <Ionicons name="people-outline" size={18} color={Colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.splitName}>{item.name}</Text>
                  <Text style={styles.meta}>{paid}/{total} paid · {new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.amount}>{item.currency} {Number(item.total_amount).toLocaleString()}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyTitle}>No splits yet</Text>
              <Text style={styles.emptySubtitle}>Tap + to split a bill</Text>
            </View>
          }
        />
      )}
      <TouchableOpacity style={styles.fab}>
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  iconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  info: { flex: 1 },
  splitName: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: Colors.text, fontWeight: '600' },
  meta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  amount: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: Colors.text, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 18, color: Colors.text, fontWeight: '600' },
  emptySubtitle: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
  fab: { position: 'absolute', bottom: 24, right: Spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
});
