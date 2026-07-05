import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useUser } from '../../src/hooks/useUser';
import { useScreenAnim } from '@/components/ui/ScreenWrapper';
import { Colors, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';

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
  const { slideAnim, handleBack } = useScreenAnim();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setNotifications(data ?? []);
      setLoading(false);

      // Mark all as read in one batch
      if (data && data.some((n: any) => !n.is_read)) {
        await supabase
          .from('notifications')
          .update({ is_read: true, read: true })
          .eq('user_id', userId)
          .eq('is_read', false);
      }
    })();
  }, [userId]);

  const handleTap = (n: any) => {
    const data = n.data ?? {};
    if (n.type === 'friend_request' || n.type === 'friend_request_accepted') {
      router.push('/(app)/(tabs)/contacts' as any);
      return;
    }
    if (n.type === 'split_bill_invite' && data.splitBillId) {
      router.push({ pathname: '/(app)/split-bill-detail', params: { splitBillId: data.splitBillId, name: data.splitBillName ?? 'split bill' } } as any);
      return;
    }
    if (n.type === 'space_invite') {
      router.push('/(app)/(tabs)/spaces' as any);
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

  // Group by Today / Yesterday / Earlier
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
    <View style={{ flex: 1, backgroundColor: Colors.white }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color="#B6E1DE" />
          </TouchableOpacity>
          <Text style={s.title}>notifications</Text>
          <View style={{ width: 34 }} />
        </View>

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
                  const isUnread = !n.is_read;
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[s.row, isUnread && s.rowUnread]}
                      activeOpacity={0.8}
                      onPress={() => handleTap(n)}
                    >
                      <View style={[s.iconWrap, isUnread && s.iconWrapUnread]}>
                        <Ionicons name={icon as any} size={18} color={isUnread ? ACCENT_DARK : Colors.muted} />
                      </View>
                      <View style={s.mid}>
                        <Text style={[s.rowTitle, isUnread && s.rowTitleUnread]} numberOfLines={1}>
                          {n.title}
                        </Text>
                        {n.body ? (
                          <Text style={s.rowBody} numberOfLines={2}>{n.body}</Text>
                        ) : null}
                      </View>
                      <Text style={s.time}>{fmt(n.created_at)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAGE, paddingTop: 16, paddingBottom: 16, gap: 10, backgroundColor: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: '#333' },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#B6E1DE22', alignItems: 'center', justifyContent: 'center' },
  title:   { flex: 1, fontFamily: Brand.font.display, fontSize: 20, color: '#B6E1DE', letterSpacing: -0.3, textAlign: 'center' },

  scroll:    { paddingBottom: 60 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  emptyText: { fontFamily: Brand.font.mono, fontSize: 13, color: Colors.muted },

  groupLabel: {
    fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted,
    letterSpacing: 1.2, textTransform: 'uppercase',
    paddingHorizontal: PAGE, paddingTop: 20, paddingBottom: 6,
  },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 14, paddingHorizontal: PAGE,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  rowUnread: { backgroundColor: ACCENT + '12' },

  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  iconWrapUnread: { backgroundColor: ACCENT + '44' },

  mid:           { flex: 1, gap: 3 },
  rowTitle:      { fontFamily: Brand.font.monoBold, fontSize: 13, color: Colors.muted },
  rowTitleUnread:{ color: Colors.text },
  rowBody:       { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, lineHeight: 16 },
  time:          { fontFamily: Brand.font.mono, fontSize: 10, color: Colors.faint, marginTop: 2, flexShrink: 0 },
});
