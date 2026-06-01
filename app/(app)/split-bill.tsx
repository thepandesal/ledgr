import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, ActivityIndicator, Animated, Dimensions, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';

const { width } = Dimensions.get('window');

const toTitleCase = (str: string) =>
  str.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

export default function SplitBillScreen() {
  const { recordingId, recordingName, amount } = useLocalSearchParams<{ recordingId: string; recordingName: string; amount: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  const [splitId, setSplitId] = useState('');
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<{ id: string; name: string; amount: string; assignments: string[] }[]>([]);
  const [newPerson, setNewPerson] = useState('');
  const [personSuggestions, setPersonSuggestions] = useState<string[]>([]);
  const [allContacts, setAllContacts] = useState<string[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState(false);
  const [assigningItemIdx, setAssigningItemIdx] = useState(-1);
  const [deleteModal, setDeleteModal] = useState(false);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      // Load contacts
      const { data: contacts } = await supabase.from('contacts').select('name').eq('user_id', user.id).order('name');
      if (contacts) setAllContacts(contacts.map((c: any) => c.name));
    }
    // Load existing split
    const { data: split } = await supabase.from('bill_splits').select('id').eq('recording_id', recordingId).single();
    if (split) {
      setSplitId(split.id);
      const [{ data: ppl }, { data: itms }] = await Promise.all([
        supabase.from('bill_split_people').select('id, name').eq('split_id', split.id),
        supabase.from('bill_split_items').select('id, name, amount, bill_split_item_assignments(person_id)').eq('split_id', split.id),
      ]);
      if (ppl) setPeople(ppl);
      if (itms) setItems(itms.map(i => ({ id: i.id, name: i.name, amount: String(i.amount), assignments: (i.bill_split_item_assignments as any[]).map(a => a.person_id) })));
    }
    setLoading(false);
  };

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  const ensureSplit = async () => {
    if (splitId) return splitId;
    const { data } = await supabase.from('bill_splits').insert({ recording_id: recordingId }).select('id').single();
    setSplitId(data!.id);
    return data!.id;
  };

  const saveContact = async (name: string) => {
    if (!userId || allContacts.includes(name)) return;
    await supabase.from('contacts').upsert({ user_id: userId, name }, { onConflict: 'name' });
    setAllContacts(prev => [...prev, name].sort());
  };

  const handlePersonInput = (val: string) => {
    setNewPerson(val);
    if (val.trim()) {
      setPersonSuggestions(allContacts.filter(c => c.toLowerCase().includes(val.toLowerCase()) && !people.some(p => p.name === c)));
    } else {
      setPersonSuggestions([]);
    }
  };

  const addPerson = async (nameOverride?: string) => {
    const raw = nameOverride ?? newPerson;
    if (!raw.trim()) return;
    const name = toTitleCase(raw);
    const sid = await ensureSplit();
    const { data } = await supabase.from('bill_split_people').insert({ split_id: sid, name }).select('id, name').single();
    if (data) setPeople(prev => [...prev, data]);
    await saveContact(name);
    setNewPerson('');
    setPersonSuggestions([]);
  };

  const removePerson = async (id: string) => {
    await supabase.from('bill_split_people').delete().eq('id', id);
    setPeople(prev => prev.filter(p => p.id !== id));
    setItems(prev => prev.map(i => ({ ...i, assignments: i.assignments.filter(a => a !== id) })));
  };

  const addItem = async () => {
    if (!newItemName.trim() || !newItemAmount) return;
    const sid = await ensureSplit();
    const { data } = await supabase.from('bill_split_items').insert({ split_id: sid, name: toTitleCase(newItemName), amount: parseFloat(newItemAmount) }).select('id, name, amount').single();
    if (data) setItems(prev => [...prev, { id: data.id, name: data.name, amount: String(data.amount), assignments: [] }]);
    setNewItemName(''); setNewItemAmount('');
  };

  const removeItem = async (id: string) => {
    await supabase.from('bill_split_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const openAssign = (idx: number) => { setAssigningItemIdx(idx); setAssignModal(true); };

  const toggleAssign = async (personId: string) => {
    const item = items[assigningItemIdx];
    const isAssigned = item.assignments.includes(personId);
    if (isAssigned) {
      const { data: existing } = await supabase.from('bill_split_item_assignments').select('id').eq('item_id', item.id).eq('person_id', personId).single();
      if (existing) await supabase.from('bill_split_item_assignments').delete().eq('id', existing.id);
      setItems(prev => prev.map((it, i) => i === assigningItemIdx ? { ...it, assignments: it.assignments.filter(a => a !== personId) } : it));
    } else {
      await supabase.from('bill_split_item_assignments').insert({ item_id: item.id, person_id: personId });
      setItems(prev => prev.map((it, i) => i === assigningItemIdx ? { ...it, assignments: [...it.assignments, personId] } : it));
    }
  };

  const assignAll = async () => {
    const item = items[assigningItemIdx];
    for (const p of people) {
      if (!item.assignments.includes(p.id)) {
        await supabase.from('bill_split_item_assignments').insert({ item_id: item.id, person_id: p.id });
      }
    }
    setItems(prev => prev.map((it, i) => i === assigningItemIdx ? { ...it, assignments: people.map(p => p.id) } : it));
  };

  const deleteSplit = async () => {
    if (splitId) await supabase.from('bill_splits').delete().eq('id', splitId);
    setSplitId(''); setPeople([]); setItems([]); setDeleteModal(false);
  };

  const breakdown = people.map(person => {
    let total = 0;
    items.forEach(item => {
      if (item.assignments.includes(person.id) && item.assignments.length > 0) {
        total += parseFloat(item.amount) / item.assignments.length;
      }
    });
    return { ...person, total };
  });

  const unassignedTotal = items.reduce((sum, item) => sum + (item.assignments.length === 0 ? parseFloat(item.amount) : 0), 0);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#8a8a8a" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>split bill</Text>
            <Text style={styles.subtitle}>{recordingName}</Text>
          </View>
          {splitId ? (
            <TouchableOpacity onPress={() => setDeleteModal(true)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={20} color="#e74c3c" />
            </TouchableOpacity>
          ) : <View style={{ width: 32 }} />}
        </View>

        {loading ? <ActivityIndicator color="#00bf63" style={{ marginTop: 40 }} /> : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>total amount</Text>
              <Text style={styles.totalAmount}>{parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>

            {/* People */}
            <Text style={styles.sectionTitle}>people</Text>
            <View style={styles.peopleRow}>
              {people.map(p => (
                <View key={p.id} style={styles.personChip}>
                  <Text style={styles.personChipText}>{p.name}</Text>
                  <TouchableOpacity onPress={() => removePerson(p.id)}>
                    <Ionicons name="close" size={14} color="#8a8a8a" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="add a person..."
                placeholderTextColor="#b0b0b0"
                value={newPerson}
                onChangeText={handlePersonInput}
                returnKeyType="done"
                onSubmitEditing={() => addPerson()}
              />
              <TouchableOpacity style={styles.addBtn} onPress={() => addPerson()}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {personSuggestions.length > 0 && (
              <View style={styles.suggestions}>
                {personSuggestions.map(s => (
                  <TouchableOpacity key={s} style={styles.suggestion} onPress={() => addPerson(s)}>
                    <Ionicons name="person-outline" size={14} color="#8a8a8a" />
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Items */}
            <Text style={styles.sectionTitle}>items</Text>
            {items.map((item, idx) => {
              const assignedNames = people.filter(p => item.assignments.includes(p.id)).map(p => p.name);
              return (
                <TouchableOpacity key={item.id} style={styles.itemCard} onPress={() => openAssign(idx)} activeOpacity={0.7}>
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemAssigned}>
                      {assignedNames.length === 0 ? 'tap to assign' : assignedNames.join(', ')}
                    </Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemAmount}>{parseFloat(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                    <TouchableOpacity onPress={() => removeItem(item.id)} style={{ padding: 4 }}>
                      <Ionicons name="trash-outline" size={14} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={styles.addRow}>
              <TextInput style={[styles.input, { flex: 2 }]} placeholder="item name" placeholderTextColor="#b0b0b0" value={newItemName} onChangeText={setNewItemName} />
              <TextInput style={[styles.input, { flex: 1, marginLeft: 8 }]} placeholder="amount" placeholderTextColor="#b0b0b0" value={newItemAmount} onChangeText={setNewItemAmount} keyboardType="decimal-pad" />
              <TouchableOpacity style={styles.addBtn} onPress={addItem}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Breakdown */}
            {breakdown.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>breakdown</Text>
                {breakdown.map(p => (
                  <View key={p.id} style={styles.breakdownRow}>
                    <View style={styles.breakdownAvatar}>
                      <Text style={styles.breakdownAvatarText}>{p.name[0].toUpperCase()}</Text>
                    </View>
                    <Text style={styles.breakdownName}>{p.name}</Text>
                    <Text style={styles.breakdownAmount}>{p.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  </View>
                ))}
                {unassignedTotal > 0 && (
                  <View style={styles.unassignedRow}>
                    <Ionicons name="alert-circle-outline" size={16} color="#e67e22" />
                    <Text style={styles.unassignedText}>{unassignedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} unassigned</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Assign Modal */}
      <Modal visible={assignModal} transparent animationType="fade" onRequestClose={() => setAssignModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{assigningItemIdx >= 0 ? items[assigningItemIdx]?.name : ''}</Text>
            <Text style={styles.modalSub}>who does this belong to?</Text>
            <TouchableOpacity style={styles.assignAllBtn} onPress={assignAll}>
              <Text style={styles.assignAllText}>assign to everyone</Text>
            </TouchableOpacity>
            {people.map(p => {
              const isAssigned = assigningItemIdx >= 0 && items[assigningItemIdx]?.assignments.includes(p.id);
              return (
                <TouchableOpacity key={p.id} style={styles.personRow} onPress={() => toggleAssign(p.id)}>
                  <Text style={[styles.personRowText, isAssigned && styles.personRowTextActive]}>{p.name}</Text>
                  {isAssigned && <Ionicons name="checkmark" size={18} color="#00bf63" />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.doneBtn} onPress={() => setAssignModal(false)}>
              <Text style={styles.doneBtnText}>done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Modal */}
      <Modal visible={deleteModal} transparent animationType="fade" onRequestClose={() => setDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>delete split?</Text>
            <Text style={styles.modalSub}>This will remove all people, items and assignments. Are you sure?</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.doneBtn, { flex: 1, backgroundColor: '#f5f5f5' }]} onPress={() => setDeleteModal(false)}>
                <Text style={[styles.doneBtnText, { color: '#8a8a8a' }]}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.doneBtn, { flex: 1, backgroundColor: '#e74c3c' }]} onPress={deleteSplit}>
                <Text style={styles.doneBtnText}>delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e8e8e8' },
  backBtn: { width: 32 },
  deleteBtn: { width: 32, alignItems: 'flex-end' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#1c1d1d' },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#8a8a8a', marginTop: 1 },
  body: { padding: 20, gap: 8, paddingBottom: 60 },
  totalCard: { backgroundColor: '#00bf63', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 8 },
  totalLabel: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalAmount: { fontFamily: 'DMSans_700Bold', fontSize: 28, color: '#ffffff', marginTop: 4 },
  sectionTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#1c1d1d', marginTop: 8, marginBottom: 4 },
  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  personChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e8e8e8' },
  personChipText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: '#1c1d1d' },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1c1d1d', borderWidth: 1, borderColor: '#e8e8e8' },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#00bf63', justifyContent: 'center', alignItems: 'center' },
  suggestions: { backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e8e8e8' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  suggestionText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#1c1d1d' },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e8e8e8' },
  itemLeft: { flex: 1 },
  itemName: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#1c1d1d' },
  itemAssigned: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#b0b0b0', marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemAmount: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#1c1d1d' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e8e8e8', gap: 12 },
  breakdownAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#00bf63', justifyContent: 'center', alignItems: 'center' },
  breakdownAvatarText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#ffffff' },
  breakdownName: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#1c1d1d', flex: 1 },
  breakdownAmount: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: '#1c1d1d' },
  unassignedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  unassignedText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#e67e22' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, width: '85%', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: '#1c1d1d' },
  modalSub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#8a8a8a' },
  assignAllBtn: { backgroundColor: '#f0fdf4', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#00bf63' },
  assignAllText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: '#00bf63' },
  personRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  personRowText: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#1c1d1d' },
  personRowTextActive: { fontFamily: 'DMSans_600SemiBold', color: '#00bf63' },
  doneBtn: { backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  doneBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#ffffff' },
});
