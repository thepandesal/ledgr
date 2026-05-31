import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing } from '../../../src/constants/theme';

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.pageHeader}>Notifications</Text>
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🔔</Text>
        <Text style={styles.emptyText}>All caught up!</Text>
        <Text style={styles.emptySub}>You'll see invites, payments, and reminders here</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pageHeader: {
    fontFamily: Fonts.header,
    fontSize: 24,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontFamily: Fonts.bodySemiBold, fontSize: 16, color: Colors.text, marginTop: Spacing.sm },
  emptySub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginTop: 4 },
});
