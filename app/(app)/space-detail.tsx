import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, Animated, Dimensions, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { useScreenAnim } from '@/components/ui/ScreenWrapper';
import { supabase } from '../../src/lib/supabase';
import ConfirmModal from '@/components/ui/ConfirmModal';
import BottomSheet from '@/components/ui/BottomSheet';
import ActivityTabs, { ACTIVITY_TABS, ActivityTab } from '@/components/ui/ActivityTabs';
import { Colors, Fonts, Radius } from '@/components/ui/theme';
import { Brand } from '../../src/lib/brand';
import AddRecordingScreen from './add-recording';

// ── Module-level pending focus date ─────────────────────────────────────────
export let pendingFocusDate: string | null = null;
export function setPendingFocusDate(date: string | null) { pendingFocusDate = date; }

// ── Constants ────────────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');

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

function getTypeLabel(type: string, status: string, is_due?: boolean, paid_amount?: number, amount?: number) {
  if (type === 'income')  return { label: 'income',  color: Colors.cyan };
  if (type === 'expense') {
    if (is_due) {
      const paid = Number(paid_amount ?? 0);
      const total = Number(amount ?? 0);
      const collected = total > 0 && paid >= total - 0.01;
      const partial   = paid > 0 && !collected;
      if (collected) return { label: 'expense · collected',        color: Colors.cyan };
      if (partial)   return { label: 'expense · due · partial',    color: PEACH };
      return               { label: 'expense · due',               color: PEACH };
    }
    return { label: 'expense', color: PEACH };
  }
  if (type === 'debt') {
    if (status === 'paid')    return { label: 'debt · paid',           color: PEACH };
    if (status === 'partial') return { label: 'debt · partially paid', color: PEACH };
    return                           { label: 'debt',                  color: PEACH };
  }
  if (type === 'due') {
    if (status === 'paid')    return { label: 'due · collected',        color: Colors.cyan };
    if (status === 'partial') return { label: 'due · partially paid',   color: Colors.cyan };
    return                           { label: 'due',                    color: Colors.cyan };
  }
  if (type === 'payment') return { label: 'payment', color: PEACH };
  if (type === 'return')  return { label: 'return',  color: Colors.cyan };
  return { label: type, color: Colors.muted };
}

import { smartDateLabel } from '../../src/lib/smartDateLabel';
import { computeGhosts, getDueDateForCycle, isLoanComplete, type GhostRow } from '../../src/lib/recurringUtils';

