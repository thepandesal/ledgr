import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase';
import pageStyles from '@/components/ui/pageStyles';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';

const { width } = Dimensions.get('window');

function recordingColor(type: string, status: string): string {
  if (type === 'expense') return Colors.expense;
  if (type === 'income' || type === 'savings') return Colors.cyan;
  if (type === 'payable') return status === 'paid' ? Colors.paid : Colors.pending;
  if (type === 'receivable') return status === 'received' ? Colors.paid : Colors.pending;
  return Colors.cyan;
}

function recordingBg(type: string, status: string): string {
  if (type === 'expense') return '#fdeded';
  if (type === 'income' || type === 'savings') return '#f6fded';
  if (type === 'payable' || type === 'receivable') {
    if (status === 'paid' || status === 'received') return '#f8f8f8';
    return '#f8edfd';
  }
  return '#f6fded';
}

function dateKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

export default function AccountDetailScreen() {
  const { accountId, accountName, bankName } = useLocalSearchParams<{ accountId: string; accountName: string; bankName: string }>();
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
  }, []);

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['account-recordings', accountId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('*, categories:category_id(name, color, icon), account:account_id(account_name, bank)')
        .eq('account_id', accountId)
        .order('transaction_date', { ascending: false });
      return data ?? [];
    },
    enabled: !!accountId,
  });

  const totalExpenses = recordings.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
  const totalIncome = recordings.filter(r => r.type === 'income' || r.type === 'savings').reduce((s, r) => s + Number(r.amount), 0);
  const countPayables = recordings.filter(r => r.type === 'payable' && r.status !== 'paid').length;
  const countReceivables = recordings.filter(r => r.type === 'receivable' && r.status === 'pending').length;

  const shortAmount = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toFixed(0);
  };

  // Group by date
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
    <Animated.View style={[pageStyles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={pageStyles.inner}>
        <TouchableOpacity onPress={() => {
          Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
        }} style={pageStyles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.muted} />
        </TouchableOpacity>

        {/* Header */}
        <View style={{ paddingHorizontal: Spacing.page, marginBottom: 16 }}>
          <Text style={s.pageTitle}>{(accountName ?? '').toLowerCase()}</Text>
          <Text style={s.pageSubtitle}>{(bankName ?? '').toLowerCase()}</Text>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: Spacing.page, marginBottom: 16 }}>
          {[
            { label: 'expenses', value: shortAmount(totalExpenses), color: Colors.expense },
            { label: 'income', value: shortAmount(totalIncome), color: Colors.income },
            { label: 'payables', value: String(countPayables), color: Colors.muted },
            { label: 'receivables', value: String(countReceivables), color: Colors.muted },
          ].map((st, i) => (
            <View key={i} style={s.statCard}>
              <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Recordings */}
        {isLoading ? (
          <ActivityIndicator color={Colors.income} style={{ marginTop: 40 }} />
        ) : grouped.length === 0 ? (
          <View style={[pageStyles.emptyBox, { borderWidth: 0, backgroundColor: 'transparent', marginTop: 40 }]}>
            <Ionicons name="receipt-outline" size={40} color={Colors.borderMid} />
            <Text style={pageStyles.emptyText}>no recordings for this account</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {grouped.map(group => (
              <View key={group.dateLabel}>
                <View style={s.dateGroupRow}>
                  <View style={s.dateGroupLine} />
                  <Text style={s.dateGroupLabel}>{group.dateLabel}</Text>
                  <View style={s.dateGroupLine} />
                </View>
                <View style={{ gap: 10 }}>
                  {group.items.map(item => {
                    const amountColor = recordingColor(item.type, item.status);
                    const statusLabel = item.type === 'payable'
                      ? (item.status === 'paid' ? 'Paid' : item.status === 'partial' ? 'Partial' : 'Unpaid')
                      : item.type === 'receivable'
                        ? (item.status === 'received' ? 'Received' : item.status === 'partial' ? 'Partial' : 'Pending')
                        : '';
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[s.recordingCard, { backgroundColor: recordingBg(item.type, item.status) }]}
                        activeOpacity={0.85}
                        onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                      >
                        <Ionicons name={item.categories?.icon ?? 'ellipse-outline'} size={22} color={amountColor} style={{ flexShrink: 0 }} />
                        <View style={s.recordingMiddle}>
                          <Text style={s.recordingName} numberOfLines={1}>{item.name}</Text>
                          <Text style={[s.recordingMeta, { fontFamily: Fonts.monoBold }]} numberOfLines={1}>
                            {statusLabel || item.categories?.name || item.type}
                          </Text>
                        </View>
                        <Text style={[s.recordingAmount, { color: amountColor }]}>
                          {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontFamily: Fonts.calSans, fontSize: 32, color: '#425252', letterSpacing: -0.5 },
  pageSubtitle: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.muted, marginTop: 2 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 8, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  statValue: { fontFamily: 'ChillaxMedium', fontSize: 13, marginBottom: 2 },
  statLabel: { fontFamily: 'ChillaxLight', fontSize: 9, color: Colors.muted, textAlign: 'center' },
  list: { paddingHorizontal: Spacing.page, paddingBottom: 100, gap: 16, paddingTop: 16 },
  dateGroupRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 16 },
  dateGroupLine: { flex: 1, height: 1, backgroundColor: Colors.borderMid },
  dateGroupLabel: { fontFamily: Fonts.calSans, fontSize: 11, color: '#555555', textAlign: 'center' },
  recordingCard: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.pill, paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  recordingMiddle: { flex: 1, gap: 2, overflow: 'hidden' },
  recordingName: { fontFamily: 'ChillaxMedium', fontSize: 13, color: '#292929' },
  recordingMeta: { fontFamily: Fonts.mono, fontSize: 10, color: '#292929' },
  recordingAmount: { fontFamily: Fonts.monoBold, fontSize: 14 },
});
