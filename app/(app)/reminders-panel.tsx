import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, TextInput,
} from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import { Colors, Radius } from '@/components/ui/theme';
import { AppFont } from '../../src/lib/fonts';
import { DC } from '../../src/lib/design';
import TopHeader from '@/components/ui/TopHeader';
import NavIcon from '@/components/ui/NavIcons';
import { SvgXml } from 'react-native-svg';
import { useNav } from '../../src/lib/NavContext';
import GooeyLoader from '@/components/ui/GooeyLoader';
import { BlurView } from 'expo-blur';
import { isReminderDueToday, reminderFrequencyLabel } from '../../src/lib/reminderUtils';
import BottomSheet from '@/components/ui/BottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dateFilter, MONTH_LABELS } from '../../src/lib/dateFilter';

const SVG_ADD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4.75c.69 0 1.25.56 1.25 1.25v4.75H18a1.25 1.25 0 1 1 0 2.5h-4.75V18a1.25 1.25 0 1 1-2.5 0v-4.75H6a1.25 1.25 0 1 1 0-2.5h4.75V6c0-.69.56-1.25 1.25-1.25"/></svg>`;

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props { onClose: () => void; }

export default function RemindersPanel({ onClose }: Props) {
  const { userId } = useUser();
  const insets = useSafeAreaInsets();
  const { openRecording, toggleNotifDropdown } = useNav();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedCalDay, setSelectedCalDay] = useState<number | null>(null);

  // Global date filter
  const [filterMonth, setFilterMonth] = useState(dateFilter.getMonth());
  const [filterYear,  setFilterYear]  = useState(dateFilter.getYear());
  useEffect(() => dateFilter.subscribe(() => {
    setFilterMonth(dateFilter.getMonth());
    setFilterYear(dateFilter.getYear());
  }), []);
  const { from, to } = useMemo(() => dateFilter.getFromTo(), [filterMonth, filterYear]);
  const dateLabel = `${MONTH_LABELS[filterMonth]} ${filterYear}`;
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [draftMonth, setDraftMonth] = useState(filterMonth);
  const [draftYear,  setDraftYear]  = useState(filterYear);

  // Add reminder state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState<'expense' | 'income'>('expense');
  const [addDeadlineDay, setAddDeadlineDay] = useState('');
  const [addCategoryId, setAddCategoryId] = useState<string | null>(null);
  const [addSpaceId, setAddSpaceId] = useState<string | null>(null);
  const [addCategories, setAddCategories] = useState<any[]>([]);
  const [addSpaces, setAddSpaces] = useState<any[]>([]);
  const [addSaving, setAddSaving] = useState(false);

  // Action sheet state
  const [selectedReminder, setSelectedReminder] = useState<any>(null);
  const [showActions, setShowActions] = useState(false);
  const [showFulfillSheet, setShowFulfillSheet] = useState(false);
  const [fulfillAmount, setFulfillAmount] = useState('');
  const [fulfillSaving, setFulfillSaving] = useState(false);
  const [fulfillIsPartial, setFulfillIsPartial] = useState(false);
  const [fulfillDay, setFulfillDay] = useState(String(new Date().getDate()));
  const [fulfillMonth, setFulfillMonth] = useState(String(new Date().getMonth() + 1));
  const [fulfillYear, setFulfillYear] = useState(String(new Date().getFullYear()));

  const now = new Date();

  const { data: reminders = [], isLoading: loadingReminders } = useQuery({
    queryKey: ['reminders-panel', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recording_reminders')
        .select('id, name, frequency, day_of_week, day_of_month, start_date, end_date, status, recording_type, workspace_id, spaces:workspace_id(name)')
        .eq('user_id', userId)
        .order('name', { ascending: true });
      return (data ?? []).map((r: any) => ({
        ...r,
        space: Array.isArray(r.spaces) ? r.spaces[0] : r.spaces,
      }));
    },
    enabled: !!userId,
  });

  const { data: fulfilledRecs = [], isLoading: loadingRecs } = useQuery({
    queryKey: ['reminders-panel-recs', userId, from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('id, name, amount, type, status, transaction_date, reminder_id')
        .eq('user_id', userId)
        .not('reminder_id', 'is', null)
        .neq('status', 'voided')
        .gte('transaction_date', from)
        .lte('transaction_date', to)
        .order('transaction_date', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`reminders-panel-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recording_reminders', filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['reminders-panel', userId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordings', filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['reminders-panel-recs', userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['reminders-panel', userId] }),
      queryClient.invalidateQueries({ queryKey: ['reminders-panel-recs', userId] }),
    ]);
    setRefreshing(false);
  };

  const isLoading = loadingReminders || loadingRecs;

  const fulfilledMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    fulfilledRecs.forEach((r: any) => {
      if (!map[r.reminder_id]) map[r.reminder_id] = [];
      map[r.reminder_id].push(r);
    });
    return map;
  }, [fulfilledRecs]);

  const filtered = reminders.filter((r: any) => statusFilter === 'all' || r.status === statusFilter);
  const fulfilledFully = (id: string) => fulfilledMap[id]?.some((r: any) => r.status === 'paid' || r.status === 'received') ?? false;
  const fulfilledPartially = (id: string) => !fulfilledFully(id) && (fulfilledMap[id]?.length ?? 0) > 0;
  const fulfilled = filtered.filter((r: any) => r.status === 'active' && fulfilledFully(r.id));
  const ongoing   = filtered.filter((r: any) => r.status === 'active' && !fulfilledFully(r.id) && fulfilledPartially(r.id));
  const notYet    = filtered.filter((r: any) => r.status === 'active' && !fulfilledFully(r.id) && !fulfilledPartially(r.id));
  const paused    = filtered.filter((r: any) => r.status === 'paused');

  // Map day-of-month -> reminders due that day
  const dueDaysMap = useMemo(() => {
    const map: Record<number, any[]> = {};
    reminders.filter((r: any) => r.status === 'active' && r.day_of_month).forEach((r: any) => {
      const d = Number(r.day_of_month);
      if (!map[d]) map[d] = [];
      map[d].push(r);
    });
    return map;
  }, [reminders]);

  const openAddSheet = async () => {
    setAddName(''); setAddType('expense'); setAddDeadlineDay(''); setAddCategoryId(null); setAddSpaceId(null);
    const [{ data: cats }, { data: sps }] = await Promise.all([
      supabase.from('categories').select('id, name').eq('user_id', userId).order('name'),
      supabase.from('spaces').select('id, name').eq('user_id', userId).eq('is_active', true).order('name'),
    ]);
    setAddCategories(cats ?? []);
    setAddSpaces(sps ?? []);
    setShowAddSheet(true);
  };
  const saveReminder = async () => {
    if (!addName.trim() || addSaving) return;
    setAddSaving(true);
    await supabase.from('recording_reminders').insert({
      user_id: userId,
      name: addName.trim(),
      recording_type: addType,
      frequency: 'monthly',
      day_of_month: addDeadlineDay ? parseInt(addDeadlineDay) : null,
      workspace_id: addSpaceId ?? null,
      category_id: addCategoryId ?? null,
      start_date: new Date().toISOString().split('T')[0],
      status: 'active',
    });
    setAddSaving(false);
    setAddName('');
    setAddType('expense');
    setAddDeadlineDay('');
    setAddCategoryId(null);
    setAddSpaceId(null);
    setShowAddSheet(false);
    queryClient.invalidateQueries({ queryKey: ['reminders-panel', userId] });
  };

  const handleFulfill = async () => {
    if (!selectedReminder || !fulfillAmount) return;
    setFulfillSaving(true);
    const pad = (n: string) => String(n).padStart(2, '0');
    const txDate = `${fulfillYear}-${pad(fulfillMonth)}-${pad(fulfillDay)}`;
    await supabase.from('recordings').insert({
      user_id: userId,
      space_id: selectedReminder.workspace_id ?? null,
      name: selectedReminder.name,
      type: selectedReminder.recording_type,
      amount: parseFloat(fulfillAmount),
      transaction_date: txDate,
      status: fulfillIsPartial ? 'partial' : (selectedReminder.recording_type === 'income' ? 'received' : 'paid'),
      reminder_id: selectedReminder.id,
    });
    setFulfillSaving(false);
    setShowFulfillSheet(false);
    setFulfillAmount('');
    setFulfillIsPartial(false);
    queryClient.invalidateQueries({ queryKey: ['reminders-panel-recs', userId] });
  };

  const handleDelete = async () => {
    if (!selectedReminder) return;
    await supabase.from('recording_reminders').delete().eq('id', selectedReminder.id);
    setShowActions(false);
    queryClient.invalidateQueries({ queryKey: ['reminders-panel', userId] });
  };

  const handleTogglePause = async () => {
    if (!selectedReminder) return;
    const newStatus = selectedReminder.status === 'active' ? 'paused' : 'active';
    await supabase.from('recording_reminders').update({ status: newStatus }).eq('id', selectedReminder.id);
    setShowActions(false);
    queryClient.invalidateQueries({ queryKey: ['reminders-panel', userId] });
  };

  const renderRow = (r: any, i: number, arr: any[]) => {
    const isLast = i === arr.length - 1;
    const recs = fulfilledMap[r.id] ?? [];
    const isFulfilled = fulfilledFully(r.id);
    const isPartial = fulfilledPartially(r.id);
    const isDueToday = isReminderDueToday(r, now);

    return (
      <TouchableOpacity
        key={r.id}
        style={[st.row, isLast && st.rowLast]}
        activeOpacity={0.7}
        onPress={() => { setSelectedReminder(r); setShowActions(true); }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.rowName} numberOfLines={1}>{r.name}</Text>
          <Text style={st.rowSub}>{reminderFrequencyLabel(r)} · {r.recording_type}</Text>
          {r.space?.name && <Text style={[st.rowSub, { color: DC.viewBtnText }]}>{r.space.name}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {isFulfilled && (
            <View style={[st.badge, { backgroundColor: '#4f928922' }]}>
              <Text style={[st.badgeText, { color: '#4f9289' }]}>fulfilled</Text>
            </View>
          )}
          {isPartial && (
            <View style={[st.badge, { backgroundColor: '#FFAB9122' }]}>
              <Text style={[st.badgeText, { color: '#e07b50' }]}>partial</Text>
            </View>
          )}
          {isDueToday && !isFulfilled && !isPartial && (
            <View style={[st.badge, { backgroundColor: DC.viewBtnBg }]}>
              <Text style={[st.badgeText, { color: DC.viewBtnText }]}>due today</Text>
            </View>
          )}
          {r.status === 'paused' && (
            <View style={[st.badge, { backgroundColor: Colors.surface }]}>
              <Text style={[st.badgeText, { color: Colors.muted }]}>paused</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <View style={st.root}>
      <TopHeader
        title="Reminders"
        subtitle={dateLabel}
        onSubtitlePress={() => { setDraftMonth(filterMonth); setDraftYear(filterYear); setShowDateSheet(true); }}
        onBack={onClose}
        centered
        variant="blue"
        topInset={insets.top}
        right={
          <TouchableOpacity onPress={toggleNotifDropdown} activeOpacity={0.7}>
            <NavIcon name="notifications" size={22} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      {/* View toggle + filters */}
      <View style={st.filterRow}>
        <View style={st.segmentOuter}>
          <TouchableOpacity style={[st.segmentBtn, viewMode === 'list' && st.segmentBtnActive]} onPress={() => setViewMode('list')} activeOpacity={0.8}>
            <Text style={[st.segmentBtnText, viewMode === 'list' && st.segmentBtnTextActive]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.segmentBtn, viewMode === 'calendar' && st.segmentBtnActive]} onPress={() => setViewMode('calendar')} activeOpacity={0.8}>
            <Text style={[st.segmentBtnText, viewMode === 'calendar' && st.segmentBtnTextActive]}>Calendar</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginLeft: 'auto' }}>
          <TouchableOpacity
            onPress={() => openAddSheet()}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: DC.viewBtnBg, alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.7}
          >
            <SvgXml xml={SVG_ADD} width={18} height={18} color={DC.viewBtnText} />
          </TouchableOpacity>
        </View>
      </View>
      {viewMode === 'list' && (
        <View style={[st.filterRow, { paddingTop: 0 }]}>
          {(['all', 'active', 'paused'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[st.filterBtn, statusFilter === f && st.filterBtnActive]}
              onPress={() => setStatusFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[st.filterBtnText, statusFilter === f && st.filterBtnTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isLoading ? (
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}><GooeyLoader /></BlurView>
      ) : viewMode === 'calendar' ? (() => {
        const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
        const firstDow = new Date(calendarYear, calendarMonth, 1).getDay();
        const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
        while (cells.length % 7 !== 0) cells.push(null);
        const todayDay = now.getMonth() === calendarMonth && now.getFullYear() === calendarYear ? now.getDate() : -1;
        const selectedDayReminders = selectedCalDay ? (dueDaysMap[selectedCalDay] ?? []) : [];
        return (
          <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
            {/* Month nav */}
            <View style={st.calHeader}>
              <TouchableOpacity onPress={() => { const d = new Date(calendarYear, calendarMonth - 1, 1); setCalendarMonth(d.getMonth()); setCalendarYear(d.getFullYear()); setSelectedCalDay(null); }} activeOpacity={0.7} style={st.calNavBtn}>
                <Text style={st.calNavText}>‹</Text>
              </TouchableOpacity>
              <Text style={st.calMonthLabel}>{MONTH_NAMES[calendarMonth]} {calendarYear}</Text>
              <TouchableOpacity onPress={() => { const d = new Date(calendarYear, calendarMonth + 1, 1); setCalendarMonth(d.getMonth()); setCalendarYear(d.getFullYear()); setSelectedCalDay(null); }} activeOpacity={0.7} style={st.calNavBtn}>
                <Text style={st.calNavText}>›</Text>
              </TouchableOpacity>
            </View>
            {/* Day of week labels */}
            <View style={st.calDowRow}>
              {DOW.map(d => <Text key={d} style={st.calDowText}>{d}</Text>)}
            </View>
            {/* Day cells */}
            {Array.from({ length: cells.length / 7 }, (_, wi) => (
              <View key={wi} style={st.calWeekRow}>
                {cells.slice(wi * 7, wi * 7 + 7).map((day, di) => {
                  const hasDue = day !== null && !!dueDaysMap[day];
                  const isToday = day === todayDay;
                  const isSelected = day === selectedCalDay;
                  return (
                    <TouchableOpacity
                      key={di}
                      style={[st.calCell, isSelected && st.calCellSelected, isToday && !isSelected && st.calCellToday]}
                      onPress={() => day && setSelectedCalDay(day === selectedCalDay ? null : day)}
                      activeOpacity={day ? 0.7 : 1}
                    >
                      <Text style={[st.calCellText, isSelected && st.calCellTextSelected, isToday && !isSelected && st.calCellTextToday]}>
                        {day ?? ''}
                      </Text>
                      {hasDue && <View style={[st.calDot, isSelected && { backgroundColor: '#fff' }]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            {/* Selected day reminders */}
            {selectedCalDay !== null && (
              <View style={{ marginTop: 16 }}>
                <Text style={st.sectionLabel}>Due on day {selectedCalDay}</Text>
                {selectedDayReminders.length === 0 ? (
                  <Text style={st.rowSub}>no reminders</Text>
                ) : (
                  <View style={st.list}>
                    {selectedDayReminders.map((r: any, i: number) => renderRow(r, i, selectedDayReminders))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        );
      })() : filtered.length === 0 ? (
        <View style={st.empty}>
          <Text style={st.emptyText}>no reminders found</Text>
          <TouchableOpacity style={st.emptyAddBtn} onPress={() => openAddSheet()} activeOpacity={0.8}>
            <Text style={st.emptyAddBtnText}>+ Add Reminder</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {fulfilled.length > 0 && (
            <>
              <Text style={st.sectionLabel}>Fulfilled</Text>
              <View style={st.list}>{fulfilled.map((r, i) => renderRow(r, i, fulfilled))}</View>
            </>
          )}
          {ongoing.length > 0 && (
            <>
              <Text style={st.sectionLabel}>Ongoing</Text>
              <View style={st.list}>{ongoing.map((r, i) => renderRow(r, i, ongoing))}</View>
            </>
          )}
          {notYet.length > 0 && (
            <>
              <Text style={st.sectionLabel}>Not Yet Fulfilled</Text>
              <View style={st.list}>{notYet.map((r, i) => renderRow(r, i, notYet))}</View>
            </>
          )}
          {paused.length > 0 && (
            <>
              <Text style={[st.sectionLabel, { color: Colors.muted }]}>Paused</Text>
              <View style={st.list}>{paused.map((r, i) => renderRow(r, i, paused))}</View>
            </>
          )}
        </ScrollView>
      )}

      {/* Add Reminder sheet */}
      <BottomSheet visible={showAddSheet} onClose={() => setShowAddSheet(false)} title="new reminder">
        <TextInput
          style={st.input}
          placeholder="reminder name"
          placeholderTextColor={Colors.faint}
          value={addName}
          onChangeText={setAddName}
          autoFocus
        />
        <Text style={st.sheetLabel}>Type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {(['expense', 'income'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[st.toggleBtn, addType === t && st.toggleBtnActive]}
              onPress={() => setAddType(t)}
              activeOpacity={0.7}
            >
              <Text style={[st.toggleBtnText, addType === t && st.toggleBtnTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={st.sheetLabel}>Frequency</Text>
            <View style={[st.input, { justifyContent: 'center', marginBottom: 0 }]}>
              <Text style={{ fontFamily: AppFont.regular, fontSize: 14, color: Colors.muted }}>Monthly</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.sheetLabel}>Deadline Day</Text>
            <TextInput
              style={[st.input, { marginBottom: 0, textAlign: 'center' }]}
              placeholder="e.g. 15"
              placeholderTextColor={Colors.faint}
              value={addDeadlineDay}
              onChangeText={v => setAddDeadlineDay(v.replace(/[^0-9]/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        </View>
        <Text style={st.sheetLabel}>Category</Text>
        <View style={st.catGrid}>
          {addCategories.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              style={[st.catChip, addCategoryId === c.id && st.catChipActive]}
              onPress={() => setAddCategoryId(addCategoryId === c.id ? null : c.id)}
              activeOpacity={0.8}
            >
              <Text style={[st.catChipText, addCategoryId === c.id && st.catChipTextActive]} numberOfLines={1}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ marginBottom: 16 }} />
        <Text style={st.sheetLabel}>Folder</Text>
        <View style={st.catGrid}>
          {addSpaces.map((sp: any) => (
            <TouchableOpacity
              key={sp.id}
              style={[st.catChip, addSpaceId === sp.id && st.catChipActive]}
              onPress={() => setAddSpaceId(addSpaceId === sp.id ? null : sp.id)}
              activeOpacity={0.8}
            >
              <Text style={[st.catChipText, addSpaceId === sp.id && st.catChipTextActive]} numberOfLines={1}>{sp.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ marginBottom: 20 }} />
        <TouchableOpacity
          style={[st.saveBtn, (!addName.trim() || addSaving) && { opacity: 0.4 }]}
          onPress={saveReminder}
          disabled={!addName.trim() || addSaving}
          activeOpacity={0.8}
        >
          <Text style={st.saveBtnText}>{addSaving ? 'saving...' : 'Save Reminder'}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Actions sheet */}
      <BottomSheet visible={showActions} onClose={() => setShowActions(false)} title={selectedReminder?.name ?? 'reminder'}>
        <TouchableOpacity style={st.actionRow} activeOpacity={0.7} onPress={() => { setShowActions(false); setFulfillAmount(''); setFulfillIsPartial(false); setShowFulfillSheet(true); }}>
          <Text style={st.actionText}>Fulfill</Text>
          <Text style={st.actionSub}>record a transaction for this reminder</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.actionRow} activeOpacity={0.7} onPress={handleTogglePause}>
          <Text style={st.actionText}>{selectedReminder?.status === 'active' ? 'Pause' : 'Resume'}</Text>
          <Text style={st.actionSub}>{selectedReminder?.status === 'active' ? 'temporarily stop this reminder' : 'reactivate this reminder'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.actionRow, { borderBottomWidth: 0 }]} activeOpacity={0.7} onPress={handleDelete}>
          <Text style={[st.actionText, { color: DC.btnDangerBg }]}>Delete</Text>
          <Text style={st.actionSub}>recordings created from this reminder are kept</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Fulfill sheet */}
      <BottomSheet visible={showFulfillSheet} onClose={() => setShowFulfillSheet(false)} title="fulfill reminder">
        <Text style={st.sheetLabel}>Payment Type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity style={[st.toggleBtn, !fulfillIsPartial && st.toggleBtnActive]} onPress={() => setFulfillIsPartial(false)} activeOpacity={0.7}>
            <Text style={[st.toggleBtnText, !fulfillIsPartial && st.toggleBtnTextActive]}>Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.toggleBtn, fulfillIsPartial && st.toggleBtnActive]} onPress={() => setFulfillIsPartial(true)} activeOpacity={0.7}>
            <Text style={[st.toggleBtnText, fulfillIsPartial && st.toggleBtnTextActive]}>Partial</Text>
          </TouchableOpacity>
        </View>
        <Text style={st.sheetLabel}>Date</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <View style={{ flex: 2 }}>
            <Text style={st.dateLabel}>Month</Text>
            <TextInput style={st.dateInput} value={MONTHS[parseInt(fulfillMonth) - 1]} editable={false} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.dateLabel}>Day</Text>
            <TextInput style={st.dateInput} value={fulfillDay} onChangeText={setFulfillDay} keyboardType="number-pad" maxLength={2} placeholder="DD" placeholderTextColor={Colors.faint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.dateLabel}>Year</Text>
            <TextInput style={st.dateInput} value={fulfillYear} onChangeText={setFulfillYear} keyboardType="number-pad" maxLength={4} placeholder="YYYY" placeholderTextColor={Colors.faint} />
          </View>
        </View>
        <Text style={st.sheetLabel}>Amount</Text>
        <TextInput
          style={[st.input, { marginBottom: 16 }]}
          placeholder="0.00"
          placeholderTextColor={Colors.faint}
          value={fulfillAmount}
          onChangeText={setFulfillAmount}
          keyboardType="decimal-pad"
          autoFocus
        />
        <TouchableOpacity
          style={[st.saveBtn, (!fulfillAmount || fulfillSaving) && { opacity: 0.4 }]}
          onPress={handleFulfill}
          disabled={!fulfillAmount || fulfillSaving}
          activeOpacity={0.8}
        >
          <Text style={st.saveBtnText}>{fulfillSaving ? 'saving...' : 'Record'}</Text>
        </TouchableOpacity>
      </BottomSheet>
      {/* Date picker sheet */}
      <BottomSheet visible={showDateSheet} onClose={() => setShowDateSheet(false)} title="select month">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => setDraftYear(y => y - 1)} activeOpacity={0.7} style={{ padding: 8 }}>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 22, color: DC.pageText, lineHeight: 26 }}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: AppFont.bold, fontSize: 16, color: DC.pageText, minWidth: 60, textAlign: 'center' }}>{draftYear}</Text>
          <TouchableOpacity onPress={() => setDraftYear(y => y + 1)} activeOpacity={0.7} style={{ padding: 8 }}>
            <Text style={{ fontFamily: AppFont.regular, fontSize: 22, color: DC.pageText, lineHeight: 26 }}>{'›'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {MONTH_LABELS.map((label, i) => (
            <TouchableOpacity
              key={label}
              style={[{ width: '22%', flexGrow: 1, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder, alignItems: 'center' }, draftMonth === i && { backgroundColor: '#4394ff', borderColor: '#4394ff' }]}
              onPress={() => setDraftMonth(i)}
              activeOpacity={0.7}
            >
              <Text style={[{ fontFamily: AppFont.regular, fontSize: 12, color: DC.pageTextMuted }, draftMonth === i && { fontFamily: AppFont.semiBold, color: '#ffffff' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={{ backgroundColor: '#4394ff', borderRadius: 999, paddingVertical: 14, alignItems: 'center' }}
          onPress={() => { dateFilter.set(draftMonth, draftYear); setShowDateSheet(false); }}
          activeOpacity={0.8}
        >
          <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: '#ffffff' }}>Apply</Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: DC.pagePadding, paddingTop: 8, paddingBottom: 80 },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: DC.pagePadding, paddingVertical: 12 },
  filterBtn:           { flex: 1, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder, backgroundColor: DC.pageBg, alignItems: 'center' },
  filterBtnActive:     { backgroundColor: DC.headerBlueBg, borderColor: DC.headerBlueBg },
  filterBtnText:       { fontFamily: AppFont.regular, fontSize: 12, color: DC.pageTextMuted },
  filterBtnTextActive: { fontFamily: AppFont.semiBold, fontSize: 12, color: '#ffffff' },

  sectionLabel: { fontFamily: AppFont.semiBold, fontSize: 11, color: DC.pageTextMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 16, marginBottom: 8 },
  list: { borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 4 },

  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  rowLast: { borderBottomWidth: 0 },
  rowName: { fontFamily: AppFont.semiBold, fontSize: 13, color: DC.pageText },
  rowSub:  { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted },

  badge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontFamily: AppFont.semiBold, fontSize: 10 },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingBottom: 80 },
  emptyText:    { fontFamily: AppFont.regular, fontSize: 13, color: Colors.muted },
  emptyAddBtn:  { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: DC.viewBtnBg },
  emptyAddBtnText: { fontFamily: AppFont.semiBold, fontSize: 13, color: DC.viewBtnText },

  // Sheet styles
  sheetLabel: { fontFamily: AppFont.semiBold, fontSize: 11, color: DC.pageTextMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input:      { fontFamily: AppFont.regular, fontSize: 16, color: DC.pageText, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 16 },
  toggleBtn:        { flex: 1, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder, backgroundColor: DC.pageBg, alignItems: 'center' },
  toggleBtnActive:  { backgroundColor: DC.headerBlueBg, borderColor: DC.headerBlueBg },
  toggleBtnText:    { fontFamily: AppFont.regular, fontSize: 12, color: DC.pageTextMuted },
  toggleBtnTextActive: { fontFamily: AppFont.semiBold, fontSize: 12, color: '#ffffff' },
  saveBtn:     { backgroundColor: DC.btnBg, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontFamily: AppFont.semiBold, fontSize: 14, color: '#ffffff' },

  actionRow:  { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  actionText: { fontFamily: AppFont.semiBold, fontSize: 14, color: DC.pageText },
  actionSub:  { fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted, marginTop: 2 },

  catGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  catChip:           { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: DC.controlBorder, backgroundColor: 'transparent' },
  catChipActive:     { backgroundColor: DC.headerBlueBg, borderColor: DC.headerBlueBg },
  catChipText:       { fontFamily: AppFont.regular, fontSize: 12, color: DC.pageText },
  catChipTextActive: { fontFamily: AppFont.semiBold, fontSize: 12, color: '#ffffff' },
  // Segment toggle
  segmentOuter:        { flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: DC.controlBorder, overflow: 'hidden', height: 34 },
  segmentBtn:          { paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  segmentBtnActive:    { backgroundColor: DC.headerBlueBg },
  segmentBtnText:      { fontFamily: AppFont.regular, fontSize: 12, color: DC.pageTextMuted },
  segmentBtnTextActive:{ fontFamily: AppFont.semiBold, fontSize: 12, color: '#fff' },

  // Calendar
  calHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  calNavBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: DC.viewBtnBg, alignItems: 'center', justifyContent: 'center' },
  calNavText:     { fontFamily: AppFont.bold, fontSize: 20, color: DC.viewBtnText, lineHeight: 24 },
  calMonthLabel:  { fontFamily: AppFont.semiBold, fontSize: 15, color: DC.pageText },
  calDowRow:      { flexDirection: 'row', marginBottom: 4 },
  calDowText:     { flex: 1, textAlign: 'center', fontFamily: AppFont.semiBold, fontSize: 10, color: Colors.muted, textTransform: 'uppercase' },
  calWeekRow:     { flexDirection: 'row', marginBottom: 2 },
  calCell:        { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calCellSelected:{ backgroundColor: DC.headerBlueBg },
  calCellToday:   { backgroundColor: DC.viewBtnBg },
  calCellText:    { fontFamily: AppFont.regular, fontSize: 13, color: DC.pageText },
  calCellTextSelected: { fontFamily: AppFont.semiBold, color: '#fff' },
  calCellTextToday:    { fontFamily: AppFont.semiBold, color: DC.viewBtnText },
  calDot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: DC.headerBlueBg, marginTop: 2 },
  dateInput: { fontFamily: AppFont.regular, fontSize: 14, color: DC.pageText, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderMid, textAlign: 'center' },
});
