import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '../../../src/constants/theme';

export default function ReceiptsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.pageHeader}>Receipts</Text>
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🧾</Text>
        <Text style={styles.emptyText}>No receipts yet</Text>
        <Text style={styles.emptySub}>Capture or upload receipts to record later</Text>
      </View>
      <View style={styles.bottomActions}>
        <Pressable style={styles.captureButton}>
          <Text style={styles.captureButtonText}>📷 Capture Receipt</Text>
        </Pressable>
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
  bottomActions: { padding: Spacing.md },
  captureButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  captureButtonText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.white },
});
