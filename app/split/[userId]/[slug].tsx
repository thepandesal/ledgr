import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Modal, TextInput, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../../src/lib/supabase';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius } from '@/components/ui/theme';
import { Brand } from '../../../src/lib/brand';

const PAGE        = 25;
const ACCENT      = Brand.color.accent;
const ACCENT_DARK = Brand.color.accentDark;
const PEACH       = '#FFAB91';

export default function SplitShareSlugPage() {
  const { userId, slug } = useLocalSearchParams<{ userId: string; slug: string }>();
  const [loading, setLoading]               = useState(true);
  const [notFound, setNotFound]             = useState(false);
  const [recording, setRecording]           = useState<any>(null);
  const [perPerson, setPerPerson]           = useState<{ name: string; total: number }[]>([]);
  const [items, setItems]                   = useState<any[]>([]);
  const [linkedRecordings, setLinkedRecordings] = useState<any[]>([]);
  const [payments, setPayments]             = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [receiptId, setReceiptId]           = useState<string | null>(null);
  const [receiptPhotos, setReceiptPhotos]   = useState<string[]>([]);
  const [splitReceiptPhotos, setSplitReceiptPhotos] = useState<string[]>([]);
  const [receiptModal, setReceiptModal]     = useState(false);
  const [receiptModalPhotos, setReceiptModalPhotos] = useState<string[]>([]);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [qrModal, setQrModal]               = useState(false);
  const [qrModalAcc, setQrModalAcc]         = useState<any>(null);
  const [showUrlBar, setShowUrlBar]         = useState(false);
  const [copiedAccIdx, setCopiedAccIdx]     = useState<number | null>(null);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://ledgr.art/split/${userId}/${slug}`;

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'split bill', url: shareUrl }); return; } catch (_) {}
    }
    setShowUrlBar(true);
  };

  useEffect(() => { if (!userId || !slug) return; loadAll(); }, [userId, slug]);

  const isDeduct = (type: string) => type === 'payable';

  const loadAll = async () => {
    // Look up share by user_id + slug
    const { data: share, error } = await supabase
      .from('split_shares')
      .select('id, recording_id, split_bill_id, data')
      .eq('user_id', userId)
      .eq('slug', slug)
      .single();
    if (error || !share) { setNotFound(true); setLoading(false); return; }

    const accountIds: string[] = share.data?.account_ids ?? [];
    const splitBillId = share.split_bill_id;
    const rid = share.recording_id;

    if (splitBillId) {
      const [billRes, splitsRes, itemsRes, recsRes, adjRes, paymentsRes] = await Promise.all([
        supabase.from('split_bills').select('id, name').eq('id', splitBillId).single(),
        supabase.from('bill_splits').select('person_name').eq('split_bill_id', splitBillId).order('created_at'),
        supabase.from('split_items').select('*, split_subitems(*)').eq('split_bill_id', splitBillId).order('created_at'),
        supabase.from('split_bill_recordings').select('amount_contributed, recording:recording_id(id, name, amount, type, transaction_date)').eq('split_bill_id', splitBillId),
        supabase.from('split_adjustments').select('*').eq('split_bill_id', splitBillId),
        supabase.from('split_bill_payments').select('*').eq('split_bill_id', splitBillId).order('created_at'),
      ]);
      if (!billRes.data) { setNotFound(true); setLoading(false); return; }
      const firstRec = (recsRes.data ?? []).map((r: any) => ({ ...r, recording: Array.isArray(r.recording) ? r.recording[0] : r.recording }))[0]?.recording;
      setRecording(firstRec ? { ...firstRec, name: billRes.data.name } : { name: billRes.data.name, amount: 0, type: 'expense', transaction_date: '' });
      if (accountIds.length > 0) {
        const { data: accs } = await supabase.from('accounts').select('account_name, holder_name, bank, account_number, qr_code').in('id', accountIds);
        if (accs) setPayments(accs);
      }
      const loadedItems = (itemsRes.data ?? []).map((item: any) => ({ ...item, subitems: item.split_subitems ?? [] }));
      setItems(loadedItems);
      const linkedRecs = (recsRes.data ?? []).map((r: any) => ({ ...r, recording: Array.isArray(r.recording) ? r.recording[0] : r.recording }));
      setLinkedRecordings(linkedRecs);
      const people = (splitsRes.data ?? []).map((r: any) => r.person_name);
      const adjs = adjRes.data ?? [];
      const perPersonMap: Record<string, number> = {};
      people.forEach(p => { perPersonMap[p] = 0; });
      loadedItems.forEach((item: any) => {
        const deduct = isDeduct(item.recording_type ?? '');
        const subs = item.subitems ?? [];
        if (subs.length === 0) {
          const pp = (item.people ?? []).length > 0 ? Number(item.cost) / item.people.length : 0;
          (item.people ?? []).forEach((p: string) => { if (perPersonMap[p] !== undefined) perPersonMap[p] += deduct ? -pp : pp; });
        } else {
          subs.forEach((sub: any) => {
            const pp = (sub.people ?? []).length > 0 ? Number(sub.cost) / sub.people.length : 0;
            (sub.people ?? []).forEach((p: string) => { if (perPersonMap[p] !== undefined) perPersonMap[p] += deduct ? -pp : pp; });
          });
        }
      });
      adjs.forEach((adj: any) => {
        const adjPeople: string[] = adj.people ?? [];
        if (adj.mode === 'manual') {
          const manual = adj.manual_amounts ?? {};
          adjPeople.forEach(p => { if (perPersonMap[p] !== undefined) perPersonMap[p] += adj.type === 'receivable' ? -(manual[p] ?? 0) : (manual[p] ?? 0); });
        } else {
          const pp = adjPeople.length > 0 ? Number(adj.amount) / adjPeople.length : 0;
          adjPeople.forEach(p => { if (perPersonMap[p] !== undefined) perPersonMap[p] += adj.type === 'receivable' ? -pp : pp; });
        }
      });
      setPerPerson(Object.entries(perPersonMap).map(([name, total]) => ({ name, total })));
      setPaymentHistory(paymentsRes.data ?? []);

      // Load receipt photos — from split bill directly, or from linked recordings
      const { data: receiptEntry } = await supabase
        .from('receipt_entries')
        .select('id')
        .eq('split_bill_id', splitBillId)
        .maybeSingle();
      let allReceiptUrls: string[] = [];
      if (receiptEntry?.id) {
        const { data: photos } = await supabase
          .from('receipt_photos')
          .select('storage_path, url')
          .eq('entry_id', receiptEntry.id)
          .order('created_at');
        if (photos) {
          const urls = await Promise.all(photos.map(async (p: any) => {
            if (p.url) return p.url;
            if (p.storage_path) {
              const { data } = await supabase.storage.from('receipts').createSignedUrl(p.storage_path, 3600);
              return data?.signedUrl ?? '';
            }
            return '';
          }));
          allReceiptUrls = [...allReceiptUrls, ...urls.filter(Boolean)];
        }
      }
      // Also load from recordings linked to this split bill
      const recIds = (recsRes.data ?? []).map((r: any) => {
        const rec = Array.isArray(r.recording) ? r.recording[0] : r.recording;
        return rec?.id;
      }).filter(Boolean);
      if (recIds.length > 0) {
        const { data: recEntries } = await supabase
          .from('receipt_entries')
          .select('id')
          .in('recording_id', recIds);
        for (const entry of recEntries ?? []) {
          const { data: photos } = await supabase
            .from('receipt_photos')
            .select('storage_path, url')
            .eq('entry_id', entry.id)
            .order('created_at');
          if (photos) {
            const urls = await Promise.all(photos.map(async (p: any) => {
              if (p.url) return p.url;
              if (p.storage_path) {
                const { data } = await supabase.storage.from('receipts').createSignedUrl(p.storage_path, 3600);
                return data?.signedUrl ?? '';
              }
              return '';
            }));
            allReceiptUrls = [...allReceiptUrls, ...urls.filter(Boolean)];
          }
        }
      }
      if (allReceiptUrls.length > 0) setSplitReceiptPhotos(allReceiptUrls);

      setLoading(false);
      return;
    }

    if (!rid) { setNotFound(true); setLoading(false); return; }
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
      const { data: accs } = await supabase.from('accounts').select('account_name, holder_name, bank, account_number, qr_code').in('id', accountIds);
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
        let url = '';
        if (p.storage_path) { const { data } = await supabase.storage.from('receipts').createSignedUrl(p.storage_path, 3600); url = data?.signedUrl ?? ''; }
        return url;
      }));
      setReceiptPhotos(urls.filter(Boolean));
    }
    setReceiptLoading(false);
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const { width: screenW } = useWindowDimensions();
  const qrSize = screenW * 0.9;

  if (loading) return <View style={s.center}><ActivityIndicator color={ACCENT_DARK} /></View>;
  if (notFound || !recording) return (
    <View style={s.center}>
      <Ionicons name="search-outline" size={36} color={Colors.borderMid} />
      <Text style={s.emptyText}>split not found</Text>
    </View>
  );

  const amtColor = recording.type === 'payable' || recording.type === 'expense' ? PEACH : ACCENT_DARK;
  const formattedDate = recording.transaction_date
    ? new Date(recording.transaction_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const grandTotal = perPerson.reduce((sum, p) => sum + p.total, 0);

  return (
    <>
      <ScrollView style={s.container} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.recName}>{String(recording.name ?? '').toLowerCase()}</Text>
        {!!formattedDate && <Text style={s.recDate}>{formattedDate}</Text>}

        {perPerson.length > 0 && <>
          <Text style={s.sectionHeader}>per person pay</Text>
          <View style={s.listBlock}>
            {perPerson.map((p, i) => {
              const absOwed = Math.abs(p.total);
              const paid = paymentHistory
                .filter((bp: any) => bp.person_name === p.name)
                .reduce((s: number, bp: any) => s + Number(bp.amount), 0);
              const fullyPaid = absOwed > 0 && paid >= absOwed - 0.01;
              const partiallyPaid = paid > 0 && !fullyPaid;
              return (
              <View key={i} style={s.row}>
                <View style={[s.rowIconWrap, { backgroundColor: fullyPaid ? '#4CAF5022' : partiallyPaid ? '#FFAB9122' : ACCENT + '44' }]}>
                  <Ionicons
                    name={fullyPaid || partiallyPaid ? 'checkmark-circle' : 'person-outline'}
                    size={15}
                    color={fullyPaid ? '#4CAF50' : partiallyPaid ? '#FFAB91' : ACCENT_DARK}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName}>{p.name}</Text>
                  {partiallyPaid && (
                    <Text style={s.splitMeta}>{fmt(paid)} paid</Text>
                  )}
                  {fullyPaid && (
                    <Text style={s.splitMeta}>complete</Text>
                  )}
                </View>
                <Text style={[s.rowAmount, { color: p.total < 0 ? PEACH : ACCENT_DARK }]}>
                  {p.total < 0 ? '-' : ''}{fmt(Math.abs(p.total))}
                </Text>
              </View>
              );
            })}
            <View style={[s.row, { backgroundColor: ACCENT + '44' }]}>
              <View style={[s.rowIconWrap, { backgroundColor: ACCENT }]}><Ionicons name="calculator-outline" size={15} color={ACCENT_DARK} /></View>
              <Text style={[s.rowName, { fontFamily: Brand.font.monoBold, color: ACCENT_DARK }]}>total</Text>
              <Text style={[s.rowAmount, { color: ACCENT_DARK }]}>{fmt(grandTotal)}</Text>
            </View>
          </View>
        </>}

        {items.length > 0 && <>
          <Text style={s.sectionHeader}>item breakdown</Text>
          <View style={s.listBlock}>
            {(() => {
              // Group items by recording_id
              const groups: { recName: string; recId: string | null; items: any[] }[] = [];
              items.forEach((item: any) => {
                const key = item.recording_id ?? '__manual__';
                const existing = groups.find(g => g.recId === key);
                if (existing) { existing.items.push(item); }
                else {
                  // find recording name from recsRes if available — use item.recording_type as fallback label
                  groups.push({ recId: key, recName: key === '__manual__' ? 'manual' : '', items: [item] });
                }
              });
              return groups.map((group, gi) => (
                <View key={gi}>
                  {groups.length > 1 && (
                    <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, backgroundColor: ACCENT + '22' }}>
                      <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: ACCENT_DARK, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        {group.recId === '__manual__' ? 'manual' : linkedRecordings.find(lr => lr.recording?.id === group.recId)?.recording?.name ?? group.items[0]?.recording_type ?? 'items'}
                      </Text>
                    </View>
                  )}
                  {group.items.map((item: any, ii: number) => {
                    const subs: any[] = item.subitems ?? [];
                    const itemPeople: any[] = item.people ?? [];
                    const deduct = isDeduct(item.recording_type ?? '');
                    const perPersonCost = itemPeople.length > 0 ? Number(item.cost ?? 0) / itemPeople.length : 0;
                    return (
                      <View key={ii} style={s.itemCard}>
                        <View style={[s.itemHeader, { paddingBottom: itemPeople.length > 0 ? 4 : 12 }]}>
                          <View style={[s.rowIconWrap, { backgroundColor: ACCENT + '44', alignSelf: 'flex-start', marginTop: 2 }]}>
                            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 13, color: ACCENT_DARK }}>{ii + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Text style={[s.rowName, { flex: 1 }]}>{String(item.name ?? '').toLowerCase()}</Text>
                              <Text style={[s.rowAmount, { color: deduct ? PEACH : ACCENT_DARK }]}>{deduct ? '-' : ''}{fmt(Number(item.cost ?? 0))}</Text>
                            </View>
                            {subs.length === 0 && itemPeople.length > 0 && (
                              <View style={{ marginTop: 2, gap: 3 }}>
                                <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: deduct ? PEACH : ACCENT_DARK }}>
                                  {fmt(perPersonCost)} each
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                  {itemPeople.map((person: string, pi: number) => (
                                    <View key={pi} style={{ backgroundColor: ACCENT + '44', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
                                      <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: ACCENT_DARK }}>{person}</Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            )}
                          </View>
                        </View>
                        {subs.map((sub: any, si: number) => {
                          const subPeople: any[] = sub.people ?? [];
                          const pp = subPeople.length > 0 ? Number(sub.cost ?? 0) / subPeople.length : Number(sub.cost ?? 0);
                          return (
                            <View key={si} style={s.subRow}>
                              <Text style={s.arrow}>↳</Text>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                  <Text style={s.subName}>{String(sub.name ?? '').toLowerCase()}</Text>
                                  <Text style={s.subCost}>{fmt(Number(sub.cost ?? 0))}</Text>
                                </View>
                                <Text style={s.splitMeta}>{fmt(pp)} each · {subPeople.join(', ')}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              ));
            })()}
          </View>
        </>}

        {splitReceiptPhotos.length > 0 && <>
          <Text style={s.sectionHeader}>receipts</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            {splitReceiptPhotos.map((url, i) => (
              <TouchableOpacity key={i} onPress={() => { setReceiptModalPhotos(splitReceiptPhotos); setReceiptModal(true); }} activeOpacity={0.85}>
                <Image source={{ uri: url }} style={{ width: 90, height: 90, borderRadius: Radius.md, backgroundColor: Colors.surface }} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </View>
        </>}

        {receiptId && <>
          <Text style={s.sectionHeader}>receipt</Text>
          <TouchableOpacity style={s.actionBtn} onPress={async () => {
            setReceiptLoading(true);
            setReceiptModal(true);
            const { data: photos } = await supabase.from('receipt_photos').select('storage_path, url').eq('entry_id', receiptId).order('created_at');
            if (photos && photos.length > 0) {
              const urls = await Promise.all(photos.map(async (p: any) => {
                if (p.url) return p.url;
                if (p.storage_path) { const { data } = await supabase.storage.from('receipts').createSignedUrl(p.storage_path, 3600); return data?.signedUrl ?? ''; }
                return '';
              }));
              setReceiptModalPhotos(urls.filter(Boolean));
            }
            setReceiptLoading(false);
          }} activeOpacity={0.8}>
            <Ionicons name="receipt-outline" size={15} color={ACCENT_DARK} />
            <Text style={s.actionBtnText}>view receipt photos</Text>
            <Ionicons name="chevron-forward" size={13} color={ACCENT_DARK} />
          </TouchableOpacity>
        </>}

        {payments.length > 0 && <>
          <Text style={s.sectionHeader}>payment information</Text>
          <View style={s.listBlock}>
            {payments.map((acc: any, i: number) => (
              <View key={i} style={s.payRow}>
                <View style={[s.rowIconWrap, { backgroundColor: ACCENT }]}><Ionicons name="card-outline" size={15} color={ACCENT_DARK} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.payBank}>{acc.bank || ''}</Text>
                  <Text style={s.payHolder}>{acc.holder_name || acc.account_name || ''}</Text>
                  <TouchableOpacity style={s.copyRow} onPress={() => copyAccountNumber(acc.account_number ?? '', i)} activeOpacity={0.7}>
                    <Text style={s.payNumber}>{acc.account_number ?? ''}</Text>
                    <Ionicons name={copiedAccIdx === i ? 'checkmark' : 'copy-outline'} size={12} color={copiedAccIdx === i ? ACCENT_DARK : Colors.muted} />
                  </TouchableOpacity>
                </View>
                {acc.qr_code && (
                  <TouchableOpacity onPress={() => { setQrModalAcc(acc); setQrModal(true); }}>
                    <Image source={{ uri: acc.qr_code }} style={s.qr} resizeMode="contain" />
                    <Text style={s.qrHint}>tap to enlarge</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </>}

        {showUrlBar ? (
          <View style={s.urlBar}>
            <TextInput style={s.urlInput} value={shareUrl} editable selectTextOnFocus autoFocus caretHidden={false} />
            <TouchableOpacity onPress={() => setShowUrlBar(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={16} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-outline" size={15} color={ACCENT_DARK} />
            <Text style={s.shareBtnText}>share this bill</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => { if (typeof window !== 'undefined') window.open('https://ledgr.art', '_blank'); }} activeOpacity={0.7}>
          <Text style={s.footer}>generated by <Text style={{ color: ACCENT_DARK, textDecorationLine: 'underline' }}>LEDGR</Text></Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={receiptModal} transparent animationType="slide" onRequestClose={() => setReceiptModal(false)}>
        <BlurView intensity={60} tint="dark" style={s.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setReceiptModal(false)} />
          <TouchableOpacity style={{ position: 'absolute', top: 56, right: 24, zIndex: 10 }} onPress={() => setReceiptModal(false)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {receiptLoading ? <ActivityIndicator color="#fff" /> : receiptModalPhotos.length === 0 ? (
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>no photos found</Text>
          ) : (
            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ padding: 24, paddingTop: 80, gap: 16 }} showsVerticalScrollIndicator={false}>
              {receiptModalPhotos.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} resizeMode="contain" />
              ))}
            </ScrollView>
          )}
        </BlurView>
      </Modal>

      <Modal visible={qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(false)}>
        <BlurView intensity={60} tint="dark" style={s.overlay}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => { setQrModal(false); setQrModalAcc(null); }}>
            <Image source={{ uri: qrModalAcc?.qr_code ?? '' }} style={[s.qrLarge, { width: qrSize, height: qrSize }]} resizeMode="contain" />
            <Text style={s.qrTap}>tap anywhere to close</Text>
          </TouchableOpacity>
        </BlurView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  scroll:    { paddingHorizontal: PAGE, paddingTop: 48, paddingBottom: 60 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white, gap: 12 },
  emptyText: { fontFamily: Brand.font.mono, fontSize: 13, color: Colors.muted },
  recName:   { fontFamily: Brand.font.display, fontSize: 30, color: Colors.text, letterSpacing: -0.5, marginBottom: 4 },
  recDate:   { fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted, marginBottom: 20 },
  sectionHeader: { ...Brand.type.sectionHeader, marginTop: 28, marginBottom: 10 },
  listBlock: { borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 4 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIconWrap:{ width: 32, height: 32, borderRadius: 16, backgroundColor: ACCENT + '44', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowName:    { flex: 1, fontFamily: Brand.font.heading, fontSize: 13, color: Colors.text },
  rowAmount:  { fontFamily: Brand.font.monoBold, fontSize: 14, letterSpacing: -0.3 },
  itemCard:   { borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  itemMeta:   { paddingHorizontal: 14, paddingBottom: 10, paddingLeft: 60 },
  subRow:     { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 8, paddingLeft: 60 },
  arrow:      { fontSize: 12, color: Colors.faint, marginTop: 2 },
  subName:    { fontFamily: Brand.font.heading, fontSize: 12, color: Colors.text },
  subCost:    { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted },
  splitMeta:  { fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted, marginTop: 2 },
  payRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  payBank:   { fontFamily: Brand.font.heading, fontSize: 14, color: Colors.text },
  payHolder: { fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted },
  payNumber: { fontFamily: Brand.font.monoBold, fontSize: 13, color: Colors.text },
  copyRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  qr:        { width: 64, height: 64, borderRadius: Radius.md },
  qrHint:    { fontFamily: Brand.font.mono, fontSize: 9, color: Colors.muted, textAlign: 'center', marginTop: 2 },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: ACCENT, backgroundColor: ACCENT + '44' },
  actionBtnText: { flex: 1, fontFamily: Brand.font.heading, fontSize: 13, color: ACCENT_DARK },
  shareBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.pill, paddingVertical: 12, borderWidth: 1, borderColor: ACCENT, backgroundColor: ACCENT + '44', marginTop: 24, marginBottom: 16 },
  shareBtnText: { fontFamily: Brand.font.heading, fontSize: 13, color: ACCENT_DARK },
  urlBar:   { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: ACCENT, backgroundColor: ACCENT + '22', paddingHorizontal: 12, marginTop: 16, marginBottom: 16, gap: 8 },
  urlInput: { flex: 1, fontFamily: Brand.font.mono, fontSize: 12, color: Colors.text, paddingVertical: 10 },
  footer: { fontFamily: Brand.font.mono, fontSize: 10, color: Colors.faint, textAlign: 'center', marginTop: 8 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  qrLarge: { borderRadius: Radius.lg },
  qrTap:   { fontFamily: Brand.font.mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 16 },
});
