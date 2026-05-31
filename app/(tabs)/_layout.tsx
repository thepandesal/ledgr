import { Tabs } from 'expo-router';
import { Text, View, Pressable, Image } from 'react-native';
import { Colors, Fonts } from '../../src/constants/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Spaces: '🏠',
    Accounts: '🏦',
    Receipts: '🧾',
    Notifications: '🔔',
  };
  return (
    <View style={{ alignItems: 'center', paddingTop: 4 }}>
      <Text style={{ fontSize: 22 }}>{icons[label]}</Text>
      <Text
        style={{
          fontFamily: Fonts.body,
          fontSize: 11,
          color: focused ? Colors.primary : Colors.textMuted,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ProfileButton() {
  return (
    <Pressable
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
      }}
    >
      <Text style={{ color: Colors.white, fontFamily: Fonts.bodySemiBold, fontSize: 14 }}>
        U
      </Text>
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background, elevation: 0, shadowOpacity: 0 },
        headerTitleStyle: { fontFamily: Fonts.header, fontSize: 20, color: Colors.text },
        headerRight: () => <ProfileButton />,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          height: 70,
          paddingBottom: 10,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="spaces"
        options={{
          title: 'Spaces',
          tabBarIcon: ({ focused }) => <TabIcon label="Spaces" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ focused }) => <TabIcon label="Accounts" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: 'Receipts',
          tabBarIcon: ({ focused }) => <TabIcon label="Receipts" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ focused }) => <TabIcon label="Notifications" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
