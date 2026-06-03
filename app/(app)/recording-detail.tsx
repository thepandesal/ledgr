import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Dimensions, ScrollView, TextInput, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');
const MAX_NAME_CHARS = 18;

function cookingAlert() { return { title: "we're cooking something", message: "" }; }

export default function RecordingDetailScreen() {
  const { recordingId } = useLocalSearchParams<{ recordingId: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  const [recording, setRecording] = useState<any>(null);
  const [people, setPeople] = useState<string[]>([]);
  const [addPersonModal, setAddPersonModal] = useState(false);
  const [personInput, setPersonInput] = useState('');
  const [cookingModal, setCookingModal] = useState(false);

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    loadRecording();
  }, []);

  const loadRecording = async () => {
    if (!recordingId) return;
    const { data } = await supabase.from('recordings')
      .select('*, categories:category_id(name, color, icon), account:account_id(account_name, bank)')
      .eq('id', recordingId)
      .single();
    if (data) setRecording(data);
  };

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: true }).start(() => router.back());
  };

  const addPerson = () => {
    if (personInput.trim()) {
      setPeople(prev => [...prev, personInput.trim()]);
      setPersonInput('');
      setAddPersonModal(false);
    }
  };

  const truncate = (str: string, max: number) =>
    str && str.length > max ? str.slice(0, max) + '...' : str;

  const amountColor = () => {
    if (!recording) return '#929090';
    if (recording.type === 'expense') return '#ed6a6a';
    if (recording.type === 'income' || recording.type === 'savings') return '#2ab671';
    return '#425252';
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const typeLabel = (type: string, status: string) => {
    const map: Record<string, string> = {
      expense: 'Expense', income: 'Income', savings: 'Savings',
    };
    if (type === 'payable') return `Payable · ${status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid'}`;
    if (type === 'receivable') return `Receivable · ${status === 'received' ? 'Received' : status === 'partial' ? 'Partial' : 'Pending'}`;
    return map[type] ?? type;
  };

  const PREVIEW_LIMIT = 4;
  const visiblePeople = people.slice(0, PREVIEW_LIMIT);
  const extraCount = people.length - PREVIEW_LIMIT;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#8a8a8a" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.titleBlock}>
            <Text style={styles.recordingsLabel}>recordings</Text>
            <View style={styles.titleRow}>
              <Text style={styles.recordingName} numberOfLines={1} ellipsizeMode="tail">
                {truncate(recording?.name ?? '', MAX_NAME_CHARS).toLowerCase()}
              </Text>
              <Text style={[styles.amount, { color: amountColor() }]}>
                {recording ? Number(recording.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setCookingModal(true)}>
              <Ionicons name="receipt-outline" size={15} color="#425252" />
              <Text style={styles.actionBtnText}>upload / view receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => setCookingModal(true)}>
              <Ionicons name="trash-outline" size={15} color="#ed6a6a" />
              <Text style={[styles.actionBtnText, { color: '#ed6a6a' }]}>delete</Text>
            </TouchableOpacity>
          </View>

          {/* Information */}
          <Text style={styles.sectionHeader}>information</Text>
          <View style={styles.infoBlock}>
            <InfoRow label="Date of transaction" value={formatDate(recording?.transaction_date)} />
            <InfoRow label="Transaction type" value={typeLabel(recording?.type ?? '', recording?.status ?? '')} />
            <InfoRow label="Bank / Account" value={truncate(recording?.account?.account_name ?? '—', 16)} />
          </View>

          {/* Split bill */}
          <Text style={styles.sectionHeader}>split bill</Text>
          <View style={styles.splitBtnGrid}>
            {[
              { icon: 'add-circle-outline', label: 'add item', onPress: () => setCookingModal(true) },
              { icon: 'people-outline', label: 'add people', onPress: () => setAddPersonModal(true) },
              { icon: 'image-outline', label: 'save image', onPress: () => setCookingModal(true) },
              { icon: 'person-add-outline', label: 'save person', onPress: () => setCookingModal(true) },
            ].map(b => (
              <TouchableOpacity key={b.label} style={styles.splitBtn} onPress={b.onPress} activeOpacity={0.8}>
                <Ionicons name={b.icon as any} size={18} color="#425252" />
                <Text style={styles.splitBtnText}>{b.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* People */}
          <Text style={styles.peopleHeader}>people</Text>
          <View style={styles.peopleContainer}>
            {people.length === 0 ? (
              <Text style={styles.peoplePlaceholder}>no people added yet</Text>
            ) : (
              <View style={styles.peopleChips}>
                {visiblePeople.map((p, i) => (
                  <View key={i} style={styles.personChip}>
                    <Text style={styles.personChipText}>{p}</Text>
                  </View>
                ))}
                {extraCount > 0 && (
                  <View style={styles.personChip}>
                    <Text style={styles.personChipText}>+{extraCount} more</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Items */}
          <Text style={styles.sectionHeader}>items</Text>
          <View style={styles.cookingBox}>
            <Text style={styles.cookingText}>🍳 we're cooking something</Text>
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* Add people modal */}
      <Modal visible={addPersonModal} transparent animationType="fade" onRequestClose={() => setAddPersonModal(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAddPersonModal(false)}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>add person</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="name"
                  placeholderTextColor="#b0b0b0"
                  value={personInput}
                  onChangeText={setPersonInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={addPerson}
                />
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f5f5f5' }]} onPress={() => setAddPersonModal(false)}>
                    <Text style={[styles.modalBtnText, { color: '#8a8a8a' }]}>cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtn} onPress={addPerson}>
                    <Text style={styles.modalBtnText}>add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </BlurView>
      </Modal>

      {/* Cooking modal */}
      <Modal visible={cookingModal} transparent animationType="fade" onRequestClose={() => setCookingModal(false)}>
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCookingModal(false)}>
            <View style={styles.modalBox}>
              <Text style={{ fontSize: 36 }}>🍳</Text>
              <Text style={styles.cookingText}>we're cooking something</Text>
            </View>
          </TouchableOpacity>
        </BlurView>
      </Modal>
    </Animated.View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <View style={infoStyles.dots} />
      <Text style={infoStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  label: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#929090', flexShrink: 0 },
  dots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: '#c0c0c0', marginHorizontal: 8 },
  value: { fontFamily: 'RobotoMono_700Bold', fontSize: 11, color: '#425252', flexShrink: 0, maxWidth: 130 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  backBtn: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 4 },
  scroll: { paddingHorizontal: 32, paddingBottom: 60 },
  titleBlock: { marginBottom: 16 },
  recordingsLabel: { fontFamily: 'ChillaxMedium', fontSize: 11, color: '#929090', marginBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  recordingName: { fontFamily: 'Avenelle', fontSize: 32, color: '#425252', lineHeight: 36, letterSpacing: -1, flex: 1 },
  amount: { fontFamily: 'RobotoMono_400Regular', fontSize: 20, flexShrink: 0 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#fafafa' },
  actionBtnDanger: { borderColor: '#fde8e8', backgroundColor: '#fff8f8' },
  actionBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#425252' },
  sectionHeader: { fontFamily: 'ChillaxMedium', fontSize: 15, color: '#0ccfcf', letterSpacing: -0.5, marginBottom: 10, marginTop: 4 },
  infoBlock: { backgroundColor: '#fafafa', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 24 },
  splitBtnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  splitBtn: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#fafafa' },
  splitBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#425252' },
  peopleHeader: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090', textAlign: 'center', marginBottom: 10 },
  peopleContainer: { borderWidth: 1, borderColor: '#929090', borderStyle: 'dashed', borderRadius: 14, padding: 14, marginBottom: 24, minHeight: 56, justifyContent: 'center' },
  peoplePlaceholder: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#c0c0c0', textAlign: 'center' },
  peopleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personChip: { backgroundColor: '#f0f0f0', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  personChipText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#425252' },
  cookingBox: { borderRadius: 14, borderWidth: 1, borderColor: '#e8e8e8', backgroundColor: '#fafafa', padding: 20, alignItems: 'center', marginBottom: 24 },
  cookingText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090', textAlign: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, width: 280, gap: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontFamily: 'ChillaxMedium', fontSize: 16, color: '#425252', alignSelf: 'flex-start' },
  modalInput: { width: '100%', backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#1c1d1d', borderWidth: 1, borderColor: '#e8e8e8' },
  modalBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtn: { flex: 1, backgroundColor: '#425252', borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  modalBtnText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#fff' },
});
