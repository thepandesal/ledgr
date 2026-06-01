import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createClient } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

const PASTEL_COLORS = [
  '#FFB3B3', '#FFD9B3', '#FFFAB3', '#B3FFB3', '#B3FFE0',
  '#B3F0FF', '#B3C6FF', '#D9B3FF', '#FFB3F0', '#FFB3C6',
];

const ICONS = [
  'home-outline', 'briefcase-outline', 'airplane-outline', 'cart-outline',
  'heart-outline', 'star-outline', 'leaf-outline', 'cafe-outline',
  'car-outline', 'musical-notes-outline',
];

const NAV_ITEMS = [
  { label: 'Spaces', icon: 'grid', route: '/spaces' },
  { label: 'Accounts', icon: 'wallet-outline', route: '/cooking' },
  { label: 'Bill Split', icon: 'people-outline', route: '/cooking' },
  { label: 'Receipts', icon: 'receipt-outline', route: '/cooking' },
];

interface Space {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export default function SpacesScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PASTEL_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserName(user.user_metadata?.full_name ?? '');
    });
  }, []);

  const openModal = () => {
    setSpaceName('');
    setSelectedColor(PASTEL_COLORS[0]);
    setSelectedIcon(ICONS[0]);
    setError('');
    setModalVisible(true);
  };

  const handleCreate = () => {
    if (!spaceName.trim()) { setError('Name is required.'); return; }
    setLoading(true);
    const newSpace: Space = {
      id: Date.now().toString(),
      name: spaceName.trim(),
      color: selectedColor,
      icon: selectedIcon,
    };
    setSpaces((prev) => [...prev, newSpace]);
    setLoading(false);
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarFallback}>
            <Ionicons name="person" size={16} color="rgba(255,255,255,0.6)" />
          </View>
          <Text style={styles.greeting}>Hey, <Text style={styles.greetingName}>{userName}!</Text></Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Spaces</Text>

        {/* Space list */}
        <View style={styles.list}>
          {spaces.map((space) => (
            <TouchableOpacity
              key={space.id}
              style={[styles.spaceBtn, { backgroundColor: space.color }]}
              activeOpacity={0.8}
              onPress={() => router.push('/space-detail')}
            >
              <Ionicons name={space.icon as any} size={16} color="#1c1d1d" style={{ marginRight: 8 }} />
              <Text style={styles.spaceBtnText}>{space.name}</Text>
            </TouchableOpacity>
          ))}

          {/* Add a space */}
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.8} onPress={openModal}>
            <Ionicons name="add" size={16} color="rgba(255,255,255,0.5)" style={{ marginRight: 6 }} />
            <Text style={styles.addBtnText}>add a space</Text>
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
              <Ionicons name={item.icon as any} size={22} color={isActive ? '#00bf63' : 'rgba(255,255,255,0.4)'} />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Create Space Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>new space</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Text style={styles.label}>name</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              placeholder="e.g. Household"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={spaceName}
              onChangeText={(v) => { setSpaceName(v.slice(0, 15)); setError(''); }}
              maxLength={15}
              autoFocus
            />
            <Text style={styles.charCount}>{spaceName.length}/15</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Color */}
            <Text style={styles.label}>color</Text>
            <View style={styles.colorRow}>
              {PASTEL_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorDot, { backgroundColor: color }, selectedColor === color && styles.colorDotSelected]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            {/* Icon */}
            <Text style={styles.label}>icon</Text>
            <View style={styles.iconRow}>
              {ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.iconBtn, selectedIcon === icon && styles.iconBtnSelected]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <Ionicons name={icon as any} size={20} color={selectedIcon === icon ? '#1c1d1d' : 'rgba(255,255,255,0.6)'} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Preview */}
            <View style={[styles.preview, { backgroundColor: selectedColor }]}>
              <Ionicons name={selectedIcon as any} size={16} color="#1c1d1d" style={{ marginRight: 8 }} />
              <Text style={styles.previewText}>{spaceName || 'preview'}</Text>
            </View>

            <TouchableOpacity
              style={[styles.createBtn, !spaceName.trim() && styles.createBtnDisabled]}
              onPress={handleCreate}
              disabled={loading || !spaceName.trim()}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>create space</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c1d1d' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2a2b2b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: { fontFamily: 'DMSans_400Regular', fontSize: 16, color: 'rgba(255,255,255,0.6)' },
  greetingName: { fontFamily: 'DMSans_700Bold', color: '#ffffff' },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  sectionTitle: { fontFamily: 'DMSans_700Bold', fontSize: 22, color: '#ffffff', marginBottom: 16 },
  list: { gap: 10 },
  spaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  spaceBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#1c1d1d' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#2a2b2b',
    borderWidth: 1,
    borderColor: '#3a3b3b',
  },
  addBtnText: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: 'rgba(255,255,255,0.4)' },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#1c1d1d',
    borderTopWidth: 1,
    borderTopColor: '#2a2b2b',
    paddingVertical: 10,
    paddingBottom: 16,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  navLabelActive: { color: '#00bf63', fontFamily: 'DMSans_600SemiBold' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#242525',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'DMSans_700Bold', fontSize: 18, color: '#ffffff' },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#2a2b2b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3a3b3b',
  },
  inputError: { borderColor: '#e74c3c' },
  charCount: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: 4, marginBottom: 16 },
  error: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#e74c3c', marginBottom: 8 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotSelected: { borderWidth: 3, borderColor: '#ffffff' },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2a2b2b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3b3b',
  },
  iconBtnSelected: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  previewText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#1c1d1d' },
  createBtn: {
    backgroundColor: '#00bf63',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#ffffff' },
});
