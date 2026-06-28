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
  const [addModal, setAddModal]         = useState(false);
  const [addModalTab, setAddModalTab]   = useState<'item' | 'adjustment'>('item');
  const [itemForms, setItemForms] = useState([{ name: '', cost: '', people: [] as string[] }]);

  // ── Add Recordings modal state ────────────────────────────────────────────
  const [addRecModal, setAddRecModal]     = useState(false);
  const [addRecTab, setAddRecTab]         = useState<'receivable' | 'loan'>('receivable');
  const [recSearch, setRecSearch]         = useState('');
  const [existingRecs, setExistingRecs]   = useState<any[]>([]);
  const [loadingRecs2, setLoadingRecs2]   = useState(false);
  const [newRecName, setNewRecName]       = useState('');
  const [newRecAmount, setNewRecAmount]   = useState('');
  const [loanRecording, setLoanRecording] = useState<any>(null);
  const [loanStep, setLoanStep]           = useState<'pick' | 'split'>('pick');
  const [loanPeople, setLoanPeople]       = useState<string[]>([]);
  const [loanMode, setLoanMode]           = useState<'equal' | 'manual'>('equal');
  const [loanManual, setLoanManual]       = useState<Record<string, string>>({});
  const [loanError, setLoanError]         = useState('');
  const [savingRec, setSavingRec]         = useState(false);

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

  // ── Add Recordings functions ─────────────────────────────────────────────
  const openAddRecModal = async (tab: 'receivable' | 'loan') => {
    setAddRecTab(tab);
    setRecSearch('');
    setNewRecName(''); setNewRecAmount('');
    setLoanRecording(null); setLoanStep('pick');
    setLoanPeople([]); setLoanMode('equal'); setLoanManual({}); setLoanError('');
    setLoadingRecs2(true);
    setAddRecModal(true);
    const type = tab === 'receivable' ? 'receivable' : 'payable';
    const { data } = await supabase.from('recordings')
      .select('id, name, amount, transaction_date, status')
      .eq('user_id', userId).eq('type', type)
      .order('transaction_date', { ascending: false });
    setExistingRecs(data ?? []);
    setLoadingRecs2(false);
  };

  const linkRecording = async (rec: any) => {
    await supabase.from('split_bill_recordings').insert({
      split_bill_id: splitBillId,
      recording_id: rec.id,
      amount_contributed: Number(rec.amount),
    });
    queryClient.invalidateQueries({ queryKey: ['split-bill-recordings', splitBillId] });
  };

  const handleSelectReceivable = async (rec: any) => {
    setSavingRec(true);
    await linkRecording(rec);
    setSavingRec(false);
    setAddRecModal(false);
  };

  const handleCreateAndLinkReceivable = async () => {
    if (!newRecName.trim() || !newRecAmount) return;
    setSavingRec(true);
    const { data: newRec } = await supabase.from('recordings').insert({
      user_id: userId,
      name: newRecName.trim(),
      type: 'receivable',
      amount: parseFloat(newRecAmount),
      transaction_date: new Date().toISOString().split('T')[0],
      status: 'pending',
    }).select('id, name, amount').single();
    if (newRec) await linkRecording(newRec);
    setSavingRec(false);
    setAddRecModal(false);
  };

  const handleSelectLoan = (rec: any) => {
    setLoanRecording(rec);
    setLoanStep('split');
  };

  const handleCreateLoan = async () => {
    if (!newRecName.trim() || !newRecAmount) return;
    setSavingRec(true);
    const { data: newRec } = await supabase.from('recordings').insert({
      user_id: userId,
      name: newRecName.trim(),
      type: 'payable',
      amount: parseFloat(newRecAmount),
      transaction_date: new Date().toISOString().split('T')[0],
      status: 'unpaid',
    }).select('id, name, amount').single();
    setSavingRec(false);
    if (newRec) { setLoanRecording(newRec); setLoanStep('split'); }
  };

  const handleSaveLoan = async () => {
    if (!loanRecording || loanPeople.length === 0) { setLoanError('select at least one person'); return; }
    const amount = Number(loanRecording.amount);
    if (loanMode === 'manual') {
      const total = loanPeople.reduce((s, p) => s + parseFloat(loanManual[p] || '0'), 0);
      if (Math.abs(total - amount) > 0.01) { setLoanError(`amounts must total ${fmt(amount)}`); return; }
    }
    setSavingRec(true);
    await linkRecording(loanRecording);
    const manual_amounts = loanMode === 'manual'
      ? Object.fromEntries(loanPeople.map(p => [p, parseFloat(loanManual[p] || '0')]))
      : {};
    await supabase.from('split_adjustments').insert({
      split_bill_id: splitBillId,
      type: 'receivable',
      name: loanRecording.name,
      amount,
      people: loanPeople,
      mode: loanMode,
      manual_amounts,
    });
    setSavingRec(false);
    refetchAdj();
    setAddRecModal(false);
  };

  const saveItems = async () => {
    const valid = itemForms.filter(f => f.name.trim() && f.cost);
    if (!valid.length) return;
    await supabase.from('split_items').insert(
      valid.map(f => ({ split_bill_id: splitBillId, user_id: userId, name: f.name.trim(), cost: parseFloat(f.cost), people: f.people }))
    );
    setItemForms([{ name: '', cost: '', people: [] }]);
    setAddModal(false);
    refetchItems();
  };

  const deleteItem = async (id: string) => {
    await supabase.from('split_items').delete().eq('id', id);
    refetchItems();
  };

  const toggleItemPerson = (idx: number, person: string) => {
    setItemForms(prev => {
      const next = [...prev];
      const p = next[idx].people.includes(person)
        ? next[idx].people.filter(x => x !== person)
        : [...next[idx].people, person];
      next[idx] = { ...next[idx], people: p };
      return next;
    });
  };

  // ── Adjustments state ─────────────────────────────────────────────────
  const [adjType, setAdjType]         = useState<'expense' | 'receivable'>('expense');
  const [adjName, setAdjName]         = useState('');
  const [adjAmount, setAdjAmount]     = useState('');
  const [adjMode, setAdjMode]         = useState<'equal' | 'manual'>('equal');
  const [adjPeople, setAdjPeople]     = useState<string[]>([]);
  const [adjManual, setAdjManual]     = useState<Record<string, string>>({});
  const [adjError, setAdjError]       = useState('');

  const { data: adjustments = [], refetch: refetchAdj } = useQuery({
    queryKey: ['split-bill-adjustments', splitBillId],
    queryFn: async () => {
      const { data } = await supabase
        .from('split_adjustments')
        .select('*')
        .eq('split_bill_id', splitBillId)
        .order('created_at');
      return data ?? [];
    },
    enabled: !!splitBillId,
  });

  const saveAdjustment = async () => {
    if (!adjName.trim() || !adjAmount) { setAdjError('name and amount required.'); return; }
    const amount = parseFloat(adjAmount);
    if (adjMode === 'manual') {
      const manualTotal = adjPeople.reduce((s, p) => s + parseFloat(adjManual[p] || '0'), 0);
      if (Math.abs(manualTotal - amount) > 0.01) { setAdjError(`manual amounts must total ${fmt(amount)}`); return; }
    }
    const manual_amounts = adjMode === 'manual'
      ? Object.fromEntries(adjPeople.map(p => [p, parseFloat(adjManual[p] || '0')]))
      : {};
    await supabase.from('split_adjustments').insert({
      split_bill_id: splitBillId,
      type: adjType,
      name: adjName.trim(),
      amount,
      people: adjPeople,
      mode: adjMode,
      manual_amounts,
    });
    setAddModal(false);
    setAdjName(''); setAdjAmount(''); setAdjMode('equal'); setAdjPeople([]); setAdjManual({}); setAdjError('');
    refetchAdj();
    refetchAdj();
  };

  const deleteAdj = async (id: string) => {
    await supabase.from('split_adjustments').delete().eq('id', id);
    refetchAdj();
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
  const remainingAmount = Math.max(0, totalAmount - totalItemsCost);
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
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => openAddRecModal('receivable')} style={s.sectionAddBtn}>
                <Ionicons name="arrow-down-circle-outline" size={14} color={Colors.cyan} />
                <Text style={s.sectionAddText}>receivable</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openAddRecModal('loan')} style={s.sectionAddBtn}>
                <Ionicons name="cash-outline" size={14} color={Colors.cyan} />
                <Text style={s.sectionAddText}>loan</Text>
              </TouchableOpacity>
            </View>
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
              onPress={() => { setItemForms([{ name: '', cost: remainingAmount > 0 ? remainingAmount.toFixed(2) : '', people: [] }]); setAddModalTab('item'); setAddModal(true); }}
              style={s.sectionAddBtn}
              disabled={filledPeople.length === 0}
            >
              <Ionicons name="add" size={14} color={filledPeople.length === 0 ? Colors.faint : Colors.cyan} />
              <Text style={[s.sectionAddText, filledPeople.length === 0 && { color: Colors.faint }]}>add</Text>
            </TouchableOpacity>
          </View>
          {items.length === 0 ? (
            <View style={pageStyles.emptyBox}>
              <Text style={pageStyles.emptyText}>{filledPeople.length === 0 ? 'add people first' : 'no items yet'}</Text>
            </View>
          ) : (
            <View style={s.list}>
              {items.map((item: any, idx: number) => {
                const perPerson = item.people?.length > 0 ? Number(item.cost) / item.people.length : 0;
                return (
                  <View key={item.id} style={s.itemCard}>
                    <Text style={s.itemNum}>{idx + 1}</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                      {item.people?.length > 0 && (
                        <Text style={s.itemSplit}>{item.people.length} people · {perPerson.toLocaleString('en-US', { minimumFractionDigits: 2 })} each</Text>
                      )}
                    </View>
                    <Text style={s.itemCost}>{fmt(Number(item.cost))}</Text>
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

          {/* Adjustments */}
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>adjustments</Text>
            <TouchableOpacity onPress={() => { setAdjName(''); setAdjAmount(''); setAdjMode('equal'); setAdjPeople([]); setAdjManual({}); setAdjError(''); setAddModalTab('adjustment'); setAddModal(true); }} style={s.sectionAddBtn}>
              <Ionicons name="add" size={14} color={Colors.cyan} />
              <Text style={s.sectionAddText}>add</Text>
            </TouchableOpacity>
          </View>
          {adjustments.length === 0 ? (
            <View style={pageStyles.emptyBox}>
              <Text style={pageStyles.emptyText}>no adjustments yet</Text>
            </View>
          ) : (
            <View style={s.list}>
              {adjustments.map((adj: any) => (
                <View key={adj.id} style={s.adjCard}>
                  <View style={[s.adjTypeBadge, { backgroundColor: adj.type === 'receivable' ? Colors.cyan + '22' : '#FFAB9122' }]}>
                    <Ionicons name={adj.type === 'receivable' ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={14} color={adj.type === 'receivable' ? Colors.cyan : '#FFAB91'} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.adjName}>{adj.name}</Text>
                    <Text style={s.adjMeta}>
                      {adj.type} · {adj.mode} · {adj.people?.length ?? 0} {adj.people?.length === 1 ? 'person' : 'people'}
                    </Text>
                  </View>
                  <Text style={[s.adjAmount, { color: adj.type === 'receivable' ? Colors.cyan : '#FFAB91' }]}>
                    {adj.type === 'receivable' ? '-' : '+'}{fmt(Number(adj.amount))}
                  </Text>
                  <TouchableOpacity onPress={() => deleteAdj(adj.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={14} color={Colors.faint} />
                  </TouchableOpacity>
                </View>
              ))}
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
              const subs = item.subitems ?? [];
              if (subs.length === 0) {
                const pp = item.people?.length > 0 ? Number(item.cost) / item.people.length : 0;
                (item.people ?? []).forEach((p: string) => { if (totals[p] !== undefined) totals[p] += pp; });
              } else {
                subs.forEach((sub: any) => {
                  const pp = sub.people?.length > 0 ? Number(sub.cost) / sub.people.length : 0;
                  (sub.people ?? []).forEach((p: string) => { if (totals[p] !== undefined) totals[p] += pp; });
                });
              }
            });
            // apply adjustments
            adjustments.forEach((adj: any) => {
              const people: string[] = adj.people ?? [];
              if (adj.mode === 'manual') {
                const manual = adj.manual_amounts ?? {};
                people.forEach(p => {
                  if (totals[p] !== undefined) {
                    totals[p] = adj.type === 'receivable'
                      ? totals[p] - (manual[p] ?? 0)
                      : totals[p] + (manual[p] ?? 0);
                  }
                });
              } else {
                const pp = people.length > 0 ? Number(adj.amount) / people.length : 0;
                people.forEach(p => {
                  if (totals[p] !== undefined) {
                    totals[p] = adj.type === 'receivable' ? totals[p] - pp : totals[p] + pp;
                  }
                });
              }
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

      {/* Add Recordings modal */}
      <BottomSheet visible={addRecModal} onClose={() => setAddRecModal(false)} title="add recording" height="65%">
        <View style={s.modalTabRow}>
          {(['receivable', 'loan'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.modalTab, addRecTab === tab && s.modalTabActive]}
              onPress={async () => {
                setAddRecTab(tab);
                setNewRecName(''); setNewRecAmount('');
                setLoanRecording(null); setLoanStep('pick');
                setLoanPeople([]); setLoanMode('equal'); setLoanManual({}); setLoanError('');
                setLoadingRecs2(true);
                const type = tab === 'receivable' ? 'receivable' : 'payable';
                const { data } = await supabase.from('recordings')
                  .select('id, name, amount, transaction_date, status')
                  .eq('user_id', userId).eq('type', type)
                  .order('transaction_date', { ascending: false });
                setExistingRecs(data ?? []);
                setLoadingRecs2(false);
              }}
            >
              <Text style={[s.modalTabText, addRecTab === tab && s.modalTabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {addRecTab === 'receivable' ? (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.contactsLabel}>create new</Text>
            <View style={s.itemFormRow}>
              <TextInput
                style={[s.itemFormInput, { flex: 1 }]}
                placeholder="name"
                placeholderTextColor={Colors.faint}
                value={newRecName}
                onChangeText={setNewRecName}
                autoFocus
              />
              <TextInput
                style={[s.itemFormInput, { width: 90, textAlign: 'right' }]}
                placeholder="0.00"
                placeholderTextColor={Colors.faint}
                value={newRecAmount}
                onChangeText={setNewRecAmount}
                keyboardType="decimal-pad"
              />
            </View>
            <TouchableOpacity
              style={[s.doneBtn, { marginBottom: 20 }, (!newRecName.trim() || !newRecAmount || savingRec) && { opacity: 0.4 }]}
              onPress={handleCreateAndLinkReceivable}
              disabled={!newRecName.trim() || !newRecAmount || savingRec}
            >
              <Text style={s.doneBtnText}>{savingRec ? '...' : 'create & link'}</Text>
            </TouchableOpacity>

            <Text style={s.contactsLabel}>or pick existing</Text>
            <TextInput
              style={[s.itemFormInput, { marginBottom: 10 }]}
              placeholder="search receivables..."
              placeholderTextColor={Colors.faint}
              value={recSearch}
              onChangeText={setRecSearch}
            />
            {loadingRecs2
              ? <ActivityIndicator color={Colors.cyan} />
              : existingRecs
                  .filter(r => r.name.toLowerCase().includes(recSearch.toLowerCase()))
                  .map((r: any) => (
                    <TouchableOpacity key={r.id} style={s.recPickRow} onPress={() => handleSelectReceivable(r)} disabled={savingRec}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.recName}>{r.name}</Text>
                        <Text style={s.recDate}>{r.transaction_date} · {r.status}</Text>
                      </View>
                      <Text style={[s.recAmount, { color: Colors.cyan }]}>{fmt(Number(r.amount))}</Text>
                    </TouchableOpacity>
                  ))
            }
          </ScrollView>
        ) : loanStep === 'pick' ? (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.contactsLabel}>create new loan</Text>
            <View style={s.itemFormRow}>
              <TextInput
                style={[s.itemFormInput, { flex: 1 }]}
                placeholder="name"
                placeholderTextColor={Colors.faint}
                value={newRecName}
                onChangeText={setNewRecName}
                autoFocus
              />
              <TextInput
                style={[s.itemFormInput, { width: 90, textAlign: 'right' }]}
                placeholder="0.00"
                placeholderTextColor={Colors.faint}
                value={newRecAmount}
                onChangeText={setNewRecAmount}
                keyboardType="decimal-pad"
              />
            </View>
            <TouchableOpacity
              style={[s.doneBtn, { marginBottom: 20 }, (!newRecName.trim() || !newRecAmount || savingRec) && { opacity: 0.4 }]}
              onPress={handleCreateLoan}
              disabled={!newRecName.trim() || !newRecAmount || savingRec}
            >
              <Text style={s.doneBtnText}>{savingRec ? '...' : 'create & continue'}</Text>
            </TouchableOpacity>

            <Text style={s.contactsLabel}>or pick existing loan</Text>
            <TextInput
              style={[s.itemFormInput, { marginBottom: 10 }]}
              placeholder="search loans..."
              placeholderTextColor={Colors.faint}
              value={recSearch}
              onChangeText={setRecSearch}
            />
            {loadingRecs2
              ? <ActivityIndicator color={Colors.cyan} />
              : existingRecs
                  .filter(r => r.name.toLowerCase().includes(recSearch.toLowerCase()))
                  .map((r: any) => (
                    <TouchableOpacity key={r.id} style={s.recPickRow} onPress={() => handleSelectLoan(r)}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.recName}>{r.name}</Text>
                        <Text style={s.recDate}>{r.transaction_date} · {r.status}</Text>
                      </View>
                      <Text style={[s.recAmount, { color: '#FFAB91' }]}>{fmt(Number(r.amount))}</Text>
                    </TouchableOpacity>
                  ))
            }
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity onPress={() => setLoanStep('pick')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <Ionicons name="arrow-back" size={14} color={Colors.muted} />
              <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted }}>
                {loanRecording?.name} · {fmt(Number(loanRecording?.amount))}
              </Text>
            </TouchableOpacity>

            {loanError ? <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.expense, marginBottom: 8 }}>{loanError}</Text> : null}

            <Text style={s.contactsLabel}>who is this loan for?</Text>
            <View style={s.chipWrap}>
              {filledPeople.map((p, pi) => {
                const sel = loanPeople.includes(p);
                return (
                  <TouchableOpacity
                    key={pi}
                    style={[s.personChip, sel && { backgroundColor: Colors.cyan, borderColor: Colors.cyan }]}
                    onPress={() => { setLoanError(''); setLoanPeople(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]); }}
                  >
                    <Text style={[s.personChipText, sel && { color: Colors.white }]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.contactsLabel}>split mode</Text>
            <View style={s.chipWrap}>
              {(['equal', 'manual'] as const).map(m => (
                <TouchableOpacity key={m} style={[s.personChip, loanMode === m && { backgroundColor: Colors.cyan, borderColor: Colors.cyan }]} onPress={() => setLoanMode(m)}>
                  <Text style={[s.personChipText, loanMode === m && { color: Colors.white }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {loanMode === 'equal' && loanPeople.length > 0 && (
              <Text style={{ fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.cyan, marginBottom: 10 }}>
                {fmt(Number(loanRecording?.amount) / loanPeople.length)} each
              </Text>
            )}

            {loanMode === 'manual' && loanPeople.length > 0 && (
              <View style={{ gap: 8, marginBottom: 10 }}>
                <Text style={s.contactsLabel}>amounts (must total {fmt(Number(loanRecording?.amount))})</Text>
                {loanPeople.map(p => (
                  <View key={p} style={s.itemFormRow}>
                    <Text style={[s.personChipText, { flex: 1 }]}>{p}</Text>
                    <TextInput
                      style={[s.itemFormInput, { width: 100, textAlign: 'right' }]}
                      placeholder="0.00"
                      placeholderTextColor={Colors.faint}
                      value={loanManual[p] ?? ''}
                      onChangeText={v => setLoanManual(prev => ({ ...prev, [p]: v }))}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[s.doneBtn, (loanPeople.length === 0 || savingRec) && { opacity: 0.4 }]}
              onPress={handleSaveLoan}
              disabled={loanPeople.length === 0 || savingRec}
            >
              <Text style={s.doneBtnText}>{savingRec ? '...' : 'save loan'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </BottomSheet>

      {/* Add item / adjustment modal */}
      <BottomSheet visible={addModal} onClose={() => setAddModal(false)} title="add" height="65%">

        {/* Tab switcher */}
        <View style={s.modalTabRow}>
          {(['item', 'adjustment'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.modalTab, addModalTab === tab && s.modalTabActive]}
              onPress={() => setAddModalTab(tab)}
            >
              <Text style={[s.modalTabText, addModalTab === tab && s.modalTabTextActive]}>
                {tab === 'item' ? 'item' : 'adjustment'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {addModalTab === 'item' ? (
          <>
            {itemForms.map((form, idx) => (
              <View key={idx} style={s.itemFormRow}>
                <TextInput
                  style={[s.itemFormInput, { flex: 1 }]}
                  placeholder="item name"
                  placeholderTextColor={Colors.faint}
                  value={form.name}
                  onChangeText={v => setItemForms(prev => { const n = [...prev]; n[idx] = { ...n[idx], name: v }; return n; })}
                  autoFocus={idx === 0}
                />
                <TextInput
                  style={[s.itemFormInput, { width: 80, textAlign: 'right' }]}
                  placeholder="0.00"
                  placeholderTextColor={Colors.faint}
                  value={form.cost}
                  onChangeText={v => setItemForms(prev => { const n = [...prev]; n[idx] = { ...n[idx], cost: v }; return n; })}
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
            {filledPeople.length > 0 && itemForms[0]?.cost ? (
              <View style={{ marginTop: 10 }}>
                <Text style={s.contactsLabel}>who's included</Text>
                <View style={s.chipWrap}>
                  {filledPeople.map((p, pi) => {
                    const sel = itemForms[0].people.includes(p);
                    return (
                      <TouchableOpacity key={pi} style={[s.personChip, sel && { backgroundColor: Colors.cyan, borderColor: Colors.cyan }]} onPress={() => toggleItemPerson(0, p)}>
                        <Text style={[s.personChipText, sel && { color: Colors.white }]}>{p}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {itemForms[0].people.length > 0 && itemForms[0].cost && (
                  <Text style={{ fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.cyan, marginTop: 6 }}>
                    {(parseFloat(itemForms[0].cost) / itemForms[0].people.length).toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                  </Text>
                )}
              </View>
            ) : null}
            <TouchableOpacity
              style={[s.doneBtn, { marginTop: 16 }, (!itemForms[0]?.name.trim() || !itemForms[0]?.cost) && { opacity: 0.4 }]}
              onPress={saveItems}
              disabled={!itemForms[0]?.name.trim() || !itemForms[0]?.cost}
            >
              <Text style={s.doneBtnText}>save item</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {adjError ? <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.expense, marginBottom: 8 }}>{adjError}</Text> : null}

            <Text style={s.contactsLabel}>type</Text>
            <View style={s.chipWrap}>
              {([
                { key: 'expense',    label: '↑ add expense',             sub: 'adds to what they owe' },
                { key: 'receivable', label: '↓ add receivable / loan',   sub: 'deducts from what they owe' },
              ] as const).map(t => (
                <TouchableOpacity key={t.key} style={[s.adjTypeBtn, adjType === t.key && s.adjTypeBtnActive]} onPress={() => setAdjType(t.key)}>
                  <Text style={[s.adjTypeBtnLabel, adjType === t.key && { color: Colors.white }]}>{t.label}</Text>
                  <Text style={[s.adjTypeBtnSub, adjType === t.key && { color: Colors.white + 'cc' }]}>{t.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.contactsLabel}>name</Text>
            <TextInput style={s.itemFormInput} placeholder="e.g. shared loan" placeholderTextColor={Colors.faint} value={adjName} onChangeText={v => { setAdjName(v); setAdjError(''); }} />

            <Text style={s.contactsLabel}>amount</Text>
            <TextInput style={s.itemFormInput} placeholder="0.00" placeholderTextColor={Colors.faint} value={adjAmount} onChangeText={v => { setAdjAmount(v); setAdjError(''); }} keyboardType="decimal-pad" />

            <Text style={s.contactsLabel}>split mode</Text>
            <View style={s.chipWrap}>
              {(['equal', 'manual'] as const).map(m => (
                <TouchableOpacity key={m} style={[s.personChip, adjMode === m && { backgroundColor: Colors.cyan, borderColor: Colors.cyan }]} onPress={() => setAdjMode(m)}>
                  <Text style={[s.personChipText, adjMode === m && { color: Colors.white }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.contactsLabel}>assign to</Text>
            <View style={s.chipWrap}>
              {filledPeople.map((p, pi) => {
                const sel = adjPeople.includes(p);
                return (
                  <TouchableOpacity key={pi} style={[s.personChip, sel && { backgroundColor: Colors.cyan, borderColor: Colors.cyan }]} onPress={() => {
                    setAdjPeople(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
                  }}>
                    <Text style={[s.personChipText, sel && { color: Colors.white }]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {adjMode === 'manual' && adjPeople.length > 0 && adjAmount ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Text style={s.contactsLabel}>manual amounts (must total {fmt(parseFloat(adjAmount || '0'))})</Text>
                {adjPeople.map(p => (
                  <View key={p} style={s.itemFormRow}>
                    <Text style={[s.personChipText, { flex: 1 }]}>{p}</Text>
                    <TextInput
                      style={[s.itemFormInput, { width: 100, textAlign: 'right' }]}
                      placeholder="0.00"
                      placeholderTextColor={Colors.faint}
                      value={adjManual[p] ?? ''}
                      onChangeText={v => setAdjManual(prev => ({ ...prev, [p]: v }))}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.doneBtn, { marginTop: 16 }, (!adjName.trim() || !adjAmount || adjPeople.length === 0) && { opacity: 0.4 }]}
              onPress={saveAdjustment}
              disabled={!adjName.trim() || !adjAmount || adjPeople.length === 0}
            >
              <Text style={s.doneBtnText}>save adjustment</Text>
            </TouchableOpacity>
          </>
        )}
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
  tagInput:      { fontFamily: Fonts.mono, fontSize: 14, color: Colors.text, minWidth: 120, flex: 1, padding: 2 },
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
  itemFormInput:  { fontFamily: Fonts.mono, fontSize: 14, color: Colors.text, backgroundColor: Colors.white, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid },

  summaryRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border },
  summaryName:   { fontFamily: Fonts.mono, fontSize: 13, color: Colors.text, flexShrink: 0 },
  summaryDots:   { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: Colors.faint, marginHorizontal: 10 },
  summaryAmount: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text, flexShrink: 0 },

  adjCard:      { backgroundColor: Colors.white, borderRadius: Radius.lg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },
  adjTypeBadge:  { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  adjName:       { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  adjMeta:       { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  adjAmount:     { fontFamily: Fonts.monoBold, fontSize: 14, letterSpacing: -0.4 },

  shareBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface, marginTop: 24, marginBottom: 8 },
  shareBtnText:  { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.muted },

  modalTabRow:       { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modalTab:          { flex: 1, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Colors.borderMid },
  modalTabActive:    { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  modalTabText:      { fontFamily: Fonts.mono,     fontSize: 12, color: Colors.muted },
  modalTabTextActive:{ fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.white },

  adjTypeBtn:        { flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMid, gap: 2 },
  adjTypeBtnActive:  { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  adjTypeBtnLabel:   { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text },
  adjTypeBtnSub:     { fontFamily: Fonts.mono,     fontSize: 10, color: Colors.muted },

  recPickRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },

  doneBtn:       { backgroundColor: Colors.cyan, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  doneBtnText:   { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.white },
});
