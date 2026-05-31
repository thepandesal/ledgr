import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { fetchRecordings } from '@/services/db';

export default function WorkspaceDashboard() {
  const { workspaceId, name, currency } = useLocalSearchParams<{ workspaceId: string; name: string; currency: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    fetchRecordings(workspaceId)
      .then(setRecordings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const now = new Date();
  const thisMonth = recordings.filter((r) => {
    const d = new Date(r.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && r.type === 'Purchase';
  });
  const totalSpent = thisMonth.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const recent = recordings.slice(0, 5);

  const QUICK_ACTIONS = [
    { label: 'Add Recording', icon: 'add-circle-outline' as const, route: 'add-recording' },
    { label: 'Split a Bill', icon: 'people-outline' as const, route: 'splits' },
    { label: 'View Members', icon: 'person-add-outline' as const, route: 'members' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stats Card */}
      <View style={styles.statsCard}>
        <Text style={styles.statsLabel}>Spent this month</Text>
        <Text style={styles.statsAmount}>{currency ?? 'PHP'} {totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        <Text style={styles.statsSubLabel}>{thisMonth.length} transactions</Text>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.actionCard}
            onPress={() => router.push(`/(app)/${workspaceId}/${action.route}?name=${name}&currency=${currency}` as any)}
            activeOpacity={0.7}
          >
            <View style={styles.actionIcon}>
              <Ionicons name={action.icon} size={22} color={Colors.primary} />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Activity */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <TouchableOpacity onPress={() => router.push(`/(app)/${workspaceId}/recordings?name=${name}&currency=${currency}` as any)}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
      ) : recent.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={36} color={Colors.border} />
          <Text style={styles.emptyText}>No recordings yet</Text>
        </View>
      ) : (
        recent.map((r) => (
          <View key={r.id} style={styles.activityRow}>
            <View style={styles.activityIcon}>
              <Ionicons name={typeIcon(r.type)} size={16} color={Colors.primary} />
            </View>
            <View style={styles.activityInfo}>
              <Text style={styles.activityName}>{r.name}</Text>
              <Text style={styles.activityMeta}>{r.category} · {new Date(r.date).toLocaleDateString()}</Text>
            </View>
            <Text style={[styles.activityAmount, r.type === 'Income' && styles.income]}>
              {r.type === 'Income' ? '+' : '-'}{r.currency} {Number(r.amount).toLocaleString()}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function typeIcon(type: string): any {
  switch (type) {
    case 'Purchase': return 'cart-outline';
    case 'Income': return 'trending-up-outline';
    case 'Savings': return 'save-outline';
    case 'Payment': return 'card-outline';
    default: return 'ellipse-outline';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: 100 },
  statsCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statsLabel: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  statsAmount: { fontFamily: Fonts.bodyBold, fontSize: 32, color: Colors.white, fontWeight: '700' },
  statsSubLabel: { fontFamily: Fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.text, fontWeight: '600', marginBottom: Spacing.sm, marginTop: Spacing.sm },
  seeAll: { fontFamily: Fonts.body, fontSize: 13, color: Colors.primary },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: { fontFamily: Fonts.body, fontSize: 11, color: Colors.text, textAlign: 'center' },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  activityInfo: { flex: 1 },
  activityName: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: Colors.text, fontWeight: '600' },
  activityMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  activityAmount: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: Colors.error, fontWeight: '600' },
  income: { color: Colors.primary },
  empty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
});
