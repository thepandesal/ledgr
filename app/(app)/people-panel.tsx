import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  TouchableOpacity, RefreshControl, TextInput,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import ReceivableDetail from './receivable-detail';
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
  const [section, setSection] = useState<'ongoing' | 'completed'>('ongoing');

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
        .select('id, type, person_name, amount, paid_amount, status, is_due, is_tagged')
        .eq('user_id', userId)
        .neq('person_name', '')
        .not('person_name', 'is', null)
        .neq('status', 'voided');

      // 5. Get debt/due recordings for balance calc (exclude old mirror debts — handled in backward compat)
      const recs = (allRecsWithPerson ?? []).filter(
        (r: any) => (r.type === 'debt' && !r.is_tagged) || r.type === 'due' || r.is_due
      );

      // 6. Get split bill payments scoped to user's bills
      const { data: payments } = billIds.length > 0
        ? await supabase.from('split_bill_payments').select('person_name, amount, status').in('split_bill_id', billIds)
        : { data: [] };

      // 7. Shared recordings where I'm tagged — I owe the owner (single-entry model)
      const { data: sharedRecs } = await supabase
        .from('recordings')
        .select('id, user_id, name, amount, status, paid_amount')
        .filter('shared_with', 'cs', `["${userId}"]`)
        .neq('status', 'voided')
        .eq('tagged_friend_user_id', userId);

      const sharedMap: Record<string, { name: string; total: number; ongoing: number; completed: number }> = {};
      for (const sr of (sharedRecs ?? [])) {
        if (sr.status === 'paid') continue;
        const ownerId = sr.user_id;
        if (ownerId === userId) continue;
        if (!sharedMap[ownerId]) {
          const { data: ownerName } = await supabase.rpc('get_user_display_name', { user_id: ownerId });
          sharedMap[ownerId] = { name: ownerName ?? 'unknown', total: 0, ongoing: 0, completed: 0 };
        }
        const paid = Number(sr.paid_amount ?? 0);
        const remaining = Math.max(0, Number(sr.amount) - paid);
        const isComplete = paid >= Number(sr.amount) - 0.01;
        if (isComplete) {
          sharedMap[ownerId].completed += 1;
        } else {
          sharedMap[ownerId].total += remaining;
          sharedMap[ownerId].ongoing += 1;
        }
      }

      // 8. Backward compat: old mirror debt recordings in my account
      const { data: oldDebts } = await supabase
        .from('recordings')
        .select('id, person_name, amount, paid_amount, status')
        .eq('user_id', userId)
        .eq('type', 'debt')
        .eq('is_tagged', true)
        .neq('status', 'voided');
      const oldDebtMap: Record<string, { amount: number; paid: number; status: string }> = {};
      (oldDebts ?? []).forEach((d: any) => {
        const name = d.person_name?.toLowerCase() || 'unknown';
        if (!oldDebtMap[name]) oldDebtMap[name] = { amount: 0, paid: 0, status: d.status };
        else {
          oldDebtMap[name].amount += Number(d.amount);
          oldDebtMap[name].paid += Number(d.paid_amount ?? 0);
        }
      });

      // Build per-person data
      const peopleMap: Record<string, {
        ongoingCount: number; completedCount: number;
        owedToMe: number; iOwe: number;
      }> = {};

      // From debt recordings
      (recs ?? []).forEach((r: any) => {
        if (!r.person_name) return;
        if (!peopleMap[r.person_name]) peopleMap[r.person_name] = { ongoingCount: 0, completedCount: 0, owedToMe: 0, iOwe: 0 };
        const paid = Number(r.paid_amount ?? 0);
        const remaining = Number(r.amount) - paid;
        const isComplete = r.status === 'paid' || r.status === 'closed' || (Number(r.amount) > 0 && paid >= Number(r.amount) - 0.01);
        if (isComplete) {
          peopleMap[r.person_name].completedCount += 1;
        } else {
          peopleMap[r.person_name].ongoingCount += 1;
          if (r.type === 'due' || r.is_due) peopleMap[r.person_name].owedToMe += remaining;
          else peopleMap[r.person_name].iOwe += remaining;
        }
      });

      // From old schema split items
      (oldItems ?? []).forEach((item: any) => {
        if (!item.people?.length) return;
        const pp = Number(item.cost) / item.people.length;
        const isDeduct = item.recording_type === 'payable';
        item.people.forEach((p: string) => {
          if (!peopleMap[p]) peopleMap[p] = { ongoingCount: 0, completedCount: 0, owedToMe: 0, iOwe: 0 };
          peopleMap[p].ongoingCount += 1;
          if (isDeduct) peopleMap[p].iOwe += pp;
          else peopleMap[p].owedToMe += pp;
        });
      });

      // From payments
      (payments ?? []).forEach((pay: any) => {
        if (pay.status === 'cancelled') return;
        if (!peopleMap[pay.person_name]) peopleMap[pay.person_name] = { ongoingCount: 0, completedCount: 0, owedToMe: 0, iOwe: 0 };
        peopleMap[pay.person_name].owedToMe -= Number(pay.amount ?? 0);
      });

      // Shared recordings — I owe the owner
      Object.entries(sharedMap).forEach(([ownerId, data]) => {
        const name = data.name;
        if (!peopleMap[name]) peopleMap[name] = { ongoingCount: 0, completedCount: 0, owedToMe: 0, iOwe: 0 };
        peopleMap[name].iOwe += data.total;
        peopleMap[name].ongoingCount += data.ongoing;
        peopleMap[name].completedCount += data.completed;
      });

      // Backward compat: old mirror debt recordings in my account
      Object.entries(oldDebtMap).forEach(([name, d]) => {
        if (!peopleMap[name]) peopleMap[name] = { ongoingCount: 0, completedCount: 0, owedToMe: 0, iOwe: 0 };
        const remaining = Math.max(0, d.amount - d.paid);
        if (remaining > 0.01) {
          peopleMap[name].iOwe += remaining;
          peopleMap[name].ongoingCount += 1;
        } else {
          peopleMap[name].completedCount += 1;
        }
      });

      // Include contacts
      (contacts ?? []).forEach((c: any) => {
        if (!peopleMap[c.name]) peopleMap[c.name] = { ongoingCount: 0, completedCount: 0, owedToMe: 0, iOwe: 0 };
      });

      const ongoing: any[] = [];
      const completed: any[] = [];

      Object.entries(peopleMap).forEach(([name, d]) => {
        const net = d.owedToMe - d.iOwe;
        const owesDirection = net > 0.01 ? 'owes_you' : (net < -0.01 ? 'you_owe' : 'settled');
        const entry = { name, ...d, net, owesDirection };

        if (d.ongoingCount > 0) {
          ongoing.push(entry);
        } else {
          completed.push(entry);
        }
      });

      ongoing.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
      completed.sort((a, b) => b.completedCount - a.completedCount);

      return { ongoing, completed };
    },
    enabled: !!userId,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['people-panel', userId] });
    setRefreshing(false);
  };

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`people-shared-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings' }, (payload: any) => {
        const checkShared = (data: any) => {
          if (!data?.shared_with) return false;
          const arr = typeof data.shared_with === 'string' ? JSON.parse(data.shared_with) : data.shared_with;
          return Array.isArray(arr) && (arr.includes(userId) || data.user_id === userId);
        };
        if (checkShared(payload.new) || checkShared(payload.old)) {
          queryClient.invalidateQueries({ queryKey: ['people-panel', userId] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  if (detailPerson) {
    return (
      <ReceivableDetail
        person={detailPerson}
        onBack={() => setDetailPerson(null)}
        onClose={onClose}
      />
    );
  }

  const filteredOngoing = (data?.ongoing ?? []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredCompleted = (data?.completed ?? []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={s.container}>
      <PageHeader title="people" onBack={onClose} />

      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          placeholder="search people..."
          placeholderTextColor={Colors.faint}
          value={search}
          onChangeText={setSearch}
        />

      </View>

      {/* Section tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, section === 'ongoing' && s.tabActive]} onPress={() => setSection('ongoing')} activeOpacity={0.7}>
          <Text style={[s.tabText, section === 'ongoing' && s.tabTextActive]}>Ongoing</Text>
          {filteredOngoing.length > 0 && <Text style={s.tabCount}>{filteredOngoing.length}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, section === 'completed' && s.tabActive]} onPress={() => setSection('completed')} activeOpacity={0.7}>
          <Text style={[s.tabText, section === 'completed' && s.tabTextActive]}>Completed</Text>
          {filteredCompleted.length > 0 && <Text style={s.tabCount}>{filteredCompleted.length}</Text>}
        </TouchableOpacity>
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
            {section === 'ongoing' && (
              <>
                {filteredOngoing.length > 0 ? (
                  <View style={s.list}>
                    {filteredOngoing.map((p, i) => {
                      const isOwedToMe = p.owesDirection === 'owes_you';
                      const totalAmount = Math.abs(p.net);
                      return (
                        <TouchableOpacity
                          key={p.name}
                          style={[s.row, i === filteredOngoing.length - 1 && s.rowLast]}
                          activeOpacity={0.7}
                          onPress={() => setDetailPerson(p.name)}
                        >
                          <View style={s.avatar}>
                            <Text style={s.avatarText}>{p.name[0].toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                            <Text style={s.rowSub}>
                              {p.ongoingCount} ongoing {p.ongoingCount === 1 ? 'transaction' : 'transactions'}
                            </Text>
                            <Text style={[s.rowSub, { fontStyle: 'italic', color: isOwedToMe ? '#2A7A6F' : '#e74c3c' }]}>
                              {isOwedToMe ? 'Owes You' : 'You Owe'}
                            </Text>
                          </View>
                          <Text style={[s.rowAmount, { color: '#111111' }]}>{fmt(totalAmount)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>
                      {search ? 'no people match your search' : 'no ongoing transactions'}
                    </Text>
                  </View>
                )}
              </>
            )}

            {section === 'completed' && (
              <>
                {filteredCompleted.length > 0 ? (
                  <View style={s.list}>
                    {filteredCompleted.map((p, i) => (
                      <TouchableOpacity
                        key={p.name}
                        style={[s.row, i === filteredCompleted.length - 1 && s.rowLast]}
                        activeOpacity={0.7}
                        onPress={() => setDetailPerson(p.name)}
                      >
                        <View style={[s.avatar, { backgroundColor: '#e8e8e8' }]}>
                          <Text style={[s.avatarText, { color: '#8a8a8a' }]}>{p.name[0].toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                          <Text style={s.rowSub}>
                            {p.completedCount > 0 ? `${p.completedCount} completed ${p.completedCount === 1 ? 'transaction' : 'transactions'}` : 'no transactions'}
                          </Text>
                          <Text style={[s.rowSub, { fontStyle: 'italic', color: '#999999' }]}>Completed</Text>
                        </View>
                        <Text style={[s.rowAmount, { color: Colors.muted }]}>0.00</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
                    <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted }}>
                      {search ? 'no people match your search' : 'no completed transactions'}
                    </Text>
                  </View>
                )}
              </>
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
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
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
  rowAmount: { fontFamily: AppFont.bold, fontSize: 14, color: '#111111' },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.borderMid,
  },
  tabActive: { backgroundColor: '#111111', borderColor: '#111111' },
  tabText: { fontFamily: AppFont.regular, fontSize: 13, color: '#666666' },
  tabTextActive: { fontFamily: AppFont.semiBold, fontSize: 13, color: '#ffffff' },
  tabCount: {
    fontFamily: AppFont.bold, fontSize: 10, color: '#ffffff',
    backgroundColor: '#9cd7d2', borderRadius: 99,
    paddingHorizontal: 6, paddingVertical: 1,
    overflow: 'hidden',
  },
});
