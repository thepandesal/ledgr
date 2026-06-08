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
      try { await navigator.share({ title: 'split bill', url: shareUrl }); return; } catch (_) {}
    }
    setShowUrlBar(true);
  };

  useEffect(() => { if (!id) return; loadAll(); }, [id]);

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
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(accNumber).then(() => {
        setCopiedAccIdx(idx);
        setTimeout(() => setCopiedAccIdx(null), 2000);
      }).catch(() => { if (typeof window !== 'undefined') window.prompt('Copy account number:', accNumber); });
    } else if (typeof window !== 'undefined') {
      window.prompt('Copy account number:', accNumber);
    }
  };

  const openReceipt = async () => {
    if (!receiptId) return;
    setReceiptLoading(true);
    setReceiptModal(true);
    const { data: photos } = await supabase.from('receipt_photos').select('storage_path, url').eq('entry_id', receiptId).order('created_at');
    if (photos && photos.length > 0) {
      const urls = await Promise.all(photos.map(async (p: any) => {
        if (p.url) return p.url;
        let url = ''; if (p.storage_path) { const { data } = await supabase.storage.from('receipts').createSignedUrl(p.storage_path, 3600); url = data?.signedUrl ?? ''; }
        return url;
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

        {/* Header */}
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
            <Ionicons name="receipt-outline" size={16} color={Colors.faint} />
            <Text style={s.receiptUnavailableText}>receipt not available</Text>
          </View>
        )}

        {/* Per Person Pay */}
        {perPerson.length > 0 && <>
          <Text style={s.sectionHeader}>per person pay</Text>
          <View style={{ gap: 8, marginBottom: 8 }}>
            {perPerson.map((p, i) => (
              <View key={i} style={s.personRow}>
                <Text style={s.personName}>{p.name}</Text>
                <View style={s.personDots} />
                <Text style={s.personAmount}>{p.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              </View>
            ))}
            <View style={[s.personRow, { backgroundColor: Colors.cyan + '18', borderColor: Colors.cyan }]}>
              <Text style={[s.personName, { color: Colors.cyan, fontFamily: Fonts.monoBold }]}>total</Text>
              <View style={s.personDots} />
              <Text style={[s.personAmount, { color: Colors.cyan }]}>
                {perPerson.reduce((sum, p) => sum + p.total, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        </>}

        {/* Item Information */}
        {items.length > 0 && <>
          <Text style={s.sectionHeader}>item information</Text>
          <View style={{ gap: 8, marginBottom: 8 }}>
            {items.map((item, ii) => {
              const subs: any[] = item.subitems ?? [];
              const itemPeople: any[] = item.people ?? [];
              return (
                <View key={ii} style={s.itemCard}>
                  <View style={s.itemHeader}>
                    <Text style={s.itemName}>{String(item.name ?? '').toLowerCase()}</Text>
                    <Text style={s.itemCost}>{Number(item.cost ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  {subs.length === 0 && itemPeople.length > 0 ? (
                    <View style={{ gap: 6 }}>
                      <Text style={s.splitMeta}>{itemPeople.length} {itemPeople.length === 1 ? 'person' : 'people'} · {(Number(item.cost ?? 0) / itemPeople.length).toLocaleString('en-US', { minimumFractionDigits: 2 })} each</Text>
                      <View style={s.chips}>
                        {itemPeople.map((p, pi) => <View key={pi} style={s.chip}><Text style={s.chipText}>{p}</Text></View>)}
                      </View>
                    </View>
                  ) : subs.map((sub, si) => {
                    const subPeople: any[] = sub.people ?? [];
                    const pp = subPeople.length > 0 ? Number(sub.cost ?? 0) / subPeople.length : Number(sub.cost ?? 0);
                    return (
                      <View key={si} style={s.subRow}>
                        <Text style={s.arrow}>↳</Text>
                        <View style={{ flex: 1, gap: 4 }}>
                          <View style={s.subTop}>
                            <Text style={s.subName}>{String(sub.name ?? '').toLowerCase()}</Text>
                            <Text style={s.subCost}>{Number(sub.cost ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                          </View>
                          <Text style={s.splitMeta}>{subPeople.length} {subPeople.length === 1 ? 'person' : 'people'} · {pp.toLocaleString('en-US', { minimumFractionDigits: 2 })} each</Text>
                          <View style={s.chips}>
                            {subPeople.map((p, pi) => <View key={pi} style={s.chip}><Text style={s.chipText}>{p}</Text></View>)}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </>}

        {/* Payment Information */}
        {payments.length > 0 && <>
          <Text style={s.sectionHeader}>payment information</Text>
          <View style={{ gap: 8, marginBottom: 8 }}>
            {payments.map((acc: any, i: number) => (
              <View key={i} style={s.payCard}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.payName}>{acc.holder_name || acc.account_name ?? ''}</Text>
                  <Text style={s.payBank}>{acc.account_name} · {acc.bank ?? ''}</Text>
                  <TouchableOpacity style={s.copyRow} onPress={() => copyAccountNumber(acc.account_number ?? '', i)} activeOpacity={0.7}>
                    <Text style={s.payNumber}>{acc.account_number ?? ''}</Text>
                    <Ionicons name={copiedAccIdx === i ? 'checkmark' : 'copy-outline'} size={13} color={copiedAccIdx === i ? Colors.income : Colors.muted} />
                  </TouchableOpacity>
                </View>
                {acc.qr_code && (
                  <TouchableOpacity onPress={() => { setQrModalAcc(acc); setQrModal(true); }}>
                    <Image source={{ uri: acc.qr_code }} style={s.qr} resizeMode="contain" />
                    <Text style={s.qrHint}>tap to expand</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </>}

        {/* Share */}
        {showUrlBar ? (
          <View style={s.urlBar}>
            <TextInput style={s.urlInput} value={shareUrl} editable selectTextOnFocus autoFocus caretHidden={false} />
            <TouchableOpacity onPress={() => setShowUrlBar(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={16} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={15} color={Colors.text} />
            <Text style={s.shareBtnText}>share this bill</Text>
          </TouchableOpacity>
        )}

        <Text style={s.footer}>generated by LEDGR</Text>
      </ScrollView>

      {/* Receipt Modal */}
      <Modal visible={receiptModal} transparent animationType="slide" onRequestClose={() => setReceiptModal(false)}>
        <BlurView intensity={60} tint="dark" style={s.overlay}>
          <TouchableOpacity style={{ position: 'absolute', top: 56, right: 24, zIndex: 10 }} onPress={() => setReceiptModal(false)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {receiptLoading ? (
            <ActivityIndicator color="#fff" />
          ) : receiptPhotos.length === 0 ? (
            <Text style={{ fontFamily: Fonts.mono, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>no photos found</Text>
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
        <BlurView intensity={60} tint="dark" style={s.overlay}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => { setQrModal(false); setQrModalAcc(null); }}>
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
  scroll: { paddingHorizontal: Spacing.page, paddingTop: 52, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white, gap: 12 },
  notFound: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.muted },

  // Header
  appLabel: { fontFamily: 'MuseoModerno_Black', fontSize: 20, color: Colors.cyan, marginBottom: 20 },
  recName: { fontFamily: 'CalSans', fontSize: 32, color: Colors.text, letterSpacing: -0.5, marginBottom: 6 },
  recAmount: { fontFamily: Fonts.monoBold, fontSize: 24, marginBottom: 4 },
  recDate: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginBottom: 32 },

  // Section headers — matches pageStyles.sectionHeader
  sectionHeader: { fontFamily: 'CalSans', fontSize: 15, color: Colors.cyan, marginBottom: 10, marginTop: 24 },

  // Per person rows — pill style like recordingCard
  personRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border },
  personName: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.text, flexShrink: 0 },
  personDots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: Colors.faint, marginHorizontal: 10 },
  personAmount: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text, flexShrink: 0 },

  // Item cards
  itemCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontFamily: 'ChillaxMedium', fontSize: 14, color: Colors.text },
  itemCost: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.muted },
  subRow: { flexDirection: 'row', gap: 8 },
  arrow: { fontSize: 12, color: Colors.faint, marginTop: 2 },
  subTop: { flexDirection: 'row', justifyContent: 'space-between' },
  subName: { fontFamily: 'ChillaxMedium', fontSize: 12, color: Colors.text },
  subCost: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  splitMeta: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { backgroundColor: Colors.borderMid, borderRadius: Radius.pill, paddingVertical: 3, paddingHorizontal: 10 },
  chipText: { fontFamily: 'ChillaxRegular', fontSize: 10, color: Colors.text },

  // Receipt
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.cyan, backgroundColor: Colors.white },
  receiptBtnText: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.cyan, flex: 1 },
  receiptUnavailable: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  receiptUnavailableText: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.faint },

  // Payment cards — #d8efea bg matching space cards
  payCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#d8efea', borderRadius: Radius.lg, padding: 16, gap: 12 },
  payName: { fontFamily: 'ChillaxMedium', fontSize: 15, color: '#292929' },
  payBank: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  payNumber: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  qr: { width: 68, height: 68, borderRadius: Radius.md },
  qrHint: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, textAlign: 'center', marginTop: 3 },

  // Share button — matches addRecordBtn
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface, marginTop: 24, marginBottom: 16 },
  shareBtnText: { fontFamily: 'ChillaxMedium', fontSize: 13, color: Colors.muted },

  // URL bar
  urlBar: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cyan, backgroundColor: Colors.successBg, paddingHorizontal: 12, marginBottom: 16, gap: 8 },
  urlInput: { flex: 1, fontFamily: Fonts.mono, fontSize: 12, color: Colors.text, paddingVertical: 10 },

  // Footer
  footer: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint, textAlign: 'center', marginTop: 8 },

  // Modals
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  qrLarge: { width: 260, height: 260, borderRadius: Radius.lg },
  qrTap: { fontFamily: Fonts.mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 16 },
});
