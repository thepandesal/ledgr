import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const user = session?.user;
  const initial = (user?.email ?? '?')[0].toUpperCase();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const ROW_ITEMS = [
    { icon: 'person-outline' as const, label: 'Display Name', value: user?.user_metadata?.full_name ?? '—' },
    { icon: 'mail-outline' as const, label: 'Email', value: user?.email ?? '—' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.displayName}>{user?.user_metadata?.full_name ?? user?.email}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        {ROW_ITEMS.map((item) => (
          <View key={item.label} style={styles.row}>
            <Ionicons name={item.icon} size={18} color={Colors.textMuted} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.rowValue}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={18} color={Colors.error} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: 60 },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  avatarText: { color: Colors.white, fontFamily: Fonts.bodyBold, fontWeight: '700', fontSize: 28 },
  displayName: { fontFamily: Fonts.bodyBold, fontSize: 20, color: Colors.text, fontWeight: '700' },
  email: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.md },
  rowInfo: { flex: 1 },
  rowLabel: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  rowValue: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: Colors.text, fontWeight: '600', marginTop: 2 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.error },
  signOutText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: Colors.error, fontWeight: '600' },
});
