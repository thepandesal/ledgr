import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, ActivityIndicator, Animated, Dimensions, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import BottomSheet from '@/components/ui/BottomSheet';
import { useUser } from '../../src/hooks/useUser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors, Radius } from '@/components/ui/theme';
import { AppFont } from '../../src/lib/fonts';
const { width } = Dimensions.get('window');
const toTitleCase = (str: string) =>
  str.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function SplitBillScreen() {
  const { recordingId, recordingName, amount } = useLocalSearchParams<{ recordingId: string; recordingName: string; amount: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useUser();
  const slideAnim = useRef(new Animated.Value(width)).current;
  const [splitId, setSplitId] = useState('');
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<{ id: string; name: string; amount: string; assignments: string[] }[]>([]);
  const [newPerson, setNewPerson] = useState('');
  const [personSuggestions, setPersonSuggestions] = useState<string[]>([]);
  const [allContacts, setAllContacts] = useState<string[]>([]);
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState(false);
  const [assigningItemIdx, setAssigningItemIdx] = useState(-1);
  const [deleteModal, setDeleteModal] = useState(false);
  const [billStatus, setBillStatus] = useState<'ongoing' | 'closed'>('ongoing');
  // Payment state
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentPerson, setPaymentPerson] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  // Close confirm state
  const [closeConfirmModal, setCloseConfirmModal] = useState(false);
  const [unpaidPeopleNames, setUnpaidPeopleNames] = useState<string[]>([]);
  const [closeCreateRecording, setCloseCreateRecording] = useState(false);
  const [closeSpaceId, setCloseSpaceId] = useState<string | null>(null);
  const [closeSpaces, setCloseSpaces] = useState<any[]>([]);
  const [closingLoading, setClosingLoading] = useState(false);
  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
    init();
  }, []);
  const init = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? (await supabase.auth.getSession()).data.session?.user.id;
    if (uid) {
      setUserId(uid);
      const { data: contacts } = await supabase.from('contacts').select('name').eq('user_id', uid).order('name');
      if (contacts) setAllContacts(contacts.map((c: any) => c.name));
      const { data: friendships } = await supabase
        .from('friendships')
        .select('id, requester_id, receiver_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${uid},receiver_id.eq.${uid}`);
      if (friendships && friendships.length > 0) {
        const friendIds = friendships.map((f: any) => f.requester_id === uid ? f.receiver_id : f.requester_id);
        const names = await Promise.all(
          friendIds.map((fid: string) =>
            supabase.rpc('get_user_display_name', { user_id: fid }).then(({ data: n }) => ({ id: fid, name: n ?? 'unknown' }))
          )
        );
        setFriends(names.sort((a, b) => a.name.localeCompare(b.name)));
      }
    }
    const { data: split } = await supabase.from('bill_splits').select('id, status').eq('recording_id', recordingId).single();
    if (split) {
      setSplitId(split.id);
      setBillStatus(split.status ?? 'ongoing');
      const [{ data: ppl }, { data: itms }] = await Promise.all([
        supabase.from('bill_split_people').select('id, name').eq('split_id', split.id),
        supabase.from('bill_split_items').select('id, name, amount, bill_split_item_assignments(person_id)').eq('split_id', split.id),
      ]);
      if (ppl) setPeople(ppl);
      if (itms) setItems(itms.map(i => ({ id: i.id, name: i.name, amount: String(i.amount), assignments: (i.bill_split_item_assignments as any[]).map(a => a.person_id) })));
    }
    setLoading(false);
  };
  // ── Fetch payments for this bill split ──────────────────────────────────
  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ['bill-split-payments', splitId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_bill_payments')
        .select('id, person_name, amount, created_at, status')
        .eq('bill_split_id', splitId)
        .order('created_at');
      return data ?? [];
    },
    enabled: !!splitId,
  });
  // ── All-time loan/due balance per person ──────────────────────────────
  const { data: personBalances = {} } = useQuery({
    queryKey: ['person-loan-balances-split', userId],
    queryFn: async () => {
      const { data: recs } = await supabase
        .from('recordings')
        .select('type, person_name, amount, paid_amount')
        .eq('user_id', userId)
        .in('type', ['debt', 'due'])
        .neq('status', 'voided');
      const balances: Record<string, number> = {};
      (recs ?? []).forEach((r: any) => {
        const name = r.person_name;
        if (!name) return;
        const paid = Number(r.paid_amount ?? 0);
        const net = Number(r.amount) - paid;
        if (r.type === 'due') {
          balances[name] = (balances[name] ?? 0) + net;
        } else {
          balances[name] = (balances[name] ?? 0) - net;
        }
      });
      return balances;
    },
    enabled: !!userId,
  });
  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };
  const ensureSplit = async () => {
    if (splitId) return splitId;
    const { data } = await supabase.from('bill_splits').insert({ recording_id: recordingId, status: 'ongoing' }).select('id').single();
    setSplitId(data!.id);
    queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
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
      setPersonSuggestions(
        allContacts.filter(c =>
          c.toLowerCase().includes(val.toLowerCase()) &&
          !people.some(p => p.name.toLowerCase() === c.toLowerCase())
        )
      );
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
    queryClient.invalidateQueries({ queryKey: ['split-bills-by-person', userId] });
  };
  const removePerson = async (id: string) => {
    await supabase.from('bill_split_people').delete().eq('id', id);
    setPeople(prev => prev.filter(p => p.id !== id));
    setItems(prev => prev.map(i => ({ ...i, assignments: i.assignments.filter(a => a !== id) })));
    queryClient.invalidateQueries({ queryKey: ['split-bills-by-person', userId] });
  };
  const addItem = async () => {
    if (!newItemName.trim() || !newItemAmount) return;
    const itemAmt = parseFloat(newItemAmount);
    if (isNaN(itemAmt) || itemAmt <= 0) return;
    if (itemAmt > available) return;
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
    queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    queryClient.invalidateQueries({ queryKey: ['split-bills-by-person', userId] });
  };
  // ── Payment ──────────────────────────────────────────────────────────────
  const openPaymentModal = (personName: string) => {
    setPaymentPerson(personName);
    setPaymentAmount('');
    setPaymentModal(true);
  };
  const savePayment = async () => {
    if (!paymentPerson || !paymentAmount || !splitId) return;
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) return;
    setPaymentSaving(true);
    await supabase.from('split_bill_payments').insert({
      bill_split_id: splitId,
      person_name: paymentPerson,
      amount: amt,
    });
    setPaymentSaving(false);
    setPaymentModal(false);
    refetchPayments();
    queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    queryClient.invalidateQueries({ queryKey: ['split-bills-by-person', userId] });
  };
  // ── Close / Reopen ────────────────────────────────────────────────────────
  const handleToggleStatus = async () => {
    if (billStatus === 'closed') {
      await supabase.from('bill_splits').update({ status: 'ongoing' }).eq('id', splitId);
      setBillStatus('ongoing');
      queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
      return;
    }
    const activePayments = payments.filter((p: any) => p.status !== 'cancelled');
    const unpaid = breakdown.filter(p => {
      const paid = activePayments
        .filter((pay: any) => pay.person_name === p.name)
        .reduce((s: number, pay: any) => s + Number(pay.amount), 0);
      return p.total > 0 && paid < p.total - 0.01;
    });
    if (unpaid.length > 0) {
      setUnpaidPeopleNames(unpaid.map(p => p.name));
      setCloseCreateRecording(false);
      setCloseSpaceId(null);
      const { data: sp } = await supabase.from('spaces').select('id, name').eq('user_id', userId).eq('is_active', true).order('name');
      setCloseSpaces(sp ?? []);
      setCloseConfirmModal(true);
    } else {
      await supabase.from('bill_splits').update({ status: 'closed' }).eq('id', splitId);
      setBillStatus('closed');
      queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    }
  };
  const confirmClose = async () => {
    if (!splitId) return;
    setClosingLoading(true);
    if (closeCreateRecording && closeSpaceId) {
      const total = items.reduce((s: number, i: any) => s + parseFloat(i.amount), 0);
      const { data: expense } = await supabase.from('recordings').insert({
        user_id: userId,
        space_id: closeSpaceId,
        name: recordingName ?? 'split bill',
        type: 'expense',
        amount: total,
        transaction_date: new Date().toISOString().split('T')[0],
        status: 'paid',
        paid_amount: total,
      }).select('id').single();
      if (expense?.id) {
        const activePayments = payments.filter((p: any) => p.status !== 'cancelled');
        for (const pay of activePayments) {
          await supabase.from('recordings').insert({
            user_id: userId,
            space_id: closeSpaceId,
            name: `${recordingName ?? 'split bill'} · ${pay.person_name}`,
            type: 'return',
            amount: Number(pay.amount),
            transaction_date: new Date().toISOString().split('T')[0],
            status: 'received',
            linked_recording_id: expense.id,
          });
        }
      }
    }
    await supabase.from('bill_splits').update({ status: 'closed' }).eq('id', splitId);
    setBillStatus('closed');
    setCloseConfirmModal(false);
    setClosingLoading(false);
    queryClient.invalidateQueries({ queryKey: ['split-bills', userId] });
    queryClient.invalidateQueries({ queryKey: ['split-bills-by-person', userId] });
    if (closeCreateRecording && closeSpaceId) {
      queryClient.invalidateQueries({ queryKey: ['recordings', closeSpaceId] });
    }
  };
  const breakdown = people.map(person => {
    let total = 0;
    items.forEach(item => {
      if (item.assignments.includes(person.id) && item.assignments.length > 0) {
        total += parseFloat(item.amount) / item.assignments.length;
      }
    });
    const paid = payments
      .filter((p: any) => p.status !== 'cancelled' && p.person_name === person.name)
      .reduce((s: number, p: any) => s + Number(p.amount), 0);
    return { ...person, total, paid };
  });
  const unassignedTotal = items.reduce((sum, item) => sum + (item.assignments.length === 0 ? parseFloat(item.amount) : 0), 0);
  const itemsTotal = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  const available = parseFloat(amount) - itemsTotal;
  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>split bill</Text>
            <Text style={styles.subtitle}>{recordingName}</Text>
          </View>
          {splitId ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {billStatus === 'ongoing' && (
                <TouchableOpacity onPress={handleToggleStatus} style={{ padding: 4 }}>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setDeleteModal(true)} style={styles.deleteBtn}>
              </TouchableOpacity>
            </View>
          ) : <View style={{ width: 32 }} />}
        </View>
        {loading ? <ActivityIndicator color="#00bf63" style={{ marginTop: 40 }} /> : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>{billStatus === 'closed' ? 'closed' : 'total amount'}</Text>
              <Text style={styles.totalAmount}>{parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              {billStatus === 'closed' && (
                <TouchableOpacity style={{ marginTop: 8 }} onPress={handleToggleStatus}>
                  <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>reopen</Text>
                </TouchableOpacity>
              )}
            </View>
            {/* People */}
            <Text style={styles.sectionTitle}>people</Text>
            <View style={styles.peopleRow}>
              {people.map(p => (
                <View key={p.id} style={styles.personChip}>
                  <Text style={styles.personChipText}>{p.name}</Text>
                  {billStatus === 'ongoing' && (
                    <TouchableOpacity onPress={() => removePerson(p.id)}>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
            {billStatus === 'ongoing' && (
              <>
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
                  </TouchableOpacity>
                </View>
                {personSuggestions.length > 0 && (
                  <View style={styles.suggestions}>
                    {personSuggestions.map(s => (
                      <TouchableOpacity key={s} style={styles.suggestion} onPress={() => addPerson(s)}>
                        <Text style={styles.suggestionText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {friends.filter(f => !people.some(p => p.name.toLowerCase() === f.name.toLowerCase())).length > 0 && (
                  <>
                    <Text style={styles.friendsLabel}>friends</Text>
                    <View style={styles.friendsRow}>
                      {friends
                        .filter(f => !people.some(p => p.name.toLowerCase() === f.name.toLowerCase()))
                        .map(f => (
                          <TouchableOpacity key={f.id} style={styles.friendChip} onPress={() => addPerson(f.name)}>
                            <View style={styles.friendAvatar}>
                              <Text style={styles.friendAvatarText}>{f.name.charAt(0).toUpperCase()}</Text>
                            </View>
                            <Text style={styles.friendChipText}>{f.name}</Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </>
                )}
              </>
            )}
            {/* Items */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>items</Text>
              {billStatus === 'ongoing' && (
                <Text style={[styles.availableText, available < 0 && { color: '#e74c3c' }]}>
                  {available >= 0 ? `${fmt(available)} available` : `over by ${fmt(Math.abs(available))}`}
                </Text>
              )}
            </View>
            {items.map((item, idx) => {
              const assignedNames = people.filter(p => item.assignments.includes(p.id)).map(p => p.name);
              return (
                <TouchableOpacity key={item.id} style={styles.itemCard} onPress={billStatus === 'ongoing' ? () => openAssign(idx) : undefined} activeOpacity={0.7}>
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemAssigned}>
                      {assignedNames.length === 0 ? 'tap to assign' : assignedNames.join(', ')}
                    </Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemAmount}>{fmt(parseFloat(item.amount))}</Text>
                    {billStatus === 'ongoing' && (
                      <TouchableOpacity onPress={() => removeItem(item.id)} style={{ padding: 4 }}>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
            {billStatus === 'ongoing' && (
              <View style={styles.addRow}>
                <TextInput style={[styles.input, { flex: 2 }]} placeholder="item name" placeholderTextColor="#b0b0b0" value={newItemName} onChangeText={setNewItemName} />
                <TextInput style={[styles.input, { flex: 1, marginLeft: 8 }]} placeholder="amount" placeholderTextColor="#b0b0b0" value={newItemAmount} onChangeText={setNewItemAmount} keyboardType="decimal-pad" />
                <TouchableOpacity style={[styles.addBtn, (available <= 0 || !newItemName.trim() || !newItemAmount) && styles.addBtnDisabled]} onPress={addItem} disabled={available <= 0 || !newItemName.trim() || !newItemAmount}>
                </TouchableOpacity>
              </View>
            )}
            {/* Breakdown with payments */}
            {breakdown.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>breakdown</Text>
                {breakdown.map(p => {
                  const remaining = Math.max(0, p.total - p.paid);
                  const fullyPaid = p.total > 0 && p.paid >= p.total - 0.01;
                  const allTimeBal = personBalances[p.name];
                  return (
                    <View key={p.id} style={styles.breakdownCard}>
                      <View style={styles.breakdownTop}>
                        <View style={styles.breakdownAvatar}>
                          <Text style={styles.breakdownAvatarText}>{p.name[0].toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.breakdownName}>{p.name}</Text>
                          <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: '#8a8a8a' }}>
                            owes: {fmt(p.total)}
                            {p.paid > 0 && ` · paid: ${fmt(p.paid)}`}
                            {!fullyPaid && p.total > 0 && ` · left: ${fmt(remaining)}`}
                          </Text>
                          {allTimeBal !== undefined && (
                            <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 10, color: allTimeBal < 0 ? '#e74c3c' : '#00bf63' }}>
                              {allTimeBal < 0 ? 'you owe' : 'owed'} all time: {fmt(Math.abs(allTimeBal))}
                            </Text>
                          )}
                        </View>
                        {fullyPaid && (
                          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#f0fdf4' }}>
                            <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 11, color: '#00bf63' }}>paid</Text>
                          </View>
                        )}
                        {billStatus === 'ongoing' && !fullyPaid && p.total > 0 && (
                          <TouchableOpacity style={styles.payBtn} onPress={() => openPaymentModal(p.name)}>
                            <Text style={styles.payBtnText}>pay</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {/* Payment history for this person */}
                      {(() => {
                        const personPays = payments.filter((pay: any) => pay.person_name === p.name);
                        if (personPays.length === 0) return null;
                        return (
                          <View style={{ borderTopWidth: 1, borderTopColor: '#e8e8e8', marginTop: 8, paddingTop: 8 }}>
                            {personPays.slice().sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                              .map((pay: any, pi: number) => (
                                <View key={pay.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                                  <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 10, color: '#8a8a8a' }}>
                                    {new Date(pay.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </Text>
                                  <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 12, color: '#00bf63', flex: 1 }}>{fmt(Number(pay.amount))}</Text>
                                  {pay.status === 'cancelled' && <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 9, color: '#8a8a8a' }}>cancelled</Text>}
                                </View>
                              ))}
                          </View>
                        );
                      })()}
                    </View>
                  );
                })}
                {unassignedTotal > 0 && (
                  <View style={styles.unassignedRow}>
                    <Text style={styles.unassignedText}>{fmt(unassignedTotal)} unassigned</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
      {/* Payment modal */}
      <Modal visible={paymentModal} transparent animationType="fade" onRequestClose={() => setPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>payment from {paymentPerson}</Text>
            <TextInput
              style={[styles.input, { fontSize: 24, textAlign: 'center', marginVertical: 16 }]}
              placeholder="0.00"
              placeholderTextColor="#b0b0b0"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.doneBtn, { flex: 1, backgroundColor: '#f5f5f5' }]} onPress={() => setPaymentModal(false)}>
                <Text style={[styles.doneBtnText, { color: '#8a8a8a' }]}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.doneBtn, { flex: 2, backgroundColor: '#00bf63', opacity: paymentSaving || !paymentAmount ? 0.5 : 1 }]}
                onPress={savePayment}
                disabled={paymentSaving || !paymentAmount}
              >
                <Text style={styles.doneBtnText}>{paymentSaving ? 'saving...' : 'record payment'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Close confirm modal */}
      <BottomSheet visible={closeConfirmModal} onClose={() => setCloseConfirmModal(false)} title="close split bill?" maxHeight="50%">
        <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted, marginBottom: 12 }}>
          these people haven't paid yet:
        </Text>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {unpaidPeopleNames.map((name, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.text }}>{name}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
          onPress={() => setCloseCreateRecording(v => !v)}
        >
          <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.text, flex: 1 }}>
            create an expense and return recordings
          </Text>
        </TouchableOpacity>
        {closeCreateRecording && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>space</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {closeSpaces.map(sp => (
                <TouchableOpacity
                  key={sp.id}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1,
                    borderColor: closeSpaceId === sp.id ? '#00bf63' : '#e8e8e8',
                    backgroundColor: closeSpaceId === sp.id ? '#f0fdf4' : '#f5f5f5',
                  }}
                  onPress={() => setCloseSpaceId(sp.id)}
                >
                  <Text style={{
                    fontFamily: 'Poppins-SemiBold', fontSize: 12,
                    color: closeSpaceId === sp.id ? '#00bf63' : '#1c1d1d',
                  }}>{sp.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <TouchableOpacity
          style={[styles.doneBtn, { opacity: closingLoading || (closeCreateRecording && !closeSpaceId) ? 0.5 : 1 }]}
          onPress={confirmClose}
          disabled={closingLoading || (closeCreateRecording && !closeSpaceId)}
        >
          <Text style={styles.doneBtnText}>{closingLoading ? 'closing...' : 'close anyway'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: '#f5f5f5', marginTop: 8 }]}
          onPress={() => setCloseConfirmModal(false)}
        >
          <Text style={[styles.doneBtnText, { color: '#8a8a8a' }]}>cancel</Text>
        </TouchableOpacity>
      </BottomSheet>
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
                  {isAssigned && null}
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
  title: { fontFamily: 'Poppins-Bold', fontSize: 16, color: '#1c1d1d' },
  subtitle: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#8a8a8a', marginTop: 1 },
  body: { padding: 20, gap: 8, paddingBottom: 60 },
  totalCard: { backgroundColor: '#00bf63', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 8 },
  totalLabel: { fontFamily: 'Poppins-Regular', fontSize: 12, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalAmount: { fontFamily: 'Poppins-Bold', fontSize: 28, color: '#ffffff', marginTop: 4 },
  sectionTitle: { fontFamily: 'Poppins-Bold', fontSize: 14, color: '#1c1d1d', marginTop: 8, marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
  availableText: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: '#00bf63' },
  addBtnDisabled: { opacity: 0.4 },
  peopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  personChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e8e8e8' },
  personChipText: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: '#1c1d1d' },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Poppins-Regular', fontSize: 14, color: '#1c1d1d', borderWidth: 1, borderColor: '#e8e8e8' },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#00bf63', justifyContent: 'center', alignItems: 'center' },
  suggestions: { backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e8e8e8' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  suggestionText: { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#1c1d1d' },
  friendsLabel: { fontFamily: 'Poppins-Bold', fontSize: 11, color: '#b0b0b0', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10, marginBottom: 6 },
  friendsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  friendChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffffff', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e8e8e8' },
  friendAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#00bf6322', justifyContent: 'center', alignItems: 'center' },
  friendAvatarText: { fontFamily: 'Poppins-Bold', fontSize: 11, color: '#00bf63' },
  friendChipText: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: '#1c1d1d' },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e8e8e8' },
  itemLeft: { flex: 1 },
  itemName: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#1c1d1d' },
  itemAssigned: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#b0b0b0', marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemAmount: { fontFamily: 'Poppins-Bold', fontSize: 14, color: '#1c1d1d' },
  breakdownCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#e8e8e8', marginBottom: 8,
  },
  breakdownTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  breakdownAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#00bf63', justifyContent: 'center', alignItems: 'center' },
  breakdownAvatarText: { fontFamily: 'Poppins-Bold', fontSize: 14, color: '#ffffff' },
  breakdownName: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#1c1d1d' },
  payBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#00bf6322' },
  payBtnText: { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: '#00bf63' },
  unassignedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  unassignedText: { fontFamily: 'Poppins-Regular', fontSize: 13, color: '#e67e22' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, width: '85%', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontFamily: 'Poppins-Bold', fontSize: 16, color: '#1c1d1d' },
  modalSub: { fontFamily: 'Poppins-Regular', fontSize: 13, color: '#8a8a8a' },
  assignAllBtn: { backgroundColor: '#f0fdf4', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#00bf63' },
  assignAllText: { fontFamily: 'Poppins-SemiBold', fontSize: 13, color: '#00bf63' },
  personRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  personRowText: { fontFamily: 'Poppins-Regular', fontSize: 15, color: '#1c1d1d' },
  personRowTextActive: { fontFamily: 'Poppins-SemiBold', color: '#00bf63' },
  doneBtn: { backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  doneBtnText: { fontFamily: 'Poppins-SemiBold', fontSize: 14, color: '#ffffff' },
});

