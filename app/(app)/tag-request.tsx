import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useUser } from '../../src/hooks/useUser';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';

const ACCENT_DARK = Brand.color.accentDark;
const ACCENT      = Brand.color.accent;

export default function TagRequestsScreen() {
  const { userId, userName, defaultCurrency } = useUser();
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const load = () => supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'expense_tag')
      .in('status', ['new', 'saw'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRequests(data ?? []);
        setLoading(false);
      });

    load();

    const channel = supabase
      .channel(`tag-requests-live-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
      }, (payload) => {
        const n = payload.new as any;
        if (n.user_id !== userId || n.type !== 'expense_tag') return;
        setRequests(prev => [n, ...prev]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
      }, (payload) => {
        const n = payload.new as any;
        if (n.user_id !== userId || n.type !== 'expense_tag') return;
        if (!['new', 'saw'].includes(n.status)) {
          setRequests(prev => prev.filter(r => r.id !== n.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const accept = async (notif: any) => {
    setResponding(notif.id);
    try {
      const d = notif.data ?? {};
      // create the due recording on the friend's account
      const { data: rec } = await supabase.from('recordings').insert({
        user_id: userId,
        name: d.recordingName ?? 'tagged expense',
        type: 'due',
        amount: d.amount,
        transaction_date: d.transactionDate ?? new Date().toISOString().split('T')[0],
        currency: d.currency ?? defaultCurrency,
        status: 'unpaid',
        notes: `tagged by ${d.taggerName || 'someone'}`,
        is_tagged: true,
        tagged_by_user_id: d.taggerUserId,
        source_recording_id: d.sourceRecordingId ?? null,
        category_id: d.categoryId ?? null,
      }).select('id').single();

      // mark notification as opened
      await supabase.from('notifications').update({ status: 'opened' }).eq('id', notif.id);

      // notify tagger
      await supabase.from('notifications').insert({
        user_id: d.taggerUserId,
        type: 'tag_accepted',
        title: `${userName || 'Someone'} accepted your expense tag`,
        body: `"${d.recordingName}" is now a due in their account.`,
        message: `"${d.recordingName}" is now a due in their account.`,
        data: { sourceRecordingId: d.sourceRecordingId, acceptedRecordingId: rec?.id },
        status: 'new',
        is_read: false,
      });

      setRequests(prev => prev.filter(r => r.id !== notif.id));

      // navigate to the new recording
      if (rec?.id) {
        router.push({ pathname: '/(app)/recording-detail', params: { recordingId: rec.id } } as any);
      }
    } catch (e) {
      console.warn('[tag-request] accept failed:', e);
    } finally {
      setResponding(null);
    }
  };

  const decline = async (notif: any) => {
    setResponding(notif.id);
    try {
      await supabase.from('notifications').update({ status: 'opened' }).eq('id', notif.id);

      await supabase.from('notifications').insert({
        user_id: notif.data?.taggerUserId,
        type: 'tag_declined',
        title: `${userName || 'Someone'} declined your expense tag`,
        body: `"${notif.data?.recordingName ?? 'expense'}" tag was declined.`,
        message: `"${notif.data?.recordingName ?? 'expense'}" tag was declined.`,
        data: { sourceRecordingId: notif.data?.sourceRecordingId },
        status: 'new',
        is_read: false,
      });

      setRequests(prev => prev.filter(r => r.id !== notif.id));
    } catch (e) {
      console.warn('[tag-request] decline failed:', e);
    } finally {
      setResponding(null);
    }
  };

  const fmt = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) return <ActivityIndicator color={ACCENT_DARK} style={{ marginTop: 40 }} />;

  if (requests.length === 0) return (
    <View style={s.empty}>
      <Ionicons name="checkmark-circle-outline" size={36} color={Colors.faint} />
      <Text style={s.emptyText}>no pending tags</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      {requests.map(notif => {
        const d = notif.data ?? {};
        const isResponding = responding === notif.id;
        return (
          <View key={notif.id} style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.iconWrap}>
                <Ionicons name="person-add-outline" size={18} color={ACCENT_DARK} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.tagger}>{d.taggerName || 'someone'}</Text>
                <Text style={s.sub}>tagged you in an expense</Text>
              </View>
            </View>
            <View style={s.detail}>
              <Text style={s.recName}>{d.recordingName ?? '—'}</Text>
              <Text style={s.recMeta}>{fmt(d.transactionDate)}</Text>
              <Text style={s.amount}>
                {d.currency ?? defaultCurrency} {Number(d.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={s.note}>
                if you accept, this appears as a <Text style={{ fontFamily: Fonts.monoBold }}>due</Text> in your account.
              </Text>
            </View>
            <View style={s.actions}>
              <TouchableOpacity
                style={[s.declineBtn, isResponding && { opacity: 0.5 }]}
                onPress={() => decline(notif)}
                disabled={isResponding}
                activeOpacity={0.8}
              >
                <Text style={s.declineBtnText}>decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.acceptBtn, isResponding && { opacity: 0.5 }]}
                onPress={() => accept(notif)}
                disabled={isResponding}
                activeOpacity={0.8}
              >
                {isResponding
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={s.acceptBtnText}>accept</Text>}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:         { padding: Spacing.page, gap: 12 },
  empty:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  emptyText:      { fontFamily: Brand.font.mono, fontSize: 13, color: Colors.muted },
  card:           { backgroundColor: Colors.white, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12 },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap:       { width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT + '44', alignItems: 'center', justifyContent: 'center' },
  tagger:         { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.text },
  sub:            { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  detail:         { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12, gap: 4 },
  recName:        { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.text },
  recMeta:        { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  amount:         { fontFamily: Fonts.monoBold, fontSize: 18, color: ACCENT_DARK, marginTop: 4 },
  note:           { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, lineHeight: 16, marginTop: 6 },
  actions:        { flexDirection: 'row', gap: 10 },
  declineBtn:     { flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMid, alignItems: 'center' },
  declineBtnText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.muted },
  acceptBtn:      { flex: 2, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: ACCENT_DARK, alignItems: 'center' },
  acceptBtnText:  { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.white },
});