export default function SpaceDetailScreen() {
  const { spaceId, name } = useLocalSearchParams<{ spaceId: string; name: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useUser();

  // Slide animation
  const { slideAnim, handleBack } = useScreenAnim();

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

  // ── Ghost payment modal ────────────────────────────────────────────────────────────
  const [ghostModal, setGhostModal]       = useState(false);
  const [ghostTarget, setGhostTarget]     = useState<GhostRow | null>(null);
  const [ghostAmount, setGhostAmount]     = useState('');
  const [ghostSaving, setGhostSaving]     = useState(false);

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
    } catch (e) { console.log(e); }
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
      const { data } = await query.eq('space_id', spaceId).order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
      return normalize(data ?? []);
    },
    enabled: !!spaceId && (spaceId !== 'all' || !!userId),
  });

  const { data: splitBillPaymentsData = [] } = useQuery({
    queryKey: ['split-bill-payments', spaceId],
    queryFn: async () => {
      const { data: sbrRows } = await supabase
        .from('split_bill_recordings')
        .select('split_bill_id, recording_id, recordings!inner(space_id, transaction_date)')
        .eq('recordings.space_id', spaceId);
      const billIds = [...new Set((sbrRows ?? []).map((r: any) => r.split_bill_id))];
      if (billIds.length === 0) return [];
      // Build map: split_bill_id → transaction_date (from first linked recording)
      const billDateMap: Record<string, string> = {};
      (sbrRows ?? []).forEach((r: any) => {
        if (!billDateMap[r.split_bill_id]) {
          const rec = Array.isArray(r.recordings) ? r.recordings[0] : r.recordings;
          if (rec?.transaction_date) billDateMap[r.split_bill_id] = rec.transaction_date;
        }
      });
      const { data: payments } = await supabase
        .from('split_bill_payments')
        .select('id, amount, split_bill_id')
        .eq('status', 'active')
        .in('split_bill_id', billIds);
      // Attach parent transaction_date to each payment, deduplicate by id
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
        .select('budget, space_type, sort_by')
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

  const budget       = spaceData?.budget ?? null;
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
  const range = activePreset === 'custom'
    ? { from: customFrom, to: customTo }
    : getRangeForPreset(activePreset, cutoffDay, rangeOffset);

  const isAll = selectedTabs.has('all');
  const currentTypes = isAll
    ? ['income','expense','debt','due']
    : ACTIVITY_TABS.filter(t => t.key !== 'all' && selectedTabs.has(t.key)).flatMap(t => [...t.types]);

  const filtered = recordings.filter(r => {
    if (!currentTypes.includes(r.type)) return false;
    if (r.status === 'voided') return false;
    // When Due tab is selected, only show is_due expenses
    if (!isAll && selectedTabs.has('receivables') && r.type === 'expense' && !r.is_due) return false;
    if (!isAllCats && !selectedCategories.has(r.category_id)) return false;
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

  // Stats — date-filtered but not tab-filtered
  const dateFiltered = recordings.filter(r => {
    const [y, m, d] = r.transaction_date.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date < range.from) return false;
    const to = new Date(range.to); to.setHours(23, 59, 59);
    return date <= to;
  });
  const fromStr = `${range.from.getFullYear()}-${String(range.from.getMonth()+1).padStart(2,'0')}-${String(range.from.getDate()).padStart(2,'0')}`;
  const toStr   = `${range.to.getFullYear()}-${String(range.to.getMonth()+1).padStart(2,'0')}-${String(range.to.getDate()).padStart(2,'0')}`;

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
  const rangeLabel = isSameDay(range.from, range.to)
    ? fmtFull(range.from)
    : `${fmtShort(range.from)} – ${fmtFull(range.to)}`;

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
      // For non-monthly modes, just use this-month with offset 0
      setActivePreset('this-month');
      setRangeOffset(0);
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
    if (activePreset === 'custom') {
      const days = Math.round((customTo.getTime() - customFrom.getTime()) / 86400000) + 1;
      const newFrom = new Date(customFrom); newFrom.setDate(newFrom.getDate() + dir * days);
      const newTo   = new Date(customTo);   newTo.setDate(newTo.getDate()   + dir * days);
      setCustomFrom(newFrom); setCustomTo(newTo);
    } else {
      setRangeOffset(o => o + dir);
    }
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

    const TEAL   = '#2A7A6F';
    const PEACH_C = '#FFAB91';
    const MINT    = '#B6E1DE';
    const TEXT    = '#425252';
    const MUTED   = '#929090';
    const FAINT   = '#c0c0c0';
    const BORDER  = '#f0f0f0';

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
    const sortedGroups = allGrouped.sort((a, b) => a.date.getTime() - b.date.getTime());

    let totalIn = 0, totalOut = 0;
    sortedGroups.flatMap(g => g.items).forEach((r: any) => {
      if (r.type === 'income') totalIn += Number(r.amount);
      else if (r.type === 'expense' || r.type === 'debt' || r.type === 'payment') {
        totalOut += Number(r.amount);
      }
    });
    const netBalance = totalIn - totalOut;
    const netColor = netBalance >= 0 ? TEAL : PEACH_C;

    const rangeStr = isSameDay(range.from, range.to)
      ? fmtDate(fmtD(range.from))
      : `${fmtDate(fmtD(range.from))} &ndash; ${fmtDate(fmtD(range.to))}`;
    const generatedOn = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

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
        const balColor = runningBalance >= 0 ? TEAL : PEACH_C;

        return `<tr style="border-bottom:1px solid ${BORDER}">
          <td style="padding:10px 8px;font-family:monospace;font-size:10px;color:${MUTED};white-space:nowrap">${fmtDate(r.transaction_date)}</td>
          <td style="padding:10px 8px">
            <div style="font-family:monospace;font-size:12px;font-weight:700;color:${TEXT}">${r.name}</div>
            ${r.categories?.name ? `<div style="font-family:monospace;font-size:10px;color:${FAINT};margin-top:2px">${r.categories.name}</div>` : ''}
          </td>
          <td style="padding:10px 8px;text-align:center">
            <span style="font-family:monospace;font-size:9px;font-weight:700;padding:3px 8px;border-radius:999px;background:${isCredit ? MINT + '55' : PEACH_C + '44'};color:${isCredit ? TEAL : PEACH_C};white-space:nowrap;letter-spacing:0.3px">${tl.label.toUpperCase()}</span>
          </td>
          <td style="padding:10px 8px;text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:${PEACH_C}">${isDebit ? fmtAmt(displayAmt) : ''}</td>
          <td style="padding:10px 8px;text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:${TEAL}">${isCredit ? fmtAmt(displayAmt) : ''}</td>
          <td style="padding:10px 8px;text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:${balColor}">${fmtAmt(runningBalance)}</td>
        </tr>`;
      }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#fff; width:794px; padding:32px; }
  table { width:100%; border-collapse:collapse; }
  th { padding:9px 8px; font-family:monospace; font-size:10px; font-weight:700; color:${MUTED}; text-transform:uppercase; letter-spacing:0.6px; border-bottom:1px solid ${BORDER}; }
  th:nth-child(4), th:nth-child(5), th:nth-child(6) { text-align:right; }
</style>
</head><body>

<div style="font-family:monospace;font-size:13px;font-weight:700;color:${TEAL};letter-spacing:1px;margin-bottom:16px">LEDGR</div>
<div style="font-size:26px;font-weight:600;color:${TEXT};letter-spacing:-0.5px;margin-bottom:6px">${String(name)}</div>
<div style="font-family:monospace;font-size:11px;color:${MUTED};margin-bottom:2px">${rangeStr}</div>
<div style="font-family:monospace;font-size:10px;color:${FAINT};margin-bottom:24px">${dateFiltered.length} transaction${dateFiltered.length !== 1 ? 's' : ''} &middot; generated ${generatedOn}</div>

<div style="height:1px;background:${BORDER};margin-bottom:20px"></div>

<div style="display:flex;gap:12px;margin-bottom:24px">
  <div style="flex:1;border:1px solid ${BORDER};border-radius:12px;padding:14px 16px">
    <div style="font-family:monospace;font-size:10px;color:${MUTED};letter-spacing:0.6px;text-transform:uppercase;margin-bottom:6px">money in</div>
    <div style="font-family:monospace;font-size:18px;font-weight:700;color:${TEAL}">${fmtAmt(totalIn)}</div>
  </div>
  <div style="flex:1;border:1px solid ${BORDER};border-radius:12px;padding:14px 16px">
    <div style="font-family:monospace;font-size:10px;color:${MUTED};letter-spacing:0.6px;text-transform:uppercase;margin-bottom:6px">money out</div>
    <div style="font-family:monospace;font-size:18px;font-weight:700;color:${PEACH_C}">${fmtAmt(totalOut)}</div>
  </div>
  <div style="flex:1;border:1px solid ${BORDER};border-radius:12px;padding:14px 16px;background:${netBalance >= 0 ? MINT + '44' : PEACH_C + '33'}">
    <div style="font-family:monospace;font-size:10px;color:${MUTED};letter-spacing:0.6px;text-transform:uppercase;margin-bottom:6px">net</div>
    <div style="font-family:monospace;font-size:18px;font-weight:700;color:${netColor}">${fmtAmt(netBalance)}</div>
  </div>
</div>

<div style="border:1px solid ${BORDER};border-radius:12px;overflow:hidden;margin-bottom:24px">
  <table>
    <thead>
      <tr style="background:#fafafa">
        <th style="width:100px;text-align:left">Date</th>
        <th style="text-align:left">Description</th>
        <th style="width:130px;text-align:center">Type</th>
        <th style="width:110px">Out</th>
        <th style="width:110px">In</th>
        <th style="width:110px">Balance</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    <tfoot>
      <tr style="background:#fafafa;border-top:1px solid ${BORDER}">
        <td colspan="3" style="padding:10px 8px;font-family:monospace;font-size:10px;font-weight:700;color:${MUTED};letter-spacing:0.6px;text-transform:uppercase">closing balance</td>
        <td style="padding:10px 8px;text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:${PEACH_C}">${fmtAmt(totalOut)}</td>
        <td style="padding:10px 8px;text-align:right;font-family:monospace;font-size:12px;font-weight:700;color:${TEAL}">${fmtAmt(totalIn)}</td>
        <td style="padding:10px 8px;text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:${netColor}">${fmtAmt(netBalance)}</td>
      </tr>
    </tfoot>
  </table>
</div>

<div style="font-family:monospace;font-size:10px;color:${FAINT};text-align:center">generated by LEDGR</div>

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
    } catch (e) { console.error('handleStatementWebViewMessage error:', e); }
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
      console.error('generateStatement error:', e);
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
      title: 'you\'ve been invited to a shared space',
      body: `${String(name)} — role: ${inviteRole}`,
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
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#B6E1DE" />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{name}</Text>
          {canViewOnly && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: '#B6E1DE22' }}>
              <Text style={{ fontFamily: Brand.font.mono, fontSize: 9, color: '#B6E1DE', letterSpacing: 0.5 }}>viewer</Text>
            </View>
          )}
          {myRole === 'co-owner' && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: '#B6E1DE22' }}>
              <Text style={{ fontFamily: Brand.font.mono, fontSize: 9, color: '#B6E1DE', letterSpacing: 0.5 }}>co-owner</Text>
            </View>
          )}
          <TouchableOpacity
            style={s.addBtn}
            onPress={generateStatement}
            activeOpacity={0.8}
            disabled={statementLoading}
          >
            {statementLoading
              ? <ActivityIndicator size="small" color="#B6E1DE" />
              : <Ionicons name="document-text-outline" size={16} color="#B6E1DE" />}
          </TouchableOpacity>
          {spaceId !== 'all' && canAddRecordings && (
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#B6E1DE" />
            </TouchableOpacity>
          )}
          {isOwner && spaceId !== 'all' && (
            <TouchableOpacity style={s.addBtn} onPress={() => setMembersModal(true)} activeOpacity={0.8}>
              <Ionicons name="people-outline" size={16} color="#B6E1DE" />
            </TouchableOpacity>
          )}
        </View>

        {/* Main scroll */}
        <ScrollView 
          contentContainerStyle={s.scroll} 
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >

          <ActivityTabs
            selectedTabs={selectedTabs}
            onToggle={handleTabToggle}
            tabValue={tabValue}
          />

          {/* Filter controls row */}
          <View style={s.filterControlsRow}>
            {spaceId !== 'all' && (
              <TouchableOpacity onPress={handleSortToggle} activeOpacity={0.75} style={s.filterBtn}>
                <Ionicons name={sortBy === 'date' ? 'calendar-outline' : 'pricetag-outline'} size={13} color={Colors.cyan} />
                <Text style={[s.filterBtnText, { color: Colors.cyan }]}>{sortBy}</Text>
              </TouchableOpacity>
            )}
            <View style={s.dateNavRow}>
              <TouchableOpacity style={s.dateNavArrow} onPress={() => navigateRange(-1)} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={14} color={Colors.cyan} />
              </TouchableOpacity>
              <TouchableOpacity style={s.filterBtn} onPress={() => setShowDateModal(true)} activeOpacity={0.75}>
                <Ionicons name="calendar-outline" size={13} color={Colors.cyan} />
                <Text style={s.filterBtnText}>{rangeLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dateNavArrow} onPress={() => navigateRange(1)} activeOpacity={0.7}>
                <Ionicons name="chevron-forward" size={14} color={Colors.cyan} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.filterBtn} onPress={handleCategoryFilter} activeOpacity={0.75}>
              <Ionicons name="options-outline" size={13} color={!isAllCats ? Colors.cyan : Colors.muted} />
              <Text style={[s.filterBtnText, !isAllCats && { color: Colors.cyan }]}>Filter</Text>
            </TouchableOpacity>
          </View>

          <View style={s.divider} />

          {/* Recordings section */}
          <View style={s.sectionRow}>
            <Text style={s.sectionHeader}>recordings ({filtered.length})</Text>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Colors.cyan} style={{ marginTop: 24 }} />
          ) : filtered.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyText}>no recordings found for this period</Text>
            </View>
          ) : (
            paginatedGroups.map(group => (
              <View key={group.key}>
                <View style={s.dateHeaderRow}>
                  <Text style={s.dateHeaderText}>{group.label}</Text>
                </View>
                {group.items.map(item => {
                  const tl = getTypeLabel(item.type, item.status, item.is_due, item.paid_amount, item.amount);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={s.row}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: '/(app)/recording-detail', params: { recordingId: item.id } } as any)}
                      onLongPress={() => { if (!canAddRecordings) return; setPendingDeleteId(item.id); setPendingDeleteName(item.name); setConfirmModal(true); }}
                    >
                      <View style={s.rowIconWrap}>
                        <Ionicons name={(item.categories?.icon ?? 'ellipse-outline') as any} size={18} color={Colors.cyan} />
                      </View>
                      <View style={s.rowMid}>
                        <Text style={s.rowType}>{tl.label}</Text>
                        <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                        {sortBy === 'category' && (
                          <Text style={s.rowDate}>{smartDateLabel(item.transaction_date)}</Text>
                        )}
                      </View>
                      <Text style={[s.rowAmount, { color: tl.color }]}>
                        {item.is_due
                          ? Math.max(0, Number(item.amount) - Number(item.paid_amount ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })
                          : fmtAmount(Number(item.amount))}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}

          {/* Ghost rows from recurring records */}
          {ghosts.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <View style={s.dateHeaderRow}>
                <Text style={s.dateHeaderText}>scheduled</Text>
              </View>
              {ghosts.map(g => (
                <TouchableOpacity
                  key={`${g.rec.id}-${g.cycleKey}`}
                  style={[s.row, s.ghostRow, g.isOverdue && s.ghostRowOverdue]}
                  activeOpacity={0.8}
                  onPress={() => openGhostModal(g)}
                >
                  <View style={[s.rowIconWrap, { backgroundColor: g.isOverdue ? '#F9731622' : Colors.surface }]}>
                    <Ionicons name="repeat-outline" size={18} color={g.isOverdue ? '#F97316' : Colors.muted} />
                  </View>
                  <View style={s.rowMid}>
                    <Text style={[s.rowType, g.isOverdue && { color: '#F97316' }]}>
                      {g.isOverdue ? 'overdue' : 'scheduled'} · {g.rec.type}
                    </Text>
                    <Text style={s.rowName} numberOfLines={1}>{g.rec.name}</Text>
                    <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>
                      due {g.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={[s.rowAmount, { color: g.isOverdue ? '#F97316' : Colors.muted }]}>
                    {g.rec.installment_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Load more indicator */}
          {hasMore && (
            <View style={s.loadMoreWrap}>
              {isLoadingMore ? (
                <ActivityIndicator color={Colors.cyan} size="small" />
              ) : (
                <Text style={s.loadMoreText}>scroll for more</Text>
              )}
            </View>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>

      {showAddModal && (
        <AddRecordingScreen inlineProps={{ spaceId: spaceId as string, spaceName: name as string, defaultDate: new Date().toISOString().split('T')[0], onClose: () => { setShowAddModal(false); queryClient.refetchQueries({ queryKey: ['recordings', spaceId] }); } }} />
      )}

      {/* Date modal */}
      <BottomSheet visible={showDateModal} onClose={() => setShowDateModal(false)} title="date range" height={MODAL_HEIGHT}>
        <View style={s.chipRow}>
          {PRESETS.map(p => {
            const active = p.key === activePreset;
            return (
              <TouchableOpacity key={p.key} style={[s.chip, active && s.chipActive]} onPress={() => applyPreset(p.key)} activeOpacity={0.75}>
                <Ionicons name={p.icon as any} size={13} color={active ? Colors.white : Colors.muted} />
                <Text style={[s.chipText, active && s.chipTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activePreset === 'cutoff' && (
          <View style={{ marginBottom: 16 }}>
            <Text style={s.modalLabel}>billing cycle starts on day</Text>
            <View style={s.chipRow}>
              {[1,5,10,15,20,25,28].map(d => (
                <TouchableOpacity key={d} style={[s.chip, parseInt(cutoffInput) === d && s.chipActive]} onPress={() => { setCutoffInput(String(d)); setCutoffDay(d); }}>
                  <Text style={[s.chipText, parseInt(cutoffInput) === d && s.chipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {activePreset === 'custom' && (
          <View style={s.calWrap}>
            <Text style={s.calHint}>{pickingDate === 'from' ? 'tap start date' : 'tap end date'}</Text>
            <View style={s.pickerNav}>
              <TouchableOpacity onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); }}>
                <Ionicons name="chevron-back" size={18} color={Colors.text} />
              </TouchableOpacity>
              <Text style={s.pickerMonthText}>{MONTHS[pickerMonth].toLowerCase()} {pickerYear}</Text>
              <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}>
                <Ionicons name="chevron-forward" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
              {['su','mo','tu','we','th','fr','sa'].map(d => <Text key={d} style={s.calDay}>{d}</Text>)}
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
              style={{ backgroundColor: Colors.cyan, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', opacity: ghostSaving ? 0.5 : 1 }}
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
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Colors.cyan + '33', marginBottom: 12 }}
            onPress={() => { setMembersModal(false); openInviteModal(); }}
          >
            <Ionicons name="person-add-outline" size={13} color={Colors.cyan} />
            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 12, color: Colors.cyan }}>invite friend</Text>
          </TouchableOpacity>
        )}
        {members.length === 0 ? (
          <Text style={{ fontFamily: Brand.font.mono, fontSize: 12, color: Colors.muted }}>no members yet</Text>
        ) : (
          members.map(m => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.cyan + '33', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 13, color: Colors.cyan }}>{m.name.charAt(0).toUpperCase()}</Text>
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
                  <Ionicons name={inviteFriendId === f.id ? 'radio-button-on' : 'radio-button-off'} size={16} color={inviteFriendId === f.id ? Colors.cyan : Colors.faint} />
                  <Text style={{ fontFamily: Brand.font.heading, fontSize: 13, color: Colors.text }}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>role</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['viewer', 'co-owner'] as const).map(r => (
                <TouchableOpacity
                  key={r}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: inviteRole === r ? Colors.cyan : Colors.borderMid, backgroundColor: inviteRole === r ? Colors.cyan + '33' : Colors.surface }}
                  onPress={() => setInviteRole(r)}
                >
                  <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 12, color: inviteRole === r ? Colors.cyan : Colors.muted }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 10, color: Colors.muted, marginTop: 8 }}>
              {inviteRole === 'co-owner' ? 'can add recordings and invite members' : 'can view recordings only'}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: Colors.cyan + '44', borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20, opacity: inviteSaving || !inviteFriendId ? 0.5 : 1 }}
              onPress={sendSpaceInvite}
              disabled={inviteSaving || !inviteFriendId}
            >
              <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 14, color: Colors.cyan }}>{inviteSaving ? 'sending...' : 'send invite'}</Text>
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
  // Header
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 16, paddingBottom: 16, gap: 10, backgroundColor: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: '#333' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#B6E1DE22', alignItems: 'center', justifyContent: 'center' },
  title:   { flex: 1, fontFamily: Brand.font.display, fontSize: 20, color: '#B6E1DE', letterSpacing: -0.3, textAlign: 'center' },
  addBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#B6E1DE22', alignItems: 'center', justifyContent: 'center' },

  // Scroll
  scroll: { paddingHorizontal: 25, paddingBottom: 80 },
  divider: { height: 8, backgroundColor: Colors.surface, marginHorizontal: -25, marginVertical: 8 },

  // Section row (recordings only)
  sectionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 8 },
  sectionHeader: { ...Brand.type.sectionHeader },
  // Filter controls row
  filterControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 16, paddingBottom: 4 },
  filterRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateNavRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateNavArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  filterBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderMid },
  filterBtnText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.text },

  // Tab circles — now in ActivityTabs component

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { ...Brand.type.emptyText },

  // Date groups
  dateHeaderRow:  { marginTop: 12, marginBottom: 6, paddingTop: 12 },
  dateHeaderText: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, letterSpacing: 1.4, textTransform: 'uppercase' },

  // Recording row
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIconWrap: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  rowMid:      { flex: 1, gap: 2 },
  rowType:     { fontFamily: Fonts.mono,     fontSize: 10, color: Colors.muted, letterSpacing: 0.4, textTransform: 'uppercase' },
  rowName:     { ...Brand.type.cardTitle },
  rowDate:     { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  rowAmount:   { fontFamily: Fonts.monoBold, fontSize: 14, letterSpacing: -0.3 },

  // Modal chips
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  chipActive:     { backgroundColor: Colors.cyan },
  chipText:       { fontFamily: Fonts.mono,     fontSize: 12, color: Colors.muted },
  chipTextActive: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.white },
  modalLabel:     { fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted, marginBottom: 10 },
  sectionLabel:   { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  clearBtn:       { alignSelf: 'flex-end', marginBottom: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  clearBtnText:   { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.cyan },

  // Calendar
  calWrap:         { width: '100%' },
  calHint:         { fontFamily: Fonts.mono, fontSize: 11, color: Colors.cyan, marginBottom: 10 },
  pickerNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4, marginBottom: 10 },
  pickerMonthText: { fontFamily: Fonts.monoBold, fontSize: 15, color: Colors.text },
  calDay:          { flex: 1, textAlign: 'center', fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  calCell:         { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calCellRange:    { backgroundColor: Colors.cyan + '55', borderRadius: 0 },
  calCellEdge:     { backgroundColor: Colors.cyan },
  calCellToday:    { backgroundColor: Colors.surface },
  calCellText:     { fontFamily: Fonts.mono,     fontSize: 13, color: Colors.text },
  calCellTextActive: { fontFamily: Fonts.monoBold, color: Colors.text },

  // Load more
  loadMoreWrap: { alignItems: 'center', paddingVertical: 20 },
  loadMoreText: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted },
  // Ghost rows
  ghostRow:        { borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.md, marginBottom: 4, backgroundColor: Colors.surface },
  ghostRowOverdue: { borderColor: '#F97316', backgroundColor: '#F9731608' },
});
