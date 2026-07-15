import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { useUser } from '../../src/hooks/useUser';
import { useScreenAnim } from '@/components/ui/ScreenWrapper';
import { Animated } from 'react-native';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';

const ACCENT      = Brand.color.accent;
const ACCENT_DARK = Brand.color.accentDark;
const PEACH       = '#FFAB91';
const PAGE        = 20;

export default function TagDetailScreen() {
  const { recordingId, notificationId } = useLocalSearchParams<{ recordingId: string; notificationId?: string }>();
  const router = useRouter();
  const { userId, userName } = useUser();
  const { slideAnim, handleBack } = useScreenAnim();

  const [recording, setRecording] = useState<any>(null);
  const [taggerName, setTaggerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Space picker for accept flow
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);
  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [recordingId]);

  const load = async () => {
    if (!recordingId) return;
    const { data: rec } = await supabase
      .from('recordings')
      .select('*, categories:category_id(name, color, icon)')
      .eq('id', recordingId)
      .single();
    if (rec) {
      setRecording({
        ...rec,
        categories: Array.isArray(rec.categories) ? rec.categories[0] : rec.categories,
      });
      // Get tagger name
      const { data: name } = await supabase.rpc('get_user_display_name', { user_id: rec.user_id });
      setTaggerName(name ?? 'someone');
    }
    // Load spaces for the current user
    const { data: spaceRows } = await supabase
      .from('spaces')
      .select('id, name')
      .eq('user_id', userId)
      .order('name');
    setSpaces(spaceRows ?? []);
    setLoading(false);
  };

  const handleDecline = async () => {
    setActionLoading(true);
    try {
      await supabase.from('recordings').update({ tag_status: 'declined' }).eq('id', recordingId);
      // Notify tagger
      await supabase.from('notifications').insert({
        user_id: recording.user_id,
        type: 'expense_tag_declined',
        title: `${userName} declined your expense tag`,
        body: `"${recording.name}" tag was declined`,
        message: `"${recording.name}" tag was declined`,
        data: { recordingId },
        is_read: false, status: 'new',
      });
      if (notificationId) {
        await supabase.from('notifications').update({ status: 'opened' }).eq('id', notificationId);
      }
      handleBack();
    } catch (e) { /* silent */ }
    finally { setActionLoading(false); }
  };

  const handleAccept = async () => {
    if (!selectedSpaceId) { setShowSpacePicker(true); return; }
    setActionLoading(true);
    try {
      // Create a debt recording on the tagged friend's side
      const { data: debtRec } = await supabase.from('recordings').insert({
        user_id: userId,
        space_id: selectedSpaceId,
        name: recording.name,
        type: 'debt',
        amount: recording.amount,
        transaction_date: recording.transaction_date,
        notes: recording.notes ?? null,
        category_id: recording.category_id ?? null,
        status: 'unpaid',
        person_name: taggerName,
        tag_linked_recording_id: recordingId,
        currency: recording.currency ?? 'PHP',
      }).select('id').single();

      // Update original recording tag status and link
      await supabase.from('recordings').update({
        tag_status: 'accepted',
        tag_linked_recording_id: debtRec?.id ?? null,
      }).eq('id', recordingId);

      // Notify tagger
      await supabase.from('notifications').insert({
        user_id: recording.user_id,
        type: 'expense_tag_accepted',
        title: `${userName} accepted your expense tag`,
        body: `"${recording.name}" — a loan was created on their end`,
        message: `"${recording.name}" — a loan was created on their end`,
        data: { recordingId },
        is_read: false, status: 'new',
      });

      if (notificationId) {
        await supabase.from('notifications').update({ status: 'opened' }).eq('id', notificationId);
      }

      // Navigate to the newly created debt recording
      if (debtRec?.id) {
        router.replace({ pathname: '/(app)/recording-detail', params: { recordingId: debtRec.id } } as any);
      } else {
        handleBack();
      }
    } catch (e) { /* silent */ }
    finally { setActionLoading(false); }
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const formatDate = (d: string) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: Colors.white }, { transform: [{ translateX: slideAnim }] }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color="#B6E1DE" />
        </TouchableOpacity>
        <Text style={s.title}>expense tag</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={ACCENT_DARK} style={{ marginTop: 48 }} />
      ) : !recording ? (
        <View style={s.emptyWrap}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.faint} />
          <Text style={s.emptyText}>recording not found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Who tagged you */}
          <View style={s.tagBanner}>
            <View style={s.tagAvatarWrap}>
              <Text style={s.tagAvatarText}>{taggerName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.tagBannerTitle}>{taggerName} tagged you</Text>
              <Text style={s.tagBannerSub}>they paid for this and expect you to pay them back</Text>
            </View>
          </View>

          {/* Recording details */}
          <View style={s.card}>
            <View style={s.cardRow}>
              <Text style={s.cardLabel}>name</Text>
              <Text style={s.cardValue}>{recording.name}</Text>
            </View>
            <View style={s.cardDivider} />
            <View style={s.cardRow}>
              <Text style={s.cardLabel}>amount</Text>
              <Text style={[s.cardValue, { color: PEACH, fontFamily: Fonts.monoBold }]}>
                {recording.currency ?? 'PHP'} {fmt(Number(recording.amount))}
              </Text>
            </View>
            <View style={s.cardDivider} />
            <View style={s.cardRow}>
              <Text style={s.cardLabel}>date</Text>
              <Text style={s.cardValue}>{formatDate(recording.transaction_date)}</Text>
            </View>
            {recording.categories?.name && (
              <>
                <View style={s.cardDivider} />
                <View style={s.cardRow}>
                  <Text style={s.cardLabel}>category</Text>
                  <Text style={s.cardValue}>{recording.categories.name}</Text>
                </View>
              </>
            )}
            {recording.notes && (
              <>
                <View style={s.cardDivider} />
                <View style={s.cardRow}>
                  <Text style={s.cardLabel}>notes</Text>
                  <Text style={[s.cardValue, { flex: 1, textAlign: 'right' }]}>{recording.notes}</Text>
                </View>
              </>
            )}
          </View>

          {/* Tag status */}
          {recording.tag_status === 'accepted' && (
            <View style={[s.statusBanner, { backgroundColor: Colors.successBg }]}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={[s.statusText, { color: Colors.success }]}>you accepted this tag — a loan was created</Text>
            </View>
          )}
          {recording.tag_status === 'declined' && (
            <View style={[s.statusBanner, { backgroundColor: Colors.dangerBg }]}>
              <Ionicons name="close-circle" size={16} color={Colors.danger} />
              <Text style={[s.statusText, { color: Colors.danger }]}>you declined this tag</Text>
            </View>
          )}

          {/* Actions — only show if still pending */}
          {(!recording.tag_status || recording.tag_status === 'pending') && (
            <View style={s.actions}>
              <Text style={s.actionsHint}>
                accepting will create a loan on your end. you can pay it off when you're ready.
              </Text>
              <TouchableOpacity
                style={[s.acceptBtn, actionLoading && { opacity: 0.5 }]}
                onPress={() => selectedSpaceId ? handleAccept() : setShowSpacePicker(true)}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <>
                      <Ionicons name="checkmark-circle-outline" size={16} color={Colors.white} />
                      <Text style={s.acceptBtnText}>accept — create loan</Text>
                    </>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.declineBtn, actionLoading && { opacity: 0.5 }]}
                onPress={handleDecline}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
                <Text style={s.declineBtnText}>decline</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Space picker */}
      <BottomSheet visible={showSpacePicker} onClose={() => setShowSpacePicker(false)} title="put loan in which space?" height="50%">
        <ScrollView showsVerticalScrollIndicator={false}>
          {spaces.length === 0 ? (
            <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted, textAlign: 'center', paddingVertical: 24 }}>
              no spaces found — create one first
            </Text>
          ) : (
            spaces.map(sp => (
              <TouchableOpacity
                key={sp.id}
                style={[s.spaceRow, selectedSpaceId === sp.id && s.spaceRowActive]}
                onPress={() => { setSelectedSpaceId(sp.id); setShowSpacePicker(false); handleAccept(); }}
                activeOpacity={0.75}
              >
                <Text style={[s.spaceRowText, selectedSpaceId === sp.id && { color: ACCENT_DARK, fontFamily: Fonts.monoBold }]}>
                  {sp.name}
                </Text>
                {selectedSpaceId === sp.id && <Ionicons name="checkmark" size={16} color={ACCENT_DARK} />}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </BottomSheet>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAGE, paddingTop: 16, paddingBottom: 16, gap: 10, backgroundColor: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: '#333' },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#B6E1DE22', alignItems: 'center', justifyContent: 'center' },
  title:   { flex: 1, fontFamily: Brand.font.display, fontSize: 20, color: '#B6E1DE', letterSpacing: -0.3, textAlign: 'center' },

  scroll:    { paddingHorizontal: PAGE, paddingBottom: 60, paddingTop: 20, gap: 16 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted },

  tagBanner:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: ACCENT + '22', borderRadius: Radius.xl, padding: 16 },
  tagAvatarWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: ACCENT + '44', justifyContent: 'center', alignItems: 'center' },
  tagAvatarText: { fontFamily: Fonts.monoBold, fontSize: 18, color: ACCENT_DARK },
  tagBannerTitle:{ fontFamily: Brand.font.heading, fontSize: 14, color: Colors.text },
  tagBannerSub:  { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, lineHeight: 16 },

  card:        { backgroundColor: Colors.surface, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cardRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  cardDivider: { height: 1, backgroundColor: Colors.border },
  cardLabel:   { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  cardValue:   { fontFamily: Fonts.mono, fontSize: 13, color: Colors.text },

  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.lg, padding: 14 },
  statusText:   { fontFamily: Fonts.monoBold, fontSize: 13 },

  actions:      { gap: 10 },
  actionsHint:  { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, textAlign: 'center', lineHeight: 16 },
  acceptBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT_DARK, borderRadius: Radius.pill, paddingVertical: 14 },
  acceptBtnText:{ fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.white },
  declineBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.dangerBg, borderRadius: Radius.pill, paddingVertical: 14, borderWidth: 1, borderColor: Colors.danger + '44' },
  declineBtnText:{ fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.danger },

  spaceRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  spaceRowActive: { backgroundColor: ACCENT + '22', borderRadius: Radius.md, paddingHorizontal: 8 },
  spaceRowText:   { fontFamily: Fonts.mono, fontSize: 14, color: Colors.text },
});
