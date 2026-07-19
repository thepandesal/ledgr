import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { useExchangeRates } from '../../src/lib/useExchangeRates';
import { useScreenAnim } from '@/components/ui/ScreenWrapper';
import { supabase } from '../../src/lib/supabase';
import ConfirmModal from '@/components/ui/ConfirmModal';
import BottomSheet from '@/components/ui/BottomSheet';
import ActivityTabs, { ACTIVITY_TABS, ActivityTab } from '@/components/ui/ActivityTabs';
import PageHeader, { HeaderActionBtn } from '@/components/ui/PageHeader';
import DateNavBar from '@/components/ui/DateNavBar';
import { Colors, Fonts, Radius } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';
import { AppFont } from '../../src/lib/fonts';
import { DC } from '../../src/lib/design';
import AddRecordingScreen from './add-recording';
import BottomNav from '@/components/ui/BottomNav';
import { useNav } from '../../src/lib/NavContext';

// ── Module-level pending focus date ─────────────────────────────────────────
export let pendingFocusDate: string | null = null;
export function setPendingFocusDate(date: string | null) { pendingFocusDate = date; }

// ── Constants ────────────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');

const today = new Date();
const PEACH = '#FFAB91';
const PAGE_HEIGHT = 1200; // px per image slice (at scale 2 = 2400px actual)

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const MODAL_HEIGHT = '50%';

type Preset = 'this-month' | 'last-30' | 'cutoff' | 'custom';
const PRESETS: { key: Preset; label: string; icon: string }[] = [
  { key: 'this-month', label: 'This Month', icon: 'calendar-outline' },
  { key: 'last-30',    label: 'Last 30d',   icon: 'time-outline'     },
  { key: 'cutoff',     label: 'Cutoff',     icon: 'cut-outline'      },
  { key: 'custom',     label: 'Custom',     icon: 'options-outline'  },
];

// ── Helper functions ─────────────────────────────────────────────────────────
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getRangeForPreset(preset: Preset, cutoffDay: number, offset = 0): { from: Date; to: Date } {
  const now = new Date();
  if (preset === 'this-month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth() + offset, 1),
      to:   new Date(now.getFullYear(), now.getMonth() + offset + 1, 0),
    };
  }
  if (preset === 'last-30') {
    const base = new Date(now); base.setDate(now.getDate() + offset * 30);
    const from = new Date(base); from.setDate(base.getDate() - 30);
    return { from, to: base };
  }
  if (preset === 'cutoff') {
    const baseMonth = now.getDate() >= cutoffDay ? now.getMonth() : now.getMonth() - 1;
    return {
      from: new Date(now.getFullYear(), baseMonth + offset, cutoffDay),
      to:   new Date(now.getFullYear(), baseMonth + offset + 1, cutoffDay - 1),
    };
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}

