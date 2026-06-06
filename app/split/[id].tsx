import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Modal, Platform, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';

export default function SplitSharePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [recording, setRecording] = useState<any>(null);
  const [perPerson, setPerPerson] = useState<{ name: string; total: number }[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptPhotos, setReceiptPhotos] = useState<string[]>([]);
  const [receiptModal, setReceiptModal] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [qrModalAcc, setQrModalAcc] = useState<any>(null);
  const [showUrlBar, setShowUrlBar] = useState(false);
  const [copiedAccIdx, setCopiedAccIdx] = useState<number | null>(null);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://ledgr.art/split/${id}`;

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'split bill', url: shareUrl });
        return;
      } catch (_) {}
    }
    // Fallback: show the URL in a selectable input so user can copy via native menu
    setShowUrlBar(true);
  };

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id]);

  const loadAll = async () => {
    const { data: share, error } = await supabase.from('split_shares').select('recording_id, data').eq('id', id).single();
    if (error || !share) { setNotFound(true); setLoading(false); return; }
    const rid = share.recording_id;
    const accountIds: string[] = share.data?.account_ids ?? [];

    const [recRes, splitsRes, itemsRes, receiptRes] = await Promise.all([
      supabase.from('recordings').select('*').eq('id', rid).single(),
      supabase.from('bill_splits').select('person_name').eq('recording_id', rid).order('created_at'),
      supabase.from('split_items').select('*, split_subitems(*)').eq('recording_id', rid).order('created_at'),
      supabase.from('receipt_entries').select('id').eq('recording_id', rid).maybeSingle(),
    ]);

    if (!recRes.data) { setNotFound(true); setLoading(false); return; }
    setRecording(recRes.data);
    if (receiptRes.data) setReceiptId(receiptRes.data.id);

    // Load selected payment accounts
    if (accountIds.length > 0) {
      const { data: accs } = await supabase.from('accounts').select('account_name, bank, account_number, qr_code').in('id', accountIds);
      if (accs) setPayments(accs);
    }

    const loadedItems = (itemsRes.data ?? []).map((item: any) => ({ ...item, subitems: item.split_subitems ?? [] }));
    setItems(loadedItems);

    const people = (splitsRes.data ?? []).map((r: any) => r.person_name);
    const perPersonMap: Record<string, number> = {};
    people.forEach(p => { perPersonMap[p] = 0; });
    loadedItems.forEach((item: any) => {
      const subs = item.subitems ?? [];
      if (subs.length === 0) {
        const pp = (item.people ?? []).length > 0 ? Number(item.cost) / item.people.length : 0;
        (item.people ?? []).forEach((p: string) => { if (perPersonMap[p] !== undefined) perPersonMap[p] = Math.round((perPersonMap[p] + pp) * 100) / 100; });
      } else {
        subs.forEach((sub: any) => {
          const pp = (sub.people ?? []).length > 0 ? Number(sub.cost) / sub.people.length : 0;
          (sub.people ?? []).forEach((p: string) => { if (perPersonMap[p] !== undefined) perPersonMap[p] = Math.round((perPersonMap[p] + pp) * 100) / 100; });
        });
      }
    });
    setPerPerson(Object.entries(perPersonMap).map(([name, total]) => ({ name, total })));
    setLoading(false);
  };

  const copyAccountNumber = (accNumber: string, idx: number) => {
    // Must be synchronous for Safari — no await before writeText
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(accNumber).then(() => {
        setCopiedAccIdx(idx);
        setTimeout(() => setCopiedAccIdx(null), 2000);
      }).catch(() => {
        if (typeof window !== 'undefined') window.prompt('Copy account number:', accNumber);
      });
    } else if (typeof window !== 'undefined') {
      window.prompt('Copy account number:', accNumber);
    }
  };

  const openReceipt = async () => {
    if (!receiptId) return;
    setReceiptLoading(true);
    setReceiptModal(true);
    const { data: photos } = await supabase.from('receipt_photos').select('storage_path').eq('entry_id', receiptId).order('created_at');
    if (photos && photos.length > 0) {
      const urls = await Promise.all(photos.map(async (p: any) => {
        const { data: signed } = await supabase.storage.from('receipts').createSignedUrl(p.storage_path, 3600);
        return signed?.signedUrl ?? '';
      }));
      setReceiptPhotos(urls.filter(Boolean));
    }
    setReceiptLoading(false);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={Colors.cyan} /></View>;
  if (notFound || !recording) return (
    <View style={s.center}>
      <Text style={{ fontSize: 40 }}>🔍</Text>
      <Text style={s.notFound}>split not found</Text>
    </View>
  );

  const amtColor = recording.type === 'expense' ? Colors.expense : recording.type === 'income' ? Colors.income : Colors.text;
  const formattedDate = recording.transaction_date
    ? new Date(recording.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <>
      <ScrollView style={s.container} contentContainerStyle={s.scroll}>
        <Text style={s.appLabel}>LEDGR</Text>
        <Text style={s.recName}>{String(recording.name ?? '').toLowerCase()}</Text>
        <Text style={[s.recAmount, { color: amtColor }]}>{Number(recording.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        <Text style={s.recDate}>{formattedDate}</Text>

        {/* Receipt */}
        <Text style={s.sectionHeader}>receipt</Text>
        {receiptId ? (
          <TouchableOpacity style={s.receiptBtn} onPress={openReceipt}>
            <Ionicons name="receipt-outline" size={16} color={Colors.cyan} />
            <Text style={s.receiptBtnText}>tap to view receipt photos</Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.cyan} />
          </TouchableOpacity>
        ) : (
          <View style={s.receiptUnavailable}>
            <Ionicons name="receipt-outline" size={16} color="#c0c0c0" />
            <Text style={s.receiptUnavailableText}>receipt not available</Text>
          </View>
        )}

        {/* Item Information */}
        {items.length > 0 && <>
          <Text style={s.sectionHeader}>item information</Text>
          {items.map((item, ii) => {
            const subs: any[] = item.subitems ?? [];
            const itemPeople: any[] = item.people ?? [];
            return (
              <View key={ii} style={s.itemBlock}>
                <View style={s.itemHeader}>
                  <Text style={s.itemName}>{String(item.name ?? '').toLowerCase()}</Text>
                  <Text style={s.itemCost}>{Number(item.cost ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </View>
                {subs.length === 0 && itemPeople.length > 0 ? (
                  <View style={s.itemPeopleRow}>
                    {itemPeople.map((p, pi) => (
                      <View key={pi} style={s.chip}><Text style={s.chipText}>{p}</Text></View>
                    ))}
                    <Text style={s.subSplit}>
                      {itemPeople.length} {itemPeople.length === 1 ? 'person' : 'people'} · {(Number(item.cost ?? 0) / itemPeople.length).toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                    </Text>
                  </View>
                ) : subs.map((sub, si) => {
                  const subPeople: any[] = sub.people ?? [];
                  const pp = subPeople.length > 0 ? Number(sub.cost ?? 0) / subPeople.length : Number(sub.cost ?? 0);
                  return (
                    <View key={si} style={s.subRow}>
                      <Text style={s.arrow}>↳</Text>
                      <View style={{ flex: 1, gap: 3 }}>
                        <View style={s.subTop}>
                          <Text style={s.subName}>{String(sub.name ?? '').toLowerCase()}</Text>
                          <Text style={s.subCost}>{Number(sub.cost ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                        </View>
                        <Text style={s.subSplit}>{subPeople.length} {subPeople.length === 1 ? 'person' : 'people'} · {pp.toLocaleString('en-US', { minimumFractionDigits: 2 })} each</Text>
                        <View style={s.chips}>
                          {subPeople.map((p, pi) => (
                            <View key={pi} style={s.chip}><Text style={s.chipText}>{p}</Text></View>
                          ))}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </>}

        {/* Per Person Pay */}
        {perPerson.length > 0 && <>
          <Text style={s.sectionHeader}>per person pay</Text>
          <View style={s.card}>
            {perPerson.map((p, i) => (
              <View key={i}>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>{p.name}</Text>
                  <View style={s.dots} />
                  <Text style={s.infoValue}>{p.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={s.divider} />
              </View>
            ))}
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: Colors.text, fontFamily: Fonts.monoBold }]}>total</Text>
              <View style={s.dots} />
              <Text style={[s.infoValue, { color: Colors.cyan }]}>
                {perPerson.reduce((sum, p) => sum + p.total, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </>}

        {/* Payment Information */}
        {payments.length > 0 && (
          <>
            <Text style={s.sectionHeader}>payment information</Text>
            {payments.map((acc: any, i: number) => (
              <View key={i} style={[s.card, { marginBottom: 10 }]}>
                <View style={s.payRow}>
                  <View style={{ gap: 3, flex: 1 }}>
                    <Text style={s.payName}>{acc.account_name ?? ''}</Text>
                    <Text style={s.payBank}>{acc.bank ?? ''}</Text>
                    <TouchableOpacity
                      style={s.copyRow}
                      onPress={() => copyAccountNumber(acc.account_number ?? '', i)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.payNumber}>{acc.account_number ?? ''}</Text>
                      <Ionicons
                        name={copiedAccIdx === i ? 'checkmark' : 'copy-outline'}
                        size={13}
                        color={copiedAccIdx === i ? Colors.income : Colors.muted}
                      />
                    </TouchableOpacity>
                  </View>
                  {acc.qr_code
                    ? <TouchableOpacity onPress={() => { setQrModalAcc(acc); setQrModal(true); }}>
                        <Image source={{ uri: acc.qr_code }} style={s.qr} resizeMode="contain" />
                      </TouchableOpacity>
                    : null}
                </View>
                {acc.qr_code && <Text style={s.qrHint}>tap the QR code to expand</Text>}
              </View>
            ))}
          </>
        )}

        {/* Share button */}
        {showUrlBar ? (
          <View style={s.urlBar}>
            <TextInput
              style={s.urlInput}
              value={shareUrl}
              editable
              selectTextOnFocus
              autoFocus
              caretHidden={false}
            />
            <TouchableOpacity onPress={() => setShowUrlBar(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={16} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={15} color={Colors.cyan} />
            <Text style={s.shareBtnText}>share this bill</Text>
          </TouchableOpacity>
        )}

        <Text style={s.footer}>generated by LEDGR</Text>
      </ScrollView>

      {/* Receipt Modal */}
      <Modal visible={receiptModal} transparent animationType="slide" onRequestClose={() => setReceiptModal(false)}>
        <BlurView intensity={60} tint="dark" style={s.qrOverlay}>
          <TouchableOpacity style={{ position: 'absolute', top: 56, right: 24, zIndex: 10 }} onPress={() => setReceiptModal(false)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {receiptLoading ? (
            <ActivityIndicator color="#fff" />
          ) : receiptPhotos.length === 0 ? (
            <Text style={{ fontFamily: 'RobotoMono_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>no photos found</Text>
          ) : (
            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ padding: 24, paddingTop: 80, gap: 16 }} showsVerticalScrollIndicator={false}>
              {receiptPhotos.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} resizeMode="contain" />
              ))}
            </ScrollView>
          )}
        </BlurView>
      </Modal>

      {/* QR Modal */}
      <Modal visible={qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(false)}>
        <BlurView intensity={60} tint="dark" style={s.qrOverlay}>
          <TouchableOpacity style={s.qrOverlay} activeOpacity={1} onPress={() => { setQrModal(false); setQrModalAcc(null); }}>
            <Image source={{ uri: qrModalAcc?.qr_code ?? '' }} style={s.qrLarge} resizeMode="contain" />
            <Text style={s.qrTap}>tap anywhere to close</Text>
          </TouchableOpacity>
        </BlurView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: Spacing.xxl + 4, paddingTop: 60, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white, gap: 12 },
  notFound: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted },
  appLabel: { fontFamily: 'MuseoModerno_Black', fontSize: 18, color: Colors.cyan, marginBottom: 8 },
  recName: { fontFamily: Fonts.display, fontSize: 26, color: Colors.text, letterSpacing: -0.5, lineHeight: 30, marginBottom: 4 },
  recAmount: { fontFamily: Fonts.mono, fontSize: 20, marginBottom: 2 },
  recDate: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, marginBottom: 28 },
  sectionHeader: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.cyan, letterSpacing: -0.3, marginBottom: 10 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border, marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoLabel: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.text, flexShrink: 0 },
  dots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: Colors.faint, marginHorizontal: 8 },
  infoValue: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text, flexShrink: 0 },
  divider: { height: 1, backgroundColor: Colors.border },
  itemBlock: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  itemName: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  itemCost: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted },
  itemPeopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  subRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  arrow: { fontSize: 11, color: Colors.faint, marginTop: 2 },
  subTop: { flexDirection: 'row', justifyContent: 'space-between' },
  subName: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.text },
  subCost: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  subSplit: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { backgroundColor: Colors.border, borderRadius: Radius.pill, paddingVertical: 3, paddingHorizontal: 8 },
  chipText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.text },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.successBg, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.cyan, marginBottom: 24 },
  receiptBtnText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.cyan, flex: 1 },
  receiptUnavailable: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 24 },
  receiptUnavailableText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.faint },
  qrHint: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint, textAlign: 'right', paddingBottom: 8 },
  payRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  payName: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.text },
  payBank: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  payNumber: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qr: { width: 80, height: 80, borderRadius: Radius.sm },
  qrOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  qrLarge: { width: 260, height: 260, borderRadius: Radius.lg },
  qrTap: { fontFamily: Fonts.mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 16 },
  footer: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint, textAlign: 'center', marginTop: 24 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.pill, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: Colors.cyan, backgroundColor: Colors.successBg, marginBottom: 28 },
  shareBtnText: { fontFamily: Fonts.mono, fontSize: 12, color: Colors.cyan },
  urlBar: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cyan, backgroundColor: Colors.successBg, paddingHorizontal: 12, marginBottom: 28, gap: 8 },
  urlInput: { flex: 1, fontFamily: Fonts.mono, fontSize: 12, color: Colors.text, paddingVertical: 10 },
});
