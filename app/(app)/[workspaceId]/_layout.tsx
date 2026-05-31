import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Spacing } from '@/constants/theme';

const TABS = [
  { name: 'index', label: 'Dashboard', icon: 'home-outline' as const },
  { name: 'recordings', label: 'Recordings', icon: 'list-outline' as const },
  { name: 'splits', label: 'Splits', icon: 'people-outline' as const },
  { name: 'members', label: 'Members', icon: 'person-add-outline' as const },
  { name: 'settings', label: 'Settings', icon: 'settings-outline' as const },
];

export default function WorkspaceLayout() {
  const { workspaceId, name } = useLocalSearchParams<{ workspaceId: string; name: string }>();
  const router = useRouter();
  const segments = useSegments();
  const currentTab = segments[segments.length - 1];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{name ?? 'Workspace'}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Top Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = currentTab === tab.name || (tab.name === 'index' && currentTab === workspaceId);
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() =>
                router.push(`/(app)/${workspaceId}/${tab.name === 'index' ? '' : tab.name}?name=${name}` as any)
              }
            >
              <Ionicons name={tab.icon} size={16} color={isActive ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="recordings" />
        <Stack.Screen name="add-recording" />
        <Stack.Screen name="splits" />
        <Stack.Screen name="members" />
        <Stack.Screen name="settings" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 32 },
  title: { fontFamily: Fonts.bodyBold, fontSize: 18, color: Colors.text, fontWeight: '700', flex: 1, textAlign: 'center' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontFamily: Fonts.body, fontSize: 9, color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary, fontFamily: Fonts.bodySemiBold },
});
