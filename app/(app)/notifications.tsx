import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useUser } from '../../src/hooks/useUser';
import { Colors, Fonts } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';
import TagRequestsScreen from './tag-request';

const ACCENT      = Brand.color.accent;
const ACCENT_DARK = Brand.color.accentDark;
const PAGE        = 20;

const TYPE_ICON: Record<string, string> = {
  recurring_due:           'repeat-outline',
  recurring_debt:          'repeat-outline',
  overdue:                 'alert-circle-outline',
  payment_received:        'checkmark-circle-outline',
  weekly_summary:          'bar-chart-outline',
  friend_request:          'person-add-outline',
  friend_request_accepted: 'people-outline',
  split_bill_invite:       'receipt-outline',
  space_invite:            'grid-outline',
  budget_warning_80:       'warning-outline',
  budget_limit_reached:    'alert-circle-outline',
  savings_reminder:        'trending-up-outline',
  dues_reminder:           'time-outline',
  dues_end_of_month:       'calendar-outline',
  dues_month_summary:      'bar-chart-outline',
  expense_tag:             'person-add-outline',
  tag_accepted:            'checkmark-circle-outline',
  tag_declined:            'close-circle-outline',
  tag_cancelled:           'close-circle-outline',
  tag_payment_update:      'cash-outline',
  overpayment_request:     'alert-circle-outline',
  default:                 'notifications-outline',
};

function smartGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.floor((todayStart.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return 'Earlier';
}

export default function NotificationsScreen({ isActive }: { isActive?: boolean }) {
  const router = useRouter();
  const { userId } = useUser();
  const [activeTab, setActiveTab] = useState<'notifications' | 'requests'>('notifications');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchPendingCount = useCallback(async () => {
    if (!userId) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('type', ['expense_tag', 'overpayment_request'])
      .eq('status', 'new');
    setPendingCount(count ?? 0);
  }, [userId]);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setNotifications(data ?? []);
    setLoading(false);
    fetchPendingCount();
    const hasNew = (data ?? []).some((n: any) => n.status === 'new' && n.type !== 'expense_tag');
    if (hasNew) {
      await supabase
        .from('notifications')
        .update({ status: 'saw', is_read: true, read: true })
        .eq('user_id', userId)
        .eq('status', 'new')
        .neq('type', 'expense_tag');
      setNotifications(prev => prev.map(n =>
        n.status === 'new' && n.type !== 'expense_tag' ? { ...n, status: 'saw' } : n
      ));
    }
  }, [userId, fetchPendingCount]);

  // Re-fetch whenever this tab becomes active
  useEffect(() => {
    if (isActive && userId) loadNotifications();
  }, [isActive, userId]);

  // Realtime channel — live inserts and updates while screen is mounted
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-live-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }, async (payload) => {
        const n = payload.new as any;
        if (n.user_id !== userId) return;
        setNotifications(prev => [n, ...prev]);
        if (n.type === 'expense_tag') {
          fetchPendingCount();
        } else {
          await supabase.from('notifications').update({ status: 'saw', is_read: true, read: true }).eq('id', n.id);
          setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, status: 'saw' } : x));
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
      }, (payload) => {
        const n = payload.new as any;
        if (n.user_id !== userId) return;
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, ...n } : x));
        if (n.type === 'expense_tag') fetchPendingCount();
      })
      .subscribe((status) => {
        console.log('[notifications] realtime status:', status);
      });

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchPendingCount]);

  const handleTap = async (n: any) => {
    if (n.status !== 'opened' && n.type !== 'expense_tag') {
      await supabase.from('notifications').update({ status: 'opened' }).eq('id', n.id);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, status: 'opened' } : x));
    }
    const data = n.data ?? {};
    if (n.type === 'friend_request' || n.type === 'friend_request_accepted') {
      router.push('/(app)/(tabs)/contacts' as any); return;
    }
    if (n.type === 'expense_tag') {
      setActiveTab('requests'); return;
    }
    if (n.type === 'tag_accepted' || n.type === 'tag_declined' || n.type === 'tag_payment_update') {
      // If A receives overpayment response from B, record income if accepted
      if (n.type === 'tag_payment_update' && data.overpaymentAmount && data.accepted === true) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && data.sourceRecordingId) {
          const { data: sourceRec } = await supabase.from('recordings').select('name, space_id').eq('id', data.sourceRecordingId).maybeSingle();
          await supabase.from('recordings').insert({
            user_id: user.id,
            space_id: sourceRec?.space_id ?? null,
            name: `${sourceRec?.name ?? 'recording'} · overpayment`,
            type: 'income',
            amount: data.overpaymentAmount,
            transaction_date: new Date().toISOString().split('T')[0],
            status: 'received',
          });
        }
      }
      if (data.sourceRecordingId) router.push({ pathname: '/(app)/recording-detail', params: { recordingId: data.sourceRecordingId } } as any);
      return;
    }
    if (n.type === 'split_bill_invite' && data.splitBillId) {
      router.push({ pathname: '/(app)/split-bill-detail', params: { splitBillId: data.splitBillId, name: data.splitBillName ?? 'split bill' } } as any); return;
    }
    if (n.type === 'space_invite') { router.push('/(app)/(tabs)/spaces' as any); return; }
    if (n.type === 'budget_warning_80' || n.type === 'budget_limit_reached') {
      if (data.spaceId) router.push({ pathname: '/(app)/space-detail', params: { spaceId: data.spaceId, name: data.spaceName ?? 'space' } } as any);
      return;
    }
    if (n.type === 'dues_reminder' || n.type === 'dues_month_summary' || n.type === 'dues_end_of_month') {
      router.push('/(app)/(tabs)/dashboard' as any); return;
    }
    if (data.recordingId) {
      router.push({ pathname: '/(app)/recording-detail', params: { recordingId: data.recordingId } } as any);
    } else if (data.splitBillId) {
      router.push({ pathname: '/(app)/split-bill-detail', params: { splitBillId: data.splitBillId, name: data.splitBillName ?? 'split bill' } } as any);
    }
  };

  const groups: { label: string; items: any[] }[] = [];
  notifications.forEach(n => {
    const label = smartGroup(n.created_at);
    const existing = groups.find(g => g.label === label);
    if (existing) existing.items.push(n);
    else groups.push({ label, items: [n] });
  });

  const fmt = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
      {/* Sub-tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'notifications' && s.tabActive]}
          onPress={() => setActiveTab('notifications')}
          activeOpacity={0.75}
        >
          <Text style={[s.tabText, activeTab === 'notifications' && s.tabTextActive]}>notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'requests' && s.tabActive]}
          onPress={async () => {
            setActiveTab('requests');
            setPendingCount(0);
            await supabase.from('notifications')
              .update({ status: 'saw', is_read: true, read: true })
              .eq('user_id', userId)
              .in('type', ['expense_tag', 'overpayment_request'])
              .eq('status', 'new');
          }}
          activeOpacity={0.75}
        >
          <Text style={[s.tabText, activeTab === 'requests' && s.tabTextActive]}>requests</Text>
          {pendingCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{pendingCount > 9 ? '9+' : String(pendingCount)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'requests' ? (
        <TagRequestsScreen />
      ) : loading ? (
        <ActivityIndicator color={ACCENT_DARK} style={{ marginTop: 40 }} />
      ) : notifications.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="notifications-off-outline" size={36} color={Colors.faint} />
          <Text style={s.emptyText}>no notifications yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {groups.map(group => (
            <View key={group.label}>
              <Text style={s.groupLabel}>{group.label}</Text>
              {group.items.map(n => {
                const icon = TYPE_ICON[n.type] ?? TYPE_ICON.default;
                const isNew = n.status === 'new';
                const isSaw = n.status === 'saw';
                const highlighted = isNew || isSaw;
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[s.row, isNew && s.rowNew, isSaw && s.rowSaw]}
                    activeOpacity={0.8}
                    onPress={() => handleTap(n)}
                  >
                    <View style={[s.iconWrap, highlighted && s.iconWrapHighlighted]}>
                      <Ionicons name={icon as any} size={18} color={highlighted ? ACCENT_DARK : Colors.muted} />
                    </View>
                    <View style={s.mid}>
                      <Text style={[s.rowTitle, highlighted && s.rowTitleHighlighted]} numberOfLines={1}>{n.title}</Text>
                      {n.body ? <Text style={s.rowBody} numberOfLines={2}>{n.body}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={s.time}>{fmt(n.created_at)}</Text>
                      {isNew && <View style={s.newDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: PAGE },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4, marginRight: 24, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: ACCENT_DARK },
  tabText:       { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted },
  tabTextActive: { fontFamily: Fonts.monoBold, fontSize: 13, color: ACCENT_DARK },
  badge:     { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#ed6a6a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.white },
  scroll:    { paddingBottom: 60 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  emptyText: { fontFamily: Brand.font.mono, fontSize: 13, color: Colors.muted },
  groupLabel: { fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 1.2, textTransform: 'uppercase', paddingHorizontal: PAGE, paddingTop: 20, paddingBottom: 6 },
  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: PAGE, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white },
  rowNew:  { backgroundColor: ACCENT + '22' },
  rowSaw:  { backgroundColor: ACCENT + '0C' },
  iconWrap:            { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  iconWrapHighlighted: { backgroundColor: ACCENT + '44' },
  mid:                 { flex: 1, gap: 3 },
  rowTitle:            { fontFamily: Brand.font.monoBold, fontSize: 13, color: Colors.muted },
  rowTitleHighlighted: { color: Colors.text },
  rowBody:             { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, lineHeight: 16 },
  time:                { fontFamily: Brand.font.mono, fontSize: 10, color: Colors.faint },
  newDot:              { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT_DARK },
});
