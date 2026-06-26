import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors, Radius } from '@/components/ui/theme';
import { useRouter } from 'expo-router';

const I   = 'PlusJakartaSans_400Regular';
const IM  = 'PlusJakartaSans_500Medium';
const IS  = 'PlusJakartaSans_600SemiBold';
const IB  = 'PlusJakartaSans_700Bold';
const FB  = 'PlusJakartaSans_600SemiBold';
const FBK = 'PlusJakartaSans_700Bold';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Light dirty-white palette ───────────────────────────────────────────────
const P = {
  bg:          '#F2F4F6',
  sheet:       '#F2F4F6',
  card:        '#FFFFFF',
  cardDark:    '#1A1A1A',
  cardDeep:    '#111111',
  border:      '#E8E8E8',
  text:        '#1A1A1A',
  textLight:   '#FFFFFF',
  textDark:    '#1A1A1A',
  secondary:   '#8A8D9F',
  muted:       '#AAAAAA',
  accent:      '#D4EAE4',
  yellow:      '#F5A623',
  yellowDark:  '#C47E00',
  green:       '#00B894',
  greenLight:  '#D4EAE4',
  orange:      '#FF7675',
  orangeLight: '#FF767522',
  gold:        '#6C5CE7',
  goldLight:   '#6C5CE722',
  blue:        '#00CEC9',
  blueLight:   '#00CEC922',
} as const;

const ACTIVITY_TABS = [
  { key: 'all',         label: 'All',         icon: 'apps-outline',              types: ['income','savings','expense','payable','receivable'], color: P.yellow, bg: P.cardDark   },
  { key: 'money-in',    label: 'Money In',    icon: 'arrow-down-circle-outline', types: ['income','savings'], color: P.green,  bg: P.greenLight  },
  { key: 'money-out',   label: 'Money Out',   icon: 'arrow-up-circle-outline',   types: ['expense'],         color: P.orange, bg: P.orangeLight },
  { key: 'loans',       label: 'Loans',       icon: 'cash-outline',              types: ['payable'],         color: P.gold,   bg: P.goldLight   },
  { key: 'receivables', label: 'Receivables', icon: 'arrow-undo-outline',        types: ['receivable'],      color: P.blue,   bg: P.blueLight   },
] as const;

type ActivityTab = typeof ACTIVITY_TABS[number]['key'];

type Preset = 'this-month' | 'last-30' | 'cutoff' | 'custom';

