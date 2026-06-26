import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { useRouter } from 'expo-router';

const I  = 'Inter_400Regular';
const IM = 'Inter_500Medium';
const IS = 'Inter_600SemiBold';
const IB = 'Inter_700Bold';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Warm luxury palette ──────────────────────────────────────────────────────
const P = {
  bg:         '#FAF8F4',
  card:       '#FFFFFF',
  surface:    '#F5F1EA',
  border:     '#E8E2D9',
  borderMid:  '#DDD6CA',
  text:       '#1C1C1A',
  secondary:  '#7A7468',
  muted:      '#B0A99E',
  green:      '#3D7A5F',
  greenLight: '#EBF4EF',
  orange:     '#C4713A',
  orangeLight:'#FAF0E8',
  red:        '#B94040',
  redLight:   '#FAEDEB',
  gold:       '#A07830',
  goldLight:  '#FAF3E0',
  blue:       '#3A6080',
  blueLight:  '#EBF2F8',
} as const;

const ACTIVITY_TABS = [
  { key: 'all',         label: 'All',         icon: 'apps-outline',              types: ['income','savings','expense','payable','receivable'], color: P.text,   bg: P.surface    },
  { key: 'money-in',    label: 'Money In',    icon: 'arrow-down-circle-outline', types: ['income','savings'], color: P.green,  bg: P.greenLight  },
  { key: 'money-out',   label: 'Money Out',   icon: 'arrow-up-circle-outline',   types: ['expense'],         color: P.orange, bg: P.orangeLight },
  { key: 'loans',       label: 'Loans',       icon: 'cash-outline',              types: ['payable'],         color: P.gold,   bg: P.goldLight   },
  { key: 'receivables', label: 'Receivables', icon: 'arrow-undo-outline',        types: ['receivable'],      color: P.blue,   bg: P.blueLight   },
] as const;

type ActivityTab = typeof ACTIVITY_TABS[number]['key'];

type Preset = 'this-month' | 'last-30' | 'cutoff' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this-month', label: 'This Month' },
  { key: 'last-30',    label: 'Last 30d'   },
  { key: 'cutoff',     label: 'Cutoff'     },
  { key: 'custom',     label: 'Custom'     },
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

