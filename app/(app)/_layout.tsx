import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { Platform } from 'react-native';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'web' ? 64 : 84,
          paddingBottom: Platform.OS === 'web' ? 10 : 26,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: Fonts.body,
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="workspaces"
        options={{
          title: 'Spaces',
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color }) => <Ionicons name="wallet-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: 'Receipts',
          tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color }) => <Ionicons name="notifications-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen name="create-workspace" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="[workspaceId]" options={{ href: null }} />
    </Tabs>
  );
}
