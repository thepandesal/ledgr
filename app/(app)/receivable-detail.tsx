import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, TextInput, RefreshControl,
  Animated, Dimensions, Modal, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { AppFont } from '../../src/lib/fonts';
import { DC } from '../../src/lib/design';
import PageHeader from '@/components/ui/PageHeader';
import { useNav } from '../../src/lib/NavContext';
import GooeyLoader from '@/components/ui/GooeyLoader';
import { BlurView } from 'expo-blur';

const TEAL = '#9cd7d2';
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  person: string;
  onClose: () => void;
  onBack?: () => void;
}

const { width } = Dimensions.get('window');

export default function ReceivableDetail({ person, onClose, onBack }: Props) {
  const { userId } = useUser();
  const { openSplitBill, openRecording } = useNav();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'completed'>('pending');
  const tabLabel = tab === 'pending' ? 'Ongoing' : 'Completed';
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const slideAnim = useRef(new Animated.Value(width)).current;
  const [mode, setMode] = useState<'view' | 'settle'>('view');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [settleModal, setSettleModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [markComplete, setMarkComplete] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleTab, setSettleTab] = useState<'transactions' | 'returns'>('transactions');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: width,
      duration: 250,
      useNativeDriver: true,
    }).start(() => (onBack ? onBack() : onClose()));
  };

  const isUnassigned = person === '__unassigned__';

  const { data, isLoading } = useQuery({
    queryKey: ['receivable-detail', userId, person],
    queryFn: async () => {
      const { data: bills } = await supabase
        .from('split_bills')
        .select('id, name, status')
        .eq('user_id', userId);

      const billIds = (bills ?? []).map((b: any) => b.id);
      const billMap: Record<string, any> = {};
      (bills ?? []).forEach((b: any) => { billMap[b.id] = b; });

      const { data: personRecs } = await supabase
        .from('recordings')
        .select('id, user_id, name, amount, paid_amount, status, type, is_due, transaction_date, space_id, tagged_friend_user_id, is_system_generated')
        .eq('user_id', userId)
        .ilike('person_name', person)
        .in('type', ['expense', 'due'])
        .neq('status', 'voided')
        .order('transaction_date', { ascending: false });

      const recEntries = (personRecs ?? [])
        .filter((r: any) => !r.is_system_generated)
        .map((r: any) => {
        const owed = Number(r.amount);
        const paid = Number(r.paid_amount ?? 0);
        const remaining = Math.max(0, owed - paid);
        const isComplete = r.status === 'paid' || r.status === 'closed' || (owed > 0 && paid >= owed - 0.01);
        const isReceivable = r.type === 'due' || r.is_due;
        return {
          billId: r.id, billName: r.name, billStatus: r.status,
          owed, paid, remaining, isComplete, isRecording: true,
          entryType: isReceivable ? 'receivable' : 'loan',
          transaction_date: r.transaction_date, space_id: r.space_id,
          createdBy: r.user_id === userId ? 'me' : person,
          ownerUserId: userId,
          taggedFriendUserId: r.tagged_friend_user_id,
        };
      });

      // Shared recordings where I'm tagged — I owe the owner (single-entry model)
      const { data: sharedRecs } = await supabase
        .from('recordings')
        .select('id, user_id, name, amount, paid_amount, status, transaction_date, tagged_friend_user_id')
        .filter('shared_with', 'cs', `["${userId}"]`)
        .in('type', ['expense', 'due'])
        .eq('tagged_friend_user_id', userId)
        .neq('status', 'voided');
      const sharedByPerson: any[] = [];
      for (const sr of (sharedRecs ?? [])) {
        const { data: ownerName } = await supabase.rpc('get_user_display_name', { user_id: sr.user_id });
        if (ownerName && ownerName.toLowerCase() === person.toLowerCase()) {
          const owed = Number(sr.amount);
          const paid = Number(sr.paid_amount ?? 0);
          const remaining = Math.max(0, owed - paid);
          sharedByPerson.push({
            billId: sr.id, billName: sr.name, billStatus: sr.status,
            owed, paid, remaining,
            isComplete: sr.status === 'paid' || (owed > 0 && paid >= owed - 0.01),
            isRecording: true, entryType: 'loan',
            transaction_date: sr.transaction_date, space_id: null, createdBy: ownerName,
            ownerUserId: sr.user_id,
            taggedFriendUserId: userId,
          });
        }
      }

      // Backward compat: old mirror debt recordings in my account
      const { data: oldMirrorDebts } = await supabase
        .from('recordings')
        .select('id, name, amount, paid_amount, status, transaction_date, person_name')
        .eq('user_id', userId)
        .eq('type', 'debt')
        .eq('is_tagged', true)
        .neq('status', 'voided')
        .order('transaction_date', { ascending: false });
      (oldMirrorDebts ?? []).forEach((d: any) => {
        const owed = Number(d.amount);
        const paid = Number(d.paid_amount ?? 0);
        const remaining = Math.max(0, owed - paid);
        sharedByPerson.push({
          billId: d.id, billName: d.name, billStatus: d.status,
          owed, paid, remaining,
          isComplete: d.status === 'paid' || (owed > 0 && paid >= owed - 0.01),
          isRecording: true, entryType: 'loan',
          transaction_date: d.transaction_date, space_id: null, createdBy: d.person_name ?? 'unknown',
        });
      });

      const allRecEntries = [...recEntries, ...sharedByPerson];

      if (!bills || bills.length === 0) {
        return {
          pending: { receivable: allRecEntries.filter(r => !r.isComplete && r.entryType === 'receivable'), loan: allRecEntries.filter(r => !r.isComplete && r.entryType === 'loan') },
          completed: { receivable: allRecEntries.filter(r => r.isComplete && r.entryType === 'receivable'), loan: allRecEntries.filter(r => r.isComplete && r.entryType === 'loan') },
        };
      }

      if (isUnassigned) {
        const [{ data: billSplits }, { data: items }] = await Promise.all([
          supabase.from('bill_splits').select('split_bill_id, person_name').in('split_bill_id', billIds),
          supabase.from('split_items').select('split_bill_id, cost, people, recording_type').in('split_bill_id', billIds),
        ]);

        const billsWithPeople = new Set((billSplits ?? []).map((bs: any) => bs.split_bill_id));
        const billsWithNoItemAssignments = (bills ?? []).filter((b: any) => {
          if (!billsWithPeople.has(b.id)) return false;
          const billItems = (items ?? []).filter((item: any) => item.split_bill_id === b.id);
          return billItems.every((item: any) => !item.people || item.people.length === 0);
        });

        const unassignedBillIds = new Set([
          ...(bills ?? []).filter((b: any) => !billsWithPeople.has(b.id) && b.status !== 'closed').map((b: any) => b.id),
          ...billsWithNoItemAssignments.filter((b: any) => b.status !== 'closed').map((b: any) => b.id),
        ]);

        const unassignedBills = (bills ?? []).filter((b: any) => unassignedBillIds.has(b.id));

        const { data: expenseRecs } = await supabase
          .from('recordings')
          .select('id, name, amount, paid_amount, status, transaction_date, split_bill_id, person_name, is_due')
          .eq('user_id', userId)
          .eq('type', 'expense')
          .neq('status', 'voided')
          .order('transaction_date', { ascending: false });

        const seenIds = new Set<string>();
        const unassignedRecordings: any[] = [];
        (expenseRecs ?? []).forEach((r: any) => {
          if (r.person_name) return;
          const inUnassignedBill = r.split_bill_id && unassignedBillIds.has(r.split_bill_id) && billMap[r.split_bill_id]?.status !== 'closed';
          const isDueNoSplitBill = r.is_due && !r.split_bill_id && r.status !== 'paid';
          const isDueUnassignedBill = r.is_due && inUnassignedBill && r.status !== 'paid';
          if ((inUnassignedBill || isDueNoSplitBill || isDueUnassignedBill) && !seenIds.has(r.id)) {
            seenIds.add(r.id);
            unassignedRecordings.push(r);
          }
        });

        const pendingRecs = unassignedRecordings.filter((r: any) => r.status !== 'paid');
        const pendingBills = unassignedBills.filter((b: any) => b.status !== 'closed');
        const completedBills = unassignedBills.filter((b: any) => b.status === 'closed');

        const pendingRecEntries = pendingRecs.map((r: any) => ({
          billId: r.id, billName: r.name, billStatus: r.status,
          owed: Number(r.amount), paid: Number(r.paid_amount ?? 0),
          remaining: Math.max(0, Number(r.amount) - Number(r.paid_amount ?? 0)),
          isComplete: false, isRecording: true, createdBy: 'me',
          entryType: r.is_due ? 'receivable' : 'loan',
        }));
        const pendingBillEntries = pendingBills.map((b: any) => ({
          billId: b.id, billName: b.name, billStatus: b.status,
          owed: 0, paid: 0, remaining: 0, isComplete: false,
          entryType: 'receivable' as const,
        }));
        const completedBillEntries = completedBills.map((b: any) => ({
          billId: b.id, billName: b.name, billStatus: b.status,
          owed: 0, paid: 0, remaining: 0, isComplete: true,
          entryType: 'receivable' as const,
        }));
        const allPending = [...pendingRecEntries, ...pendingBillEntries];

        return {
          pending: {
            receivable: allPending.filter((b: any) => b.entryType === 'receivable'),
            loan: allPending.filter((b: any) => b.entryType === 'loan'),
          },
          completed: {
            receivable: completedBillEntries,
            loan: [],
          },
        };
      }

      const [{ data: billSplits }, { data: items }, { data: payments }] = await Promise.all([
        supabase.from('bill_splits').select('split_bill_id, person_name').in('split_bill_id', billIds),
        supabase.from('split_items').select('split_bill_id, cost, people, recording_type').in('split_bill_id', billIds),
        supabase.from('split_bill_payments').select('split_bill_id, person_name, amount, status').in('split_bill_id', billIds).eq('person_name', person).neq('status', 'cancelled'),
      ]);

      const owedMap: Record<string, number> = {};
      (items ?? []).forEach((item: any) => {
        const people: string[] = item.people ?? [];
        if (!people.includes(person)) return;
        const isDeduct = item.recording_type === 'payable';
        const pp = Number(item.cost) / people.length;
        owedMap[item.split_bill_id] = (owedMap[item.split_bill_id] ?? 0) + (isDeduct ? -pp : pp);
      });

      const paidMap: Record<string, number> = {};
      (payments ?? []).forEach((pay: any) => {
        paidMap[pay.split_bill_id] = (paidMap[pay.split_bill_id] ?? 0) + Number(pay.amount);
      });

      const personBillIdsSet = new Set<string>();
      (billSplits ?? []).filter((bs: any) => bs.person_name === person).forEach((bs: any) => personBillIdsSet.add(bs.split_bill_id));
      (items ?? []).forEach((item: any) => {
        if ((item.people ?? []).includes(person)) personBillIdsSet.add(item.split_bill_id);
      });
      const personBillIds = [...personBillIdsSet];

      const entries = personBillIds.map((billId: string) => {
        const bill = billMap[billId];
        if (!bill) return null;
        const netOwed = owedMap[billId] ?? 0;
        const paid = paidMap[billId] ?? 0;
        const isReceivable = netOwed > 0;
        const owed = Math.abs(netOwed);
        const remaining = Math.max(0, owed - paid);
        const isComplete = bill.status === 'closed' || (owed > 0 && paid >= owed - 0.01);
        return { billId, billName: bill.name, billStatus: bill.status, owed, paid, remaining, isComplete, entryType: isReceivable ? 'receivable' : 'loan' };
      }).filter(Boolean);

      const shownBillIds = entries.filter(Boolean).map((e: any) => e.billId);
      const { data: sbrRows } = shownBillIds.length > 0
        ? await supabase.from('split_bill_recordings').select('recording_id').in('split_bill_id', shownBillIds)
        : { data: [] };
      const linkedRecordingIds = new Set((sbrRows ?? []).map((r: any) => r.recording_id));

      const newRecEntries = allRecEntries.filter((r: any) => !linkedRecordingIds.has(r.billId));

      const all = [...entries.filter(Boolean), ...newRecEntries];

      const { data: returnRows } = await supabase
        .from('recordings')
        .select('id, user_id, name, amount, transaction_date, linked_recording_id, payment_to')
        .eq('type', 'return')
        .or(`user_id.eq.${userId},payment_to.eq.${userId}`)
        .ilike('person_name', person)
        .order('transaction_date', { ascending: false });

      return {
        pending: {
          receivable: all.filter((b: any) => !b.isComplete && b.entryType === 'receivable'),
          loan: all.filter((b: any) => !b.isComplete && b.entryType === 'loan'),
        },
        completed: {
          receivable: all.filter((b: any) => b.isComplete && b.entryType === 'receivable'),
          loan: all.filter((b: any) => b.isComplete && b.entryType === 'loan'),
        },
        returns: (returnRows ?? []).map((r: any) => ({
          billId: r.id, billName: r.name, amount: Number(r.amount),
          transaction_date: r.transaction_date, linkedRecordingId: r.linked_recording_id,
          borrowerId: r.payment_to, userId: r.user_id,
        })),
      };
    },
    enabled: !!userId && !!person,
  });

  const returns = data?.returns ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['receivable-detail', userId, person] });
    setRefreshing(false);
  };

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`receivable-shared-live-${userId}-${person}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings' }, (payload: any) => {
        const check = (data: any) => {
          if (!data) return false;
          if (data.user_id === userId) return true;
          if (!data?.shared_with) return false;
          const arr = typeof data.shared_with === 'string' ? JSON.parse(data.shared_with) : data.shared_with;
          return Array.isArray(arr) && arr.includes(userId);
        };
        if (check(payload.new) || check(payload.old)) {
          queryClient.invalidateQueries({ queryKey: ['receivable-detail', userId, person] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, person, queryClient]);

  const filterItems = (items: any[]) =>
    items.filter((b: any) => !search.trim() || b.billName.toLowerCase().includes(search.toLowerCase()));

  const sections = tab === 'pending'
    ? [{ key: 'receivable', label: 'Owes You', items: filterItems(data?.pending?.receivable ?? []) },
       { key: 'loan',       label: 'You Owe',  items: filterItems(data?.pending?.loan ?? []) }]
    : [{ key: 'receivable', label: 'Owes You', items: filterItems(data?.completed?.receivable ?? []) },
       { key: 'loan',       label: 'You Owe',  items: filterItems(data?.completed?.loan ?? []) }];

  const hasAny = sections.some(s => s.items.length > 0);
  const pendingSections = [
    { key: 'receivable', label: 'Owes You', items: (data?.pending?.receivable ?? []).filter((i: any) => i.isRecording) },
    { key: 'loan',       label: 'You Owe',  items: (data?.pending?.loan ?? []).filter((i: any) => i.isRecording) },
  ].filter(s => s.items.length > 0);
  const hasSettleItems = pendingSections.some(s => s.items.length > 0);
  const pendingItems = (data?.pending?.receivable ?? []).concat(data?.pending?.loan ?? []);
  const selectedTotal = [...selectedIds].reduce((sum, id) => {
    const item = pendingItems.find(i => i.billId === id);
    if (item) return sum + Number(item.remaining);
    const ret = returns.find((r: any) => r.billId === id);
    if (ret) return sum + Number(ret.amount);
    return sum;
  }, 0);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getLenderBorrower = (item: any) => {
    if (item.entryType === 'receivable') return { lenderId: userId, borrowerId: item.taggedFriendUserId };
    return { lenderId: item.ownerUserId, borrowerId: userId };
  };

  const settleItem = async (billId: string, amount: number) => {
    const item = pendingItems.find(i => i.billId === billId);
    if (!item || item.remaining <= 0) return;
    if (item.taggedFriendUserId) {
      const { lenderId, borrowerId } = getLenderBorrower(item);
      await supabase.rpc('record_payment', {
        p_recording_id: billId, p_lender_id: lenderId,
        p_borrower_id: borrowerId, p_amount: amount, p_person_name: person,
      });
    } else {
      const newPaid = item.paid + amount;
      const newStatus = newPaid >= item.owed - 0.01 ? 'paid' : 'partial';
      await supabase.from('recordings').update({ paid_amount: newPaid, status: newStatus }).eq('id', billId);
    }
  };

  const closeItem = async (billId: string) => {
    const item = pendingItems.find(i => i.billId === billId);
    if (!item || item.remaining <= 0) return;
    await supabase.from('recordings').update({ status: 'paid' }).eq('id', billId);
  };

  const completeAll = async () => {
    if (settling) return;
    setSettling(true);
    try {
      for (const billId of selectedIds) {
        const item = pendingItems.find(i => i.billId === billId);
        if (!item || item.remaining <= 0) continue;
        await settleItem(billId, item.remaining);
      }
    } catch (_) {}
    setSettling(false);
    setSelectedIds(new Set());
    setMode('view');
    queryClient.invalidateQueries({ queryKey: ['receivable-detail', userId, person] });
  };

  const confirmPartial = async () => {
    const amount = parseFloat(settleAmount || '0');
    if (amount <= 0 || settling) return;
    setSettling(true);
    try {
      for (const billId of selectedIds) {
        const item = pendingItems.find(i => i.billId === billId);
        if (!item || item.remaining <= 0) continue;
        const payAmount = Math.min(amount, item.remaining);
        await settleItem(billId, payAmount);
      }
    } catch (_) {}
    setSettling(false);
    setSettleModal(false);
    setSelectedIds(new Set());
    setMode('view');
    queryClient.invalidateQueries({ queryKey: ['receivable-detail', userId, person] });
  };

  const confirmClose = async () => {
    if (settling) return;
    setSettling(true);
    try {
      for (const billId of selectedIds) {
        await closeItem(billId);
      }
    } catch (_) {}
    setSettling(false);
    setCloseModal(false);
    setSelectedIds(new Set());
    setMode('view');
    queryClient.invalidateQueries({ queryKey: ['receivable-detail', userId, person] });
  };

  const toggleSettleMode = () => {
    if (mode === 'settle') { setSelectedIds(new Set()); setMode('view'); return; }
    setTab('pending');
    setSettleTab('transactions');
    setMode('settle');
  };

  const renderRow = (bill: any, i: number, sectionItems: any[], isRedSection: boolean) => {
    if (mode === 'settle' && tab === 'pending') {
      const checked = selectedIds.has(bill.billId);
      const creatorLabel = bill.createdBy === 'me' ? 'You' : bill.createdBy;
      return (
        <TouchableOpacity
          key={bill.billId}
          style={[st.row, i === sectionItems.length - 1 && { borderBottomWidth: 0 }, { opacity: checked ? 1 : 0.7 }]}
          activeOpacity={0.7}
          onPress={() => toggleSelection(bill.billId)}
        >
          <Ionicons name={checked ? 'radio-button-on' : 'radio-button-off'} size={20} color={checked ? TEAL : Colors.faint} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={st.rowName} numberOfLines={1}>{bill.billName}</Text>
            <Text style={st.rowSub}>Created by: {creatorLabel}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[st.rowAmount, { color: '#111' }]}>{fmt(bill.remaining)}</Text>
            <Text style={st.rowSub}>Total: {fmt(bill.owed)} · Paid: {fmt(bill.paid)}</Text>
          </View>
        </TouchableOpacity>
      );
    }
    const creatorLabel = bill.createdBy === 'me' ? 'You' : bill.createdBy;
    return (
      <TouchableOpacity
        key={bill.billId}
        style={[st.row, i === sectionItems.length - 1 && { borderBottomWidth: 0 }]}
        activeOpacity={0.7}
        onPress={() => bill.isRecording ? openRecording(bill.billId) : openSplitBill(bill.billId, bill.billName)}
      >
        <View style={{ flex: 1 }}>
          <Text style={st.rowName} numberOfLines={1}>{bill.billName}</Text>
          <Text style={st.rowSub}>Created by: {creatorLabel}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[st.rowAmount, { color: isRedSection ? '#e74c3c' : (tab === 'pending' ? TEAL : '#111111') }]}>
            {fmt(bill.remaining)}
          </Text>
          <Text style={st.rowSub}>Total: {fmt(bill.owed)} · Paid: {fmt(bill.paid)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={13} color={Colors.faint} style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    );
  };

  const deleteSelectedReturns = async () => {
    if (settling) return;
    setSettling(true);
    try {
      for (const billId of selectedIds) {
        const ret = returns.find((r: any) => r.billId === billId);
        if (!ret) continue;
        await supabase.rpc('delete_return', { p_return_id: billId, p_lender_id: ret.userId, p_borrower_id: ret.borrowerId });
      }
    } catch (_) {}
    setSettling(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['receivable-detail', userId, person] });
  };

  const settleBar = mode === 'settle' && selectedIds.size > 0 ? (
    <View style={{ padding: DC.pagePadding, paddingBottom: 100, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.white }}>
      <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted, marginBottom: 8 }}>
        {selectedIds.size} selected · {settleTab === 'returns' ? `total: PHP ${fmt(selectedTotal)}` : `total: PHP ${fmt(selectedTotal)}`}
      </Text>
      {settleTab === 'returns' ? (
        <TouchableOpacity
          style={{ backgroundColor: '#e74c3c', borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center' }}
          activeOpacity={0.8}
          onPress={deleteSelectedReturns}
        >
          {settling ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontFamily: AppFont.bold, fontSize: 14, color: '#fff' }}>Delete</Text>}
        </TouchableOpacity>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: DC.cardBg, alignItems: 'center', borderWidth: 1, borderColor: DC.cardBorder }}
            activeOpacity={0.8}
            onPress={() => { setSettleAmount(''); setMarkComplete(false); setSettleModal(true); }}
          >
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 12, color: '#111' }}>Partial</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: TEAL, alignItems: 'center' }}
            activeOpacity={0.8}
            onPress={completeAll}
          >
            {settling ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontFamily: AppFont.bold, fontSize: 12, color: '#fff' }}>Completed</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: '#e74c3c', alignItems: 'center' }}
            activeOpacity={0.8}
            onPress={() => setCloseModal(true)}
          >
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 12, color: '#fff' }}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  ) : null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: slideAnim }] }]} pointerEvents="box-none">
      <SafeAreaView style={st.root}>
        <PageHeader
          title="Loan Details"
          onBack={handleClose}
          titleColor={TEAL}
        />

        <View style={st.personNameRow}>
          <View style={st.avatarSmall}>
            <Text style={st.avatarSmallText}>{person[0].toUpperCase()}</Text>
          </View>
          <Text style={st.personNameText} numberOfLines={1}>{person}</Text>
        </View>

        <View style={st.tabRow}>
          <TouchableOpacity style={[st.tab, tab === 'pending' && st.tabActive]} onPress={() => setTab('pending')} activeOpacity={0.7}>
            <Text style={[st.tabText, tab === 'pending' && st.tabTextActive]}>Ongoing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.tab, tab === 'completed' && st.tabActive]} onPress={() => setTab('completed')} activeOpacity={0.7}>
            <Text style={[st.tabText, tab === 'completed' && st.tabTextActive]}>Completed</Text>
          </TouchableOpacity>
        </View>

        <View style={st.searchWrap}>
          <Ionicons name="search-outline" size={13} color={Colors.faint} />
          <TextInput
            style={st.searchInput}
            placeholder="search transactions..."
            placeholderTextColor={Colors.faint}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={13} color={Colors.faint} />
            </TouchableOpacity>
          )}
        </View>

        {tab === 'pending' && (hasSettleItems || returns.length > 0) && (
          <TouchableOpacity
            style={[st.settleBtn, mode === 'settle' && { backgroundColor: DC.cardBg, borderWidth: 1, borderColor: DC.cardBorder }]}
            onPress={toggleSettleMode}
            activeOpacity={0.7}
          >
            <Text style={[st.settleBtnText, mode === 'settle' && { color: DC.pageText }]}>
              {mode === 'settle' ? 'Cancel' : 'Settle'}
            </Text>
          </TouchableOpacity>
        )}

        {mode === 'settle' && (
          <View style={[st.tabRow, { paddingTop: 0 }]}>
            <TouchableOpacity style={[st.tab, settleTab === 'transactions' && st.tabActive]} onPress={() => { setSettleTab('transactions'); setSelectedIds(new Set()); }} activeOpacity={0.7}>
              <Text style={[st.tabText, settleTab === 'transactions' && st.tabTextActive]}>Transactions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.tab, settleTab === 'returns' && st.tabActive]} onPress={() => { setSettleTab('returns'); setSelectedIds(new Set()); }} activeOpacity={0.7}>
              <Text style={[st.tabText, settleTab === 'returns' && st.tabTextActive]}>Returns</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'settle' && settleTab === 'returns' ? (
          returns.length === 0 ? (
            <View style={st.empty}><Text style={st.emptyText}>no returns</Text></View>
          ) : (
            <ScrollView
              contentContainerStyle={[st.scroll, { paddingBottom: settleBar ? 140 : 20 }]}
              showsVerticalScrollIndicator={false}
            >
              <Text style={st.sectionLabel}>Returns</Text>
              {returns.map((ret: any, i: number) => {
                const checked = selectedIds.has(ret.billId);
                return (
                  <TouchableOpacity
                    key={ret.billId}
                    style={[st.row, i === returns.length - 1 && { borderBottomWidth: 0 }, { opacity: checked ? 1 : 0.7 }]}
                    activeOpacity={0.7}
                    onPress={() => toggleSelection(ret.billId)}
                  >
                    <Ionicons name={checked ? 'radio-button-on' : 'radio-button-off'} size={20} color={checked ? TEAL : Colors.faint} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={st.rowName} numberOfLines={1}>{ret.billName}</Text>
                      <Text style={st.rowSub}>{new Date(ret.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    </View>
                    <Text style={[st.rowAmount, { color: '#111' }]}>{fmt(ret.amount)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )
        ) : isLoading ? (
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}><GooeyLoader /></BlurView>
        ) : !hasAny ? (
          <View style={st.empty}><Text style={st.emptyText}>no {tabLabel.toLowerCase()} transactions</Text></View>
        ) : (
          <ScrollView
            contentContainerStyle={[st.scroll, { paddingBottom: settleBar ? 140 : 20 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {sections.filter(s => s.items.length > 0).map(section => {
              const secOwed = section.items.reduce((s: number, b: any) => s + Number(b.owed), 0);
              const secPaid = section.items.reduce((s: number, b: any) => s + Number(b.paid), 0);
              const secRemaining = section.items.reduce((s: number, b: any) => s + Number(b.remaining), 0);
              const isRed = section.key === 'loan';
              return (
                <View key={section.key} style={{ marginBottom: 12 }}>
                  <Text style={[st.sectionLabel, isRed && { color: '#e74c3c' }]}>{section.label}</Text>
                  {section.items.map((bill: any, i: number) => renderRow(bill, i, section.items, isRed))}
                  <View style={[st.row, { borderBottomWidth: 0, paddingTop: 4 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.rowName, { fontFamily: AppFont.bold }]}>Total</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[st.rowAmount, { color: isRed ? '#e74c3c' : TEAL }]}>
                        {fmt(secRemaining)}
                      </Text>
                      <Text style={st.rowSub}>Total: {fmt(secOwed)} · Paid: {fmt(secPaid)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {settleBar}

        {/* Partial Settle Modal */}
        <Modal visible={settleModal} transparent animationType="fade" onRequestClose={() => setSettleModal(false)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ width: width * 0.85, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 24, gap: 16 }}>
              <Text style={{ fontFamily: AppFont.bold, fontSize: 16, color: '#111' }}>Partial Payment</Text>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted }}>Amount (max: {fmt(selectedTotal)})</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: DC.cardBorder, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text style={{ fontFamily: AppFont.bold, fontSize: 14, color: Colors.muted, marginRight: 6 }}>PHP</Text>
                <TextInput
                  style={{ flex: 1, fontFamily: AppFont.monoBold, fontSize: 16, color: '#111', padding: 0, margin: 0 }}
                  value={settleAmount}
                  onChangeText={t => {
                    const cleaned = t.replace(/[^0-9.]/g, '');
                    const num = parseFloat(cleaned || '0');
                    if (num > selectedTotal) return;
                    setSettleAmount(cleaned);
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                onPress={() => setMarkComplete(!markComplete)}
                activeOpacity={0.7}
              >
                <Ionicons name={markComplete ? 'checkbox' : 'square-outline'} size={20} color={markComplete ? TEAL : Colors.faint} />
                <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: '#111' }}>Mark as fully paid</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: DC.cardBg, alignItems: 'center', borderWidth: 1, borderColor: DC.cardBorder }}
                  onPress={() => setSettleModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: '#111' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: TEAL, alignItems: 'center' }}
                  onPress={confirmPartial}
                  activeOpacity={0.8}
                >
                  {settling ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontFamily: AppFont.bold, fontSize: 13, color: '#fff' }}>Confirm</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Close Transaction Verification Modal */}
        <Modal visible={closeModal} transparent animationType="fade" onRequestClose={() => setCloseModal(false)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ width: width * 0.85, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 24, gap: 16 }}>
              <Text style={{ fontFamily: AppFont.bold, fontSize: 16, color: '#111' }}>Close Transaction</Text>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted, lineHeight: 18 }}>
                This will mark {selectedIds.size} transaction{selectedIds.size > 1 ? 's' : ''} as complete without recording a payment. Are you sure?
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: DC.cardBg, alignItems: 'center', borderWidth: 1, borderColor: DC.cardBorder }}
                  onPress={() => setCloseModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: '#111' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: '#e74c3c', alignItems: 'center' }}
                  onPress={confirmClose}
                  activeOpacity={0.8}
                >
                  {settling ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontFamily: AppFont.bold, fontSize: 13, color: '#fff' }}>Close</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.white },
  scroll:      { paddingHorizontal: DC.pagePadding, paddingBottom: 120, paddingTop: 8 },
  tabRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: DC.pagePadding, paddingVertical: 8 },
  tab:         { flex: 1, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: DC.pageActionBg, alignItems: 'center' },
  tabActive:   { backgroundColor: '#111111' },
  tabText:     { fontFamily: AppFont.regular, fontSize: 12, color: DC.pageActionText },
  tabTextActive: { fontFamily: AppFont.semiBold, fontSize: 12, color: '#ffffff' },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: DC.cardBorder, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: DC.cardBg, marginHorizontal: DC.pagePadding, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: AppFont.regular, fontSize: 13, color: DC.pageText, padding: 0 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  rowLast:     { borderBottomWidth: 0 },
  rowName:     { fontFamily: AppFont.regular, fontSize: 14, color: '#111111' },
  rowSub:      { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, fontStyle: 'italic' },
  rowAmount:   { fontFamily: AppFont.bold, fontSize: 13 },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  emptyText:   { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },
  sectionLabel: { fontFamily: AppFont.bold, fontSize: 10, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, marginTop: 8 },
  settleBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: DC.pagePadding, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: DC.pageActionBg, marginBottom: 8 },
  settleBtnText: { fontFamily: AppFont.semiBold, fontSize: 13, color: DC.pageActionText },
  personNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: DC.pagePadding, paddingTop: 4, paddingBottom: 4 },
  avatarSmall: { width: 24, height: 24, borderRadius: 12, backgroundColor: TEAL + '66', justifyContent: 'center', alignItems: 'center' },
  avatarSmallText: { fontFamily: AppFont.bold, fontSize: 10, color: '#2A7A6F' },
  personNameText: { fontFamily: AppFont.semiBold, fontSize: 13, color: Colors.text, flex: 1 },
});
