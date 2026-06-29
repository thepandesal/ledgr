import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, Animated, Dimensions, ActivityIndicator, TextInput, Share, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase';
import { useUser } from '../../src/hooks/useUser';
import { Colors, Fonts, Radius } from '@/components/ui/theme';
import pageStyles from '@/components/ui/pageStyles';
import BottomSheet from '@/components/ui/BottomSheet';
import itemStyles from '@/components/ui/itemStyles';

const { width } = Dimensions.get('window');

export default function SplitBillDetailScreen() {
  const { splitBillId, name } = useLocalSearchParams<{ splitBillId: string; name: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
  }, []);

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  // ── Load linked recordings ────────────────────────────────────────────────
  const { userId } = useUser();

  // ── People state ─────────────────────────────────────────────────────────
  const [addPersonModal, setAddPersonModal] = useState(false);
  const [tagInputVal, setTagInputVal] = useState('');
  const [contacts, setContacts] = useState<string[]>([]);

  const { data: people = [], refetch: refetchPeople } = useQuery({
    queryKey: ['split-bill-people', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('bill_splits')
        .select('id, person_name')
        .eq('split_bill_id', splitBillId)
        .order('created_at');
      return data ?? [];
    },
    enabled: !!splitBillId,
  });

  const filledPeople = people.map((p: any) => p.person_name);

  useEffect(() => {
    if (!userId) return;
    supabase.from('contacts').select('name').eq('user_id', userId).order('name')
      .then(({ data }) => { if (data) setContacts(data.map((c: any) => c.name)); });
  }, [userId]);

  const savePerson = async (name: string) => {
    if (!name.trim() || filledPeople.includes(name.trim())) return;
    await supabase.from('bill_splits').insert({ split_bill_id: splitBillId, user_id: userId, person_name: name.trim() });
    // save to contacts too
    const exists = contacts.includes(name.trim());
    if (!exists) {
      await supabase.from('contacts').insert({ user_id: userId, name: name.trim() });
      setContacts(prev => [...prev, name.trim()].sort());
    }
    refetchPeople();
  };

  const removePerson = async (id: string) => {
    await supabase.from('bill_splits').delete().eq('id', id);
    refetchPeople();
  };

  const handleAddPersonSubmit = async () => {
    const name = tagInputVal.trim();
    if (name) await savePerson(name);
    setTagInputVal('');
  };

  // ── Items state ──────────────────────────────────────────────────────────
  const [addItemModal, setAddItemModal]         = useState(false);
  const [itemStep, setItemStep]                 = useState<'pick-recording' | 'configure'>('pick-recording');
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  const [itemName, setItemName]                 = useState('');
  const [itemCost, setItemCost]                 = useState('');
  const [itemPeople, setItemPeople]             = useState<string[]>([]);
  const [itemMode, setItemMode]                 = useState<'equal' | 'manual'>('equal');
  const [itemManual, setItemManual]             = useState<Record<string, string>>({});
  const [itemError, setItemError]               = useState('');
  const [savingItem, setSavingItem]             = useState(false);

  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ['split-bill-items', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_items')
        .select('*, split_subitems(*)')
        .eq('split_bill_id', splitBillId)
        .order('created_at');
      return (data ?? []).map((i: any) => ({ ...i, subitems: i.split_subitems ?? [] }));
    },
    enabled: !!splitBillId,
  });

  const totalItemsCost = items.reduce((s: number, i: any) => s + Number(i.cost), 0);

  const openAddItem = () => {
    setItemStep('pick-recording');
    setSelectedRecording(null);
    setItemName(''); setItemCost(''); setItemPeople([]);
    setItemMode('equal'); setItemManual({}); setItemError('');
    setAddItemModal(true);
  };

  const handlePickRecording = (lr: any) => {
    setSelectedRecording(lr);
    const recType = lr.recording?.type;
    const isDeductType = recType === 'payable' || recType === 'receivable';
    setItemName(isDeductType ? (lr.recording?.name ?? '') : '');
    setItemCost(isDeductType ? String(lr.amount_contributed) : '');
    setItemPeople([]); setItemMode('equal'); setItemManual({}); setItemError('');
    setItemStep('configure');
  };

  const saveItem = async () => {
    if (!selectedRecording) return;
    const recType = selectedRecording.recording?.type;
    const isDeductType = recType === 'payable' || recType === 'receivable';
    if (!isDeductType && (!itemName.trim() || !itemCost)) { setItemError('name and amount required.'); return; }
    if (itemPeople.length === 0) { setItemError('select at least one person.'); return; }
    const cost = parseFloat(isDeductType ? String(selectedRecording.amount_contributed) : itemCost);
    if (itemMode === 'manual') {
      const total = itemPeople.reduce((s, p) => s + parseFloat(itemManual[p] || '0'), 0);
      if (Math.abs(total - cost) > 0.01) { setItemError(`amounts must total ${fmt(cost)}`); return; }
    }
    setSavingItem(true);
    await supabase.from('split_items').insert({
      split_bill_id: splitBillId,
      user_id: userId,
      name: isDeductType ? (selectedRecording.recording?.name ?? itemName) : itemName.trim(),
      cost,
      people: itemPeople,
      recording_type: recType ?? 'expense',
    });
    setSavingItem(false);
    setAddItemModal(false);
    refetchItems();
  };

  const deleteItem = async (id: string) => {
    await supabase.from('split_items').delete().eq('id', id);
    refetchItems();
  };

  // ── Share ──────────────────────────────────────────────────────────────────
  const { data: shareRow } = useQuery({
    queryKey: ['split-bill-share', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_shares')
        .select('id')
        .eq('split_bill_id', splitBillId)
        .maybeSingle();
      return data;
    },
    enabled: !!splitBillId,
  });

  const handleShare = async () => {
    let shareId = shareRow?.id;
    if (!shareId) {
      const { data } = await supabase
        .from('split_shares')
        .insert({ split_bill_id: splitBillId, data: {} })
        .select('id')
        .single();
      shareId = data?.id;
    }
    if (!shareId) return;
    const url = `https://ledgr.art/split/${shareId}`;
    if (Platform.OS !== 'web') {
      Share.share({ message: url, url });
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
  };

  const { data: linkedRecordings = [], isLoading: loadingRecs } = useQuery({
    queryKey: ['split-bill-recordings', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_bill_recordings')
        .select('id, amount_contributed, recording:recording_id(id, name, amount, type, transaction_date)')
        .eq('split_bill_id', splitBillId)
        .order('created_at');
      return (data ?? []).map((r: any) => ({
        ...r,
        recording: Array.isArray(r.recording) ? r.recording[0] : r.recording,
      }));
    },
    enabled: !!splitBillId,
  });

  const totalAmount = linkedRecordings.reduce((s: number, r: any) => s + Number(r.amount_contributed), 0);
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const typeColor = (type: string) => {
    if (['income', 'savings', 'return', 'receivable'].includes(type)) return Colors.cyan;
    return '#FFAB91';
  };

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: Colors.white }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} style={pageStyles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={Colors.muted} />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{name}</Text>
          <View style={s.totalBadge}>
            <Text style={s.totalBadgeText}>{fmt(totalAmount)}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Linked Recordings */}
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>recordings</Text>
            <Text style={s.sectionAddText}>recordings</Text>
          </View>
          {loadingRecs ? (
            <ActivityIndicator color={Colors.cyan} />
          ) : linkedRecordings.length === 0 ? (
            <View style={pageStyles.emptyBox}>
              <Text style={pageStyles.emptyText}>no recordings linked yet</Text>
            </View>
          ) : (
            <View style={s.list}>
              {linkedRecordings.map((lr: any) => (
                <TouchableOpacity
                  key={lr.id}
                  style={s.recRow}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: lr.recording?.id } } as any)}
                >
                  <View style={s.recIconWrap}>
                    <Ionicons name="receipt-outline" size={16} color={Colors.cyan} />
                  </View>
                  <View style={s.recMid}>
                    <Text style={s.recName} numberOfLines={1}>{lr.recording?.name ?? '—'}</Text>
                    <Text style={s.recDate}>
                      {lr.recording?.transaction_date
                        ? new Date(lr.recording.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </Text>
                  </View>
                  <Text style={[s.recAmount, { color: typeColor(lr.recording?.type ?? '') }]}>
                    {fmt(Number(lr.amount_contributed))}
                  </Text>
                  <TouchableOpacity
                    onPress={async () => {
                      await supabase.from('split_bill_recordings').delete().eq('id', lr.id);
                      queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={14} color={Colors.faint} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* People */}
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>people</Text>
            <TouchableOpacity onPress={() => { setTagInputVal(''); setAddPersonModal(true); }} style={s.sectionAddBtn}>
              <Ionicons name="add" size={14} color={Colors.cyan} />
              <Text style={s.sectionAddText}>add</Text>
            </TouchableOpacity>
          </View>
          {filledPeople.length === 0 ? (
            <View style={pageStyles.emptyBox}>
              <Text style={pageStyles.emptyText}>no people yet — tap add</Text>
            </View>
          ) : (
            <View style={s.chipWrap}>
              {people.map((p: any) => (
                <View key={p.id} style={s.personChip}>
                  <Text style={s.personChipText}>{p.person_name}</Text>
                  <TouchableOpacity onPress={() => removePerson(p.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close" size={11} color={Colors.muted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Items */}
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>items</Text>
            <TouchableOpacity
              onPress={openAddItem}
              style={s.sectionAddBtn}
              disabled={filledPeople.length === 0 || linkedRecordings.length === 0}
            >
              <Ionicons name="add" size={14} color={filledPeople.length === 0 || linkedRecordings.length === 0 ? Colors.faint : Colors.cyan} />
              <Text style={[s.sectionAddText, (filledPeople.length === 0 || linkedRecordings.length === 0) && { color: Colors.faint }]}>add</Text>
            </TouchableOpacity>
          </View>
          {items.length === 0 ? (
            <View style={pageStyles.emptyBox}>
              <Text style={pageStyles.emptyText}>{filledPeople.length === 0 ? 'add people first' : 'no items yet'}</Text>
            </View>
          ) : (
            <View style={s.list}>
              {items.map((item: any, idx: number) => {
                const isDeduct = item.recording_type === 'receivable' || item.recording_type === 'payable';
                const perPerson = item.people?.length > 0 ? Number(item.cost) / item.people.length : 0;
                return (
                  <View key={item.id} style={s.itemCard}>
                    <Text style={s.itemNum}>{idx + 1}</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                      {item.people?.length > 0 && (
                        <Text style={[s.itemSplit, { color: isDeduct ? Colors.cyan : '#FFAB91' }]}>
                          {isDeduct ? '-' : '+'}{perPerson.toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                        </Text>
                      )}
                    </View>
                    <Text style={[s.itemCost, { color: isDeduct ? Colors.cyan : Colors.text }]}>{isDeduct ? '-' : ''}{fmt(Number(item.cost))}</Text>
                    <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={14} color={Colors.faint} />
                    </TouchableOpacity>
                  </View>
                );
              })}
              <View style={s.itemsTotalRow}>
                <Text style={s.itemsTotalLabel}>total allocated</Text>
                <View style={s.itemsTotalDots} />
                <Text style={s.itemsTotalValue}>{fmt(totalItemsCost)}</Text>
              </View>
            </View>
          )}

          {/* Per-person summary */}
          <Text style={s.sectionHeader}>per person summary</Text>
          {filledPeople.length === 0 || items.length === 0 ? (
            <View style={pageStyles.emptyBox}>
              <Text style={pageStyles.emptyText}>add people and items to see summary</Text>
            </View>
          ) : (() => {
            // build per-person totals from items
            const totals: Record<string, number> = {};
            filledPeople.forEach(p => { totals[p] = 0; });
            items.forEach((item: any) => {
              const isDeduct = item.recording_type === 'receivable' || item.recording_type === 'payable';
              const pp = item.people?.length > 0 ? Number(item.cost) / item.people.length : 0;
              (item.people ?? []).forEach((p: string) => {
                if (totals[p] !== undefined) totals[p] += isDeduct ? -pp : pp;
              });
            });
            const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
            return (
              <View style={s.list}>
                {filledPeople.map(p => (
                  <View key={p} style={s.summaryRow}>
                    <Text style={s.summaryName}>{p}</Text>
                    <View style={s.summaryDots} />
                    <Text style={[s.summaryAmount, totals[p] < 0 && { color: Colors.cyan }]}>
                      {totals[p] < 0 ? '-' : ''}{fmt(Math.abs(totals[p]))}
                    </Text>
                  </View>
                ))}
                <View style={[s.summaryRow, { backgroundColor: Colors.cyan + '18', borderColor: Colors.cyan }]}>
                  <Text style={[s.summaryName, { fontFamily: Fonts.monoBold, color: Colors.cyan }]}>total</Text>
                  <View style={s.summaryDots} />
                  <Text style={[s.summaryAmount, { color: Colors.cyan }]}>{fmt(grandTotal)}</Text>
                </View>
              </View>
            );
          })()}

          {/* Share */}
          <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={15} color={Colors.muted} />
            <Text style={s.shareBtnText}>share split bill</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>

      {/* Add item modal */}
      <BottomSheet visible={addItemModal} onClose={() => setAddItemModal(false)} title={itemStep === 'pick-recording' ? 'for which recording?' : 'configure item'} height="65%">
        {itemStep === 'pick-recording' ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {linkedRecordings.map((lr: any) => {
              const recType = lr.recording?.type;
              const isDeduct = recType === 'receivable' || recType === 'payable';
              // show how many items are already under this recording
              const recItems = items.filter((i: any) => i.recording_type === recType && i.name === lr.recording?.name);
              const usedAmt = recItems.reduce((s: number, i: any) => s + Number(i.cost), 0);
              const remaining = Number(lr.amount_contributed) - usedAmt;
              return (
                <TouchableOpacity key={lr.id} style={s.recPickRow} onPress={() => handlePickRecording(lr)}>
                  <View style={[s.recIconWrap, { backgroundColor: isDeduct ? Colors.cyan + '22' : '#FFAB9122' }]}>
                    <Ionicons name={recType === 'payable' ? 'cash-outline' : isDeduct ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={16} color={isDeduct ? Colors.cyan : '#FFAB91'} />
                  </View>
                  <View style={s.recMid}>
                    <Text style={s.recName} numberOfLines={1}>{lr.recording?.name ?? '—'}</Text>
                    <Text style={s.recDate}>{recType} · {fmt(Number(lr.amount_contributed))}</Text>
                  </View>
                  {isDeduct ? (
                    <Text style={[s.recDate, { color: remaining < 0 ? Colors.expense : Colors.cyan }]}>
                      {fmt(remaining)} left
                    </Text>
                  ) : null}
                  <Ionicons name="chevron-forward" size={14} color={Colors.muted} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (() => {
          if (!selectedRecording) return null;
          const recType = selectedRecording.recording?.type;
          const isDeductType = recType === 'payable' || recType === 'receivable';
          const cost = isDeductType ? Number(selectedRecording.amount_contributed) : parseFloat(itemCost) || 0;
          const perPerson = itemPeople.length > 0 && itemMode === 'equal' ? cost / itemPeople.length : 0;
          return (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Recording label */}
              <Text style={[s.recDate, { marginBottom: 12 }]}>
                {selectedRecording.recording?.name} · {recType} · {fmt(Number(selectedRecording.amount_contributed))}
              </Text>

              {/* Name + cost (expense only) */}
              {!isDeductType && (
                <View style={{ gap: 8, marginBottom: 12 }}>
                  <TextInput
                    style={s.itemFormInput}
                    placeholder="item name"
                    placeholderTextColor={Colors.faint}
                    value={itemName}
                    onChangeText={setItemName}
                    autoFocus
                  />
                  <TextInput
                    style={[s.itemFormInput, { textAlign: 'right' }]}
                    placeholder="amount"
                    placeholderTextColor={Colors.faint}
                    value={itemCost}
                    onChangeText={setItemCost}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              {/* People */}
              <Text style={[s.recDate, { marginBottom: 6 }]}>who's included?</Text>
              <View style={[itemStyles.personSelectRow, { marginBottom: 12 }]}>
                {filledPeople.map((p, pi) => {
                  const sel = itemPeople.includes(p);
                  return (
                    <TouchableOpacity
                      key={pi}
                      style={[itemStyles.personSelectChip, sel && itemStyles.personSelectChipActive]}
                      onPress={() => setItemPeople(prev => sel ? prev.filter(x => x !== p) : [...prev, p])}
                    >
                      <Text style={[itemStyles.personSelectText, sel && itemStyles.personSelectTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Equal / Manual toggle */}
              {itemPeople.length > 0 && cost > 0 && (
                <View style={{ gap: 8, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['equal', 'manual'] as const).map(m => (
                      <TouchableOpacity
                        key={m}
                        style={[s.modeBtn, itemMode === m && s.modeBtnActive]}
                        onPress={() => { setItemMode(m); setItemManual({}); }}
                      >
                        <Text style={[s.modeBtnText, itemMode === m && s.modeBtnTextActive]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {itemMode === 'equal' ? (
                    <Text style={{ fontFamily: Fonts.monoBold, fontSize: 11, color: isDeductType ? Colors.cyan : '#FFAB91' }}>
                      {isDeductType ? '-' : '+'}{fmt(perPerson)} each
                    </Text>
                  ) : (
                    <View style={{ gap: 6 }}>
                      {itemPeople.map(p => (
                        <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={[s.recName, { flex: 1 }]}>{p}</Text>
                          <TextInput
                            style={[s.itemFormInput, { width: 100, textAlign: 'right' }]}
                            placeholder="0.00"
                            placeholderTextColor={Colors.faint}
                            value={itemManual[p] ?? ''}
                            onChangeText={v => setItemManual(prev => ({ ...prev, [p]: v }))}
                            keyboardType="decimal-pad"
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {itemError ? <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: Colors.expense, marginBottom: 8 }}>{itemError}</Text> : null}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity style={[s.doneBtn, { flex: 1, backgroundColor: Colors.surface }]} onPress={() => setItemStep('pick-recording')}>
                  <Text style={[s.doneBtnText, { color: Colors.muted }]}>back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.doneBtn, { flex: 2, opacity: savingItem || itemPeople.length === 0 ? 0.4 : 1 }]}
                  onPress={saveItem}
                  disabled={savingItem || itemPeople.length === 0}
                >
                  <Text style={s.doneBtnText}>save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          );
        })()}
      </BottomSheet>

      {/* Add person modal */}
      <BottomSheet visible={addPersonModal} onClose={() => setAddPersonModal(false)} title="add people" height="50%">
        <View style={s.tagInputWrap}>
          {people.map((p: any) => (
            <View key={p.id} style={s.tagChip}>
              <Text style={s.tagChipText}>{p.person_name}</Text>
              <TouchableOpacity onPress={() => removePerson(p.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close" size={11} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ))}
          <TextInput
            style={s.tagInput}
            placeholder={filledPeople.length === 0 ? 'type a name and press enter...' : ''}
            placeholderTextColor={Colors.faint}
            value={tagInputVal}
            onChangeText={setTagInputVal}
            returnKeyType="done"
            onSubmitEditing={handleAddPersonSubmit}
            blurOnSubmit={false}
            autoFocus
          />
        </View>
        <Text style={s.contactsLabel}>your contacts</Text>
        <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {contacts.length === 0 && <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: Colors.faint }}>no contacts saved yet</Text>}
          {contacts.map((c, i) => {
            const added = filledPeople.includes(c);
            return (
              <TouchableOpacity
                key={i}
                style={[s.contactRow, added && { opacity: 0.35 }]}
                onPress={() => { if (!added) { savePerson(c); } }}
                disabled={added}
              >
                <Text style={s.contactName}>{c}</Text>
                {added
                  ? <Ionicons name="checkmark" size={14} color={Colors.faint} />
                  : <Ionicons name="add" size={14} color={Colors.cyan} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={s.doneBtn} onPress={() => setAddPersonModal(false)} activeOpacity={0.8}>
          <Text style={s.doneBtnText}>done</Text>
        </TouchableOpacity>
      </BottomSheet>

    </Animated.View>
  );
}

const s = StyleSheet.create({
  header:     { flexDirection: 'row', alignItems: 'center', paddingRight: 16, paddingBottom: 4, gap: 8 },
  title:      { flex: 1, fontFamily: Fonts.display, fontSize: 24, color: Colors.text, letterSpacing: -0.8 },
  totalBadge: { backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.borderMid },
  totalBadgeText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.cyan },

  scroll: { paddingHorizontal: 16, paddingBottom: 60 },

  sectionHeader: { fontFamily: Fonts.display, fontSize: 15, color: Colors.cyan, marginBottom: 10, marginTop: 24 },

  list:       { gap: 8 },
  recRow:     { backgroundColor: Colors.white, borderRadius: Radius.xl, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  recIconWrap:{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  recMid:     { flex: 1, gap: 2 },
  recName:    { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.text, letterSpacing: 0.1 },
  recDate:    { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  recAmount:  { fontFamily: Fonts.monoBold, fontSize: 15, letterSpacing: -0.4 },

  sectionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 24 },
  sectionAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionAddText:{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.cyan },

  chipWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  personChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingVertical: 6, paddingLeft: 12, paddingRight: 8, borderWidth: 1, borderColor: Colors.borderMid },
  personChipText:{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.text },

  tagInputWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, padding: 8, minHeight: 44, marginBottom: 12 },
  tagChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.cyan, borderRadius: Radius.pill, paddingVertical: 4, paddingLeft: 10, paddingRight: 6 },
  tagChipText:   { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.white },
  tagInput:      { fontFamily: Fonts.mono, fontSize: 16, color: Colors.text, minWidth: 120, flex: 1, padding: 2 },
  contactsLabel: { fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  contactRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  contactName:   { fontFamily: Fonts.mono, fontSize: 13, color: Colors.text },
  itemCard:      { backgroundColor: Colors.white, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid },
  itemNum:        { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.cyan, width: 18 },
  itemName:       { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  itemSplit:      { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  itemCost:       { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  itemsTotalRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, marginTop: 4 },
  itemsTotalLabel:{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  itemsTotalDots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: Colors.faint, marginHorizontal: 8 },
  itemsTotalValue:{ fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.text },
  itemFormRow:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
  itemFormInput:  { fontFamily: Fonts.mono, fontSize: 16, color: Colors.text, backgroundColor: Colors.white, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid },

  summaryRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border },
  summaryName:   { fontFamily: Fonts.mono, fontSize: 13, color: Colors.text, flexShrink: 0 },
  summaryDots:   { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: Colors.faint, marginHorizontal: 10 },
  summaryAmount: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text, flexShrink: 0 },

  shareBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface, marginTop: 24, marginBottom: 8 },
  shareBtnText:  { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.muted },

  recPickRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },

  modeBtn:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface },
  modeBtnActive: { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  modeBtnText:   { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
  modeBtnTextActive: { color: Colors.white, fontFamily: Fonts.monoBold },

  doneBtn:       { backgroundColor: Colors.cyan, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  doneBtnText:   { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.white },
});
