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
  const [userId, setUserId] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(user.user_metadata?.full_name ?? '');
        setUserId(user.id);
        loadSpaces(user.id);
      }
    });
  }, []);

  const loadSpaces = async (uid: string) => {
    const { data } = await supabase.from('spaces').select().eq('user_id', uid).order('created_at');
    if (data) setSpaces(data);
  };

  const openModal = () => {
    setSpaceName('');
    setSelectedColor(PASTEL_COLORS[0]);
    setSelectedIcon(ICONS[0]);
    setError('');
    setModalVisible(true);
  };

  const handleCreate = async () => {
    if (!spaceName.trim()) { setError('Name is required.'); return; }
    setLoading(true);
    const { data, error: insertError } = await supabase.from('spaces').insert({
      user_id: userId,
      name: spaceName.trim(),
      color: selectedColor,
      icon: selectedIcon,
    }).select().single();
    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }
    setSpaces((prev) => [...prev, data]);
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

        <View style={styles.grid}>
          {spaces.map((space) => (
            <TouchableOpacity
              key={space.id}
              style={[styles.spaceCard, { backgroundColor: space.color }]}
              activeOpacity={0.8}
              onPress={() => router.push('/space-detail')}
            >
              <Ionicons name={space.icon as any} size={20} color="#1c1d1d" />
              <Text style={styles.spaceCardText}>{space.name}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.addCard} activeOpacity={0.8} onPress={openModal}>
            <Ionicons name="add" size={24} color="rgba(255,255,255,0.4)" />
            <Text style={styles.addCardText}>add a space</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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

            <Text style={styles.label}>preview</Text>
            <View style={[styles.preview, { backgroundColor: selectedColor }]}>
              <Ionicons name={selectedIcon as any} size={20} color="#1c1d1d" />
              <Text style={styles.previewText}>{spaceName || 'my space'}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarFallback: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#2a2b2b', justifyContent: 'center', alignItems: 'center' },
  greeting: { fontFamily: 'DMSans_400Regular', fontSize: 16, color: 'rgba(255,255,255,0.6)' },
  greetingName: { fontFamily: 'DMSans_700Bold', color: '#ffffff' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: { fontFamily: 'DMSans_700Bold', fontSize: 22, color: '#ffffff', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  spaceCard: {
    width: '47%',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spaceCardText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#1c1d1d' },
  addCard: {
    width: '47%',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2a2b2b',
    borderWidth: 1,
    borderColor: '#3a3b3b',
    gap: 6,
  },
  addCardText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#242525', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'DMSans_700Bold', fontSize: 18, color: '#ffffff' },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16 },
  input: { backgroundColor: '#2a2b2b', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#ffffff', borderWidth: 1, borderColor: '#3a3b3b' },
  inputError: { borderColor: '#e74c3c' },
  charCount: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: 4 },
  error: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#e74c3c', marginTop: 4 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotSelected: { borderWidth: 3, borderColor: '#ffffff' },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#2a2b2b', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3a3b3b' },
  iconBtnSelected: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 16, marginTop: 4 },
  previewText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#1c1d1d' },
  createBtn: { backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#ffffff' },
});
