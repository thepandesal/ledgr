import { View, Text, Pressable, SectionList, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '../../../src/constants/theme';

const mockAccounts = [
  { title: 'Bank Accounts', data: [{ id: '1', name: 'BDO Savings', bank: 'BDO' }] },
  { title: 'Credit Cards', data: [{ id: '2', name: 'BPI Gold', bank: 'BPI' }] },
  { title: 'ATM', data: [{ id: '3', name: 'Main ATM', bank: 'BDO' }] },
  { title: 'Savings Goals', data: [{ id: '4', name: 'Emergency Fund', bank: 'GCash' }] },
];

export default function AccountsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.pageHeader}>Accounts</Text>
      <SectionList
        sections={mockAccounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.md }}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>{item.bank}</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add Account</Text>
          </Pressable>
        }
      />
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
  sectionTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.text },
  cardSub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  addButtonText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.white },
});
