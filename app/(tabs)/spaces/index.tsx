import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Colors, Fonts, Spacing, BorderRadius } from '../../../src/constants/theme';

const mockSpaces = [
  { id: '1', name: 'Household', currency: 'PHP', members: 3 },
  { id: '2', name: 'Trip to Japan', currency: 'JPY', members: 5 },
];

export default function SpacesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.pageHeader}>Your Spaces</Text>
      <FlatList
        data={mockSpaces}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.md }}
        renderItem={({ item }) => (
          <Pressable style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>
              {item.currency} · {item.members} members
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Create Space</Text>
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
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 16, color: Colors.text },
  cardSub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  addButtonText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.white },
});
