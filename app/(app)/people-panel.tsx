import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, RefreshControl, TextInput,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import ReceivableDetail from './receivable-detail';
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

interface Props { onClose: () => void; initialPerson?: string | null; }

export default function PeoplePanel({ onClose, initialPerson }: Props) {
  const { userId } = useUser();
  const { openRecording, openSplitBill } = useNav();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [detailPerson, setDetailPerson] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const initialPersonSet = useRef(false);
  useEffect(() => {
    if (!initialPerson) { initialPersonSet.current = false; return; }
    if (!initialPersonSet.current) { initialPersonSet.current = true; setDetailPerson(initialPerson); }
  }, [initialPerson]);

  // ── Query: all people with positions ────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['people-panel', userId],
    queryFn: async () => {
      // 1. Get ALL contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('name')
        .eq('user_id', userId)
        .order('name');

      // 2. Get user's split bills (for scoping items/payments)
      const { data: userBills } = await supabase
        .from('split_bills')
        .select('id')
        .eq('user_id', userId);
      const billIds = (userBills ?? []).map((b: any) => b.id);

      // 3. Get split items scoped to user's bills
      const { data: oldItems } = billIds.length > 0
        ? await supabase.from('split_items').select('people, cost, recording_type').in('split_bill_id', billIds)
        : { data: [] };

      // 4. Get ALL recordings with a person (for transaction counts)
      const { data: allRecsWithPerson } = await supabase
        .from('recordings')
        .select('id, type, person_name, amount, paid_amount, status, is_due')
        .eq('user_id', userId)
        .neq('person_name', '')
        .not('person_name', 'is', null)
        .neq('status', 'voided');

      // 5. Get debt/due recordings for balance calc
      const recs = (allRecsWithPerson ?? []).filter(
        (r: any) => r.type === 'debt' || r.type === 'due' || r.is_due
      );

      // Shared recordings — I owe the sharer
      const { data: sharedRecs } = await supabase
        .from('recordings')
        .select('id, user_id, name, amount, status')
        .filter('shared_with', 'cs', `["${userId}"]`)
        .neq('status', 'voided');
      const sharedMap: Record<string, { name: string; total: number }> = {};
      for (const sr of (sharedRecs ?? [])) {
        if (sr.status === 'paid') continue;
        const ownerId = sr.user_id;
        if (!sharedMap[ownerId]) {
          const { data: ownerName } = await supabase.rpc('get_user_display_name', { user_id: ownerId });
          sharedMap[ownerId] = { name: ownerName ?? 'unknown', total: 0 };
        }
        sharedMap[ownerId].total += Number(sr.amount ?? 0);
      }

      // 6. Get split bill payments scoped to user's bills
      const { data: payments } = billIds.length > 0
        ? await supabase.from('split_bill_payments').select('person_name, amount, status').in('split_bill_id', billIds)
        : { data: [] };

      // Build set of all unique people (only those with actual transactions)
      const peopleSet = new Set<string>();
      (contacts ?? []).forEach((c: any) => peopleSet.add(c.name));
      (recs ?? []).forEach((r: any) => r.person_name && peopleSet.add(r.person_name));
      (payments ?? []).forEach((p: any) => peopleSet.add(p.person_name));
      (oldItems ?? []).forEach((item: any) => {
        if (item.people?.length) item.people.forEach((p: string) => peopleSet.add(p));
      });

      // Calculate per-person balances
      const balances: Record<string, { owedToMe: number; iOwe: number; bills: number }> = {};

      // From debt recordings (I owe them)
      (recs ?? []).forEach((r: any) => {
        if (!r.person_name) return;
        if (!balances[r.person_name]) balances[r.person_name] = { owedToMe: 0, iOwe: 0, bills: 0 };
        const paid = Number(r.paid_amount ?? 0);
        const net = Number(r.amount) - paid;
        if (r.type === 'due' || r.is_due) balances[r.person_name].owedToMe += net;
        else balances[r.person_name].iOwe += net;
      });

      // From old schema split items
      (oldItems ?? []).forEach((item: any) => {
        if (!item.people?.length) return;
        const pp = Number(item.cost) / item.people.length;
        const isDeduct = item.recording_type === 'payable';
        item.people.forEach((p: string) => {
          if (!balances[p]) balances[p] = { owedToMe: 0, iOwe: 0, bills: 0 };
          if (isDeduct) balances[p].iOwe += pp;
          else balances[p].owedToMe += pp;
        });
      });

      // From payments
      (payments ?? []).forEach((pay: any) => {
        if (pay.status === 'cancelled') return;
        if (!balances[pay.person_name]) balances[pay.person_name] = { owedToMe: 0, iOwe: 0, bills: 0 };
        // payments reduce what they owe
        balances[pay.person_name].owedToMe -= Number(pay.amount ?? 0);
      });

      // Shared recordings — I owe the owner
      Object.entries(sharedMap).forEach(([ownerId, data]) => {
        const name = data.name;
        peopleSet.add(name);
        if (!balances[name]) balances[name] = { owedToMe: 0, iOwe: 0, bills: 0 };
        balances[name].iOwe += data.total;
      });

      // Count visible entries (matches what ReceivableDetail shows)
      const txCount: Record<string, number> = {};
      // Unique recordings per person
      const countedRecs = new Set<string>();
      (allRecsWithPerson ?? []).forEach((r: any) => {
        if (r.person_name && !countedRecs.has(r.id)) {
          countedRecs.add(r.id);
          txCount[r.person_name] = (txCount[r.person_name] ?? 0) + 1;
        }
      });
      // Shared recordings count toward the owner
      Object.values(sharedMap).forEach(data => {
        txCount[data.name] = (txCount[data.name] ?? 0) + 1;
      });


      const people = [...peopleSet].map(name => {
        const b = balances[name] ?? { owedToMe: 0, iOwe: 0, bills: 0 };
        const net = b.owedToMe - b.iOwe;
        return { name, net, owedToMe: b.owedToMe, iOwe: b.iOwe, txCount: txCount[name] ?? 0 };
      });

      const owedToMe = people.filter(p => p.net > 0.01).sort((a, b) => b.net - a.net);
      const iOwe = people.filter(p => p.net < -0.01).sort((a, b) => a.net - b.net);
      const neutral = people.filter(p => Math.abs(p.net) <= 0.01).sort((a, b) => b.txCount - a.txCount);

      return { owedToMe, iOwe, neutral };
    },
    enabled: !!userId,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['people-panel', userId] });
    setRefreshing(false);
  };

  if (detailPerson) {
    return (
      <ReceivableDetail
        person={detailPerson}
        onBack={() => setDetailPerson(null)}
        onClose={onClose}
      />
    );
  }

  const filteredOwedToMe = (data?.owedToMe ?? []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredIOwe = (data?.iOwe ?? []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredNeutral = (data?.neutral ?? []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={s.container}>
      <PageHeader title="people" onBack={onClose} />

      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={14} color={Colors.faint} />
        <TextInput
          style={s.searchInput}
          placeholder="search people..."
          placeholderTextColor={Colors.faint}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close" size={14} color={Colors.faint} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {isLoading ? (
          <BlurView intensity={40} tint="light" style={{ borderRadius: 20, overflow: 'hidden', marginTop: 40 }}>
            <GooeyLoader />
          </BlurView>
        ) : (
          <>
            {/* Owed to me */}
            {filteredOwedToMe.length > 0 && (
              <>
                <Text style={s.sectionLabel}>owed to you</Text>
                <View style={s.list}>
                  {filteredOwedToMe.map((p, i) => (
                    <TouchableOpacity
                      key={p.name}
                      style={[s.row, i === filteredOwedToMe.length - 1 && s.rowLast]}
                      activeOpacity={0.7}
                      onPress={() => setDetailPerson(p.name)}
                    >
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{p.name[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                        <Text style={s.rowSub}>
                          {p.owedToMe > 0.01 ? `${fmt(p.owedToMe)} owed` : ''}
                          {p.owedToMe > 0.01 && p.iOwe > 0.01 ? ` · ` : ''}
                          {p.iOwe > 0.01 ? `you owe ${fmt(p.iOwe)}` : ''}
                        </Text>
                      </View>
                      <Text style={s.rowValuePositive}>{fmt(p.net)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* I owe */}
            {filteredIOwe.length > 0 && (
              <>
                <Text style={s.sectionLabel}>you owe</Text>
                <View style={s.list}>
                  {filteredIOwe.map((p, i) => (
                    <TouchableOpacity
                      key={p.name}
                      style={[s.row, i === filteredIOwe.length - 1 && s.rowLast]}
                      activeOpacity={0.7}
                      onPress={() => setDetailPerson(p.name)}
                    >
                      <View style={s.avatar}>
                        <Text style={s.avatarText}>{p.name[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                        <Text style={s.rowSub}>
                          {p.owedToMe > 0.01 ? `${fmt(p.owedToMe)} owed · ` : ''}
                          owe {fmt(p.iOwe)}
                        </Text>
                      </View>
                      <Text style={s.rowValueNegative}>-{fmt(Math.abs(p.net))}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Neutral (contacts with no financial relationship) */}
            {filteredNeutral.length > 0 && (
              <>
                <Text style={s.sectionLabel}>contacts</Text>
                <View style={s.list}>
                  {filteredNeutral.map((p, i) => (
                    <TouchableOpacity
                      key={p.name}
                      style={[s.row, i === filteredNeutral.length - 1 && s.rowLast]}
                      activeOpacity={0.7}
                      onPress={() => setDetailPerson(p.name)}
                    >
                      <View style={[s.avatar, { backgroundColor: '#e8e8e8' }]}>
                        <Text style={[s.avatarText, { color: '#8a8a8a' }]}>{p.name[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                        <Text style={s.rowSub}>{p.txCount} transaction{p.txCount !== 1 ? 's' : ''}</Text>
                      </View>
                      <Text style={[s.rowValuePositive, { color: Colors.muted }]}>0.00</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {!isLoading && filteredOwedToMe.length === 0 && filteredIOwe.length === 0 && filteredNeutral.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
                <Ionicons name="people-outline" size={32} color={Colors.faint} />
                <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>
                  {search ? 'no people match your search' : 'no people found — add contacts or create a split bill'}
                </Text>
              </View>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 12, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.md, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.borderMid,
  },
  searchInput: { flex: 1, fontFamily: AppFont.regular, fontSize: 13, color: Colors.text, padding: 0 },
  sectionLabel: {
    fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 16, marginBottom: 8,
  },
  list: { backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: TEAL + '66', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontFamily: AppFont.bold, fontSize: 13, color: '#2A7A6F' },
  rowName: { fontFamily: AppFont.semiBold, fontSize: 14, color: Colors.text },
  rowSub: { fontFamily: AppFont.regular, fontSize: 10, color: Colors.muted, marginTop: 1 },
  rowValuePositive: { fontFamily: AppFont.bold, fontSize: 14, color: '#2A7A6F' },
  rowValueNegative: { fontFamily: AppFont.bold, fontSize: 14, color: '#e74c3c' },
});