const PRESETS: { key: Preset; label: string; icon: string }[] = [
  { key: 'this-month', label: 'This Month', icon: 'calendar-outline'   },
  { key: 'last-30',    label: 'Last 30d',   icon: 'time-outline'       },
  { key: 'cutoff',     label: 'Cutoff',     icon: 'cut-outline'        },
  { key: 'custom',     label: 'Custom',     icon: 'options-outline'    },
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
  const [cutoffInput,  setCutoffInput]  = useState('25');
  const [showDateModal,  setShowDateModal]  = useState(false);
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set(['all']));

  // custom range state
  const [customFrom, setCustomFrom] = useState<Date>(new Date());
  const [customTo,   setCustomTo]   = useState<Date>(new Date());

  // calendar picker state
  const [pickingDate,  setPickingDate]  = useState<'from' | 'to'>('from');
  const [pickerMonth,  setPickerMonth]  = useState(new Date().getMonth());
  const [pickerYear,   setPickerYear]   = useState(new Date().getFullYear());

  const range = activePreset === 'custom'
    ? { from: customFrom, to: customTo }
    : getRangeForPreset(activePreset, cutoffDay);

  // ── load saved settings ──
  useQuery({
    queryKey: ['user-settings', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('cutoff_day, dashboard_preset, dashboard_custom_from, dashboard_custom_to, dashboard_space_ids')
        .eq('user_id', userId)
        .maybeSingle();
      if (!data) return data;
      if (data.cutoff_day) { setCutoffDay(data.cutoff_day); setCutoffInput(String(data.cutoff_day)); }
      if (data.dashboard_preset) setActivePreset(data.dashboard_preset as Preset);
      if (data.dashboard_custom_from) setCustomFrom(new Date(data.dashboard_custom_from));
      if (data.dashboard_custom_to)   setCustomTo(new Date(data.dashboard_custom_to));
      if (data.dashboard_space_ids) {
        const ids = (data.dashboard_space_ids as string).split(',').filter(Boolean);
        setSelectedSpaces(new Set(ids.length ? ids : ['all']));
      }
      return data;
    },
    enabled: !!userId,
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      await supabase.from('user_settings').upsert(
        { user_id: userId, ...patch, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-settings', userId] }),
  });

  const applyPreset = (key: Preset, cutoff?: number) => {
    const day = cutoff ?? cutoffDay;
    if (key === 'cutoff' && cutoff) { setCutoffDay(cutoff); setCutoffInput(String(cutoff)); }
    setActivePreset(key);
    const patch: Record<string, any> = { dashboard_preset: key };
    if (key === 'cutoff' && cutoff) patch.cutoff_day = cutoff;
    if (key === 'custom') {
      patch.dashboard_custom_from = customFrom.toISOString();
      patch.dashboard_custom_to   = customTo.toISOString();
    }
    saveSettings.mutate(patch);
  };

  const applyCustomRange = (from: Date, to: Date) => {
    setCustomFrom(from); setCustomTo(to);
    setActivePreset('custom');
    saveSettings.mutate({
      dashboard_preset: 'custom',
      dashboard_custom_from: from.toISOString(),
      dashboard_custom_to:   to.toISOString(),
    });
  };

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces-list', userId],
    queryFn: async () => {
      const { data } = await supabase.from('spaces').select('id,name').eq('user_id', userId).order('name');
      return data ?? [];
    },
    enabled: !!userId,
  });

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

  const isAllSpaces = selectedSpaces.has('all');

  const filtered = recordings.filter(r => {
    if (!currentTypes.includes(r.type)) return false;
    if (!isAllSpaces && !selectedSpaces.has(r.space_id)) return false;
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date < range.from) return false;
    const to = new Date(range.to); to.setHours(23, 59, 59);
    if (date > to) return false;
    if (statusFilter === 'active'   && r.type === 'payable'    && r.status === 'paid')     return false;
    if (statusFilter === 'paid'     && r.type === 'payable'    && r.status !== 'paid')     return false;
    if (statusFilter === 'pending'  && r.type === 'receivable' && r.status === 'received') return false;
    if (statusFilter === 'received' && r.type === 'receivable' && r.status !== 'received') return false;
    return true;
  });

  const toggleSpace = (id: string) => {
    setSelectedSpaces(prev => {
      const next = new Set(prev);
      if (id === 'all') return new Set(['all']);
      next.delete('all');
      if (next.has(id)) { next.delete(id); if (next.size === 0) return new Set(['all']); }
      else next.add(id);
      return next;
    });
    // persist after state settles
    setTimeout(() => {
      setSelectedSpaces(prev => {
        const ids = [...prev].filter(x => x !== 'all');
        saveSettings.mutate({ dashboard_space_ids: ids.join(',') });
        return prev;
      });
    }, 0);
  };

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);
  const activeTabData = ACTIVITY_TABS.find(t => t.key === (isAll ? 'all' : [...selectedTabs][0])) ?? ACTIVITY_TABS[0];
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

  const fmt     = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const fmtAbbr = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'M';
    if (n >= 1_000)     return (n / 1_000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'K';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2 });
  };
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
      else { applyCustomRange(customFrom, d); setPickingDate('from'); }
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

  const handlePresetSelect = (key: Preset) => {
    if (key === 'custom') {
      if (activePreset !== 'custom') {
        const r = getRangeForPreset('this-month', cutoffDay);
        setCustomFrom(r.from); setCustomTo(r.to);
      }
      setPickingDate('from');
    }
    applyPreset(key);
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

      {/* ── Floating top section ── */}
      <View style={s.topSection}>

        {/* Header card */}
        <View style={s.headerCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Activities ✦</Text>
            <Text style={s.subtitle}>here's how you're doing</Text>
          </View>
          {/* Date + Spaces buttons */}
          <View style={s.filterBtns}>
            <TouchableOpacity style={s.filterBtn} onPress={() => setShowDateModal(true)} activeOpacity={0.75}>
              <Ionicons name="calendar-outline" size={13} color={P.yellow} />
              <Text style={s.filterBtnText}>{rangeLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.filterBtn, !isAllSpaces && s.filterBtnActive]}
              onPress={() => setShowSpaceModal(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="layers-outline" size={13} color={!isAllSpaces ? P.textDark : P.secondary} />
              <Text style={[s.filterBtnText, !isAllSpaces && s.filterBtnTextActive]}>
                {isAllSpaces ? 'All Spaces' : `${selectedSpaces.size} space${selectedSpaces.size > 1 ? 's' : ''}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats + tabs — dark floating card */}
        <View style={s.statsCard}>
        {(() => {
          const hasIn   = selectedTabs.has('money-in');
          const hasOut  = selectedTabs.has('money-out');
          const hasLoan = selectedTabs.has('loans');
          const hasRec  = selectedTabs.has('receivables');
          const filteredTotal = filtered.reduce((sum, r) => sum + Number(r.amount), 0);

          if (isAll) return (
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statValue}>{fmtAbbr(moneyInTotal)}</Text>
                <Text style={s.statLabel}>Money In</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{fmtAbbr(moneyOutTotal)}</Text>
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
          );

          // loans only
          if (hasLoan && !hasIn && !hasOut && !hasRec) return (
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: P.gold }]}>{loansActive}</Text>
                <Text style={s.statLabel}>Active</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: P.green }]}>{loansPaid}</Text>
                <Text style={s.statLabel}>Paid</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: P.gold }]}>{fmtAbbr(filteredTotal)}</Text>
                <Text style={s.statLabel}>Total</Text>
              </View>
            </View>
          );

          // receivables only
          if (hasRec && !hasIn && !hasOut && !hasLoan) return (
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: P.blue }]}>{receivablesPending}</Text>
                <Text style={s.statLabel}>Pending</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: P.green }]}>{receivablesReceived}</Text>
                <Text style={s.statLabel}>Received</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: P.blue }]}>{fmtAbbr(filteredTotal)}</Text>
                <Text style={s.statLabel}>Total</Text>
              </View>
            </View>
          );

          // loans + receivables
          if (hasLoan && hasRec && !hasIn && !hasOut) return (
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: P.gold }]}>{loansActive}</Text>
                <Text style={s.statLabel}>Loans</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: P.blue }]}>{receivablesPending}</Text>
                <Text style={s.statLabel}>Pending</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{filtered.length}</Text>
                <Text style={s.statLabel}>Entries</Text>
              </View>
            </View>
          );

          // any combo with both in + out (with or without loans/receivables)
          if (hasIn && hasOut) return (
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: P.green }]}>{fmtAbbr(moneyInTotal)}</Text>
                <Text style={s.statLabel}>Total In</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: P.orange }]}>{fmtAbbr(moneyOutTotal)}</Text>
                <Text style={s.statLabel}>Total Out</Text>
              </View>
              {(hasLoan || hasRec) && <View style={s.statDivider} />}
              {hasLoan && (
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: P.gold }]}>{loansActive}</Text>
                  <Text style={s.statLabel}>Loans</Text>
                </View>
              )}
              {hasRec && (
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: P.blue }]}>{receivablesPending}</Text>
                  <Text style={s.statLabel}>Pending</Text>
                </View>
              )}
            </View>
          );

          // money-in only
          if (hasIn) return (
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: P.green }]}>{fmtAbbr(moneyInTotal)}</Text>
                <Text style={s.statLabel}>Total In</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{filtered.length}</Text>
                <Text style={s.statLabel}>Entries</Text>
              </View>
            </View>
          );

          // money-out only
          if (hasOut) return (
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: P.orange }]}>{fmtAbbr(moneyOutTotal)}</Text>
                <Text style={s.statLabel}>Total Out</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{filtered.length}</Text>
                <Text style={s.statLabel}>Entries</Text>
              </View>
            </View>
          );

          // fallback
          return (
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: activeTabData.color }]}>{fmtAbbr(filteredTotal)}</Text>
                <Text style={s.statLabel}>Total</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{filtered.length}</Text>
                <Text style={s.statLabel}>Entries</Text>
              </View>
            </View>
          );
        })()}

        {/* Tab filter buttons */}
        <View style={s.tabRow}>
          {ACTIVITY_TABS.map(tab => {
            const isActive = selectedTabs.has(tab.key);
            return (
              <TouchableOpacity key={tab.key} style={s.tabWrap} onPress={() => handleTabToggle(tab.key)} activeOpacity={0.75}>
                <View style={[s.tabCircle, { backgroundColor: isActive ? tab.color : '#2A2A2A' }]}>
                  <Ionicons name={tab.icon as any} size={16} color={isActive ? (tab.color === P.yellow ? P.textDark : '#fff') : P.secondary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        </View>{/* end statsCard */}
      </View>{/* end topSection */}

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

      {/* ── Date modal ── */}
      <BottomSheet visible={showDateModal} onClose={() => setShowDateModal(false)} title="date range">
        {/* Preset options */}
        <View style={s.modalPresetRow}>
          {PRESETS.map(p => {
            const active = p.key === activePreset;
            return (
              <TouchableOpacity
                key={p.key}
                style={[s.modalPresetChip, active && s.modalPresetChipActive]}
                onPress={() => handlePresetSelect(p.key)}
                activeOpacity={0.75}
              >
                <Ionicons name={p.icon as any} size={13} color={active ? P.textDark : P.secondary} />
                <Text style={[s.modalPresetText, active && s.modalPresetTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Cutoff day input — shown when cutoff selected */}
        {activePreset === 'cutoff' && (
          <View style={s.cutoffRow}>
            <Text style={s.cutoffLabel}>billing cycle starts on day</Text>
            <View style={s.cutoffChips}>
              {[1,5,10,15,20,25,28].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.cutoffChip, parseInt(cutoffInput) === d && s.cutoffChipActive]}
                  onPress={() => { setCutoffInput(String(d)); applyPreset('cutoff', d); }}
                >
                  <Text style={[s.cutoffChipText, parseInt(cutoffInput) === d && s.cutoffChipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.cutoffInputRow}>
              <Text style={s.cutoffInputLabel}>or type a day</Text>
              <TextInput
                style={s.cutoffInput}
                value={cutoffInput}
                onChangeText={v => setCutoffInput(v.replace(/[^0-9]/g, ''))}
                onEndEditing={() => {
                  const d = parseInt(cutoffInput);
                  if (d >= 1 && d <= 31) applyPreset('cutoff', d);
                }}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="1–31"
                placeholderTextColor={Colors.faint}
              />
            </View>
          </View>
        )}

        {/* Calendar — shown when custom selected */}
        {activePreset === 'custom' && (
          <View style={s.calWrap}>
            <Text style={s.calHint}>
              {pickingDate === 'from' ? 'tap start date' : 'tap end date'}
            </Text>
            <View style={s.pickerNav}>
              <TouchableOpacity onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); }}>
                <Ionicons name="chevron-back" size={18} color={P.text} />
              </TouchableOpacity>
              <Text style={s.pickerMonthText}>{MONTHS[pickerMonth].toLowerCase()} {pickerYear}</Text>
              <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}>
                <Ionicons name="chevron-forward" size={18} color={P.text} />
              </TouchableOpacity>
            </View>
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
          </View>
        )}
      </BottomSheet>

      {/* ── Spaces modal ── */}
      <BottomSheet visible={showSpaceModal} onClose={() => setShowSpaceModal(false)} title="filter by space">
        <View style={s.spaceChips}>
          <TouchableOpacity
            style={[s.spaceChip, isAllSpaces && s.spaceChipActive]}
            onPress={() => toggleSpace('all')}
            activeOpacity={0.75}
          >
            <Text style={[s.spaceChipText, isAllSpaces && s.spaceChipTextActive]}>All</Text>
          </TouchableOpacity>
          {spaces.map((sp: any) => {
            const active = selectedSpaces.has(sp.id);
            return (
              <TouchableOpacity
                key={sp.id}
                style={[s.spaceChip, active && s.spaceChipActive]}
                onPress={() => toggleSpace(sp.id)}
                activeOpacity={0.75}
              >
                <Text style={[s.spaceChipText, active && s.spaceChipTextActive]}>{sp.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  topSection: { paddingHorizontal: 16, paddingTop: 20, gap: 12 },

  // Header floating white card
  headerCard: {
    backgroundColor: P.card,
    borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 18,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  title:    { fontFamily: FBK, fontSize: 24, color: P.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: I,   fontSize: 12, color: P.secondary, marginTop: 3, lineHeight: 18 },

  // Stats + tabs dark floating card
  statsCard: {
    backgroundColor: P.cardDark,
    borderRadius: 28,
    paddingTop: 20, paddingBottom: 16,
    marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },

  // Date + Spaces filter buttons
  filterBtns: { gap: 6, alignItems: 'flex-end', paddingTop: 4 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F2F4F6',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  filterBtnActive:     { backgroundColor: P.yellow },
  filterBtnText:       { fontFamily: IM, fontSize: 11, color: P.secondary },
  filterBtnTextActive: { fontFamily: IS, fontSize: 11, color: P.textDark },

  // Stats row
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 14,
  },
  statItem:    { flex: 1, alignItems: 'center', gap: 5 },
  statValue:   { fontFamily: FBK, fontSize: 15, color: '#FFFFFF', letterSpacing: -0.3 },
  statLabel:   { fontFamily: IM,  fontSize: 10, color: '#8A8D9F', letterSpacing: 0.3 },
  statDivider: { width: 1, height: 28, backgroundColor: '#2A2A2A' },

  // Tab filter row
  tabRow:  { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20, paddingBottom: 4, paddingTop: 6 },
  tabWrap: { alignItems: 'center' },
  tabCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },

  // Transaction list scroll area
  sheet: {
    flex: 1,
    backgroundColor: P.bg,
    overflow: 'hidden',
  },

  // Empty state
  emptyWrap:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, paddingBottom: 80 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  emptyTitle:    { fontFamily: FB, fontSize: 16, color: P.text },
  emptyText:     { fontFamily: IM, fontSize: 13, color: P.secondary, textAlign: 'center', lineHeight: 21, letterSpacing: 0.2 },

  // Transaction list
  list:           { paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  dateHeaderRow:  { marginTop: 8, marginBottom: 4, paddingHorizontal: 4 },
  dateHeaderText: { fontFamily: IS, fontSize: 10, color: P.secondary, letterSpacing: 1.4, textTransform: 'uppercase' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  rowIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  rowMid:      { flex: 1, gap: 4 },
  rowName:     { fontFamily: FB,  fontSize: 14, color: P.text, letterSpacing: 0.1, lineHeight: 20 },
  rowCategory: { fontFamily: IM,  fontSize: 11, color: P.secondary, letterSpacing: 0.3, lineHeight: 16 },
  rowAmount:   { fontFamily: FBK, fontSize: 15, letterSpacing: -0.4 },

  // Date modal — preset chips
  modalPresetRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  modalPresetChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: '#F2F4F6' },
  modalPresetChipActive: { backgroundColor: P.yellow },
  modalPresetText:       { fontFamily: IM, fontSize: 12, color: P.secondary },
  modalPresetTextActive: { fontFamily: IS, fontSize: 12, color: P.textDark },

  // Cutoff
  cutoffRow:       { marginBottom: 16, width: '100%' },
  cutoffLabel:     { fontFamily: IM, fontSize: 12, color: P.secondary, marginBottom: 10 },
  cutoffChips:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  cutoffChip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: '#F2F4F6' },
  cutoffChipActive:     { backgroundColor: P.green },
  cutoffChipText:       { fontFamily: IM, fontSize: 12, color: P.secondary },
  cutoffChipTextActive: { color: '#fff' },
  cutoffInputRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cutoffInputLabel: { fontFamily: I, fontSize: 12, color: P.secondary, flex: 1 },
  cutoffInput: {
    backgroundColor: '#F2F4F6', borderRadius: Radius.sm,
    paddingHorizontal: 12, paddingVertical: 8,
    fontFamily: FB, fontSize: 16, color: P.text,
    width: 70, textAlign: 'center',
  },

  // Calendar
  calWrap:    { width: '100%' },
  calHint:    { fontFamily: I, fontSize: 11, color: P.yellow, marginBottom: 10 },
  pickerNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 4, marginBottom: 10,
  },
  pickerMonthText:   { fontFamily: FB, fontSize: 15, color: P.text },
  calDay:            { flex: 1, textAlign: 'center', fontFamily: I, fontSize: 10, color: P.muted },
  calCell:           { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellRange:      { backgroundColor: P.yellow + '22', borderRadius: 0 },
  calCellEdge:       { backgroundColor: P.yellow },
  calCellToday:      { backgroundColor: '#F2F4F6' },
  calCellText:       { fontFamily: I,  fontSize: 13, color: P.text },
  calCellTextActive: { fontFamily: IS, color: P.textDark },

  // Spaces modal
  spaceChips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 16 },
  spaceChip:         { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.pill, backgroundColor: '#F2F4F6' },
  spaceChipActive:   { backgroundColor: P.yellow },
  spaceChipText:     { fontFamily: IM, fontSize: 13, color: P.secondary },
  spaceChipTextActive: { fontFamily: IS, fontSize: 13, color: P.textDark },

  // Status filter chips
  statusFilterRow:      { flexDirection: 'row', gap: 10 },
  statusChip:           { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: '#F2F4F6' },
  statusChipText:       { fontFamily: IS, fontSize: 13, color: P.secondary },
  statusChipTextActive: { color: P.text },
});
