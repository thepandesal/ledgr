import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Image, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createClient } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

const NAV_ITEMS = [
  { label: 'Spaces', icon: 'grid', route: '/spaces' },
  { label: 'Accounts', icon: 'wallet-outline', route: '/cooking' },
  { label: 'Bill Split', icon: 'people-outline', route: '/cooking' },
  { label: 'Receipts', icon: 'receipt-outline', route: '/cooking' },
];

// Mock spaces for now
const MOCK_SPACES = [
  { id: '1', name: 'Household' },
  { id: '2', name: 'Trip to Japan' },
  { id: '3', name: 'Business' },
];

export default function SpacesScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(user.user_metadata?.full_name ?? '');
        setAvatarUrl(user.user_metadata?.avatar_url ?? '');
      }
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={18} color="rgba(255,255,255,0.6)" />
            </View>
          )}
          <Text style={styles.greeting}>Hey, <Text style={styles.greetingName}>{userName}!</Text></Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Spaces</Text>

        {/* Grid */}
        <View style={styles.grid}>
          {MOCK_SPACES.map((space) => (
            <TouchableOpacity
              key={space.id}
              style={styles.spaceCard}
              activeOpacity={0.8}
              onPress={() => router.push('/space-detail')}
            >
              <Ionicons name="grid" size={24} color="#fff" style={styles.spaceIcon} />
              <Text style={styles.spaceName}>{space.name}</Text>
            </TouchableOpacity>
          ))}

          {/* Add a space */}
          <TouchableOpacity
            style={styles.addCard}
            activeOpacity={0.8}
            onPress={() => router.push('/space-detail')}
          >
            <Ionicons name="add" size={28} color="rgba(255,255,255,0.5)" />
            <Text style={styles.addCardText}>add a space</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.route === '/spaces';
          return (
            <TouchableOpacity
              key={item.label}
              style={styles.navItem}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon as any}
                size={22}
                color={isActive ? '#00bf63' : 'rgba(255,255,255,0.4)'}
              />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1d1d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2b2b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  greetingName: {
    fontFamily: 'DMSans_700Bold',
    color: '#ffffff',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 22,
    color: '#ffffff',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  spaceCard: {
    width: '47%',
    backgroundColor: '#00bf63',
    borderRadius: 16,
    padding: 20,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  spaceIcon: {
    marginBottom: 8,
  },
  spaceName: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: '#ffffff',
  },
  addCard: {
    width: '47%',
    backgroundColor: '#2a2b2b',
    borderRadius: 16,
    padding: 20,
    minHeight: 110,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3b3b',
    borderStyle: 'dashed',
    gap: 6,
  },
  addCardText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#242525',
    borderTopWidth: 1,
    borderTopColor: '#2e2f2f',
    paddingVertical: 10,
    paddingBottom: 16,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  navLabelActive: {
    color: '#00bf63',
    fontFamily: 'DMSans_600SemiBold',
  },
});
