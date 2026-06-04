import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Modal } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../../src/lib/supabase';
import { BlurView } from 'expo-blur';

export default function SplitSharePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [qrModal, setQrModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('split_shares').select('data').eq('id', id).single()
      .then(({ data: row, error }) => {
        if (error || !row) setNotFound(true);
        else setData(row.data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <View style={s.center}><ActivityIndicator color="#0ccfcf" /></View>;
  if (notFound || !data) return (
    <View style={s.center}>
      <Text style={{ fontSize: 40 }}>🔍</Text>
      <Text style={s.notFound}>split not found</Text>
    </View>
  );

  const amtColor = data.recordingType === 'expense' ? '#ed6a6a' : data.recordingType === 'income' ? '#2ab671' : '#425252';
  const perPerson: any[] = Array.isArray(data.perPerson) ? data.perPerson : [];
  const items: any[] = Array.isArray(data.items) ? data.items : [];

  return (
    <>
      <ScrollView style={s.container} contentContainerStyle={s.scroll}>

        <Text style={s.appLabel}>ledgr</Text>
        <Text style={s.recName}>{String(data.recordingName ?? '').toLowerCase()}</Text>
        <Text style={[s.recAmount, { color: amtColor }]}>{Number(data.recordingAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        <Text style={s.recDate}>{data.date ?? ''}</Text>

        {/* Per Person Pay */}
        {perPerson.length > 0 && <>
          <Text style={s.sectionHeader}>per person pay</Text>
          <View style={s.card}>
            {perPerson.map((p: any, i: number) => (
              <View key={i}>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>{p.name ?? ''}</Text>
                  <View style={s.dots} />
                  <Text style={s.infoValue}>{Number(p.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </View>
                {i < perPerson.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        </>}

        {/* Item Information */}
        {items.length > 0 && <>
          <Text style={s.sectionHeader}>item information</Text>
          {items.map((item: any, ii: number) => {
            const subitems: any[] = Array.isArray(item.subitems) ? item.subitems : [];
            const itemPeople: any[] = Array.isArray(item.people) ? item.people : [];
            return (
              <View key={ii} style={s.itemBlock}>
                <View style={s.itemHeader}>
                  <Text style={s.itemName}>{String(item.name ?? '').toLowerCase()}</Text>
                  <Text style={s.itemCost}>{Number(item.cost ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </View>
                {subitems.length === 0 && itemPeople.length > 0 ? (
                  <View style={s.itemPeopleRow}>
                    {itemPeople.map((p: any, pi: number) => (
                      <View key={pi} style={s.chip}><Text style={s.chipText}>{p}</Text></View>
                    ))}
                    <Text style={s.subSplit}>
                      {itemPeople.length} {itemPeople.length === 1 ? 'person' : 'people'} · {(Number(item.cost ?? 0) / itemPeople.length).toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                    </Text>
                  </View>
                ) : (
                  subitems.map((sub: any, si: number) => {
                    const subPeople: any[] = Array.isArray(sub.people) ? sub.people : [];
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
                            {subPeople.map((p: any, pi: number) => (
                              <View key={pi} style={s.chip}><Text style={s.chipText}>{p}</Text></View>
                            ))}
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            );
          })}
        </>}

        {/* Receipt */}
        <Text style={s.sectionHeader}>receipt</Text>
        {data.receiptId ? (
          <TouchableOpacity
            style={s.receiptBtn}
            onPress={() => {
              if (typeof window !== 'undefined') {
                window.open(`${window.location.origin}/receipt-view/${data.receiptId}`, '_blank');
              }
            }}
          >
            <Ionicons name="receipt-outline" size={16} color="#0ccfcf" />
            <Text style={s.receiptBtnText}>tap to view receipt photos</Text>
            <Ionicons name="arrow-forward" size={14} color="#0ccfcf" />
          </TouchableOpacity>
        ) : (
          <View style={s.receiptUnavailable}>
            <Ionicons name="receipt-outline" size={16} color="#c0c0c0" />
            <Text style={s.receiptUnavailableText}>receipt not available</Text>
          </View>
        )}

        {/* Payment Information */}
        {data.payment && (
          <>
            <Text style={s.sectionHeader}>payment information</Text>
            <View style={s.card}>
              <View style={s.payRow}>
                <View style={{ gap: 3, flex: 1 }}>
                  <Text style={s.payName}>{data.payment.accountName ?? ''}</Text>
                  <Text style={s.payBank}>{data.payment.bank ?? ''}</Text>
                  <Text style={s.payNumber}>{data.payment.accountNumber ?? ''}</Text>
                </View>
                {data.payment.qrCode
                  ? <TouchableOpacity onPress={() => setQrModal(true)}>
                      <Image source={{ uri: data.payment.qrCode }} style={s.qr} resizeMode="contain" />
                    </TouchableOpacity>
                  : null}
              </View>
            </View>
          </>
        )}

        <Text style={s.footer}>generated by ledgr</Text>
      </ScrollView>

      {/* QR Modal */}
      <Modal visible={qrModal} transparent animationType="fade" onRequestClose={() => setQrModal(false)}>
        <BlurView intensity={60} tint="dark" style={s.qrOverlay}>
          <TouchableOpacity style={s.qrOverlay} activeOpacity={1} onPress={() => setQrModal(false)}>
            <Image source={{ uri: data?.payment?.qrCode ?? '' }} style={s.qrLarge} resizeMode="contain" />
            <Text style={s.qrTap}>tap anywhere to close</Text>
          </TouchableOpacity>
        </BlurView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { paddingHorizontal: 28, paddingTop: 60, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', gap: 12 },
  notFound: { fontFamily: 'RobotoMono_400Regular', fontSize: 13, color: '#929090' },
  appLabel: { fontFamily: 'Avenelle', fontSize: 18, color: '#0ccfcf', marginBottom: 8 },
  recName: { fontFamily: 'Avenelle', fontSize: 26, color: '#425252', letterSpacing: -0.5, lineHeight: 30, marginBottom: 4 },
  recAmount: { fontFamily: 'RobotoMono_400Regular', fontSize: 20, marginBottom: 2 },
  recDate: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', marginBottom: 28 },
  sectionHeader: { fontFamily: 'ChillaxMedium', fontSize: 14, color: '#0ccfcf', letterSpacing: -0.3, marginBottom: 10 },
  card: { backgroundColor: '#fafafa', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#425252', flexShrink: 0 },
  dots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: '#d0d0d0', marginHorizontal: 8 },
  infoValue: { fontFamily: 'RobotoMono_700Bold', fontSize: 12, color: '#425252', flexShrink: 0 },
  divider: { height: 1, backgroundColor: '#f0f0f0' },
  itemBlock: { backgroundColor: '#fafafa', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 10 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  itemName: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#425252' },
  itemCost: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090' },
  itemPeopleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  subRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  arrow: { fontSize: 11, color: '#c0c0c0', marginTop: 2 },
  subTop: { flexDirection: 'row', justifyContent: 'space-between' },
  subName: { fontFamily: 'RobotoMono_700Bold', fontSize: 11, color: '#425252' },
  subCost: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#929090' },
  subSplit: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: { backgroundColor: '#f0f0f0', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 },
  chipText: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#425252' },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fffe', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#0ccfcf', marginBottom: 24 },
  receiptBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#0ccfcf', flex: 1 },
  receiptUnavailable: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fafafa', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 24 },
  receiptUnavailableText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#c0c0c0' },
  payRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  payName: { fontFamily: 'ChillaxMedium', fontSize: 14, color: '#425252' },
  payBank: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090' },
  payNumber: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#425252' },
  qr: { width: 80, height: 80, borderRadius: 8 },
  qrOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  qrLarge: { width: 260, height: 260, borderRadius: 16 },
  qrTap: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 16 },
  footer: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#c0c0c0', textAlign: 'center', marginTop: 24 },
});
