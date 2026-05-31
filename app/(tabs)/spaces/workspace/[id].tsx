import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors, Fonts, Spacing, BorderRadius } from '../../../../src/constants/theme';

export default function WorkspaceDashboard() {
  const { id } = useLocalSearchParams();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.md, paddingBottom: 90 }}>
      <Text style={styles.pageHeader}>Dashboard</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>₱0</Text>
          <Text style={styles.statLabel}>Spent this month</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Due soon</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <Pressable style={styles.actionButton}>
          <Text style={styles.actionIcon}>📝</Text>
          <Text style={styles.actionLabel}>Record</Text>
        </Pressable>
        <Pressable style={styles.actionButton}>
          <Text style={styles.actionIcon}>✂️</Text>
          <Text style={styles.actionLabel}>Split</Text>
        </Pressable>
        <Pressable style={styles.actionButton}>
          <Text style={styles.actionIcon}>📷</Text>
          <Text style={styles.actionLabel}>Receipt</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pageHeader: { fontFamily: Fonts.header, fontSize: 24, color: Colors.text, marginBottom: Spacing.lg },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: { fontFamily: Fonts.bodyBold, fontSize: 20, color: Colors.primary },
  statLabel: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  sectionTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  actionIcon: { fontSize: 24 },
  actionLabel: { fontFamily: Fonts.body, fontSize: 12, color: Colors.text, marginTop: 4 },
});
