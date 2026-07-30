import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { AppFont } from '../../src/lib/fonts';
import BottomSheet from '@/components/ui/BottomSheet';

const TEAL = '#9cd7d2';
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface PaymentItem {
  id: string;
  name: string;
  amount: number;
  type: 'receivable' | 'loan';
  source: 'split_bill' | 'recording';
  sourceName: string;
}

interface Props {
  visible: boolean;
  person: string;
  splitBillId?: string;
  onClose: () => void;
  onConfirm: (items: PaymentItem[], mode: 'all' | 'this-bill' | 'selected') => void;
}

export default function PaymentModal({ visible, person, splitBillId, onClose, onConfirm }: Props) {
  const { userId } = useUser();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'choose' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['payment-items', userId, person, splitBillId],
    queryFn: async () => {
      const items: PaymentItem[] = [];

      // 1. Split bills where this person has pending amounts
      const { data: userBills } = await supabase
        .from('split_bills')
        .select('id, name, status')
        .eq('user_id', userId);
      const billIds = (userBills ?? []).map((b: any) => b.id);

      if (billIds.length > 0) {
        const [{ data: billSplits }, { data: splitItems }] = await Promise.all([
          supabase.from('bill_splits').select('split_bill_id, person_name').in('split_bill_id', billIds),
          supabase.from('split_items').select('split_bill_id, cost, people, recording_type').in('split_bill_id', billIds),
        ]);

        const billMap: Record<string, any> = {};
        (userBills ?? []).forEach((b: any) => { billMap[b.id] = b; });

        // per-person per-bill net
        const personOwedMap: Record<string, Record<string, number>> = {};
        (splitItems ?? []).forEach((item: any) => {
          const people: string[] = item.people ?? [];
          if (!people.length) return;
          const pp = Number(item.cost) / people.length;
          const isDeduct = item.recording_type === 'payable';
          people.forEach((p: string) => {
            if (!personOwedMap[p]) personOwedMap[p] = {};
            personOwedMap[p][item.split_bill_id] = (personOwedMap[p][item.split_bill_id] ?? 0) + (isDeduct ? -pp : pp);
          });
        });

        // payments per person per bill
        const { data: payments } = await supabase
          .from('split_bill_payments')
          .select('split_bill_id, person_name, amount, status')
          .in('split_bill_id', billIds)
          .eq('person_name', person)
          .neq('status', 'cancelled');
        const paidMap: Record<string, number> = {};
        (payments ?? []).forEach((pay: any) => {
          paidMap[pay.split_bill_id] = (paidMap[pay.split_bill_id] ?? 0) + Number(pay.amount);
        });

        // For each person, create items per bill
        const personBills = new Set<string>();
        (billSplits ?? []).filter((bs: any) => bs.person_name === person).forEach((bs: any) => personBills.add(bs.split_bill_id));
        (splitItems ?? []).forEach((item: any) => {
          if ((item.people ?? []).includes(person)) personBills.add(item.split_bill_id);
        });

        personBills.forEach((billId: string) => {
          const bill = billMap[billId];
          if (!bill || bill.status === 'closed') return;
          const netOwed = personOwedMap[person]?.[billId] ?? 0;
          const paid = paidMap[billId] ?? 0;
          const remaining = Math.max(0, Math.abs(netOwed) - paid);
          if (remaining <= 0.01) return;
          const isReceivable = netOwed > 0;
          // Only include items from this specific bill if splitBillId is set and scoped
          if (splitBillId && billId !== splitBillId) return;
          items.push({
            id: `sb-${billId}`,
            name: person,
            amount: remaining,
            type: isReceivable ? 'receivable' : 'loan',
            source: 'split_bill',
            sourceName: bill.name,
          });
        });
      }

      // 2. Recordings (debt/due/is_due) for this person
      const { data: recs } = await supabase
        .from('recordings')
        .select('id, name, amount, paid_amount, type, is_due, status, split_bill_id')
        .eq('user_id', userId)
        .ilike('person_name', person)
        .neq('status', 'voided')
        .neq('status', 'paid');
      (recs ?? []).forEach((r: any) => {
        const remaining = Number(r.amount) - Number(r.paid_amount ?? 0);
        if (remaining <= 0.01) return;
        // Don't include this recording if already shown as a split bill item
        if (r.split_bill_id && items.some(i => i.id === `sb-${r.split_bill_id}`)) return;
        items.push({
          id: `rec-${r.id}`,
          name: r.name,
          amount: remaining,
          type: (r.type === 'due' || r.is_due) ? 'receivable' : 'loan',
          source: 'recording',
          sourceName: r.type === 'debt' ? 'Loan' : (r.is_due ? 'Due' : r.type),
        });
      });

      return items;
    },
    enabled: !!userId && !!person && visible,
  });

  const items = data ?? [];

  const reset = () => { setSelectedIds(new Set()); setMode(null); };

  const handleAll = () => {
    const allSelected = new Set(items.map(i => i.id));
    if (allSelected.size === selectedIds.size && items.every(i => selectedIds.has(i.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(allSelected);
    }
  };

  const handleThisBill = () => {
    onConfirm(items.filter(i => i.source === 'split_bill' && i.id.startsWith(`sb-${splitBillId}`)), 'this-bill');
    reset();
  };

  const handleConfirm = () => {
    const selectedItems = items.filter(i => selectedIds.has(i.id));
    if (selectedItems.length === 0) return;
    onConfirm(selectedItems, 'selected');
    reset();
  };

  const allSelected = items.length > 0 && items.every(i => selectedIds.has(i.id));
  const totalOwed = items.reduce((s, i) => s + i.amount, 0);
  const selectedTotal = items.filter(i => selectedIds.has(i.id)).reduce((s, i) => s + i.amount, 0);

  return (
    <BottomSheet visible={visible} onClose={() => { reset(); onClose(); }} title={person}>
      {isLoading ? (
        <ActivityIndicator color={TEAL} style={{ marginVertical: 40 }} />
      ) : items.length === 0 ? (
        <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted, textAlign: 'center', paddingVertical: 40 }}>
          no pending items
        </Text>
      ) : (
        <>
          {/* Total */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 12, color: Colors.muted }}>
              {items.length} pending item{items.length !== 1 ? 's' : ''} · {fmt(totalOwed)} total
            </Text>
            {selectedIds.size > 0 && (
              <Text style={{ fontFamily: AppFont.semiBold, fontSize: 12, color: TEAL }}>
                selected: {fmt(selectedTotal)}
              </Text>
            )}
          </View>

          {/* Quick action: All */}
          <TouchableOpacity
            style={[s.allBtn, allSelected && s.allBtnActive]}
            onPress={handleAll}
            activeOpacity={0.7}
          >
            <Text style={[s.allBtnText, allSelected && s.allBtnTextActive]}>All — {fmt(totalOwed)}</Text>
          </TouchableOpacity>

          {/* This bill only (if in split bill context) */}
          {splitBillId && items.some(i => i.id.startsWith(`sb-${splitBillId}`)) && (
            <TouchableOpacity
              style={s.allBtn}
              onPress={handleThisBill}
              activeOpacity={0.7}
            >
              <Text style={s.allBtnText}>This split bill only</Text>
            </TouchableOpacity>
          )}

          {/* Items grouped by source */}
          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {['split_bill', 'recording'].map(source => {
              const sourceItems = items.filter(i => i.source === source);
              if (sourceItems.length === 0) return null;
              return (
                <View key={source} style={{ marginBottom: 8 }}>
                  <Text style={s.sourceLabel}>
                    {source === 'split_bill' ? 'Split Bills' : 'Recordings'}
                  </Text>
                  {sourceItems.map(item => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[s.itemRow, isSelected && s.itemRowSelected]}
                        onPress={() => {
                          const next = new Set(selectedIds);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          setSelectedIds(next);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.itemName} numberOfLines={1}>{item.sourceName}</Text>
                          <Text style={s.itemSub}>{item.source === 'split_bill' ? 'split bill' : 'recording'} · {item.type === 'receivable' ? 'owes you' : 'you owe'}</Text>
                        </View>
                        <Text style={[s.itemAmount, { color: item.type === 'loan' ? '#e74c3c' : '#2A7A6F' }]}>
                          {fmt(item.amount)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          {/* Confirm */}
          <TouchableOpacity
            style={[s.confirmBtn, selectedIds.size === 0 && { opacity: 0.4 }]}
            onPress={handleConfirm}
            disabled={selectedIds.size === 0}
            activeOpacity={0.8}
          >
            <Text style={s.confirmBtnText}>
              {selectedIds.size > 0
                ? `Mark ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''} as paid (${fmt(selectedTotal)})`
                : 'Select items to mark as paid'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  allBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderMid,
    marginBottom: 6,
  },
  allBtnActive: { backgroundColor: '#111111', borderColor: '#111111' },
  allBtnText: { fontFamily: AppFont.semiBold, fontSize: 13, color: Colors.muted, flex: 1 },
  allBtnTextActive: { color: '#ffffff' },
  sourceLabel: {
    fontFamily: AppFont.bold, fontSize: 10, color: Colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: Radius.md, marginBottom: 2,
  },
  itemRowSelected: { backgroundColor: '#F5F5F5' },
  itemName: { fontFamily: AppFont.semiBold, fontSize: 13, color: Colors.text },
  itemSub: { fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted, marginTop: 1 },
  itemAmount: { fontFamily: AppFont.bold, fontSize: 13 },
  confirmBtn: {
    backgroundColor: '#111111', borderRadius: Radius.pill,
    paddingVertical: 14, alignItems: 'center', marginTop: 12,
  },
  confirmBtnText: { fontFamily: AppFont.bold, fontSize: 13, color: '#ffffff' },
});
