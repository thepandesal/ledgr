import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase';
import { useSlideScreen } from '../../src/hooks/useSlideScreen';
import { Colors, Radius } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';

const { width } = Dimensions.get('window');
const PAGE = 25;
const ACCENT      = Brand.color.accent;
const ACCENT_DARK = Brand.color.accentDark;
const PEACH       = '#FFAB91';

function recordingColor(type: string): string {
  if (type === 'expense' || type === 'payable') return PEACH;
  return ACCENT_DARK;
}

function dateKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

export default function AccountDetailScreen() {
  const { accountId, accountName, bankName } = useLocalSearchParams<{ accountId: string; accountName: string; bankName: string }>();
  const router = useRouter();
  const { slideAnim, handleBack } = useSlideScreen();

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['account-recordings', accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('*, categories:category_id(name, color, icon)')
        .eq('account_id', accountId)
        .order('transaction_date', { ascending: false });
      return (data ?? []).map((r: any) => ({
        ...r,
        categories: Array.isArray(r.categories) ? r.categories[0] : r.categories,
      }));
    },
    enabled: !!accountId,
  });

  const totalExpenses    = recordings.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
  const totalIncome      = recordings.filter(r => r.type === 'income' || r.type === 'savings').reduce((s, r) => s + Number(r.amount), 0);
  const countPayables    = recordings.filter(r => r.type === 'payable' && r.status !== 'paid').length;
  const countReceivables = recordings.filter(r => r.type === 'receivable' && r.status === 'pending').length;

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const fmtAbbr = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return n.toFixed(0);
  };

  const grouped: { dateLabel: string; dateObj: Date; items: any[] }[] = [];
  recordings.forEach(r => {
    const parts = r.transaction_date.split('-');
    const rDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const key = dateKey(rDate);
    const existing = grouped.find(g => dateKey(g.dateObj) === key);
    if (existing) existing.items.push(r);
    else grouped.push({ dateLabel: rDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), dateObj: rDate, items: [r] });
  });
  grouped.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: Colors.white }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => handleBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{(accountName ?? '').toLowerCase()}</Text>
            <Text style={s.subtitle}>{(bankName ?? '').toLowerCase()}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { label: 'expenses',    value: fmtAbbr(totalExpenses),    color: PEACH       },
            { label: 'income',      value: fmtAbbr(totalIncome),      color: ACCENT_DARK },
            { label: 'payables',    value: String(countPayables),     color: Colors.muted },
            { label: 'receivables', value: String(countReceivables),  color: Colors.muted },
          ].map((st, i) => (
            <View key={i} style={s.statCard}>
              <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Recordings */}
        {isLoading ? (
          <ActivityIndicator color={ACCENT_DARK} style={{ marginTop: 40 }} />
        ) : grouped.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60, gap: 8 }}>
            <Ionicons name="receipt-outline" size={36} color={Colors.borderMid} />
            <Text style={Brand.type.emptyText}>no recordings for this account</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {grouped.map(group => (
              <View key={group.dateLabel}>
                <View style={s.dateRow}>
                  <View style={s.dateLine} />
                  <Text style={s.dateLabel}>{group.dateLabel}</Text>
                  <View style={s.dateLine} />
                </View>
                {group.items.map(item => {
                  const color = recordingColor(item.type);
                  const statusLabel = item.type === 'payable'
                    ? (item.status === 'paid' ? 'paid' : item.status === 'partial' ? 'partial' : 'unpaid')
                    : item.type === 'receivable'
                      ? (item.status === 'received' ? 'received' : item.status === 'partial' ? 'partial' : 'pending')
                      : '';
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={s.row}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                    >
                      <View style={s.rowIconWrap}>
                        <Ionicons name={item.categories?.icon ?? 'ellipse-outline'} size={18} color={ACCENT_DARK} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                        <Text style={s.rowMeta}>{statusLabel || item.categories?.name || item.type}</Text>
                      </View>
                      <Text style={[s.rowAmount, { color }]}>{fmt(Number(item.amount))}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  header:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAGE, paddingTop: 16, paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  title:    { fontFamily: Brand.font.display, fontSize: 22, color: Colors.text, letterSpacing: -0.3 },
  subtitle: { fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginTop: 1 },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: PAGE, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statValue:{ fontFamily: Brand.font.monoBold, fontSize: 13, marginBottom: 2 },
  statLabel:{ fontFamily: Brand.font.mono, fontSize: 9, color: Colors.muted, textAlign: 'center' },

  list:     { paddingHorizontal: PAGE, paddingBottom: 100, paddingTop: 8 },

  dateRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10 },
  dateLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dateLabel:{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' },

  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIconWrap:{ width: 36, height: 36, borderRadius: 18, backgroundColor: ACCENT + '44', alignItems: 'center', justifyContent: 'center' },
  rowName:    { ...Brand.type.cardTitle },
  rowMeta:    { ...Brand.type.cardMeta },
  rowAmount:  { fontFamily: Brand.font.monoBold, fontSize: 14, letterSpacing: -0.3 },
});
