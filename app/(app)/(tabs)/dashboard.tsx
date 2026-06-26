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

const I   = 'PlusJakartaSans_400Regular';
const IM  = 'PlusJakartaSans_500Medium';
const IS  = 'PlusJakartaSans_600SemiBold';
const IB  = 'PlusJakartaSans_700Bold';
const FB  = 'PlusJakartaSans_600SemiBold';
const FBK = 'PlusJakartaSans_700Bold';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── High-contrast dark palette ──────────────────────────────────────────────
const P = {
  bg:          '#1C2632',
  sheet:       '#FFFFFF',
  card:        '#243041',
  cardDeep:    '#2D3A50',
  border:      '#2D3A50',
  text:        '#FFFFFF',
  textDark:    '#1C2632',
  secondary:   '#8A8D9F',
  muted:       '#5A5D70',
  yellow:      '#F5A623',
  yellowDark:  '#C47E00',
  green:       '#00B894',
  greenLight:  '#00B89422',
  orange:      '#FF7675',
  orangeLight: '#FF767522',
  gold:        '#6C5CE7',
  goldLight:   '#6C5CE722',
  blue:        '#00CEC9',
  blueLight:   '#00CEC922',
} as const;

const ACTIVITY_TABS = [
  { key: 'all',         label: 'All',         icon: 'apps-outline',              types: ['income','savings','expense','payable','receivable'], color: P.yellow, bg: P.card       },
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

  // ── range navigation ──
  const shiftRange = (dir: 1 | -1) => {
    if (activePreset === 'this-month') {
      const newFrom = new Date(range.from.getFullYear(), range.from.getMonth() + dir, 1);
      setActivePreset('custom');
      setCustomFrom(newFrom);
      setCustomTo(new Date(newFrom.getFullYear(), newFrom.getMonth() + 1, 0));
    } else if (activePreset === 'last-30') {
      const days = 30 * dir;
      const newFrom = new Date(range.from); newFrom.setDate(newFrom.getDate() + days);
      const newTo   = new Date(range.to);   newTo.setDate(newTo.getDate() + days);
      setActivePreset('custom'); setCustomFrom(newFrom); setCustomTo(newTo);
    } else if (activePreset === 'cutoff') {
      const newFrom = new Date(range.from); newFrom.setMonth(newFrom.getMonth() + dir);
      const newTo   = new Date(range.to);   newTo.setMonth(newTo.getMonth() + dir);
      setActivePreset('custom'); setCustomFrom(newFrom); setCustomTo(newTo);
    } else {
      const diff = range.to.getTime() - range.from.getTime();
      const newFrom = new Date(range.from.getTime() + diff * dir + 86400000 * dir);
      const newTo   = new Date(newFrom.getTime() + diff);
      setCustomFrom(newFrom); setCustomTo(newTo);
    }
  };

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

      {/* ── Dark top section ── */}
      <View style={s.darkTop}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Activities ✦</Text>
            <Text style={s.subtitle}>here's how you're doing</Text>
          </View>
        </View>

        {/* Preset chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presetRow} style={s.presetScroll}>
          {PRESETS.map(p => {
            const isActive = p.key === activePreset;
            return (
              <TouchableOpacity key={p.key} style={[s.presetChip, isActive && s.presetChipActive]} onPress={() => handlePreset(p.key)} activeOpacity={0.75}>
                {p.key === 'cutoff' && <Ionicons name="cut-outline" size={12} color={isActive ? P.textDark : P.secondary} />}
                {p.key === 'custom' && <Ionicons name="calendar-outline" size={12} color={isActive ? P.textDark : P.secondary} />}
                <Text style={[s.presetChipText, isActive && s.presetChipTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Range label */}
        <View style={s.rangeLabelRow}>
          <TouchableOpacity onPress={() => shiftRange(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={16} color={P.secondary} />
          </TouchableOpacity>
          <Ionicons name="time-outline" size={11} color={P.muted} style={{ marginHorizontal: 4 }} />
          <Text style={s.rangeLabel}>{rangeLabel}</Text>
          {activePreset === 'custom' && (
            <TouchableOpacity onPress={() => { setPickingDate('from'); setShowPicker(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.rangeLabelEdit}>edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => shiftRange(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={16} color={P.secondary} />
          </TouchableOpacity>
        </View>

        {/* Summary stats row */}
        {isAll ? (
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statValue}>{fmt(moneyInTotal)}</Text>
              <Text style={s.statLabel}>Money In</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statValue}>{fmt(moneyOutTotal)}</Text>
              <Text style={s.statLabel}>Money Out</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={[s.statValue, { color: P.gold }]}>{loansActive}</Text>
              <Text style={s.statLabel}>Loans</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={[s.statValue, { color: P.blue }]}>{receivablesPending}</Text>
              <Text style={s.statLabel}>Receivables</Text>
            </View>
          </View>
        ) : (
          <View style={s.focusCard}>
            <View style={[s.focusIcon, { backgroundColor: activeTabData.color }]}>
              <Ionicons name={activeTabData.icon as any} size={16} color={activeTabData.color === P.yellow ? P.textDark : '#fff'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.focusLabel}>{[...selectedTabs].map(k => ACTIVITY_TABS.find(t => t.key === k)?.label).join(', ')}</Text>
              <Text style={s.focusEntries}>{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</Text>
            </View>
            <Text style={[s.focusTotal, { color: activeTabData.color }]}>
              {fmt(filtered.reduce((s, r) => s + Number(r.amount), 0))}
            </Text>
          </View>
        )}

        {/* Tab filter buttons */}
        <View style={s.tabRow}>
          {ACTIVITY_TABS.map(tab => {
            const isActive = selectedTabs.has(tab.key);
            return (
              <TouchableOpacity key={tab.key} style={s.tabWrap} onPress={() => handleTabToggle(tab.key)} activeOpacity={0.75}>
                <View style={[s.tabCircle, { backgroundColor: isActive ? tab.color : P.card }]}>
                  <Ionicons name={tab.icon as any} size={16} color={isActive ? (tab.color === P.yellow ? P.textDark : '#fff') : P.secondary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── White bottom sheet ── */}
      <View style={s.sheet}>
        {isLoading ? (
          <ActivityIndicator color={P.yellow} style={{ marginTop: 48 }} />
        ) : filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={[s.emptyIconWrap, { backgroundColor: activeTabData.bg }]}>
              <Ionicons name={activeTabData.icon as any} size={28} color={activeTabData.color} />
            </View>
            <Text style={s.emptyTitle}>nothing here</Text>
            <Text style={s.emptyText}>no {activeTabData.label.toLowerCase()} found{`\n`}for this period</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
            {filtered.map((item, idx) => {
              const prevDate = filtered[idx - 1]?.transaction_date;
              const showDate = item.transaction_date !== prevDate;
              const dateStr  = new Date(item.transaction_date + 'T00:00:00')
                .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
              const tl = typeLabel(item);
              return (
                <View key={item.id}>
                  {showDate && (
                    <View style={s.dateHeaderRow}>
                      <Text style={s.dateHeaderText}>{dateStr}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}>
                    <View style={[s.rowIconWrap, { backgroundColor: tl?.color ?? P.secondary }]}>
                      <Ionicons name={(item.categories?.icon ?? activeTabData.icon) as any} size={16} color="#fff" />
                    </View>
                    <View style={s.rowMid}>
                      <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.rowCategory}>{tl?.label ?? activeTabData.label}{item.space?.name ? ` · ${item.space.name}` : ''}</Text>
                    </View>
                    <Text style={[s.rowAmount, { color: tl?.color ?? P.secondary }]}>
                      {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>

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

  // Dark top
  darkTop: { backgroundColor: P.bg, paddingBottom: 0 },

  // Header
  header:   { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 8 },
  title:    { fontFamily: FBK, fontSize: 26, color: P.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: I,   fontSize: 12, color: P.secondary, marginTop: 3, lineHeight: 18 },

  // Preset chips
  presetScroll: { flexGrow: 0, flexShrink: 0 },
  presetRow:    { paddingHorizontal: 24, gap: 8, paddingBottom: 0 },
  presetChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: P.card,
  },
  presetChipActive:     { backgroundColor: P.yellow },
  presetChipText:       { fontFamily: IM, fontSize: 11, color: P.secondary },
  presetChipTextActive: { color: P.textDark, fontFamily: IS },

  // Range label
  rangeLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 24, marginTop: 10, marginBottom: 12,
  },
  rangeLabel:     { fontFamily: IM, fontSize: 11, color: '#8A8D9F', flex: 1, letterSpacing: 0.2 },
  rangeLabelEdit: { fontFamily: IS, fontSize: 11, color: P.yellow },

  // Stats row
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, marginBottom: 14,
  },
  statItem:    { flex: 1, alignItems: 'center', gap: 5 },
  statValue:   { fontFamily: FBK, fontSize: 15, color: P.text, letterSpacing: -0.3 },
  statLabel:   { fontFamily: IM,  fontSize: 10, color: '#8A8D9F', letterSpacing: 0.3 },
  statDivider: { width: 1, height: 28, backgroundColor: P.border },

  // Focused summary card (non-all tabs)
  focusCard: {
    marginHorizontal: 24, marginBottom: 14,
    backgroundColor: P.card,
    borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  focusIcon:    { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  focusLabel:   { fontFamily: IS,  fontSize: 14, color: P.text },
  focusEntries: { fontFamily: I,   fontSize: 11, color: P.secondary, marginTop: 2, lineHeight: 16 },
  focusTotal:   { fontFamily: FBK, fontSize: 22, letterSpacing: -0.5 },

  // Tab filter row
  tabRow:  { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 24, paddingBottom: 16, paddingTop: 6 },
  tabWrap: { alignItems: 'center' },
  tabCircle: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
  },

  // Off-white bottom sheet
  sheet: {
    flex: 1,
    backgroundColor: '#F8F8F6',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    overflow: 'hidden',
  },

  // Empty state
  emptyWrap:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingBottom: 80 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  emptyTitle:    { fontFamily: FB, fontSize: 16, color: '#1C2632' },
  emptyText:     { fontFamily: IM, fontSize: 13, color: '#5A5D70', textAlign: 'center', lineHeight: 21, letterSpacing: 0.2 },

  // Transaction list
  list:           { paddingHorizontal: 24, paddingTop: 28 },
  dateHeaderRow:  { marginTop: 28, marginBottom: 12 },
  dateHeaderText: { fontFamily: IS, fontSize: 10, color: '#5A5D70', letterSpacing: 1.4, textTransform: 'uppercase' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEA',
  },
  rowIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  rowMid:      { flex: 1, gap: 4 },
  rowName:     { fontFamily: FB,  fontSize: 14, color: '#1A1A1A', letterSpacing: 0.1, lineHeight: 20 },
  rowCategory: { fontFamily: IM,  fontSize: 11, color: '#6B6B6B', letterSpacing: 0.3, lineHeight: 16 },
  rowAmount:   { fontFamily: FBK, fontSize: 15, letterSpacing: -0.4 },

  // Status filter chips
  statusFilterRow:      { flexDirection: 'row', gap: 10 },
  statusChip:           { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: P.cardDeep },
  statusChipText:       { fontFamily: IS, fontSize: 13, color: P.secondary },
  statusChipTextActive: { color: '#fff' },

  // Cutoff modal
  cutoffRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginBottom: 12 },
  cutoffChip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: P.card },
  cutoffChipActive:     { backgroundColor: P.green },
  cutoffChipText:       { fontFamily: IM, fontSize: 12, color: P.secondary },
  cutoffChipTextActive: { color: '#fff' },
  cutoffInputRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  cutoffInputLabel:     { fontFamily: I, fontSize: 12, color: P.secondary, flex: 1 },
  cutoffInput: {
    backgroundColor: P.card, borderRadius: Radius.sm,
    paddingHorizontal: 12, paddingVertical: 8,
    fontFamily: FB, fontSize: 16, color: P.text,
    width: 70, textAlign: 'center',
  },

  // Calendar
  pickerNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 4, marginBottom: 10,
  },
  pickerMonthText:   { fontFamily: FB, fontSize: 15, color: P.text },
  pickerHint:        { fontFamily: I,  fontSize: 10, color: P.yellow, marginBottom: 8 },
  calDay:            { flex: 1, textAlign: 'center', fontFamily: I, fontSize: 10, color: P.muted },
  calCell:           { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellRange:      { backgroundColor: P.yellow + '22', borderRadius: 0 },
  calCellEdge:       { backgroundColor: P.yellow },
  calCellToday:      { backgroundColor: P.card },
  calCellText:       { fontFamily: I,  fontSize: 13, color: P.text },
  calCellTextActive: { fontFamily: IS, color: P.textDark },
});