function fmtAbbr(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtAmount(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

function getTypeLabel(type: string, status: string, is_due?: boolean, paid_amount?: number, amount?: number) {
  if (type === 'income')  return { label: 'Income',  color: DC.incomeColor };
  if (type === 'expense') {
    if (is_due) {
      const paid = Number(paid_amount ?? 0);
      const total = Number(amount ?? 0);
      const collected = total > 0 && paid >= total - 0.01;
      const partial   = paid > 0 && !collected;
      if (collected) return { label: 'Expense · Collected',        color: DC.incomeColor };
      if (partial)   return { label: 'Expense · Due · Partial',    color: DC.expenseColor };
      return               { label: 'Expense · Due',               color: DC.expenseColor };
    }
    return { label: 'Expense', color: DC.expenseColor };
  }
  if (type === 'debt') {
    if (status === 'paid')    return { label: 'Debt · Paid',           color: DC.expenseColor };
    if (status === 'partial') return { label: 'Debt · Partially Paid', color: DC.expenseColor };
    return                           { label: 'Debt',                  color: DC.expenseColor };
  }
  if (type === 'due') {
    if (status === 'paid')    return { label: 'Due · Collected',        color: DC.incomeColor };
    if (status === 'partial') return { label: 'Due · Partially Paid',   color: DC.incomeColor };
    return                           { label: 'Due',                    color: DC.incomeColor };
  }
  if (type === 'payment') return { label: 'Payment', color: DC.expenseColor };
  if (type === 'return')  return { label: 'Return',  color: DC.incomeColor };
  return { label: type, color: Colors.muted };
}

import { smartDateLabel } from '../../src/lib/smartDateLabel';
import { getDateRange, getDateLabel, type DateMode as LocalDateMode, type WeekStart } from '../../src/lib/dateUtils';
import { computeGhosts, getDueDateForCycle, isLoanComplete, type GhostRow } from '../../src/lib/recurringUtils';
import { isReminderDueToday } from '../../src/lib/reminderUtils';
import type { RecordingReminder } from '../../src/types';

export default function SpaceDetailScreen({ spaceId: propSpaceId, name: propName, onClose }: { spaceId?: string; name?: string; onClose?: () => void }) {
  const params = useLocalSearchParams<{ spaceId: string; name: string }>();
  const spaceId = propSpaceId ?? params.spaceId;
  const name    = propName    ?? params.name;
  const router  = useRouter();
  const queryClient = useQueryClient();
  const { userId, defaultCurrency } = useUser();
  const { convert } = useExchangeRates();

  const { slideAnim, handleBack: handleBackAnim } = useScreenAnim();
  const handleBack = onClose ?? handleBackAnim;
  const { openRecording } = useNav();

  // Load default settings from spaces page
  const { data: spacesSettings } = useQuery({
    queryKey: ['spaces-settings', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('spaces_date_mode, spaces_week_start, spaces_date_offset, spaces_cutoff_day, spaces_use_cutoff')
        .eq('user_id', userId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!userId,
  });

  // Date range state - initialized from spaces settings
  const [activePreset, setActivePreset] = useState<Preset>('this-month');
  const [rangeOffset,  setRangeOffset]  = useState(0);
  const [cutoffDay,    setCutoffDay]    = useState(25);
  const [cutoffInput,  setCutoffInput]  = useState('25');
  const [customFrom,   setCustomFrom]   = useState<Date>(new Date());
  const [customTo,     setCustomTo]     = useState<Date>(new Date());

  // Local filter state (temporary — never saved, spaces settings always takes over on load)
  const [localMode,      setLocalMode]      = useState<LocalDateMode>('monthly');
  const [localOffset,    setLocalOffset]    = useState(0);
  const [localWeekStart, setLocalWeekStart] = useState<WeekStart>('monday');
  const [localUseCutoff, setLocalUseCutoff] = useState(false);
  const [localCutoffDay, setLocalCutoffDay] = useState(25);
  const [localCustomFrom, setLocalCustomFrom] = useState('');
  const [localCustomTo,   setLocalCustomTo]   = useState('');
  const [showLocalFilter, setShowLocalFilter] = useState(false);
  // true once spacesSettings has been applied — prevents local changes being overwritten
  const settingsAppliedRef = useRef(false);

  // Calendar picker state
  const [pickingDate, setPickingDate] = useState<'from' | 'to'>('from');
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear,  setPickerYear]  = useState(new Date().getFullYear());

  // Tab filter state
  const [selectedTabs, setSelectedTabs] = useState<Set<ActivityTab>>(new Set(['all']));

  // Category filter state
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['all']));

  // Modal visibility
  const [showDateModal,   setShowDateModal]   = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [confirmModal,    setConfirmModal]    = useState(false);

  // Delete state
  const [pendingDeleteId,   setPendingDeleteId]   = useState('');
  const [pendingDeleteName, setPendingDeleteName] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddChoice, setShowAddChoice] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTab, setReminderTab] = useState<'active' | 'completed' | 'paused'>('active');
  const [recordingSearch, setRecordingSearch] = useState('');
  const [activeSection, setActiveSection] = useState<'recordings' | 'reminders'>('recordings');

  // ── Reminder add modal state (quick-add from space) ────────────────────────────────────────────────────────────
  const [rName, setRName]               = useState('');
  const [rFrequency, setRFrequency]     = useState<'daily'|'weekly'|'monthly'>('monthly');
  const [rDayOfWeek, setRDayOfWeek]     = useState(1);
  const [rDayOfMonth, setRDayOfMonth]   = useState(1);
  const [rStartMonth, setRStartMonth]   = useState(today.getMonth());
  const [rStartDay, setRStartDay]       = useState(today.getDate());
  const [rStartYear, setRStartYear]     = useState(today.getFullYear());
  const [rSaving, setRSaving]           = useState(false);
  const [editReminderId, setEditReminderId] = useState<string | null>(null);
  const [rRecordingType, setRRecordingType] = useState<'expense'|'income'|'debt'|'due'>('expense');
  const [rCategoryId, setRCategoryId]       = useState('');

  const SD_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const SD_DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const SD_YEARS  = Array.from({ length: 6 }, (_, i) => today.getFullYear() + i);

  const handleSaveReminder = async () => {
    if (!rName.trim()) return;
    setRSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const startDate = `${rStartYear}-${String(rStartMonth + 1).padStart(2, '0')}-${String(rFrequency === 'monthly' ? rDayOfMonth : rStartDay).padStart(2, '0')}`;
      const payload = {
        user_id:      user.id,
        workspace_id: spaceId,
        name:         rName.trim(),
        frequency:    rFrequency,
        day_of_week:  rFrequency === 'weekly'  ? rDayOfWeek  : null,
        day_of_month: rFrequency === 'monthly' ? rDayOfMonth : null,
        start_date:   startDate,
        recording_type: rRecordingType,
        category_id:  rCategoryId || null,
        status:       'active',
      };
      if (editReminderId) {
        await supabase.from('recording_reminders').update(payload).eq('id', editReminderId);
      } else {
        await supabase.from('recording_reminders').insert(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['space-reminders', spaceId, userId] });
      setShowReminderModal(false);
      setRName('');
      setRCategoryId('');
      setEditReminderId(null);
    } finally {
      setRSaving(false);
    }
  };

  // ── Ghost payment modal ────────────────────────────────────────────────────────────
  const [ghostModal, setGhostModal]       = useState(false);
  const [ghostTarget, setGhostTarget]     = useState<GhostRow | null>(null);
  const [ghostAmount, setGhostAmount]     = useState('');
  const [ghostSaving, setGhostSaving]     = useState(false);

  // ── Reminder fill modal ────────────────────────────────────────────────────────────
  const [reminderModal, setReminderModal]   = useState(false);
  const [reminderTarget, setReminderTarget] = useState<RecordingReminder | null>(null);
  const [reminderAmount, setReminderAmount] = useState('');
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderLinked, setReminderLinked] = useState<any[]>([]);
  const [reminderIsPartial, setReminderIsPartial] = useState(false);
  const [reminderDate, setReminderDate] = useState('');


  const deleteReminderLinked = async (id: string) => {
    await supabase.from('recordings').delete().eq('id', id);
    setReminderLinked(prev => prev.filter(r => r.id !== id));
    queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
  };
  const [reminderChoiceModal, setReminderChoiceModal]   = useState(false);
  const [reminderChoiceTarget, setReminderChoiceTarget] = useState<RecordingReminder | null>(null);

  const openReminderChoice = (r: RecordingReminder) => {
    setReminderChoiceTarget(r);
    setReminderChoiceModal(true);
  };

  const openReminderModal = async (r: RecordingReminder) => {
    setReminderTarget(r);
    setReminderAmount('');
    setReminderIsPartial(false);
    setReminderDate(new Date().toISOString().split('T')[0]);
    const { data } = await supabase
      .from('recordings')
      .select('id, amount, transaction_date, type, status')
      .eq('reminder_id', r.id)
      .order('transaction_date', { ascending: false });
    setReminderLinked(data ?? []);
    setReminderModal(true);
  };

  const confirmReminderFill = async () => {
    if (!reminderTarget || !reminderAmount) return;
    setReminderSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const recType = reminderTarget.recording_type ?? 'expense';
      const recStatus = reminderIsPartial ? 'partial' : recType === 'income' ? 'received' : 'paid';



      await supabase.from('recordings').insert({
        user_id:          user.id,
        space_id:         spaceId,
        name:             reminderTarget.name,
        type:             recType as any,
        amount:           parseFloat(reminderAmount),
        transaction_date: reminderDate || new Date().toISOString().split('T')[0],
        status:           recStatus,
        category_id:      reminderTarget.category_id ?? null,
        account_id:       reminderTarget.account_id  ?? null,
        reminder_id:      reminderTarget.id,
      });
      setReminderModal(false);
      queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
    } finally {
      setReminderSaving(false);
    }
  };

  const openGhostModal = (g: GhostRow) => {
    setGhostTarget(g);
    setGhostAmount(String(g.rec.installment_amount));
    setGhostModal(true);
  };

  const confirmGhostPayment = async () => {
    if (!ghostTarget) return;
    setGhostSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { rec, cycleKey: ck, dueDate } = ghostTarget;
      const amt = parseFloat(ghostAmount || '0') || rec.installment_amount;
      const txDate = dueDate.toISOString().split('T')[0];

      await supabase.from('recordings').insert({
        user_id: user.id,
        space_id: rec.space_id,
        name: rec.name,
        type: rec.type,
        amount: amt,
        transaction_date: txDate,
        status: rec.type === 'expense' ? 'paid' : 'unpaid',
        category_id: rec.category_id ?? null,
        recurring_record_id: rec.id,
        cycle_key: ck,
      });

      const newTotalPaid = rec.total_paid + amt;
      const updates: any = { total_paid: newTotalPaid };
      if (isLoanComplete({ ...rec, total_paid: newTotalPaid })) {
        updates.status = 'completed';
      }
      await supabase.from('recurring_records').update(updates).eq('id', rec.id);

      setGhostModal(false);
      queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['recurring-records', spaceId] });
    } catch (e) { /* ghost payment failed silently */ }
    finally { setGhostSaving(false); }
  };

  // Statement image state
  const [statementLoading, setStatementLoading] = useState(false);
  const [captureHtml, setCaptureHtml] = useState<string | null>(null);
  const webviewRef = useRef<any>(null);

  // Pagination state
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['recordings', spaceId, userId],
    queryFn: async () => {
      const normalize = (data: any[]) => data.map((r: any) => ({
        ...r,
        categories: Array.isArray(r.categories) ? r.categories[0] : r.categories,
      }));
      const query = supabase
        .from('recordings')
        .select('*, categories:category_id(name,color,icon)');
      if (spaceId === 'all') {
        if (!userId) return [];
        const { data } = await query.eq('user_id', userId).order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
        return normalize(data ?? []);
      }
      const { data } = await query.select('*, categories:category_id(name,color,icon), user_id').eq('space_id', spaceId).order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
      return normalize(data ?? []);
    },
    enabled: !!spaceId && (spaceId !== 'all' || !!userId),
  });

  const { data: splitBillPaymentsData = [] } = useQuery({
    queryKey: ['split-bill-payments', spaceId],
    queryFn: async () => {
      // Step 1: get split_bill_ids linked to recordings in this space
      const { data: sbrRows } = await supabase
        .from('split_bill_recordings')
        .select('split_bill_id, recording_id')
        .in('recording_id',
          (await supabase.from('recordings').select('id').eq('space_id', spaceId)).data?.map((r: any) => r.id) ?? []
        );
      const billIds = [...new Set((sbrRows ?? []).map((r: any) => r.split_bill_id))];
      if (billIds.length === 0) return [];
      // Step 2: build map split_bill_id → transaction_date from recordings
      const recIds = [...new Set((sbrRows ?? []).map((r: any) => r.recording_id))];
      const { data: recRows } = await supabase.from('recordings').select('id, transaction_date').in('id', recIds);
      const recDateMap: Record<string, string> = {};
      (recRows ?? []).forEach((r: any) => { recDateMap[r.id] = r.transaction_date; });
      const billDateMap: Record<string, string> = {};
      (sbrRows ?? []).forEach((r: any) => {
        if (!billDateMap[r.split_bill_id] && recDateMap[r.recording_id]) {
          billDateMap[r.split_bill_id] = recDateMap[r.recording_id];
        }
      });
      // Step 3: fetch payments for those bills
      const { data: payments } = await supabase
        .from('split_bill_payments')
        .select('id, amount, split_bill_id')
        .eq('status', 'active')
        .in('split_bill_id', billIds);
      const seen = new Set<string>();
      return (payments ?? []).filter((p: any) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      }).map((p: any) => ({ ...p, transaction_date: billDateMap[p.split_bill_id] ?? null }));
    },
    enabled: !!spaceId && spaceId !== 'all',
  });

  const { data: spaceData } = useQuery({
    queryKey: ['space-budget', spaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('spaces')
        .select('budget, budget_currency, space_type, sort_by')
        .eq('id', spaceId)
        .single();
      return data;
    },
    enabled: !!spaceId && spaceId !== 'all',
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('id,name')
        .eq('user_id', userId)
        .order('created_at');
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: recurringRecords = [] } = useQuery({
    queryKey: ['recurring-records', spaceId],
    queryFn: async () => {
      if (!spaceId || spaceId === 'all') return [];
      const { data } = await supabase
        .from('recurring_records')
        .select('*')
        .eq('space_id', spaceId)
        .eq('status', 'active');
      return data ?? [];
    },
    enabled: !!spaceId && spaceId !== 'all',
  });

  const { data: spaceReminders = [] } = useQuery<RecordingReminder[]>({
    queryKey: ['space-reminders', spaceId, userId],
    queryFn: async () => {
      if (!spaceId || spaceId === 'all' || !userId) return [];
      const { data } = await supabase
        .from('recording_reminders')
        .select('*, categories:category_id(name,color,icon), account:account_id(account_name,bank)')
        .eq('user_id', userId)
        .or(`workspace_id.eq.${spaceId},workspace_id.is.null`);
      return (data ?? []).map((r: any) => ({
        ...r,
        categories: Array.isArray(r.categories) ? r.categories[0] : r.categories,
        account:    Array.isArray(r.account)    ? r.account[0]    : r.account,
      }));
    },
    enabled: !!spaceId && spaceId !== 'all' && !!userId,
  });

  const budget       = spaceData?.budget ? convert(spaceData.budget, spaceData.budget_currency ?? 'PHP', defaultCurrency) : null;
  const isExpSpace   = (spaceData?.space_type ?? 'expense') === 'expense';
  const isAllCats    = selectedCategories.has('all');

  const [sortBy, setSortBy] = useState<'date' | 'category'>('date');

  useEffect(() => {
    if (spaceData?.sort_by) setSortBy(spaceData.sort_by as 'date' | 'category');
  }, [spaceData]);

  const handleSortToggle = async () => {
    const next = sortBy === 'date' ? 'category' : 'date';
    setSortBy(next);
    if (spaceId && spaceId !== 'all') {
      await supabase.from('spaces').update({ sort_by: next }).eq('id', spaceId);
    }
  };

  // ── Computed values ────────────────────────────────────────────────────────
  const range = getDateRange(localMode, localOffset, localWeekStart, localUseCutoff, localCutoffDay,
    localCustomFrom ? new Date(localCustomFrom) : undefined,
    localCustomTo   ? new Date(localCustomTo)   : undefined
  );

  const isAll = selectedTabs.has('all');
  const currentTypes = isAll
    ? ['income','expense','debt','due']
    : ACTIVITY_TABS.filter(t => t.key !== 'all' && selectedTabs.has(t.key)).flatMap(t => [...t.types]);

  const filtered = recordings.filter(r => {
    if (!currentTypes.includes(r.type)) return false;
    if (r.status === 'voided') return false;
    if (!isAll && selectedTabs.has('receivables') && r.type === 'expense' && !r.is_due) return false;
    if (!isAllCats && !selectedCategories.has(r.category_id)) return false;
    if (recordingSearch.trim() && !r.name.toLowerCase().includes(recordingSearch.toLowerCase())) return false;
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date < range.from) return false;
    const to = new Date(range.to); to.setHours(23, 59, 59);
    return date <= to;
  });

  // Group filtered by date or category
  const grouped: { key: string; label: string; date: Date; items: any[] }[] = [];
  if (sortBy === 'date') {
    filtered.forEach(r => {
      const [y, m, d] = r.transaction_date.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const k = dateKey(date);
      const existing = grouped.find(g => g.key === k);
      if (existing) existing.items.push(r);
      else grouped.push({ key: k, label: smartDateLabel(r.transaction_date), date, items: [r] });
    });
    grouped.sort((a, b) => b.date.getTime() - a.date.getTime());
  } else {
    filtered.forEach(r => {
      const catName = r.categories?.name ?? 'uncategorized';
      const existing = grouped.find(g => g.key === catName);
      if (existing) existing.items.push(r);
      else grouped.push({ key: catName, label: catName, date: new Date(0), items: [r] });
    });
    grouped.sort((a, b) => a.label.localeCompare(b.label));
    grouped.forEach(g => g.items.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)));
  }

  // Paginate groups
  const paginatedGroups = grouped.slice(0, displayCount);
  const hasMore = displayCount < grouped.length;

  // ── Ghost rows from recurring records ───────────────────────────────────────────────
  const ghosts: GhostRow[] = computeGhosts(
    recurringRecords,
    recordings.filter(r => r.recurring_record_id),
    new Date()
  );

  const fromStr = `${range.from.getFullYear()}-${String(range.from.getMonth()+1).padStart(2,'0')}-${String(range.from.getDate()).padStart(2,'0')}`;
  const toStr   = `${range.to.getFullYear()}-${String(range.to.getMonth()+1).padStart(2,'0')}-${String(range.to.getDate()).padStart(2,'0')}`;

  const reminderCompletedInRange = new Set(
    recordings
      .filter(r => r.reminder_id && r.transaction_date >= fromStr && r.transaction_date <= toStr)
      .map(r => r.reminder_id)
  );

  // ── Due reminders for this space ──────────────────────────────────────────
  const rangeSpanDays = (range.to.getTime() - range.from.getTime()) / 86400000;
  const isWideRange = rangeSpanDays > 35;
  const visibleReminders = spaceReminders.filter(r => {
    if (r.status === 'archived') return false;

    if (r.status === 'paused') return (reminderTab as string) === 'paused';
    const doneThisPeriod = reminderCompletedInRange.has(r.id);
    if (reminderTab === 'completed') return doneThisPeriod;
    if (reminderTab === 'active') return isWideRange ? true : !doneThisPeriod;
    return false;
  }).sort((a, b) => a.name.localeCompare(b.name));
  const getReminderMeta = (r: RecordingReminder) => {
    const filledCount = recordings.filter(rec =>
      rec.reminder_id === r.id &&
      rec.transaction_date >= fromStr &&
      rec.transaction_date <= toStr
    ).length;
    return { filledCount, isDone: reminderCompletedInRange.has(r.id) };
  };

  const dateFiltered = recordings.filter(r => {
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date < range.from) return false;
    const to = new Date(range.to); to.setHours(23, 59, 59);
    return date <= to;
  });

  const splitBillMoneyIn = (splitBillPaymentsData as any[]).filter(p => {
    if (!p.transaction_date) return false;
    return p.transaction_date >= fromStr && p.transaction_date <= toStr;
  }).reduce((s: number, p: any) => s + Number(p.amount), 0);

  const moneyIn  = dateFiltered.filter(r => (r.type === 'income' || r.type === 'due' || r.type === 'return') && r.status !== 'voided').reduce((s, r) => s + Number(r.amount), 0) + splitBillMoneyIn;
  const moneyOut = dateFiltered.filter(r => (r.type === 'expense' || r.type === 'debt' || r.type === 'payment') && r.status !== 'voided').reduce((s, r) => s + Number(r.amount), 0);
  const loansActive        = dateFiltered.filter(r => r.type === 'debt' && r.status !== 'paid').length;
  const receivablesPending = dateFiltered.filter(r =>
    (r.type === 'due' && r.status !== 'paid') ||
    (r.type === 'expense' && r.is_due && Number(r.paid_amount ?? 0) < Number(r.amount) - 0.01)
  ).length;
  const mainValue  = isExpSpace ? moneyOut : moneyIn;
  const pct        = budget ? Math.min(mainValue / budget, 1) : 0;
  const overBudget = isExpSpace && budget ? mainValue > budget : false;

  // Tab circle values
  const tabValue = (key: string) => {
    if (key === 'all')          return fmtAbbr(moneyIn + moneyOut);
    if (key === 'money-in')     return fmtAbbr(moneyIn);
    if (key === 'money-out')    return fmtAbbr(moneyOut);
    if (key === 'loans')        return String(loansActive);
    if (key === 'receivables')  return String(receivablesPending);
    return '';
  };

  // Range label
  const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtFull  = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rangeLabel = getDateLabel(localMode, localOffset, localWeekStart, localUseCutoff, localCutoffDay,
    localCustomFrom ? new Date(localCustomFrom) : undefined,
    localCustomTo   ? new Date(localCustomTo)   : undefined
  );

  // Calendar helpers
  const firstDay    = new Date(pickerYear, pickerMonth, 1).getDay();
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  const isInRange = (day: number) => { const d = new Date(pickerYear, pickerMonth, day); return d > customFrom && d < customTo; };
  const isEdge    = (day: number) => { const d = new Date(pickerYear, pickerMonth, day); return isSameDay(d, customFrom) || isSameDay(d, customTo); };

  // ── Event handlers ─────────────────────────────────────────────────────────
  // Initialize from spaces settings
  useEffect(() => {
    if (!spacesSettings) return;
    
    const dateMode = spacesSettings.spaces_date_mode || 'monthly';
    const offset = Number(spacesSettings.spaces_date_offset ?? 0);
    const useCutoff = Boolean(spacesSettings.spaces_use_cutoff);
    const cutoff = Number(spacesSettings.spaces_cutoff_day ?? 25);
    const ws = (spacesSettings.spaces_week_start ?? 'monday') as WeekStart;

    // Always apply cutoff day if set
    setCutoffDay(cutoff);
    setCutoffInput(String(cutoff));

    // Map spaces filters to space-detail presets
    if (dateMode === 'monthly') {
      if (useCutoff) {
        setActivePreset('cutoff');
      } else {
        setActivePreset('this-month');
      }
      setRangeOffset(offset);
    } else {
      setActivePreset('this-month');
      setRangeOffset(0);
    }

    // Initialize local filter to match spaces settings (only on first load)
    if (!settingsAppliedRef.current) {
      setLocalMode(dateMode as LocalDateMode);
      setLocalOffset(offset);
      setLocalWeekStart(ws);
      setLocalUseCutoff(useCutoff);
      setLocalCutoffDay(cutoff);
      settingsAppliedRef.current = true;
    }
  }, [spacesSettings]);

  useEffect(() => {
    // Push a history entry on web so minimize/restore keeps us here
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState(null, '', window.location.href);
    }
  }, []);

  // Prevent Chrome minimize/restore from popping back to spaces on web
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (typeof window !== 'undefined' && window.history) {
          window.history.pushState(null, '', window.location.href);
        }
      }
    };
    const onPopState = (e: PopStateEvent) => {
      // Re-push so the page doesn't navigate away on restore
      if (typeof window !== 'undefined' && document.visibilityState === 'hidden') {
        window.history.pushState(null, '', window.location.href);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useFocusEffect(useCallback(() => {
    if (!spaceId) return;
    // Only refetch if data is older than 30s, so navigating back doesn't always reload
    const state = queryClient.getQueryState(['recordings', spaceId, userId]);
    const age = state?.dataUpdatedAt ? Date.now() - state.dataUpdatedAt : Infinity;
    if (age > 30_000) {
      queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['spaces-settings', userId] });
    }
    setDisplayCount(10);
    setPendingFocusDate(null);
  }, [spaceId, userId]));

  const confirmDelete = async () => {
    await supabase.from('recordings').delete().eq('id', pendingDeleteId);
    setConfirmModal(false);
    queryClient.refetchQueries({ queryKey: ['recordings', spaceId] });
  };

  const navigateRange = (dir: 1 | -1) => {
    setDisplayCount(10);
    setLocalOffset(o => o + dir);
  };

  const applyPreset = (key: Preset) => {
    setRangeOffset(0);
    setActivePreset(key);
    setDisplayCount(10);
    if (key === 'custom') setPickingDate('from');
  };

  const handleDayPress = (day: number) => {
    const d = new Date(pickerYear, pickerMonth, day);
    if (pickingDate === 'from') {
      setCustomFrom(d); setCustomTo(d); setPickingDate('to');
    } else {
      if (d < customFrom) setCustomFrom(d);
      else { setCustomTo(d); setActivePreset('custom'); }
      setPickingDate('from');
    }
  };

  const handleTabToggle = (key: ActivityTab) => {
    if (key === 'all') { setSelectedTabs(new Set(['all'])); setDisplayCount(10); return; }
    setSelectedTabs(prev => {
      const next = new Set(prev);
      next.delete('all');
      if (next.has(key)) { next.delete(key); if (next.size === 0) return new Set(['all']); }
      else { next.add(key); if (next.size === 4) return new Set(['all']); }
      setDisplayCount(10);
      return next;
    });
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isCloseToBottom && hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayCount(prev => prev + 10);
        setIsLoadingMore(false);
      }, 300);
    }
  };

  const handleCategoryFilter = () => {
    setShowFilterModal(true);
    setDisplayCount(10);
  };

  const buildStatementHtml = (paymentsByParent: Record<string, any[]>) => {
    const fmtDate = (d: string) => {
      if (!d) return '\u2014';
      const [y, m, day] = d.split('-').map(Number);
      return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const fmtAmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });
    const fmtD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const TEXT   = '#111111';
    const MUTED  = '#666666';
    const FAINT  = '#999999';
    const BORDER = '#e0e0e0';

    // Build groups from all date-filtered recordings (ignores tab filter) for accurate totals
    // Exclude linked recordings — they'll be appended after their parent
    const linkedIds = new Set(Object.values(paymentsByParent).flat().map((p: any) => p.id));
    const allGrouped: { key: string; date: Date; items: any[] }[] = [];
    dateFiltered.filter((r: any) => !linkedIds.has(r.id)).forEach((r: any) => {
      const [y, m, d] = r.transaction_date.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const k = dateKey(date);
      const existing = allGrouped.find(g => g.key === k);
      if (existing) existing.items.push(r);
      else allGrouped.push({ key: k, date, items: [r] });
    });
    // Sort earliest → oldest
    const sortedGroups = allGrouped.sort((a, b) => a.date.getTime() - b.date.getTime());

    let totalIn = 0, totalOut = 0;
    sortedGroups.flatMap(g => g.items).forEach((r: any) => {
      if (r.type === 'income' || r.type === 'return') totalIn += Number(r.amount);
      else if (r.type === 'expense' || r.type === 'debt' || r.type === 'payment') totalOut += Number(r.amount);
    });
    const netBalance = totalIn - totalOut;

    const rangeStr = isSameDay(range.from, range.to)
      ? fmtDate(fmtD(range.from))
      : `${fmtDate(fmtD(range.from))} &ndash; ${fmtDate(fmtD(range.to))}`;
    const generatedOn = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // ── Category breakdown ──────────────────────────────────────────────────
    // SVG paths for common Ionicons (outline variants)
    const ICON_SVG: Record<string, string> = {
      'fitness-outline':       'M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2 4.86l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14L19.86 21.43 22 19.29l-1.43-1.43L22 16.43z',
      'barbell-outline':       'M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2 4.86l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14L19.86 21.43 22 19.29l-1.43-1.43L22 16.43z',
      'restaurant-outline':    'M18 2v8c0 1.1-.9 2-2 2h-2v10h-2V12H10c-1.1 0-2-.9-2-2V2h2v7h2V2h2v7h2V2h2zM6 2C4.34 2 3 3.34 3 5v6h2.5v11h2V11H10V5c0-1.66-1.34-3-4-3z',
      'fast-food-outline':     'M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05h-5V1h-1.97v4.05h-4.97l.3 2.34c1.71.47 3.31 1.32 4.27 2.26 1.44 1.42 2.43 2.89 2.43 5.29v8.05zM1 21.99V21h15.03v.99c0 .55-.45 1-1.01 1H2.01c-.56 0-1.01-.45-1.01-1zm15.03-7H1v-2h15.03v2zm0-4H1v-2h15.03v2z',
      'cafe-outline':          'M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z',
      'cart-outline':          'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.1 17 7 17h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0023.46 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
      'bag-outline':           'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 4c0 .55-.45 1-1 1s-1-.45-1-1V8h2v2zm2-4c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm4 4c0 .55-.45 1-1 1s-1-.45-1-1V8h2v2z',
      'car-outline':           'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z',
      'airplane-outline':      'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
      'home-outline':          'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
      'business-outline':      'M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z',
      'medkit-outline':        'M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.53 15.47 0 12.36 0c-1.5 0-2.84.59-3.82 1.55L7 3H4c-1.1 0-2 .9-2 2v15c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8.55-4.26c.51-.51 1.21-.74 1.91-.74 1.49 0 2.64 1.15 2.64 2.64 0 .48-.14.94-.32 1.36H9.5l2.95-3.26zM13 14h-2v3H9v-3H6v-2h3v-3h2v3h3v2z',
      'heart-outline':         'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
      'school-outline':        'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z',
      'book-outline':          'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
      'game-controller-outline':'M15 7.5V2H9v5.5l3 3 3-3zM7.5 9H2v6h5.5l3-3-3-3zM9 16.5V22h6v-5.5l-3-3-3 3zM16.5 9l-3 3 3 3H22V9h-5.5z',
      'musical-notes-outline': 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
      'phone-portrait-outline':'M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z',
      'laptop-outline':        'M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z',
      'cash-outline':          'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
      'card-outline':          'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
      'wallet-outline':        'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
      'gift-outline':          'M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.53 15.47 0 12.36 0c-1.5 0-2.84.59-3.82 1.55L7 3H4c-1.1 0-2 .9-2 2v15c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7.64-4.26c.51-.51 1.21-.74 1.91-.74 1.49 0 2.64 1.15 2.64 2.64 0 .48-.14.94-.32 1.36H9.5l2.86-3.26zM11 11H4V8h7v3zm2 9H4v-7h9v7zm7 0h-5v-7h5v7zm0-9h-5V8h5v3z',
      'paw-outline':           'M4.5 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5zm7-8a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5zm5 0a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5zm3.5 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5zm-3.5 6.5c-1.5 0-2.5-1-4-1s-2.5 1-4 1c-2 0-4-2-4-5 0-2.5 2-4.5 4-4.5 1 0 2 .5 4 .5s3-.5 4-.5c2 0 4 2 4 4.5 0 3-2 5-4 5z',
      'leaf-outline':          'M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-5 8z',
      'water-outline':         'M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z',
      'flash-outline':         'M7 2v11h3v9l7-12h-4l4-8z',
      'flame-outline':         'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z',
      'sunny-outline':         'M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z',
      'people-outline':        'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
      'person-outline':        'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
      'trending-up-outline':   'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z',
      'star-outline':          'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
      'ellipse-outline':       'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z',
    };

    const iconSvg = (iconName: string, catName: string): string => {
      const path = ICON_SVG[iconName];
      if (path) {
        return `<div style="width:36px;height:36px;margin-bottom:10px;background:${BORDER};border-radius:8px;display:flex;align-items:center;justify-content:center;padding:6px;box-sizing:border-box">`+
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="${MUTED}"><path d="${path}"/></svg></div>`;
      }
      const initial = (catName || '?').charAt(0).toUpperCase();
      return `<div style="width:36px;height:36px;border:1.5px solid ${BORDER};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:${MUTED};margin-bottom:6px">${initial}</div><div style="font-size:8px;color:${FAINT};margin-bottom:4px;word-break:break-all">${iconName}</div>`;
    };
    const catMap: Record<string, { name: string; icon: string; in: number; out: number; count: number }> = {};
    dateFiltered.forEach((r: any) => {
      const key = r.categories?.name ?? 'uncategorized';
      if (!catMap[key]) catMap[key] = { name: key, icon: r.categories?.icon ?? '', in: 0, out: 0, count: 0 };
      const isCredit = r.type === 'income' || r.type === 'return';
      const isDebit  = r.type === 'expense' || r.type === 'debt' || r.type === 'payment';
      if (isCredit) catMap[key].in  += Number(r.amount);
      if (isDebit)  catMap[key].out += Number(r.amount);
      catMap[key].count++;
    });
    const catCards = Object.values(catMap)
      .sort((a, b) => (b.out + b.in) - (a.out + a.in))
      .map(c => `
        <div style="width:160px;border:1px solid ${BORDER};padding:16px;display:inline-block;vertical-align:top;margin:0 12px 12px 0">
          ${iconSvg(c.icon, c.name)}
          <div style="font-size:12px;font-weight:700;color:${TEXT};margin-bottom:12px;text-transform:capitalize">${c.name}</div>
          ${c.in > 0 ? `<div style="margin-bottom:6px"><div style="font-size:9px;font-weight:600;color:${FAINT};letter-spacing:0.6px;text-transform:uppercase;margin-bottom:2px">money in</div><div style="font-size:13px;font-weight:700;color:${TEXT}">${fmtAmt(c.in)}</div></div>` : ''}
          ${c.out > 0 ? `<div><div style="font-size:9px;font-weight:600;color:${FAINT};letter-spacing:0.6px;text-transform:uppercase;margin-bottom:2px">money out</div><div style="font-size:13px;font-weight:700;color:${TEXT}">${fmtAmt(c.out)}</div></div>` : ''}
        </div>`).join('');

    // Flatten all items across groups into a single sorted list, appending linked activities after their parent
    const allItems: any[] = [];
    sortedGroups.forEach(group => {
      group.items.forEach((r: any) => {
        allItems.push(r);
        (paymentsByParent[r.id] ?? []).forEach((sub: any) => allItems.push(sub));
      });
    });

    let runningBalance = 0;
    const tableRows = allItems.map((r: any) => {
        const tl = getTypeLabel(r.type, r.status, r.is_due, r.paid_amount, r.amount);
        const displayAmt = Number(r.amount);
        const isCredit = r.type === 'income' || r.type === 'return';
        const isDebit  = r.type === 'expense' || r.type === 'debt' || r.type === 'payment';
        if (isCredit) runningBalance += displayAmt;
        else if (isDebit) runningBalance -= displayAmt;

        return `<tr>
          <td style="padding:9px 8px;font-size:11px;color:${MUTED};white-space:nowrap">${fmtDate(r.transaction_date)}</td>
          <td style="padding:9px 8px">
            <div style="font-size:12px;font-weight:600;color:${TEXT}">${r.name}</div>
            ${r.categories?.name ? `<div style="font-size:10px;color:${FAINT};margin-top:1px">${r.categories.name}</div>` : ''}
          </td>
          <td style="padding:9px 8px;font-size:10px;color:${MUTED};text-transform:uppercase;letter-spacing:0.4px">${tl.label}</td>
          <td style="padding:9px 8px;text-align:right;font-size:12px;color:${TEXT}">${isDebit ? fmtAmt(displayAmt) : ''}</td>
          <td style="padding:9px 8px;text-align:right;font-size:12px;color:${TEXT}">${isCredit ? fmtAmt(displayAmt) : ''}</td>
          <td style="padding:9px 8px;text-align:right;font-size:12px;font-weight:600;color:${TEXT}">${fmtAmt(runningBalance)}</td>
        </tr>`;
      }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; background:#fff; width:794px; padding:40px; color:${TEXT}; }
  table { width:100%; border-collapse:collapse; }
  tr { border-bottom:1px solid ${BORDER}; }
  th { padding:8px 8px; font-size:10px; font-weight:600; color:${MUTED}; text-transform:uppercase; letter-spacing:0.6px; border-bottom:2px solid ${TEXT}; text-align:left; }
  th:nth-child(4), th:nth-child(5), th:nth-child(6) { text-align:right; }
</style>
</head><body>

<div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${MUTED};margin-bottom:32px">LEDGR</div>

<div style="font-size:22px;font-weight:700;color:${TEXT};margin-bottom:4px">${String(name)}</div>
<div style="font-size:12px;color:${MUTED};margin-bottom:2px">${rangeStr}</div>
<div style="font-size:11px;color:${FAINT};margin-bottom:32px">${dateFiltered.length} transaction${dateFiltered.length !== 1 ? 's' : ''} &middot; generated ${generatedOn}</div>

<div style="height:1px;background:${TEXT};margin-bottom:24px"></div>

<div style="display:flex;gap:0;margin-bottom:32px;border:1px solid ${BORDER}">
  <div style="flex:1;padding:16px 20px;border-right:1px solid ${BORDER}">
    <div style="font-size:10px;font-weight:600;color:${MUTED};letter-spacing:0.6px;text-transform:uppercase;margin-bottom:6px">Money In</div>
    <div style="font-size:18px;font-weight:700;color:${TEXT}">${fmtAmt(totalIn)}</div>
  </div>
  <div style="flex:1;padding:16px 20px;border-right:1px solid ${BORDER}">
    <div style="font-size:10px;font-weight:600;color:${MUTED};letter-spacing:0.6px;text-transform:uppercase;margin-bottom:6px">Money Out</div>
    <div style="font-size:18px;font-weight:700;color:${TEXT}">${fmtAmt(totalOut)}</div>
  </div>
  <div style="flex:1;padding:16px 20px">
    <div style="font-size:10px;font-weight:600;color:${MUTED};letter-spacing:0.6px;text-transform:uppercase;margin-bottom:6px">Net</div>
    <div style="font-size:18px;font-weight:700;color:${TEXT}">${fmtAmt(netBalance)}</div>
  </div>
</div>

<div style="font-size:10px;font-weight:600;color:${MUTED};letter-spacing:0.6px;text-transform:uppercase;margin-bottom:12px;margin-top:32px">By Category</div>
<div style="margin-bottom:32px">${catCards}</div>

<div style="font-size:10px;font-weight:600;color:${MUTED};letter-spacing:0.6px;text-transform:uppercase;margin-bottom:10px">Transactions</div>
<table>
  <thead>
    <tr>
      <th style="width:110px">Date</th>
      <th>Description</th>
      <th style="width:130px">Type</th>
      <th style="width:110px">Out</th>
      <th style="width:110px">In</th>
      <th style="width:110px">Balance</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
  <tfoot>
    <tr style="border-top:2px solid ${TEXT};border-bottom:none">
      <td colspan="3" style="padding:10px 8px;font-size:10px;font-weight:600;color:${MUTED};letter-spacing:0.6px;text-transform:uppercase">Closing Balance</td>
      <td style="padding:10px 8px;text-align:right;font-size:12px;font-weight:700;color:${TEXT}">${fmtAmt(totalOut)}</td>
      <td style="padding:10px 8px;text-align:right;font-size:12px;font-weight:700;color:${TEXT}">${fmtAmt(totalIn)}</td>
      <td style="padding:10px 8px;text-align:right;font-size:13px;font-weight:700;color:${TEXT}">${fmtAmt(netBalance)}</td>
    </tr>
  </tfoot>
</table>

<div style="font-size:10px;color:${FAINT};text-align:center;margin-top:32px;letter-spacing:1px;text-transform:uppercase">LEDGR</div>

</body></html>`;
  };

  const handleStatementWebViewMessage = async (event: any) => {
    const dataUrl: string = event.nativeEvent.data;
    if (!dataUrl.startsWith('data:image/png')) return;
    setCaptureHtml(null);
    try {
      const FileSystem = require('expo-file-system');
      const MediaLibrary = require('expo-media-library');
      const Sharing = require('expo-sharing');
      const base64 = dataUrl.replace('data:image/png;base64,', '');
      const fileUri = `${FileSystem.cacheDirectory}statement_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      if (Platform.OS === 'ios') {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(fileUri);
          alert('Statement saved to your Photos!');
        } else if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Save statement' });
        }
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Save statement' });
        }
      }
    } catch (e) { /* statement webview capture failed silently */ }
    finally { setStatementLoading(false); }
  };

  const generateStatement = async () => {
    const diffDays = (range.to.getTime() - range.from.getTime()) / 86400000;
    if (diffDays > 184) { alert('Statement is limited to a maximum of 6 months.'); return; }
    if (filtered.length === 0) { alert('No recordings found for this period.'); return; }
    setStatementLoading(true);
    try {
      const recordingIds = filtered.map((r: any) => r.id);
      const { data: linkedPayments } = await supabase
        .from('recordings')
        .select('id, name, amount, transaction_date, type, linked_recording_id')
        .in('linked_recording_id', recordingIds)
        .in('type', ['return', 'expense', 'income'])
        .order('transaction_date', { ascending: true });
      const paymentsByParent: Record<string, any[]> = {};
      (linkedPayments ?? []).forEach((p: any) => {
        if (!paymentsByParent[p.linked_recording_id]) paymentsByParent[p.linked_recording_id] = [];
        paymentsByParent[p.linked_recording_id].push(p);
      });
      const html = buildStatementHtml(paymentsByParent);
      if (Platform.OS === 'web') {
        await new Promise<void>((resolve, reject) => {
          if ((window as any).html2canvas) { resolve(); return; }
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = () => resolve(); script.onerror = reject;
          document.head.appendChild(script);
        });
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:4000px;border:none;background:#fff';
        document.body.appendChild(iframe);
        iframe.contentDocument!.open();
        iframe.contentDocument!.write(html);
        iframe.contentDocument!.close();
        await new Promise(r => setTimeout(r, 800));
        const body = iframe.contentDocument!.body;
        const fullCanvas = await (window as any).html2canvas(body, {
          scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
          width: 794, windowWidth: 794, scrollY: 0, scrollX: 0,
          height: body.scrollHeight, windowHeight: body.scrollHeight,
        });
        document.body.removeChild(iframe);
        const totalH = fullCanvas.height;
        const sliceH = PAGE_HEIGHT * 2;
        const pageCount = Math.ceil(totalH / sliceH);
        const slug = String(name).replace(/\s+/g, '-');
        for (let i = 0; i < pageCount; i++) {
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = fullCanvas.width;
          sliceCanvas.height = Math.min(sliceH, totalH - i * sliceH);
          sliceCanvas.getContext('2d')!.drawImage(fullCanvas, 0, -i * sliceH);
          await new Promise<void>(res => {
            sliceCanvas.toBlob(blob => {
              if (!blob) { res(); return; }
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = pageCount > 1 ? `${slug}-statement-${i + 1}.png` : `${slug}-statement.png`;
              document.body.appendChild(a); a.click();
              document.body.removeChild(a); URL.revokeObjectURL(url);
              res();
            }, 'image/png');
          });
        }
        setStatementLoading(false);
      } else {
        const captureScript = html.replace(
          '</body>',
          `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>`+
          `<script>window.onload=function(){html2canvas(document.body,{scale:2,useCORS:true,backgroundColor:'#ffffff',width:794,windowWidth:794}).then(function(c){window.ReactNativeWebView.postMessage(c.toDataURL('image/png'));});}<\/script>`+
          `</body>`
        );
        setCaptureHtml(captureScript);
      }
    } catch (e) {
      setStatementLoading(false);
    }
  };

  // ── Space ownership + members ──────────────────────────────────────────────────
  const { data: spaceOwner } = useQuery<string>({
    queryKey: ['space-owner', spaceId],
    queryFn: async () => {
      const { data } = await supabase.from('spaces').select('user_id').eq('id', spaceId).single();
      return data?.user_id ?? '';
    },
    enabled: !!spaceId && spaceId !== 'all',
  });
  const isOwner = spaceOwner === userId;

  const { data: members = [], refetch: refetchMembers } = useQuery<{ id: string; user_id: string; role: string; status: string; name: string }[]>({
    queryKey: ['space-members', spaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('space_members')
        .select('id, user_id, role, status')
        .eq('space_id', spaceId);
      if (!data || data.length === 0) return [];
      const names = await Promise.all(
        data.map((m: any) =>
          supabase.rpc('get_user_display_name', { user_id: m.user_id }).then(({ data: n }) => ({ ...m, name: n ?? 'unknown' }))
        )
      );
      return names;
    },
    enabled: !!spaceId && spaceId !== 'all',
  });

  // role for this user in this space (null = owner)
  const myMembership = members.find(m => m.user_id === userId);
  const myRole = isOwner ? 'owner' : (myMembership?.status === 'accepted' ? myMembership.role : null);
  const canAddRecordings = myRole === 'owner' || myRole === 'co-owner';
  const canViewOnly = myRole === 'viewer';

  // Delete permission: owner can delete any recording.
  // co-owner can delete their own recordings or other co-owners', but NOT the owner's recordings.
  const canDeleteRecording = (recordingUserId: string) => {
    if (myRole === 'owner') return true;
    if (myRole === 'co-owner') return recordingUserId !== spaceOwner;
    return false;
  };

  const [membersModal, setMembersModal] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteFriends, setInviteFriends] = useState<{ id: string; name: string }[]>([]);
  const [inviteFriendId, setInviteFriendId] = useState('');
  const [inviteRole, setInviteRole] = useState<'co-owner' | 'viewer'>('viewer');
  const [inviteSaving, setInviteSaving] = useState(false);

  const openInviteModal = async () => {
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, receiver_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
    if (!friendships || friendships.length === 0) { setInviteFriends([]); setInviteModal(true); return; }
    const friendIds = friendships.map((f: any) => f.requester_id === userId ? f.receiver_id : f.requester_id);
    const alreadyMemberIds = members.map(m => m.user_id);
    const eligible = friendIds.filter((id: string) => !alreadyMemberIds.includes(id));
    const names = await Promise.all(
      eligible.map((id: string) =>
        supabase.rpc('get_user_display_name', { user_id: id }).then(({ data: n }) => ({ id, name: n ?? 'unknown' }))
      )
    );
    setInviteFriends(names);
    setInviteFriendId(names[0]?.id ?? '');
    setInviteRole('viewer');
    setInviteModal(true);
  };

  const sendSpaceInvite = async () => {
    if (!inviteFriendId) return;
    setInviteSaving(true);
    await supabase.from('space_members').insert({
      space_id: spaceId,
      user_id: inviteFriendId,
      role: inviteRole,
      invited_by: userId,
      status: 'pending',
    });
    await supabase.from('notifications').insert({
      user_id: inviteFriendId,
      type: 'space_invite',
      title: `${userName} is inviting you to join a space`,
      body: `${String(name)} — role: ${inviteRole}`,
      message: `${String(name)} — role: ${inviteRole}`,
      data: { spaceId, spaceName: String(name) },
      is_read: false,
      status: 'new',
    });
    refetchMembers();
    setInviteSaving(false);
    setInviteModal(false);
  };

  const removeMember = async (memberId: string) => {
    await supabase.from('space_members').delete().eq('id', memberId);
    refetchMembers();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[{ flex: 1, backgroundColor: Colors.white }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <PageHeader
          title={String(name)}
          onBack={handleBack}
        />

        {/* ── Sticky controls ── */}
        <View style={s.stickyControls}>
          {/* Section toggle: Recordings / Reminders */}
          <View style={s.sectionToggleRow}>
            <TouchableOpacity style={[s.sectionToggleBtn, activeSection === 'recordings' && s.sectionToggleBtnActive]} onPress={() => setActiveSection('recordings')} activeOpacity={0.8}>
              <Text style={[s.sectionToggleText, activeSection === 'recordings' && s.sectionToggleTextActive]}>Recordings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.sectionToggleBtn, activeSection === 'reminders' && s.sectionToggleBtnActive]} onPress={() => setActiveSection('reminders')} activeOpacity={0.8}>
              <Text style={[s.sectionToggleText, activeSection === 'reminders' && s.sectionToggleTextActive]}>Reminders</Text>
            </TouchableOpacity>
          </View>

          {activeSection === 'recordings' && (
            <View style={{ gap: 10 }}>
              <ActivityTabs selectedTabs={selectedTabs} onToggle={handleTabToggle} tabValue={tabValue} />
              <View style={s.filterControlsRow}>
                <TouchableOpacity style={s.filterBtn} onPress={() => setShowFilterModal(true)} activeOpacity={0.75}>
                  <View style={s.filterDot} />
                  <Text style={s.filterBtnText}>Filters</Text>
                </TouchableOpacity>
                <DateNavBar style={{ flex: 6.4 }}
                  label={rangeLabel}
                  onPrev={() => navigateRange(-1)}
                  onNext={() => navigateRange(1)}
                  onLabelPress={() => setShowLocalFilter(true)}
                />
                {canAddRecordings && (
                  <TouchableOpacity style={s.actionsBtn} onPress={() => setShowAddChoice(true)} activeOpacity={0.8}>
                    <Text style={s.actionsBtnText}>Actions</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.searchBar}>
                <Ionicons name="search-outline" size={13} color={Colors.faint} />
                <TextInput style={s.searchInput} placeholder="Search Recordings.." placeholderTextColor={Colors.faint} value={recordingSearch} onChangeText={v => { setRecordingSearch(v); setDisplayCount(10); }} />
                {recordingSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setRecordingSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={13} color={Colors.faint} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {activeSection === 'reminders' && (
            <View style={{ gap: 10 }}>
              <View style={s.filterControlsRow}>
                <DateNavBar style={{ flex: 1 }}
                  label={rangeLabel}
                  onPrev={() => navigateRange(-1)}
                  onNext={() => navigateRange(1)}
                  onLabelPress={() => setShowLocalFilter(true)}
                />
                <TouchableOpacity style={s.filterBtn} onPress={() => setShowFilterModal(true)} activeOpacity={0.75}>
                  <View style={s.filterDot} />
                  <Text style={s.filterBtnText}>Filters</Text>
                </TouchableOpacity>
                {canAddRecordings && (
                  <TouchableOpacity style={s.addCircleBtn} onPress={() => { setEditReminderId(null); setRRecordingType('expense'); setRCategoryId(''); setRName(''); setRFrequency('monthly'); setRDayOfWeek(1); setRDayOfMonth(1); setRStartMonth(today.getMonth()); setRStartDay(today.getDate()); setRStartYear(today.getFullYear()); setShowReminderModal(true); }} activeOpacity={0.8}>
                    <Ionicons name="add" size={18} color={DC.btnText} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['active', 'completed', 'paused'] as const).map(tab => (
                  <TouchableOpacity key={tab} style={[s.chip, reminderTab === tab && s.chipActive]} onPress={() => setReminderTab(tab)} activeOpacity={0.75}>
                    <Text style={[s.chipText, reminderTab === tab && s.chipTextActive]}>{tab}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.searchBar}>
                <Ionicons name="search-outline" size={13} color={Colors.faint} />
                <TextInput style={s.searchInput} placeholder="Search Reminders.." placeholderTextColor={Colors.faint} />
              </View>
            </View>
          )}
        </View>

        {/* Main scroll */}
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {activeSection === 'recordings' && (
            <View style={{ gap: 12 }}>
              {/* Recordings list */}
              <View>
                {isLoading ? (
                  <ActivityIndicator color={DC.accent1} style={{ marginTop: 24 }} />
                ) : filtered.length === 0 ? (
                  <View style={s.emptyWrap}><Text style={s.emptyText}>no recordings found for this period</Text></View>
                ) : (
                  paginatedGroups.map(group => (
                    <View key={group.key} style={s.dateGroup}>
                      <View style={s.dateHeaderRow}>
                        <View style={s.dateHeaderLine} />
                        <Text style={s.dateHeaderText}>{group.label}</Text>
                        <View style={s.dateHeaderLine} />
                      </View>
                      <View style={{ gap: 10 }}>
                        {group.items.map(item => {
                          const tl = getTypeLabel(item.type, item.status, item.is_due, item.paid_amount, item.amount);
                          return (
                            <TouchableOpacity key={item.id} style={s.row} activeOpacity={0.85}
                              onPress={() => openRecording(item.id)}
                              onLongPress={() => { if (!canDeleteRecording(item.user_id)) return; setPendingDeleteId(item.id); setPendingDeleteName(item.name); setConfirmModal(true); }}
                            >
                              <View style={s.rowIconWrap}>
                                <Ionicons name={(item.categories?.icon ?? 'ellipse-outline') as any} size={24} color={DC.pageText} />
                              </View>
                              <View style={s.rowMid}>
                                <Text style={s.rowName} numberOfLines={1}>{toTitleCase(item.name)}</Text>
                                <Text style={s.rowType}>{tl.label}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[s.rowAmount, { color: tl.color }]}>
                                  {item.is_due ? Math.max(0, Number(item.amount) - Number(item.paid_amount ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2 }) : fmtAmount(Number(item.amount))}
                                </Text>
                                {item.is_due && Number(item.paid_amount ?? 0) > 0 && (
                                  <Text style={{ fontFamily: AppFont.regular, fontSize: 10, color: DC.pageTextMuted }}>{Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Ghost rows */}
              {ghosts.length > 0 && (
                <View style={{ gap: 10 }}>
                  <View style={s.dateHeaderRow}>
                    <View style={s.dateHeaderLine} />
                    <Text style={s.dateHeaderText}>scheduled</Text>
                    <View style={s.dateHeaderLine} />
                  </View>
                  {ghosts.map(g => (
                    <TouchableOpacity key={`${g.rec.id}-${g.cycleKey}`} style={[s.row, s.ghostRow, g.isOverdue && s.ghostRowOverdue]} activeOpacity={0.8} onPress={() => openGhostModal(g)}>
                      <View style={[s.rowIconWrap, { backgroundColor: g.isOverdue ? '#F9731622' : Colors.surface }]}>
                        <Ionicons name="repeat-outline" size={18} color={g.isOverdue ? '#F97316' : DC.pageText} />
                      </View>
                      <View style={s.rowMid}>
                        <Text style={s.rowName} numberOfLines={1}>{g.rec.name}</Text>
                        <Text style={[s.rowType, g.isOverdue && { color: '#F97316' }]}>{g.isOverdue ? 'overdue' : 'scheduled'} · due {g.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                      </View>
                      <Text style={[s.rowAmount, { color: g.isOverdue ? '#F97316' : DC.pageTextMuted }]}>{g.rec.installment_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {hasMore && (
                <View style={s.loadMoreWrap}>
                  {isLoadingMore ? <ActivityIndicator color={DC.accent1} size="small" /> : <Text style={s.loadMoreText}>scroll for more</Text>}
                </View>
              )}
            </View>
          )}

          {activeSection === 'reminders' && (
            <View style={{ gap: 12 }}>
              {/* Reminder cards */}
              <View style={{ gap: 10 }}>
                {visibleReminders.length === 0 ? (
                  <View style={s.emptyWrap}><Text style={s.emptyText}>no {reminderTab} reminders for this space</Text></View>
                ) : (
                  visibleReminders.map(r => {
                    const isDue = isReminderDueToday(r, today);
                    const { filledCount, isDone } = getReminderMeta(r);
                    return (
                      <TouchableOpacity key={`reminder-${r.id}`} style={s.row} activeOpacity={0.8} onPress={() => openReminderChoice(r)}>
                        <View style={s.rowIconWrap}>
                          <Ionicons name={isDone ? 'checkmark-circle-outline' : 'alarm-outline'} size={24} color={DC.pageText} />
                        </View>
                        <View style={s.rowMid}>
                          <Text style={s.rowName} numberOfLines={1}>{toTitleCase(r.name)}</Text>
                          <Text style={s.rowType}>{isDone ? `filled ${filledCount}x this period` : isDue ? 'due today' : r.status === 'paused' ? 'paused' : r.categories?.name ?? 'reminder'}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={DC.pageTextMuted} />
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>

      {showAddModal && (
        <AddRecordingScreen inlineProps={{ spaceId: spaceId as string, spaceName: name as string, defaultDate: new Date().toISOString().split('T')[0], onClose: () => { setShowAddModal(false); queryClient.refetchQueries({ queryKey: ['recordings', spaceId] }); } }} />
      )}

      {/* Add / Actions choice sheet */}
      <BottomSheet visible={showAddChoice} onClose={() => setShowAddChoice(false)} title="actions">
        <TouchableOpacity style={s.choiceRow} activeOpacity={0.8} onPress={() => { setShowAddChoice(false); setShowAddModal(true); }}>
          <View style={[s.choiceIcon, { backgroundColor: DC.accent1 + '22' }]}>
            <Ionicons name="receipt-outline" size={20} color={DC.accent1} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.choiceTitle}>Add Recording</Text>
            <Text style={s.choiceSub}>Log an expense, income, or loan</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
        </TouchableOpacity>
        <TouchableOpacity style={s.choiceRow} activeOpacity={0.8} onPress={() => { setShowAddChoice(false); generateStatement(); }}>
          <View style={[s.choiceIcon, { backgroundColor: DC.accent1 + '22' }]}>
            {statementLoading
              ? <ActivityIndicator size="small" color={DC.accent1} />
              : <Ionicons name="document-text-outline" size={20} color={DC.accent1} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.choiceTitle}>Export Statement</Text>
            <Text style={s.choiceSub}>Download a PDF statement for this period</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
        </TouchableOpacity>
        {isOwner && spaceId !== 'all' && (
          <TouchableOpacity style={s.choiceRow} activeOpacity={0.8} onPress={() => { setShowAddChoice(false); setMembersModal(true); }}>
            <View style={[s.choiceIcon, { backgroundColor: DC.accent1 + '22' }]}>
              <Ionicons name="people-outline" size={20} color={DC.accent1} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.choiceTitle}>Members</Text>
              <Text style={s.choiceSub}>Manage space members and invites</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
          </TouchableOpacity>
        )}
      </BottomSheet>

      {/* Quick-add reminder modal */}
      <BottomSheet visible={showReminderModal} onClose={() => setShowReminderModal(false)} title={editReminderId ? 'edit reminder' : 'new reminder'}>
        {/* Name */}
        <Text style={s.modalLabel}>Name</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. Electricity Bill"
          placeholderTextColor={Colors.faint}
          value={rName}
          onChangeText={setRName}
          autoFocus
        />

        {/* Recording Type */}
        <Text style={s.modalLabel}>Recording Type</Text>
        <View style={s.dropdownRow}>
          {(['expense','income','debt','due'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.dropdownOption, rRecordingType === t && s.dropdownOptionActive]} onPress={() => setRRecordingType(t)} activeOpacity={0.75}>
              <Text style={[s.dropdownOptionText, rRecordingType === t && s.dropdownOptionTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category */}
        <Text style={s.modalLabel}>Category <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: DC.pageTextMuted }}>(optional)</Text></Text>
        <View style={s.dropdownRow}>
          <TouchableOpacity style={[s.dropdownOption, !rCategoryId && s.dropdownOptionActive]} onPress={() => setRCategoryId('')} activeOpacity={0.75}>
            <Text style={[s.dropdownOptionText, !rCategoryId && s.dropdownOptionTextActive]}>None</Text>
          </TouchableOpacity>
          {(categories as any[]).map((c: any) => (
            <TouchableOpacity key={c.id} style={[s.dropdownOption, rCategoryId === c.id && s.dropdownOptionActive]} onPress={() => setRCategoryId(c.id)} activeOpacity={0.75}>
              <Text style={[s.dropdownOptionText, rCategoryId === c.id && s.dropdownOptionTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Frequency */}
        <Text style={s.modalLabel}>Frequency</Text>
        <View style={s.dropdownRow}>
          {(['daily','weekly','monthly'] as const).map(f => (
            <TouchableOpacity key={f} style={[s.dropdownOption, rFrequency === f && s.dropdownOptionActive]} onPress={() => setRFrequency(f)} activeOpacity={0.75}>
              <Text style={[s.dropdownOptionText, rFrequency === f && s.dropdownOptionTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Day of week (weekly) */}
        {rFrequency === 'weekly' && (
          <>
            <Text style={s.modalLabel}>Repeats On</Text>
            <View style={s.dropdownRow}>
              {SD_DAYS.map((d, i) => (
                <TouchableOpacity key={d} style={[s.dropdownOption, rDayOfWeek === i && s.dropdownOptionActive]} onPress={() => setRDayOfWeek(i)} activeOpacity={0.75}>
                  <Text style={[s.dropdownOptionText, rDayOfWeek === i && s.dropdownOptionTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Day of month (monthly) */}
        {rFrequency === 'monthly' && (
          <>
            <Text style={s.modalLabel}>Day of Month</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <TouchableOpacity key={d} style={[s.dropdownOption, rDayOfMonth === d && s.dropdownOptionActive]} onPress={() => setRDayOfMonth(d)} activeOpacity={0.75}>
                  <Text style={[s.dropdownOptionText, rDayOfMonth === d && s.dropdownOptionTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Start date */}
        <Text style={s.modalLabel}>{rFrequency === 'monthly' ? 'Starts From' : 'Start Date'}</Text>
        <View style={{ flexDirection: 'row', gap: 8, height: 130 }}>
          <ScrollView style={s.dropCol} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {SD_MONTHS.map((m, i) => (
              <TouchableOpacity key={m} style={[s.dropItem, rStartMonth === i && s.dropItemActive]} onPress={() => setRStartMonth(i)} activeOpacity={0.75}>
                <Text style={[s.dropText, rStartMonth === i && s.dropTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {(rFrequency === 'daily' || rFrequency === 'weekly') && (
            <ScrollView style={s.dropCol} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <TouchableOpacity key={d} style={[s.dropItem, rStartDay === d && s.dropItemActive]} onPress={() => setRStartDay(d)} activeOpacity={0.75}>
                  <Text style={[s.dropText, rStartDay === d && s.dropTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <ScrollView style={s.dropCol} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {SD_YEARS.map(y => (
              <TouchableOpacity key={y} style={[s.dropItem, rStartYear === y && s.dropItemActive]} onPress={() => setRStartYear(y)} activeOpacity={0.75}>
                <Text style={[s.dropText, rStartYear === y && s.dropTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={[s.saveBtn, (!rName.trim() || rSaving) && { opacity: 0.4 }]}
          onPress={handleSaveReminder}
          disabled={rSaving || !rName.trim()}
          activeOpacity={0.8}
        >
          <Text style={s.saveBtnText}>{rSaving ? 'Saving...' : editReminderId ? 'Save Changes' : 'Create Reminder'}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Local filter modal — temporary, never saved */}
      <BottomSheet visible={showLocalFilter} onClose={() => setShowLocalFilter(false)} title="date filter" height="55%">
        <Text style={s.modalLabel}>view by</Text>
        <View style={s.chipRow}>
          {(['monthly','weekly','daily','yearly','custom'] as LocalDateMode[]).map(m => (
            <TouchableOpacity key={m} style={[s.chip, localMode === m && s.chipActive]} onPress={() => { setLocalMode(m); setLocalOffset(0); setDisplayCount(10); }} activeOpacity={0.75}>
              <Text style={[s.chipText, localMode === m && s.chipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {localMode === 'custom' && (
          <>
            <Text style={s.modalLabel}>from</Text>
            <TextInput
              style={[s.chip, { borderColor: Colors.borderMid, paddingHorizontal: 12, fontFamily: Fonts.mono, fontSize: 13, color: Colors.text }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.faint}
              value={localCustomFrom}
              onChangeText={setLocalCustomFrom}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <Text style={s.modalLabel}>to</Text>
            <TextInput
              style={[s.chip, { borderColor: Colors.borderMid, paddingHorizontal: 12, fontFamily: Fonts.mono, fontSize: 13, color: Colors.text }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.faint}
              value={localCustomTo}
              onChangeText={setLocalCustomTo}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </>
        )}

        {localMode === 'monthly' && (
          <>
            <Text style={s.modalLabel}>use cutoff?</Text>
            <View style={s.chipRow}>
              <TouchableOpacity style={[s.chip, localUseCutoff && s.chipActive]} onPress={() => setLocalUseCutoff(true)} activeOpacity={0.75}>
                <Text style={[s.chipText, localUseCutoff && s.chipTextActive]}>yes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.chip, !localUseCutoff && s.chipActive]} onPress={() => setLocalUseCutoff(false)} activeOpacity={0.75}>
                <Text style={[s.chipText, !localUseCutoff && s.chipTextActive]}>no</Text>
              </TouchableOpacity>
            </View>
            {localUseCutoff && (
              <>
                <Text style={s.modalLabel}>cutoff day</Text>
                <View style={s.chipRow}>
                  {[1,5,10,15,20,25,28].map(d => (
                    <TouchableOpacity key={d} style={[s.chip, localCutoffDay === d && s.chipActive]} onPress={() => setLocalCutoffDay(d)} activeOpacity={0.75}>
                      <Text style={[s.chipText, localCutoffDay === d && s.chipTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {localMode === 'weekly' && (
          <>
            <Text style={s.modalLabel}>week starts on</Text>
            <View style={s.chipRow}>
              {(['monday','sunday','saturday'] as WeekStart[]).map(ws => (
                <TouchableOpacity key={ws} style={[s.chip, localWeekStart === ws && s.chipActive]} onPress={() => { setLocalWeekStart(ws); setLocalOffset(0); }} activeOpacity={0.75}>
                  <Text style={[s.chipText, localWeekStart === ws && s.chipTextActive]}>{ws}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={[s.modalLabel, { marginTop: 8 }]}>quick jump</Text>
        <View style={s.chipRow}>
          {[{label:'Today',mode:'daily'},{label:'This Week',mode:'weekly'},{label:'This Month',mode:'monthly'},{label:'This Year',mode:'yearly'}].map(p => (
            <TouchableOpacity key={p.label} style={s.chip} onPress={() => { setLocalMode(p.mode as LocalDateMode); setLocalOffset(0); setDisplayCount(10); setShowLocalFilter(false); }} activeOpacity={0.75}>
              <Text style={s.chipText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint, marginTop: 12 }}>
          temporary — spaces filter always resets this on open
        </Text>
      </BottomSheet>

      {/* Filter modal */}
      <BottomSheet visible={showFilterModal} onClose={() => setShowFilterModal(false)} title="filter" height={MODAL_HEIGHT}>
        <TouchableOpacity style={s.clearBtn} onPress={() => setSelectedCategories(new Set(['all']))} activeOpacity={0.75}>
          <Text style={s.clearBtnText}>Clear Filters</Text>
        </TouchableOpacity>
        <Text style={s.sectionLabel}>Categories</Text>
        <View style={s.chipRow}>
          <TouchableOpacity style={[s.chip, isAllCats && s.chipActive]} onPress={() => setSelectedCategories(new Set(['all']))} activeOpacity={0.75}>
            <Text style={[s.chipText, isAllCats && s.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat: any) => {
            const active = selectedCategories.has(cat.id);
            return (
              <TouchableOpacity key={cat.id} style={[s.chip, active && s.chipActive]} onPress={() => {
                setSelectedCategories(prev => {
                  const next = new Set(prev); next.delete('all');
                  if (next.has(cat.id)) { next.delete(cat.id); if (next.size === 0) return new Set(['all']); }
                  else next.add(cat.id);
                  return next;
                });
              }} activeOpacity={0.75}>
                <Text style={[s.chipText, active && s.chipTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

      {/* Hidden WebView for native statement capture */}
      {captureHtml && Platform.OS !== 'web' && (() => {
        const { WebView } = require('react-native-webview');
        return (
          <WebView
            ref={webviewRef}
            source={{ html: captureHtml }}
            style={{ position: 'absolute', width: 794, height: 1, opacity: 0, top: -9999 }}
            onMessage={handleStatementWebViewMessage}
            javaScriptEnabled
            originWhitelist={['*']}
          />
        );
      })()}

      {/* Reminder choice modal */}
      <BottomSheet visible={reminderChoiceModal} onClose={() => setReminderChoiceModal(false)} title={reminderChoiceTarget?.name ?? 'reminder'} height="45%">
        <TouchableOpacity
          style={s.choiceRow}
          activeOpacity={0.8}
          onPress={() => { setReminderChoiceModal(false); if (reminderChoiceTarget) openReminderModal(reminderChoiceTarget); }}
        >
          <View style={[s.choiceIcon, { backgroundColor: Brand.color.accent + '22' }]}>
            <Ionicons name="add-circle-outline" size={20} color={Brand.color.accentDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.choiceTitle}>record amount</Text>
            <Text style={s.choiceSub}>log a transaction for this reminder</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.choiceRow}
          activeOpacity={0.8}
          onPress={() => {
            setReminderChoiceModal(false);
            if (reminderChoiceTarget) {
              setEditReminderId(reminderChoiceTarget.id);
              setRRecordingType((reminderChoiceTarget.recording_type ?? 'expense') as any);
              setRName(reminderChoiceTarget.name);
              setRFrequency(reminderChoiceTarget.frequency);
              setRDayOfWeek(reminderChoiceTarget.day_of_week ?? 1);
              setRDayOfMonth(reminderChoiceTarget.day_of_month ?? 1);
              const sd = new Date(reminderChoiceTarget.start_date + 'T00:00:00');
              setRStartMonth(sd.getMonth());
              setRStartDay(sd.getDate());
              setRStartYear(sd.getFullYear());
              setRCategoryId(reminderChoiceTarget.category_id ?? '');
              setShowReminderModal(true);
            }
          }}
        >
          <View style={[s.choiceIcon, { backgroundColor: Colors.surface }]}>
            <Ionicons name="create-outline" size={20} color={Colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.choiceTitle}>edit reminder</Text>
            <Text style={s.choiceSub}>change name, frequency, or category</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.faint} />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.choiceRow}
          activeOpacity={0.8}
          onPress={async () => {
            setReminderChoiceModal(false);
            if (!reminderChoiceTarget) return;
            const next = reminderChoiceTarget.status === 'paused' ? 'active' : 'paused';
            await supabase.from('recording_reminders').update({ status: next }).eq('id', reminderChoiceTarget.id);
            queryClient.invalidateQueries({ queryKey: ['space-reminders', spaceId, userId] });
          }}
        >
          <View style={[s.choiceIcon, { backgroundColor: Colors.surface }]}>
            <Ionicons
              name={reminderChoiceTarget?.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
              size={20} color={Colors.muted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.choiceTitle}>{reminderChoiceTarget?.status === 'active' ? 'pause reminder' : 'resume reminder'}</Text>
            <Text style={s.choiceSub}>temporarily stop this reminder</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.choiceRow}
          activeOpacity={0.8}
          onPress={async () => {
            setReminderChoiceModal(false);
            if (!reminderChoiceTarget) return;
            const hasLinked = recordings.some(r => r.reminder_id === reminderChoiceTarget.id);
            if (hasLinked) {
              await supabase.from('recording_reminders').update({ status: 'archived' }).eq('id', reminderChoiceTarget.id);
            } else {
              await supabase.from('recording_reminders').delete().eq('id', reminderChoiceTarget.id);
            }
            queryClient.invalidateQueries({ queryKey: ['space-reminders', spaceId, userId] });
          }}
        >
          <View style={[s.choiceIcon, { backgroundColor: Colors.surface }]}>
            <Ionicons name={recordings.some(r => r.reminder_id === reminderChoiceTarget?.id) ? 'archive-outline' : 'trash-outline'} size={20} color={Colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.choiceTitle}>{recordings.some(r => r.reminder_id === reminderChoiceTarget?.id) ? 'archive reminder' : 'delete reminder'}</Text>
            <Text style={s.choiceSub}>{recordings.some(r => r.reminder_id === reminderChoiceTarget?.id) ? 'has linked recordings - will be archived' : 'permanently remove this reminder'}</Text>
          </View>
        </TouchableOpacity>
      </BottomSheet>

      {/* Reminder fill modal */}
      <BottomSheet visible={reminderModal} onClose={() => setReminderModal(false)} title="fill reminder">
        {reminderTarget && (
          <>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text, marginBottom: 2 }}>
              {reminderTarget.name}
            </Text>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 12 }}>
              {reminderTarget.recording_type ?? 'expense'}
            </Text>

            {/* Previous payments */}
            {reminderLinked.length > 0 && (
              <>
                <Text style={{ fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>previous payments</Text>
                {reminderLinked.map(r => (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text }}>{Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>{r.transaction_date} · {r.type} · {r.status}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteReminderLinked(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle-outline" size={18} color={Colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {/* Partial/complete toggle */}
            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 }}>payment type</Text>
            <View style={s.chipRow}>
              <TouchableOpacity style={[s.chip, !reminderIsPartial && s.chipActive]} onPress={() => setReminderIsPartial(false)} activeOpacity={0.75}>
                <Text style={[s.chipText, !reminderIsPartial && s.chipTextActive]}>complete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.chip, reminderIsPartial && s.chipActive]} onPress={() => setReminderIsPartial(true)} activeOpacity={0.75}>
                <Text style={[s.chipText, reminderIsPartial && s.chipTextActive]}>partial</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 }}>date</Text>
            <TextInput
              style={{ fontFamily: Brand.font.mono, fontSize: 14, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 16 }}
              value={reminderDate}
              onChangeText={setReminderDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.faint}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 }}>amount</Text>
            <TextInput
              style={{ fontFamily: Brand.font.mono, fontSize: 16, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 16 }}
              value={reminderAmount}
              onChangeText={setReminderAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
            <TouchableOpacity
              style={{ backgroundColor: Brand.color.accent, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', opacity: reminderSaving || !reminderAmount ? 0.5 : 1 }}
              onPress={confirmReminderFill}
              disabled={reminderSaving || !reminderAmount}
            >
              <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 14, color: Colors.text }}>
                {reminderSaving ? 'saving...' : reminderIsPartial ? 'record partial' : `record ${reminderTarget.recording_type ?? 'expense'}`}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>

      {/* Ghost payment modal */}
      <BottomSheet visible={ghostModal} onClose={() => setGhostModal(false)} title="record payment">
        {ghostTarget && (
          <>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text, marginBottom: 4 }}>
              {ghostTarget.rec.name}
            </Text>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 16 }}>
              {ghostTarget.cycleKey} · due {ghostTarget.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>amount</Text>
            <TextInput
              style={{ fontFamily: Brand.font.mono, fontSize: 16, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 16 }}
              value={ghostAmount}
              onChangeText={setGhostAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
            <TouchableOpacity
              style={{ backgroundColor: Brand.color.accent, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', opacity: ghostSaving ? 0.5 : 1 }}
              onPress={confirmGhostPayment}
              disabled={ghostSaving}
            >
              <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 14, color: Colors.text }}>
                {ghostSaving ? 'saving...' : 'record payment'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>

      {/* Members modal */}
      <BottomSheet visible={membersModal} onClose={() => setMembersModal(false)} title="members" maxHeight="60%">
        {isOwner && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Brand.color.accent + '33', marginBottom: 12 }}
            onPress={() => { setMembersModal(false); openInviteModal(); }}
          >
            <Ionicons name="person-add-outline" size={13} color={Brand.color.accentDark} />
            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 12, color: Brand.color.accentDark }}>invite friend</Text>
          </TouchableOpacity>
        )}
        {members.length === 0 ? (
          <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted }}>no members yet</Text>
        ) : (
          members.map(m => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Brand.color.accent + '33', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 13, color: Brand.color.accentDark }}>{m.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: Brand.font.heading, fontSize: 13, color: Colors.text }}>{m.name}</Text>
                <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted }}>{m.role} · {m.status}</Text>
              </View>
              {isOwner && (
                <TouchableOpacity onPress={() => removeMember(m.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={14} color={Colors.muted} />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </BottomSheet>

      {/* Invite modal */}
      <BottomSheet visible={inviteModal} onClose={() => setInviteModal(false)} title="invite to space">
        {inviteFriends.length === 0 ? (
          <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted }}>
            no friends available to invite — add friends first from the contacts page.
          </Text>
        ) : (
          <>
            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>friend</Text>
            <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
              {inviteFriends.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}
                  onPress={() => setInviteFriendId(f.id)}
                >
                  <Ionicons name={inviteFriendId === f.id ? 'radio-button-on' : 'radio-button-off'} size={16} color={inviteFriendId === f.id ? Brand.color.accentDark : Colors.faint} />
                  <Text style={{ fontFamily: Brand.font.heading, fontSize: 13, color: Colors.text }}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>role</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['viewer', 'co-owner'] as const).map(r => (
                <TouchableOpacity
                  key={r}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: inviteRole === r ? Brand.color.accentDark : Colors.borderMid, backgroundColor: inviteRole === r ? Brand.color.accent + '33' : Colors.surface }}
                  onPress={() => setInviteRole(r)}
                >
                  <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 12, color: inviteRole === r ? Brand.color.accentDark : Colors.muted }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted, marginTop: 8 }}>
              {inviteRole === 'co-owner' ? 'can add recordings and invite members' : 'can view recordings only'}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: Brand.color.accent + '44', borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20, opacity: inviteSaving || !inviteFriendId ? 0.5 : 1 }}
              onPress={sendSpaceInvite}
              disabled={inviteSaving || !inviteFriendId}
            >
              <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 14, color: Brand.color.accentDark }}>{inviteSaving ? 'sending...' : 'send invite'}</Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>

      {/* Delete confirm */}
      <ConfirmModal
        visible={confirmModal}
        onClose={() => setConfirmModal(false)}
        title="delete recording"
        message={`Delete "${pendingDeleteName}"?`}
        actions={[
          { label: 'cancel', onPress: () => setConfirmModal(false), muted: true },
          { label: 'delete', onPress: confirmDelete, destructive: true },
        ]}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  stickyControls: { paddingHorizontal: DC.pagePadding, paddingTop: 12, paddingBottom: 10, backgroundColor: Colors.white, gap: 10 },
  // Section toggle tabs
  sectionToggleRow:        { flexDirection: 'row', gap: 8, marginBottom: 4 },
  sectionToggleBtn:        { flex: 1, paddingVertical: 10, borderRadius: Radius.pill, borderWidth: 1, borderColor: DC.cardBorder, backgroundColor: Colors.white, alignItems: 'center' },
  sectionToggleBtnActive:  { backgroundColor: '#111111', borderColor: '#111111' },
  sectionToggleText:       { fontFamily: AppFont.semiBold, fontSize: 13, color: DC.pageTextMuted },
  sectionToggleTextActive: { color: Colors.white },

  // Filter dot
  filterDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: DC.btnText },

  // Actions button
  actionsBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: DC.btnBg, alignItems: 'center', borderWidth: DC.btnBorderWidth },
  actionsBtnText: { fontFamily: AppFont.semiBold, fontSize: 12, color: DC.btnText },

  // Add circle button (reminders)
  addCircleBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: DC.btnBg, alignItems: 'center', justifyContent: 'center', borderWidth: DC.btnBorderWidth },

  // Scroll
  scroll:  { paddingHorizontal: DC.pagePadding, paddingBottom: 80 },
  divider: { height: 8, backgroundColor: Colors.surface, marginHorizontal: -DC.pagePadding, marginVertical: 8 },

  // Section
  sectionRow:    { alignItems: 'center', paddingTop: 20, paddingBottom: 10 },
  sectionHeader: { fontFamily: AppFont.bold, fontSize: 16, color: DC.pageText, textAlign: 'center' },

  // Search bar
  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: DC.cardBorder, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: DC.cardBg },
  searchInput: { flex: 1, fontFamily: AppFont.regular, fontSize: 13, color: DC.pageText, padding: 0 },

  // Filter controls row
  filterControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' },
  filterRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateNavRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  dateNavArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: DC.cardBg, borderWidth: 1, borderColor: DC.cardBorder },
  dateNavArrowText: { fontFamily: AppFont.regular, fontSize: 18, color: DC.accent1, lineHeight: 22 },
  filterBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 36, borderRadius: Radius.pill, backgroundColor: DC.btnBg, borderWidth: DC.btnBorderWidth },
  filterBtnDate: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: DC.btnBg, borderWidth: DC.btnBorderWidth },
  filterBtnText: { fontFamily: AppFont.regular, fontSize: 11, color: DC.btnText },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontFamily: AppFont.regular, fontSize: 13, color: DC.pageTextMuted },

  // Date header with lines
  dateGroup:      { paddingVertical: 16, gap: 10 },
  dateHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dateHeaderLine: { flex: 1, height: 1, backgroundColor: DC.cardBorder },
  dateHeaderText: { fontFamily: AppFont.regular, fontSize: 11, color: DC.pageTextMuted },

  // Recording / reminder row
  row:         { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: DC.cardBorder, backgroundColor: DC.cardBg },
  rowIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: DC.cardBg },
  rowMid:      { flex: 1, gap: 3 },
  rowType:     { fontFamily: AppFont.regular, fontSize: 11, color: DC.pageTextMuted, fontStyle: 'italic' },
  rowName:     { fontFamily: AppFont.bold, fontSize: 14, color: DC.pageText },
  rowDate:     { fontFamily: AppFont.regular, fontSize: 10, color: DC.pageTextMuted },
  rowAmount:   { fontFamily: AppFont.bold, fontSize: 14, letterSpacing: -0.3, minWidth: 70, textAlign: 'right' },

  // Modal chips
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: DC.cardBg, borderWidth: 1, borderColor: DC.cardBorder },
  chipActive:     { backgroundColor: DC.badgeActiveBg, borderColor: DC.badgeActiveBg },
  chipText:       { fontFamily: AppFont.regular, fontSize: 12, color: DC.pageTextMuted },
  chipTextActive: { fontFamily: AppFont.semiBold, fontSize: 12, color: DC.badgeActiveText },
  modalLabel:     { fontFamily: AppFont.regular, fontSize: 12, color: DC.pageText, marginBottom: 10 },
  sectionLabel:   { fontFamily: AppFont.bold, fontSize: 11, color: DC.pageTextMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  clearBtn:       { alignSelf: 'flex-end', marginBottom: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: DC.btnBg, borderWidth: DC.btnBorderWidth },
  clearBtnText:   { fontFamily: AppFont.semiBold, fontSize: 12, color: DC.btnText },

  // Calendar
  calWrap:           { width: '100%' },
  calHint:           { fontFamily: AppFont.regular, fontSize: 11, color: DC.accent1, marginBottom: 10 },
  pickerNav:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4, marginBottom: 10 },
  pickerMonthText:   { fontFamily: AppFont.bold, fontSize: 15, color: DC.pageText },
  calDay:            { flex: 1, textAlign: 'center', fontFamily: AppFont.regular, fontSize: 10, color: DC.pageTextMuted },
  calCell:           { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellRange:      { backgroundColor: DC.accent1 + '33', borderRadius: 0 },
  calCellEdge:       { backgroundColor: DC.accent1 },
  calCellToday:      { backgroundColor: DC.cardBg },
  calCellText:       { fontFamily: AppFont.regular, fontSize: 13, color: DC.pageText },
  calCellTextActive: { fontFamily: AppFont.bold, color: Colors.white },

  // Load more
  loadMoreWrap: { alignItems: 'center', paddingVertical: 20 },
  loadMoreText: { fontFamily: AppFont.regular, fontSize: 11, color: DC.pageTextMuted },

  // Ghost rows
  ghostRow:        { borderStyle: 'dashed', borderWidth: 1, borderColor: DC.cardBorder, borderRadius: DC.cardRadius, backgroundColor: DC.cardBg },
  ghostRowOverdue: { borderColor: '#F97316', backgroundColor: '#F9731608' },

  // Choice sheet
  choiceRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: DC.cardBorder },
  choiceIcon:  { width: 40, height: 40, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  choiceTitle: { fontFamily: AppFont.semiBold, fontSize: 14, color: DC.pageText },
  choiceSub:   { fontFamily: AppFont.regular, fontSize: 11, color: DC.pageTextMuted, marginTop: 2 },

  // Dropdown options
  dropdownRow:              { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  dropdownOption:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: DC.cardBorder, backgroundColor: DC.cardBg },
  dropdownOptionActive:     { backgroundColor: DC.btnBg, borderWidth: DC.btnBorderWidth },
  dropdownOptionText:       { fontFamily: AppFont.regular, fontSize: 12, color: DC.pageTextMuted },
  dropdownOptionTextActive: { fontFamily: AppFont.semiBold, fontSize: 12, color: DC.btnText },
  saveBtn:     { backgroundColor: DC.btnBg, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center' as const, marginTop: 20, borderWidth: DC.btnBorderWidth },
  saveBtnText: { fontFamily: AppFont.semiBold, fontSize: 14, color: DC.btnText },
  dropItem:       { paddingVertical: 9, paddingHorizontal: 10, alignItems: 'center' },
  dropItemActive: { backgroundColor: DC.btnBg, borderRadius: Radius.md },
  dropText:       { fontFamily: AppFont.regular, fontSize: 13, color: DC.pageTextMuted },
  dropTextActive: { fontFamily: AppFont.semiBold, fontSize: 13, color: DC.btnText },
});

