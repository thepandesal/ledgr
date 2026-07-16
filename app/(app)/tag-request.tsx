import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../src/lib/supabase';
import { useUser } from '../../src/hooks/useUser';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';

const ACCENT_DARK = Brand.color.accentDark;
const ACCENT      = Brand.color.accent;

export default function TagRequestsScreen() {
  const { userId, userName, defaultCurrency } = useUser();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('recording_tags')
      .select('*, recordings:recording_id(id, name, amount, transaction_date, currency)')
      .eq('tagged_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const taggerIds = [...new Set(data.map((r: any) => r.tagger_user_id))];
    const names: Record<string, string> = {};
    await Promise.all(taggerIds.map(async (id: string) => {
      const { data: n } = await supabase.rpc('get_user_display_name', { user_id: id });
      names[id] = n ?? 'someone';
    }));

    setRequests(data.map((r: any) => ({ ...r, taggerName: names[r.tagger_user_id] ?? 'someone' })));
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const respond = async (tag: any, accept: boolean) => {
    setResponding(tag.id);
    try {
      if (accept) {
        const rec = tag.recordings;
        const { data: mirrored } = await supabase.from('recordings').insert({
          user_id: userId,
          name: rec?.name ?? 'tagged expense',
          type: 'due',
          amount: tag.amount,
          transaction_date: rec?.transaction_date ?? new Date().toISOString().split('T')[0],
          status: 'unpaid',
          currency: rec?.currency ?? defaultCurrency,
          notes: `tagged by ${tag.taggerName}`,
          is_tagged: true,
        }).select('id').single();

        await supabase.from('recording_tags').update({
          status: 'accepted',
          mirrored_recording_id: mirrored?.id ?? null,
        }).eq('id', tag.id);

        await supabase.from('notifications').insert({
          user_id: tag.tagger_user_id,
          type: 'tag_accepted',
          title: `${userName || 'Someone'} accepted your expense tag`,
          body: `"${rec?.name ?? 'expense'}" is now a due in their account.`,
          data: { recordingId: tag.recording_id, tagId: tag.id },
          status: 'new',
          is_read: false,
        });
      } else {
        await supabase.from('recording_tags').update({ status: 'declined' }).eq('id', tag.id);

        await supabase.from('notifications').insert({
          user_id: tag.tagger_user_id,
          type: 'tag_declined',
          title: `${userName || 'Someone'} declined your expense tag`,
          body: `"${tag.recordings?.name ?? 'expense'}" tag was declined.`,
          data: { recordingId: tag.recording_id, tagId: tag.id },
          status: 'new',
          is_read: false,
        });
      }
      setRequests(prev => prev.filter(r => r.id !== tag.id));
    } catch (e) {
      console.warn('[tag] respond failed:', e);
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
      <Text style={s.emptyText}>no pending requests</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      {requests.map(tag => {
        const rec = tag.recordings;
        const isResponding = responding === tag.id;
        return (
          <View key={tag.id} style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.iconWrap}>
                <Ionicons name="person-add-outline" size={18} color={ACCENT_DARK} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.tagger}>{tag.taggerName}</Text>
                <Text style={s.sub}>tagged you in an expense</Text>
              </View>
            </View>
            <View style={s.detail}>
              <Text style={s.recName}>{rec?.name ?? '—'}</Text>
              <Text style={s.recMeta}>{fmt(rec?.transaction_date)}</Text>
              <Text style={s.amount}>
                {rec?.currency ?? defaultCurrency} {Number(tag.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={s.note}>
                if you accept, this appears as a <Text style={{ fontFamily: Fonts.monoBold }}>due</Text> in your account. payment is managed by {tag.taggerName}.
              </Text>
            </View>
            <View style={s.actions}>
              <TouchableOpacity
                style={[s.declineBtn, isResponding && { opacity: 0.5 }]}
                onPress={() => respond(tag, false)}
                disabled={isResponding}
                activeOpacity={0.8}
              >
                <Text style={s.declineBtnText}>decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.acceptBtn, isResponding && { opacity: 0.5 }]}
                onPress={() => respond(tag, true)}
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
  scroll:    { padding: Spacing.page, gap: 12 },
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
  emptyText: { fontFamily: Brand.font.mono, fontSize: 13, color: Colors.muted },
  card:      { backgroundColor: Colors.white, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 12 },
  cardHeader:{ flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap:  { width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT + '44', alignItems: 'center', justifyContent: 'center' },
  tagger:    { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.text },
  sub:       { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  detail:    { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 12, gap: 4 },
  recName:   { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.text },
  recMeta:   { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  amount:    { fontFamily: Fonts.monoBold, fontSize: 18, color: ACCENT_DARK, marginTop: 4 },
  note:      { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, lineHeight: 16, marginTop: 6 },
  actions:   { flexDirection: 'row', gap: 10 },
  declineBtn:     { flex: 1, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMid, alignItems: 'center' },
  declineBtnText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.muted },
  acceptBtn:      { flex: 2, paddingVertical: 12, borderRadius: Radius.pill, backgroundColor: ACCENT_DARK, alignItems: 'center' },
  acceptBtnText:  { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.white },
});
