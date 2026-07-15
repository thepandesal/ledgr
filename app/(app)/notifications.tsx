import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useUser } from '../../src/hooks/useUser';
import { Colors } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';

const ACCENT      = Brand.color.accent;
const ACCENT_DARK = Brand.color.accentDark;
const PAGE        = 20;

const TYPE_ICON: Record<string, string> = {
  expense_tag:             'person-add-outline',
  expense_tag_accepted:    'checkmark-circle-outline',
  expense_tag_declined:    'close-circle-outline',
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

export default function NotificationsScreen() {
  const router = useRouter();
  const { userId } = useUser();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setNotifications(data ?? []);
      setLoading(false);
      if (data && data.some((n: any) => n.status === 'new')) {
        await supabase
          .from('notifications')
          .update({ status: 'saw', is_read: true, read: true })
          .eq('user_id', userId)
          .eq('status', 'new');
        setNotifications(prev => prev.map(n => n.status === 'new' ? { ...n, status: 'saw' } : n));
      }
    };

    load();

    // Realtime — new notifications appear instantly without refresh
    const channel = supabase
      .channel(`notifications-live-${userId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        const n = payload.new as any;
        setNotifications(prev => [n, ...prev]);
        // Auto-mark as saw since the page is open
        await supabase.from('notifications').update({ status: 'saw', is_read: true, read: true }).eq('id', n.id);
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, status: 'saw' } : x));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const handleTap = async (n: any) => {
    // Mark as opened
    if (n.status !== 'opened') {
      await supabase.from('notifications').update({ status: 'opened' }).eq('id', n.id);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, status: 'opened' } : x));
    }
    const data = n.data ?? {};
    if (n.type === 'expense_tag' && data.recordingId) {
      router.push({ pathname: '/(app)/tag-detail', params: { recordingId: data.recordingId, notificationId: n.id } } as any); return;
    }
    if ((n.type === 'expense_tag_accepted' || n.type === 'expense_tag_declined') && data.recordingId) {
      router.push({ pathname: '/(app)/recording-detail', params: { recordingId: data.recordingId } } as any); return;
    }
    if (n.type === 'friend_request' || n.type === 'friend_request_accepted') {
      router.push('/(app)/(tabs)/contacts' as any); return;
    }
    if (n.type === 'split_bill_invite' && data.splitBillId) {
      router.push({ pathname: '/(app)/split-bill-detail', params: { splitBillId: data.splitBillId, name: data.splitBillName ?? 'split bill' } } as any); return;
    }
    if (n.type === 'space_invite') {
      router.push('/(app)/(tabs)/spaces' as any); return;
    }
    if (n.type === 'budget_warning_80' || n.type === 'budget_limit_reached') {
      if (data.spaceId) router.push({ pathname: '/(app)/space-detail', params: { spaceId: data.spaceId, name: data.spaceName ?? 'space' } } as any);
      return;
    }
    if (n.type === 'savings_reminder') {
      if (data.spaceId) router.push({ pathname: '/(app)/space-detail', params: { spaceId: data.spaceId, name: data.spaceName ?? 'space' } } as any);
      return;
    }
    if (n.type === 'dues_reminder' || n.type === 'dues_month_summary' || n.type === 'dues_end_of_month') {
      router.push('/(app)/(tabs)/dashboard' as any);
      return;
    }
    if (data.recordingId) {
      router.push({ pathname: '/(app)/recording-detail', params: { recordingId: data.recordingId } } as any);
    } else if (data.recurringRecordId) {
      router.push({ pathname: '/(app)/space-detail', params: { spaceId: data.spaceId ?? 'all', name: data.spaceName ?? 'space' } } as any);
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
      {loading ? (
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
                      <Text style={[s.rowTitle, highlighted && s.rowTitleHighlighted]} numberOfLines={1}>
                        {n.title}
                      </Text>
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
  scroll:    { paddingBottom: 60 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  emptyText: { fontFamily: Brand.font.mono, fontSize: 13, color: Colors.muted },

  groupLabel: {
    fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted,
    letterSpacing: 1.2, textTransform: 'uppercase',
    paddingHorizontal: PAGE, paddingTop: 20, paddingBottom: 6,
  },

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