function getRangeForPreset(preset: Preset, cutoffDay: number): { from: Date; to: Date } {
  const now = new Date();
  if (preset === 'this-month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
  if (preset === 'last-30') {
    const from = new Date(now); from.setDate(now.getDate() - 30);
    return { from, to: now };
  }
  if (preset === 'cutoff') {
    const day = cutoffDay;
    let from: Date, to: Date;
    if (now.getDate() >= day) {
      from = new Date(now.getFullYear(), now.getMonth(), day);
      to   = new Date(now.getFullYear(), now.getMonth() + 1, day - 1);
    } else {
      from = new Date(now.getFullYear(), now.getMonth() - 1, day);
      to   = new Date(now.getFullYear(), now.getMonth(), day - 1);
    }
    return { from, to };
  }
  // custom — caller manages dates
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}

export default function DashboardScreen() {
  const router    = useRouter();
  const { userId } = useUser();

  const queryClient = useQueryClient();

  const [activePreset, setActivePreset] = useState<Preset>('this-month');
  const [selectedTabs, setSelectedTabs] = useState<Set<ActivityTab>>(new Set(['all']));
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [cutoffDay,    setCutoffDay]    = useState(25);
  const [showCutoff,   setShowCutoff]   = useState(false);
  const [cutoffInput,  setCutoffInput]  = useState('25');

  // custom range state
  const [customFrom, setCustomFrom] = useState<Date>(new Date());
  const [customTo,   setCustomTo]   = useState<Date>(new Date());

  // calendar picker state
  const [showPicker,   setShowPicker]   = useState(false);
  const [pickingDate,  setPickingDate]  = useState<'from' | 'to'>('from');
  const [pickerMonth,  setPickerMonth]  = useState(new Date().getMonth());
  const [pickerYear,   setPickerYear]   = useState(new Date().getFullYear());

  const range = activePreset === 'custom'
    ? { from: customFrom, to: customTo }
    : getRangeForPreset(activePreset, cutoffDay);

  // ── load saved cutoff day ──
  useQuery({
    queryKey: ['user-settings', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('cutoff_day')
        .eq('user_id', userId)
        .maybeSingle();
      if (data?.cutoff_day) {
        setCutoffDay(data.cutoff_day);
        setCutoffInput(String(data.cutoff_day));
      }
      return data;
    },
    enabled: !!userId,
  });

  const saveCutoff = useMutation({
    mutationFn: async (day: number) => {
      await supabase.from('user_settings').upsert(
        { user_id: userId, cutoff_day: day, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-settings', userId] }),
  });

  const handleSaveCutoff = () => {
    const day = parseInt(cutoffInput);
    if (!day || day < 1 || day > 31) return;
    setCutoffDay(day);
    saveCutoff.mutate(day);
    setShowCutoff(false);
    setActivePreset('cutoff');
  };

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['dashboard-activities', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('*, categories:category_id(name,color,icon), space:space_id(name)')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  const isAll = selectedTabs.has('all');
  const currentTypes = isAll
    ? ['income','savings','expense','payable','receivable']
    : ACTIVITY_TABS.filter(t => t.key !== 'all' && selectedTabs.has(t.key)).flatMap(t => t.types as string[]);

  const filtered = recordings.filter(r => {
    if (!currentTypes.includes(r.type)) return false;
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date < range.from) return false;
    const to = new Date(range.to); to.setHours(23, 59, 59);
    if (date > to) return false;
    // status filter (loans / receivables only)
    if (statusFilter === 'active'   && r.type === 'payable'    && r.status === 'paid')     return false;
    if (statusFilter === 'paid'     && r.type === 'payable'    && r.status !== 'paid')     return false;
    if (statusFilter === 'pending'  && r.type === 'receivable' && r.status === 'received') return false;
    if (statusFilter === 'received' && r.type === 'receivable' && r.status !== 'received') return false;
    return true;
  });

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);
  const activeTabData = ACTIVITY_TABS.find(t => t.key === (isAll ? 'all' : [...selectedTabs][0])) ?? ACTIVITY_TABS[0];

  // ── summary stats per tab ──
  const allRecordings = (types: string[]) => recordings.filter(r => {
    if (!types.includes(r.type)) return false;
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date < range.from) return false;
    const to = new Date(range.to); to.setHours(23, 59, 59);
    return date <= to;
  });

  const moneyInTotal    = allRecordings(['income','savings']).reduce((s, r) => s + Number(r.amount), 0);
  const moneyOutTotal   = allRecordings(['expense']).reduce((s, r) => s + Number(r.amount), 0);
  const loansActive     = allRecordings(['payable']).filter(r => r.status !== 'paid').length;
  const loansPaid       = allRecordings(['payable']).filter(r => r.status === 'paid').length;
  const receivablesPending  = allRecordings(['receivable']).filter(r => r.status !== 'received').length;
  const receivablesReceived = allRecordings(['receivable']).filter(r => r.status === 'received').length;

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtFull  = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rangeLabel = isSameDay(range.from, range.to)
    ? fmtFull(range.from)
    : `${fmtShort(range.from)} – ${fmtFull(range.to)}`;

  // ── calendar helpers ──
  const firstDay    = new Date(pickerYear, pickerMonth, 1).getDay();
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));

  const isInRange = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    return d > customFrom && d < customTo;
  };
  const isEdge = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    return isSameDay(d, customFrom) || isSameDay(d, customTo);
  };

  const handleDayPress = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    if (pickingDate === 'from') {
      setCustomFrom(d); setCustomTo(d); setPickingDate('to');
    } else {
      if (d < customFrom) { setCustomFrom(d); setPickingDate('to'); }
      else { setCustomTo(d); setShowPicker(false); setPickingDate('from'); }
    }
  };

  const handleTabToggle = (key: ActivityTab) => {
    setStatusFilter(null);
    if (key === 'all') {
      setSelectedTabs(new Set(['all']));
      return;
    }
    setSelectedTabs(prev => {
      const next = new Set(prev);
      next.delete('all');
      if (next.has(key)) {
        next.delete(key);
        if (next.size === 0) return new Set(['all']);
      } else {
        next.add(key);
        if (next.size === 4) return new Set(['all']);
      }
      return next;
    });
  };

  const handlePreset = (key: Preset) => {
    if (key === 'cutoff') {
      setCutoffInput(String(cutoffDay));
      setShowCutoff(true);
      return;
    }
    if (key === 'custom') {
      const r = getRangeForPreset('this-month', cutoffDay);
      setCustomFrom(r.from); setCustomTo(r.to);
      setPickingDate('from'); setShowPicker(true);
    }
    setActivePreset(key);
  };

  const typeLabel = (r: any) => {
    if (r.type === 'income')     return { label: 'money in',                color: P.green  };
    if (r.type === 'savings')    return { label: 'savings',                 color: P.green  };
    if (r.type === 'expense')    return { label: 'money out',               color: P.orange };
    if (r.type === 'payable')    return r.status === 'paid'
      ? { label: 'loan · paid',    color: P.green  }
      : r.status === 'partial'
      ? { label: 'loan · partial', color: P.gold   }
      : { label: 'loan',           color: P.gold   };
    if (r.type === 'receivable') return r.status === 'received'
      ? { label: 'receivable · received', color: P.green }
      : r.status === 'partial'
      ? { label: 'receivable · partial',  color: P.gold  }
      : { label: 'receivable',            color: P.blue  };
    return null;
  };

  return (
    <SafeAreaView style={s.container}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Activities</Text>
          <Text style={s.subtitle}>your financial overview</Text>
        </View>
      </View>

      {/* ── Preset chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.presetRow}
        style={s.presetScroll}
      >
        {PRESETS.map(p => {
          const isActive = p.key === activePreset;
          return (
            <TouchableOpacity
              key={p.key}
              style={[s.presetChip, isActive && s.presetChipActive]}
              onPress={() => handlePreset(p.key)}
              activeOpacity={0.75}
            >
              {p.key === 'cutoff' && (
                <Ionicons name="cut-outline" size={12} color={isActive ? '#fff' : P.secondary} />
              )}
              {p.key === 'custom' && (
                <Ionicons name="calendar-outline" size={12} color={isActive ? '#fff' : P.secondary} />
              )}
              <Text style={[s.presetChipText, isActive && s.presetChipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Range label ── */}
      <View style={s.rangeLabelRow}>
        <Ionicons name="time-outline" size={11} color={P.muted} />
        <Text style={s.rangeLabel}>{rangeLabel}</Text>
        {activePreset === 'custom' && (
          <TouchableOpacity onPress={() => { setPickingDate('from'); setShowPicker(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.rangeLabelEdit}>edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Summary card ── */}
      {isAll ? (
        <View style={s.summaryCard}>
          <View style={s.summaryGrid}>
            <View style={[s.summaryGridItem, { borderLeftColor: P.green }]}>
              <Text style={s.summaryGridLabel}>Money In</Text>
              <Text style={[s.summaryGridValue, { color: P.green }]}>{fmt(moneyInTotal)}</Text>
            </View>
            <View style={[s.summaryGridItem, { borderLeftColor: P.orange }]}>
              <Text style={s.summaryGridLabel}>Money Out</Text>
              <Text style={[s.summaryGridValue, { color: P.orange }]}>{fmt(moneyOutTotal)}</Text>
            </View>
            <View style={[s.summaryGridItem, { borderLeftColor: P.gold }]}>
              <Text style={s.summaryGridLabel}>Loans</Text>
              <Text style={[s.summaryGridValue, { color: P.gold }]}>{loansActive} active</Text>
              <Text style={[s.summaryGridSub, { color: P.green }]}>{loansPaid} paid</Text>
            </View>
            <View style={[s.summaryGridItem, { borderLeftColor: P.blue }]}>
              <Text style={s.summaryGridLabel}>Receivables</Text>
              <Text style={[s.summaryGridValue, { color: P.blue }]}>{receivablesPending} pending</Text>
              <Text style={[s.summaryGridSub, { color: P.green }]}>{receivablesReceived} received</Text>
            </View>
          </View>
        </View>
      ) : selectedTabs.has('loans') && selectedTabs.size === 1 ? (
        <View style={[s.summaryCard, { borderLeftColor: P.gold }]}>
          <View style={s.summaryTop}>
            <View style={[s.summaryIcon, { backgroundColor: P.goldLight }]}>
              <Ionicons name="cash-outline" size={18} color={P.gold} />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <View style={s.statusFilterRow}>
                {([{ key: 'active', label: `${loansActive} active`, color: P.gold }, { key: 'paid', label: `${loansPaid} paid`, color: P.green }] as const).map(f => (
                  <TouchableOpacity
                    key={f.key}
                    style={[s.statusChip, statusFilter === f.key && { backgroundColor: f.color, borderColor: f.color }]}
                    onPress={() => setStatusFilter(prev => prev === f.key ? null : f.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.statusChipText, statusFilter === f.key && s.statusChipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      ) : selectedTabs.has('receivables') && selectedTabs.size === 1 ? (
        <View style={[s.summaryCard, { borderLeftColor: P.blue }]}>
          <View style={s.summaryTop}>
            <View style={[s.summaryIcon, { backgroundColor: P.blueLight }]}>
              <Ionicons name="arrow-undo-outline" size={18} color={P.blue} />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <View style={s.statusFilterRow}>
                {([{ key: 'pending', label: `${receivablesPending} pending`, color: P.gold }, { key: 'received', label: `${receivablesReceived} received`, color: P.green }] as const).map(f => (
                  <TouchableOpacity
                    key={f.key}
                    style={[s.statusChip, statusFilter === f.key && { backgroundColor: f.color, borderColor: f.color }]}
                    onPress={() => setStatusFilter(prev => prev === f.key ? null : f.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.statusChipText, statusFilter === f.key && s.statusChipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={[s.summaryCard, { borderLeftColor: activeTabData.color }]}>
          <View style={s.summaryTop}>
            <View style={[s.summaryIcon, { backgroundColor: activeTabData.bg }]}>
              <Ionicons name={activeTabData.icon as any} size={18} color={activeTabData.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.summaryTabLabel}>{[...selectedTabs].map(k => ACTIVITY_TABS.find(t => t.key === k)?.label).join(', ')}</Text>
              <Text style={s.summaryEntries}>{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</Text>
            </View>
            <Text style={[s.summaryTotal, { color: activeTabData.color }]}>
              {fmt(filtered.reduce((s, r) => s + Number(r.amount), 0))}
            </Text>
          </View>
        </View>
      )}

      {/* ── Activity tab nav 3-2 grid ── */}
      <View style={s.tabGrid}>
        <View style={s.tabRow}>
          {ACTIVITY_TABS.slice(0, 3).map(tab => {
            const isActive = selectedTabs.has(tab.key);
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tabChip, isActive && { backgroundColor: tab.color, borderColor: tab.color }]}
                onPress={() => handleTabToggle(tab.key)}
                activeOpacity={0.75}
              >
                <Ionicons name={tab.icon as any} size={12} color={isActive ? '#fff' : P.secondary} />
                <Text style={[s.tabChipText, isActive && s.tabChipTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={[s.tabRow, { justifyContent: 'center' }]}>
          {ACTIVITY_TABS.slice(3).map(tab => {
            const isActive = selectedTabs.has(tab.key);
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tabChip, { flex: 0, minWidth: '40%' }, isActive && { backgroundColor: tab.color, borderColor: tab.color }]}
                onPress={() => handleTabToggle(tab.key)}
                activeOpacity={0.75}
              >
                <Ionicons name={tab.icon as any} size={12} color={isActive ? '#fff' : P.secondary} />
                <Text style={[s.tabChipText, isActive && s.tabChipTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Divider ── */}
      <View style={s.divider} />

      {/* ── List ── */}
      {isLoading ? (
        <ActivityIndicator color={P.orange} style={{ marginTop: 48 }} />
      ) : filtered.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIconWrap}>
            <Ionicons name={activeTabData.icon as any} size={28} color={P.muted} />
          </View>
          <Text style={s.emptyTitle}>nothing here</Text>
          <Text style={s.emptyText}>no {activeTabData.label.toLowerCase()} found{'\n'}for this period</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {filtered.map((item, idx) => {
            const prevDate  = filtered[idx - 1]?.transaction_date;
            const showDate  = item.transaction_date !== prevDate;
            const dateStr   = new Date(item.transaction_date + 'T00:00:00')
              .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            const tl = typeLabel(item);

            return (
              <View key={item.id}>
                {showDate && (
                  <View style={s.dateHeaderRow}>
                    <Text style={s.dateHeaderText}>{dateStr}</Text>
                    <View style={s.dateHeaderLine} />
                  </View>
                )}
                <TouchableOpacity
                  style={s.row}
                  activeOpacity={0.7}
                  onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                >
                  <View style={[s.rowIconWrap, { backgroundColor: tl ? tl.color + '15' : P.surface }]}>
                    <Ionicons
                      name={(item.categories?.icon ?? activeTabData.icon) as any}
                      size={15}
                      color={tl?.color ?? activeTabData.color}
                    />
                  </View>
                  <View style={s.rowMid}>
                    {tl && (
                      <Text style={[s.rowCategory, { color: tl.color }]}>{tl.label}</Text>
                    )}
                    <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                    {item.space?.name && (
                      <Text style={s.rowSpace} numberOfLines={1}>{item.space.name}</Text>
                    )}
                  </View>
                  <View style={s.rowRight}>
                    <Text style={[s.rowAmount, { color: tl?.color ?? activeTabData.color }]}>
                      {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Cutoff day modal ── */}
      <ConfirmModal
        visible={showCutoff}
        onClose={() => setShowCutoff(false)}
        title="billing cutoff day"
        message="which day of the month does your billing cycle start?"
        actions={[
          { label: 'cancel', onPress: () => setShowCutoff(false), muted: true },
          { label: 'save',   onPress: handleSaveCutoff, disabled: saveCutoff.isPending },
        ]}
      >
        <View style={s.cutoffRow}>
          {[1,5,10,15,20,25,28].map(d => (
            <TouchableOpacity
              key={d}
              style={[s.cutoffChip, parseInt(cutoffInput) === d && s.cutoffChipActive]}
              onPress={() => setCutoffInput(String(d))}
            >
              <Text style={[s.cutoffChipText, parseInt(cutoffInput) === d && s.cutoffChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.cutoffInputRow}>
          <Text style={s.cutoffInputLabel}>or enter a day</Text>
          <TextInput
            style={s.cutoffInput}
            value={cutoffInput}
            onChangeText={v => setCutoffInput(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="1–31"
            placeholderTextColor={Colors.faint}
          />
        </View>
      </ConfirmModal>

      {/* ── Custom date picker modal ── */}
      <ConfirmModal
        visible={showPicker}
        onClose={() => { setShowPicker(false); setPickingDate('from'); }}
        title={pickingDate === 'from' ? 'start date' : 'end date'}
        actions={[
          { label: 'cancel', onPress: () => { setShowPicker(false); setPickingDate('from'); }, muted: true },
          { label: 'done',   onPress: () => { setShowPicker(false); setPickingDate('from'); } },
        ]}
      >
        <View style={s.pickerNav}>
          <TouchableOpacity onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); }}>
            <Ionicons name="chevron-back" size={18} color={Colors.text} />
          </TouchableOpacity>
          <Text style={s.pickerMonthText}>{MONTHS[pickerMonth].toLowerCase()} {pickerYear}</Text>
          <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}>
            <Ionicons name="chevron-forward" size={18} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <Text style={s.pickerHint}>{pickingDate === 'from' ? 'tap to set start date' : 'tap to set end date'}</Text>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          {['su','mo','tu','we','th','fr','sa'].map(d => (
            <Text key={d} style={s.calDay}>{d}</Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
          {cells.map((day, i) => {
            if (!day) return <View key={`e${i}`} style={s.calCell} />;
            const inRange = isInRange(day);
            const edge    = isEdge(day);
            const today   = isSameDay(new Date(pickerYear, pickerMonth, day), new Date());
            return (
              <TouchableOpacity
                key={day}
                style={[s.calCell, inRange && s.calCellRange, edge && s.calCellEdge, !inRange && !edge && today && s.calCellToday]}
                onPress={() => handleDayPress(day)}
              >
                <Text style={[s.calCellText, (edge || today) && s.calCellTextActive]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ConfirmModal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },

  // Header
  header: { paddingHorizontal: Spacing.page, paddingTop: 32, paddingBottom: 20 },
  title:    { fontFamily: IB, fontSize: 30, color: P.text, letterSpacing: -0.8 },
  subtitle: { fontFamily: I,  fontSize: 12, color: P.secondary, marginTop: 4, letterSpacing: 0.2 },

  // Preset chips
  presetScroll: { flexGrow: 0, flexShrink: 0 },
  presetRow: { paddingHorizontal: Spacing.page, gap: 8, paddingBottom: 2 },
  presetChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: Radius.pill, borderWidth: 1,
    borderColor: P.border, backgroundColor: P.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  presetChipActive: { backgroundColor: P.text, borderColor: P.text },
  presetChipText:       { fontFamily: IM, fontSize: 12, color: P.secondary },
  presetChipTextActive: { color: '#fff' },

  // Range label
  rangeLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.page, marginTop: 10, marginBottom: 18,
  },
  rangeLabel:     { fontFamily: I, fontSize: 11, color: P.muted, flex: 1, letterSpacing: 0.1 },
  rangeLabelEdit: { fontFamily: IS, fontSize: 11, color: P.orange },

  // Summary card
  summaryCard: {
    marginHorizontal: Spacing.page, marginBottom: 20,
    backgroundColor: P.card,
    borderRadius: Radius.xl,
    borderWidth: 1, borderColor: P.border,
    borderLeftWidth: 4,
    paddingHorizontal: 18, paddingVertical: 16,
    shadowColor: '#8B7355', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  summaryIcon: { width: 42, height: 42, borderRadius: Radius.lg, justifyContent: 'center', alignItems: 'center' },
  summaryTabLabel: { fontFamily: IS, fontSize: 13, color: P.text },
  summaryEntries:  { fontFamily: I,  fontSize: 11, color: P.secondary, marginTop: 2 },
  summaryTotal:    { fontFamily: IB, fontSize: 24, letterSpacing: -0.5 },
  summaryStatRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  summaryStatLabel: { fontFamily: IM, fontSize: 12, color: P.secondary },
  summaryStatValue: { fontFamily: IB, fontSize: 17 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  summaryGridItem: { flex: 1, minWidth: '45%', borderLeftWidth: 3, paddingLeft: 10, gap: 3 },
  summaryGridLabel: { fontFamily: IM, fontSize: 11, color: P.muted },
  summaryGridValue: { fontFamily: IB, fontSize: 15 },
  summaryGridSub:   { fontFamily: IM, fontSize: 11 },

  // Activity tabs 3-2 grid
  tabGrid: { paddingHorizontal: Spacing.page, gap: 8, marginBottom: 6 },
  tabRow:  { flexDirection: 'row', gap: 8 },
  tabChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: Radius.lg, borderWidth: 1,
    borderColor: P.border, backgroundColor: P.card,
    shadowColor: '#8B7355', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  tabChipText:       { fontFamily: IM, fontSize: 12, color: P.secondary },
  tabChipTextActive: { color: '#fff', fontFamily: IS },

  // Divider
  divider: { height: 1, backgroundColor: P.border, marginHorizontal: Spacing.page, marginTop: 18, marginBottom: 6 },

  // Empty state
  emptyWrap:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingBottom: 80 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: Radius.xl, backgroundColor: P.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyTitle:    { fontFamily: IS, fontSize: 14, color: P.text },
  emptyText:     { fontFamily: I,  fontSize: 12, color: P.secondary, textAlign: 'center', lineHeight: 19 },

  // List
  list: { paddingHorizontal: Spacing.page, paddingTop: 8 },
  dateHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 10 },
  dateHeaderText: { fontFamily: IS, fontSize: 11, color: P.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  dateHeaderLine: { flex: 1, height: 1, backgroundColor: P.border },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: P.border,
  },
  rowIconWrap: { width: 40, height: 40, borderRadius: Radius.lg, justifyContent: 'center', alignItems: 'center' },
  rowMid:      { flex: 1, gap: 2 },
  rowCategory: { fontFamily: IM, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowName:     { fontFamily: IB, fontSize: 13, color: P.text },
  rowSpace:    { fontFamily: I,  fontSize: 11, color: P.muted },
  rowRight:    { alignItems: 'flex-end', gap: 4 },
  rowAmount:   { fontFamily: IB, fontSize: 15 },

  // Status filter chips (loans / receivables)
  statusFilterRow:      { flexDirection: 'row', gap: 8 },
  statusChip:           { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.lg, borderWidth: 1, borderColor: P.border, backgroundColor: P.surface },
  statusChipText:       { fontFamily: IS, fontSize: 13, color: P.secondary },
  statusChipTextActive: { color: '#fff' },

  // Cutoff modal
  cutoffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginBottom: 12 },
  cutoffChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.pill, borderWidth: 1,
    borderColor: P.border, backgroundColor: P.surface,
  },
  cutoffChipActive:     { backgroundColor: P.green, borderColor: P.green },
  cutoffChipText:       { fontFamily: IM, fontSize: 12, color: P.secondary },
  cutoffChipTextActive: { color: '#fff' },
  cutoffInputRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  cutoffInputLabel: { fontFamily: IM, fontSize: 12, color: P.secondary, flex: 1 },
  cutoffInput: {
    backgroundColor: P.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: P.border,
    paddingHorizontal: 12, paddingVertical: 8,
    fontFamily: IB, fontSize: 16, color: P.text,
    width: 70, textAlign: 'center',
  },

  // Calendar
  pickerNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 4, marginBottom: 10,
  },
  pickerMonthText: { fontFamily: IS, fontSize: 14, color: P.text },
  pickerHint:      { fontFamily: I,  fontSize: 10, color: P.orange, marginBottom: 8 },
  calDay:       { flex: 1, textAlign: 'center', fontFamily: IM, fontSize: 10, color: P.muted },
  calCell:      { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellRange: { backgroundColor: P.orange + '22', borderRadius: 0 },
  calCellEdge:  { backgroundColor: P.orange },
  calCellToday: { backgroundColor: P.surface },
  calCellText:  { fontFamily: I,  fontSize: 13, color: P.text },
  calCellTextActive: { fontFamily: IS, color: '#fff' },
});
