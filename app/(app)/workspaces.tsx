import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing, BorderRadius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

interface Workspace {
  id: string;
  name: string;
  memberCount: number;
  currency: string;
  role: 'Owner' | 'Editor' | 'Viewer';
}

const MOCK_WORKSPACES: Workspace[] = [
  { id: '1', name: 'Household', memberCount: 3, currency: 'PHP', role: 'Owner' },
  { id: '2', name: 'Trip to Japan', memberCount: 5, currency: 'JPY', role: 'Editor' },
];

const PENDING_INVITES = 2;

export default function WorkspacesScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();

  const userInitial = session?.user?.email?.[0]?.toUpperCase() ?? '?';

  const renderWorkspace = ({ item }: { item: Workspace }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.7}>
      <View style={styles.cardIcon}>
        <Ionicons name="grid" size={22} color={Colors.primary} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.cardMetaText}>{item.memberCount} members</Text>
          <Text style={styles.cardMetaDot}>·</Text>
          <Text style={styles.cardMetaText}>{item.currency}</Text>
          <Text style={styles.cardMetaDot}>·</Text>
          <Text style={styles.cardRole}>{item.role}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Spaces</Text>
        <View style={styles.headerRight}>
          {PENDING_INVITES > 0 && (
            <TouchableOpacity style={styles.inviteBadge}>
              <Ionicons name="mail-outline" size={18} color={Colors.primary} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{PENDING_INVITES}</Text>
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.avatar} onPress={signOut}>
            <Text style={styles.avatarText}>{userInitial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={MOCK_WORKSPACES}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkspace}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="grid-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>No spaces yet</Text>
            <Text style={styles.emptySubtitle}>Create a space to get started</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => router.push('/(app)/create-workspace')}>
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  title: {
    fontFamily: Fonts.bodyBold,
    fontSize: 24,
    color: Colors.text,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  inviteBadge: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.error,
    borderRadius: 99,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontFamily: Fonts.bodyBold,
    fontWeight: '700',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontFamily: Fonts.bodyBold,
    fontWeight: '700',
    fontSize: 15,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: 100,
  },
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
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  cardMetaDot: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  cardRole: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.primary,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 18,
    color: Colors.text,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
  },
  fab: {
    position: 'absolute',
    bottom: 80,
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
