import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { fetchAccounts, deleteAccount } from '@/services/db';

const TYPE_ICONS: Record<string, any> = {
  bank: 'business-outline',
  credit_card: 'card-outline',
  atm: 'cash-outline',
  savings: 'save-outline',
};

const TYPE_LABELS: Record<string, string> = {
  bank: 'Bank',
  credit_card: 'Credit Card',
  atm: 'ATM',
  savings: 'Savings',
};

export default function AccountsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchAccounts(session.user.id)
      .then((data) => {
        setAccounts(data ?? []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading accounts:', err);
        setAccounts([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, [session?.user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [session?.user?.id])
  );

  const handleDelete = (id: string) => {
    Alert.alert('Delete Account', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAccount(id);
          load();
        },
      },
    ]);
  };

  const grouped = accounts.reduce((acc: Record<string, any[]>, item) => {
    const key = item.type ?? 'bank';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Accounts</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={Object.entries(grouped)}
          keyExtractor={([type]) => type}
          contentContainerStyle={styles.list}
          renderItem={({ item: [type, items] }) => (
            <View>
              <Text style={styles.sectionLabel}>{TYPE_LABELS[type] ?? type}</Text>
              {items.map((account) => (
                <View key={account.id} style={styles.card}>
                  <View style={styles.iconWrap}>
                    <Ionicons name={TYPE_ICONS[type] ?? 'wallet-outline'} size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.bankName}>{account.bank_name}</Text>
                    {account.type === 'atm' && account.balance != null && (
                      <Text style={styles.balance}>Balance: {Number(account.balance).toLocaleString()}</Text>
                    )}
                    {account.type === 'credit_card' && account.due_date != null && (
                      <Text style={styles.balance}>Due: Day {account.due_date}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(account.id)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyTitle}>No accounts yet</Text>
              <Text style={styles.emptySubtitle}>Tap + to add a bank account</Text>
            </View>
          }
        />
      )}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/(app)/add-account' as any)}>
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  title: { fontFamily: Fonts.bodyBold, fontSize: 24, color: Colors.text, fontWeight: '700' },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  sectionLabel: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  iconWrap: { width: 42, height: 42, borderRadius: BorderRadius.sm, backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  info: { flex: 1 },
  accountName: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.text, fontWeight: '600' },
  bankName: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  balance: { fontFamily: Fonts.body, fontSize: 12, color: Colors.primary, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
  emptyTitle: { fontFamily: Fonts.bodySemiBold, fontSize: 18, color: Colors.text, fontWeight: '600' },
  emptySubtitle: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
  fab: { position: 'absolute', bottom: 24, right: Spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
});
