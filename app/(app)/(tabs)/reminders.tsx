import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { useUser } from '../../../src/hooks/useUser';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { Brand } from '../../../src/lib/brand';
import type { RecordingReminder, ReminderFrequency } from '../../../src/types';
import {
  isReminderDueToday,
  reminderFrequencyLabel,
  scheduleReminderNotification,
} from '../../../src/lib/reminderUtils';

const FREQUENCIES: ReminderFrequency[] = ['daily', 'weekly', 'monthly'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const CURRENT_YEAR = today.getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + i);

export default function RemindersScreen() {
  const { userId } = useUser();
  const queryClient = useQueryClient();

  // ── Add/Edit modal state ────────────────────────────────────────────────
  const [showModal, setShowModal]       = useState(false);
  const [editTarget, setEditTarget]     = useState<RecordingReminder | null>(null);
  const [rName, setRName]               = useState('');
  const [rFrequency, setRFrequency]     = useState<ReminderFrequency>('monthly');
  const [rDayOfWeek, setRDayOfWeek]     = useState(1);
  const [rDayOfMonth, setRDayOfMonth]   = useState(1);
  const [rStartMonth, setRStartMonth]   = useState(today.getMonth());     // 0-indexed
  const [rStartDay, setRStartDay]       = useState(today.getDate());      // 1-31
  const [rStartYear, setRStartYear]     = useState(today.getFullYear());
  const [rEndDate, setREndDate]         = useState('');
  const [rCategoryId, setRCategoryId]   = useState('');
  const [rAccountId, setRAccountId]     = useState('');
  const [rSpaceId, setRSpaceId]         = useState('');
  const [rRecordingType, setRRecordingType] = useState<'expense'|'income'|'debt'|'due'>('expense');
  const [saving, setSaving]             = useState(false);

  // ── Fill reminder modal state ───────────────────────────────────────────
  const [fillModal, setFillModal]         = useState(false);
  const [fillTarget, setFillTarget]       = useState<RecordingReminder | null>(null);
  const [fillAmount, setFillAmount]       = useState('');
  const [fillSaving, setFillSaving]       = useState(false);
  const [fillIsPartial, setFillIsPartial] = useState(false);
  const [fillIsDue, setFillIsDue]         = useState(false);   // expense → due
  const [fillIsLoan, setFillIsLoan]       = useState(false);   // income → loan (payable)
  const [fillLinked, setFillLinked]       = useState<any[]>([]); // existing recordings for this reminder

  const openFill = async (r: RecordingReminder) => {
    setFillTarget(r);
    setFillAmount('');
    setFillIsPartial(false);
    setFillIsDue(false);
    setFillIsLoan(false);
    // fetch existing recordings linked to this reminder
    const { data } = await supabase
      .from('recordings')
      .select('id, name, amount, transaction_date, type, status')
      .eq('reminder_id', r.id)
      .order('transaction_date', { ascending: false });
    setFillLinked(data ?? []);
    setFillModal(true);
  };

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: reminders = [], isLoading } = useQuery<RecordingReminder[]>({
    queryKey: ['reminders', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recording_reminders')
        .select('*, categories:category_id(name,color,icon), account:account_id(account_name,bank), space:workspace_id(name,color)')
        .eq('user_id', userId)
        .in('status', ['active', 'paused'])
        .order('name', { ascending: true });
      return (data ?? []).map((r: any) => ({
        ...r,
        categories: Array.isArray(r.categories) ? r.categories[0] : r.categories,
        account:    Array.isArray(r.account)    ? r.account[0]    : r.account,
        space:      Array.isArray(r.space)      ? r.space[0]      : r.space,
      }));
    },
    enabled: !!userId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', userId],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id,name,color,icon').eq('user_id', userId).order('name');
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', userId],
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select('id,account_name,bank').eq('user_id', userId).order('account_name');
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces-list', userId],
    queryFn: async () => {
      const { data } = await supabase.from('spaces').select('id,name').eq('user_id', userId).eq('is_active', true).order('name');
      return data ?? [];
    },
    enabled: !!userId,
  });

  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['reminders', userId] });
  }, [userId]));

  // ── Derived lists ────────────────────────────────────────────────────────
  const now      = new Date();
  const dueToday = reminders.filter(r => r.status === 'active' && isReminderDueToday(r, now));
  const upcoming = reminders.filter(r => r.status === 'active' && !isReminderDueToday(r, now));
  const paused   = reminders.filter(r => r.status === 'paused');

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null);
    setRName(''); setRFrequency('monthly'); setRDayOfWeek(1); setRDayOfMonth(1);
    setRStartMonth(today.getMonth()); setRStartDay(today.getDate()); setRStartYear(today.getFullYear());
    setREndDate('');
    setRCategoryId(''); setRAccountId(''); setRSpaceId(''); setRRecordingType('expense');
    setShowModal(true);
  };

  const openEdit = (r: RecordingReminder) => {
    setEditTarget(r);
    setRName(r.name);
    setRFrequency(r.frequency);
    setRDayOfWeek(r.day_of_week ?? 1);
    setRDayOfMonth(r.day_of_month ?? 1);
    const sd = new Date(r.start_date + 'T00:00:00');
    setRStartMonth(sd.getMonth());
    setRStartDay(sd.getDate());
    setRStartYear(sd.getFullYear());
    setREndDate(r.end_date ?? '');
    setRCategoryId(r.category_id ?? '');
    setRAccountId(r.account_id ?? '');
    setRSpaceId(r.workspace_id ?? '');
    setRRecordingType((r.recording_type ?? 'expense') as any);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!rName.trim()) return;
    setSaving(true);
    try {
      const startDate = `${rStartYear}-${String(rStartMonth + 1).padStart(2, '0')}-${String(rFrequency === 'monthly' ? rDayOfMonth : rStartDay).padStart(2, '0')}`;
      const payload: any = {
        user_id:      userId,
        name:         rName.trim(),
        frequency:    rFrequency,
        day_of_week:  rFrequency === 'weekly'  ? rDayOfWeek  : null,
        day_of_month: rFrequency === 'monthly' ? rDayOfMonth : null,
        recording_type: rRecordingType,
        interval_days: null,
        start_date:   startDate,
        end_date:     rEndDate || null,
        category_id:  rCategoryId || null,
        account_id:   rAccountId  || null,
        workspace_id: rSpaceId    || null,
        status:       'active',
      };

      let saved: RecordingReminder | null = null;
      if (editTarget) {
        const { data } = await supabase.from('recording_reminders').update(payload).eq('id', editTarget.id).select().single();
        saved = data;
      } else {
        const { data } = await supabase.from('recording_reminders').insert(payload).select().single();
        saved = data;
      }
      if (saved) await scheduleReminderNotification(saved);
      queryClient.invalidateQueries({ queryKey: ['reminders', userId] });
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    // archive instead of delete to preserve linked recordings
    await supabase.from('recording_reminders').update({ status: 'paused' }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['reminders', userId] });
  };

  const handleToggleStatus = async (r: RecordingReminder) => {
    const next = r.status === 'active' ? 'paused' : 'active';
    await supabase.from('recording_reminders').update({ status: next }).eq('id', r.id);
    queryClient.invalidateQueries({ queryKey: ['reminders', userId] });
  };

  const [choiceTarget, setChoiceTarget] = useState<RecordingReminder | null>(null);
  const [choiceModal, setChoiceModal]   = useState(false);

  const openChoice = (r: RecordingReminder) => {
    setChoiceTarget(r);
    setChoiceModal(true);
  };

  const handleFill = async () => {
    if (!fillTarget || !fillAmount) return;
    setFillSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const baseType = fillTarget.recording_type ?? 'expense';
      const recType  = fillIsLoan ? 'payable' : baseType;
      const recStatus = fillIsPartial ? 'partial'
        : recType === 'income' ? 'received'
        : recType === 'payable' ? 'unpaid'
        : 'paid';
      await supabase.from('recordings').insert({
        user_id:          user.id,
        space_id:         fillTarget.workspace_id ?? null,
        name:             fillTarget.name,
        type:             recType as any,
        amount:           parseFloat(fillAmount),
        transaction_date: todayStr,
        status:           recStatus,
        is_due:           fillIsDue || undefined,
        category_id:      fillTarget.category_id ?? null,
        account_id:       fillTarget.account_id  ?? null,
        reminder_id:      fillTarget.id,
      });
      if (!fillIsPartial) {
        await supabase.from('recording_reminders').update({ status: 'completed' }).eq('id', fillTarget.id);
      }
      queryClient.invalidateQueries({ queryKey: ['reminders', userId] });
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      setFillModal(false);
    } finally {
      setFillSaving(false);
    }
  };

  // Step 6+8: delete a linked recording
  const deleteLinkedRecording = async (id: string) => {
    await supabase.from('recordings').delete().eq('id', id);
    setFillLinked(prev => prev.filter(r => r.id !== id));
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderReminder = (r: RecordingReminder, isDue = false) => (
    <TouchableOpacity
      key={r.id}
      style={[s.row, isDue && s.rowDue]}
      activeOpacity={0.85}
      onPress={() => openChoice(r)}
    >
      <View style={[s.rowIcon, isDue && s.rowIconDue]}>
        <Ionicons name="alarm-outline" size={18} color={isDue ? Colors.cyan : Colors.muted} />
      </View>
      <View style={s.rowMid}>
        {isDue && <Text style={s.rowDueLabel}>due today · tap to fill</Text>}
        <Text style={s.rowName} numberOfLines={1}>{r.name}</Text>
        <Text style={s.rowMeta}>{reminderFrequencyLabel(r)}{r.space ? ` · ${r.space.name}` : ''}</Text>
      </View>
      <View style={s.rowActions}>
        <TouchableOpacity onPress={() => handleToggleStatus(r)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={r.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'} size={18} color={Colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="archive-outline" size={16} color={Colors.muted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['reminders', userId] });
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        {/* Add button */}
        <TouchableOpacity style={s.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Ionicons name="add" size={16} color={Colors.cyan} />
          <Text style={s.addBtnText}>new reminder</Text>
        </TouchableOpacity>

        {isLoading && <ActivityIndicator color={Colors.cyan} style={{ marginTop: 32 }} />}

        {/* Due today */}
        {dueToday.length > 0 && (
          <>
            <Text style={s.sectionHeader}>due today</Text>
            {dueToday.map(r => renderReminder(r, true))}
          </>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <>
            <Text style={s.sectionHeader}>upcoming</Text>
            {upcoming.map(r => renderReminder(r, false))}
          </>
        )}

        {/* Paused */}
        {paused.length > 0 && (
          <>
            <Text style={s.sectionHeader}>paused</Text>
            {paused.map(r => renderReminder(r, false))}
          </>
        )}

        {!isLoading && reminders.length === 0 && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>no reminders yet — tap + to create one</Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Choice sheet ── */}
      <BottomSheet visible={choiceModal} onClose={() => setChoiceModal(false)} title={choiceTarget?.name ?? 'reminder'} height="30%">
        <TouchableOpacity
          style={s.choiceRow}
          activeOpacity={0.8}
          onPress={() => { setChoiceModal(false); if (choiceTarget) openFill(choiceTarget); }}
        >
          <View style={[s.choiceIcon, { backgroundColor: Colors.cyan + '22' }]}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.cyan} />
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
          onPress={() => { setChoiceModal(false); if (choiceTarget) openEdit(choiceTarget); }}
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
      </BottomSheet>

      {/* ── Add / Edit modal ── */}
      <BottomSheet visible={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'edit reminder' : 'new reminder'}>
        <Text style={s.label}>name</Text>
        <TextInput
          style={[s.input, { marginBottom: 8 }]} placeholder="e.g. electricity bill"
          placeholderTextColor={Colors.faint} value={rName}
          onChangeText={setRName} autoFocus
        />

        <Text style={[s.label, { marginTop: 20 }]}>recording type</Text>
        <View style={s.chipRow}>
          {(['expense','income','debt','due'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.chip, rRecordingType === t && s.chipActive]} onPress={() => setRRecordingType(t)} activeOpacity={0.75}>
              <Text style={[s.chipText, rRecordingType === t && s.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>frequency</Text>
        <View style={s.chipRow}>
          {FREQUENCIES.map(f => (
            <TouchableOpacity key={f} style={[s.chip, rFrequency === f && s.chipActive]} onPress={() => setRFrequency(f)} activeOpacity={0.75}>
              <Text style={[s.chipText, rFrequency === f && s.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── weekly: day of week chips ── */}
        {rFrequency === 'weekly' && (
          <>
            <Text style={s.label}>repeats on</Text>
            <View style={s.chipRow}>
              {DAYS.map((d, i) => (
                <TouchableOpacity key={d} style={[s.chip, rDayOfWeek === i && s.chipActive]} onPress={() => setRDayOfWeek(i)} activeOpacity={0.75}>
                  <Text style={[s.chipText, rDayOfWeek === i && s.chipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── monthly: day of month chips + custom ── */}
        {rFrequency === 'monthly' && (
          <>
            <Text style={s.label}>day of month</Text>
            <View style={s.chipRow}>
              {[1,5,10,15,20,25,28].map(d => (
                <TouchableOpacity key={d} style={[s.chip, rDayOfMonth === d && s.chipActive]} onPress={() => setRDayOfMonth(d)} activeOpacity={0.75}>
                  <Text style={[s.chipText, rDayOfMonth === d && s.chipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
              {/* custom chip — active when value isn't one of the presets */}
              <TouchableOpacity
                style={[s.chip, ![1,5,10,15,20,25,28].includes(rDayOfMonth) && s.chipActive]}
                onPress={() => setRDayOfMonth(0)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipText, ![1,5,10,15,20,25,28].includes(rDayOfMonth) && s.chipTextActive]}>custom</Text>
              </TouchableOpacity>
            </View>
            {/* custom day dropdown — shown when not a preset */}
            {![1,5,10,15,20,25,28].includes(rDayOfMonth) && (
              <>
                <Text style={s.label}>pick day</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <TouchableOpacity key={d} style={[s.chip, rDayOfMonth === d && s.chipActive]} onPress={() => setRDayOfMonth(d)} activeOpacity={0.75}>
                      <Text style={[s.chipText, rDayOfMonth === d && s.chipTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        )}

        {/* ── start date ── */}
        {/* daily + weekly: month / day / year dropdowns */}
        {(rFrequency === 'daily' || rFrequency === 'weekly') && (
          <>
            <Text style={s.label}>start date</Text>
            <View style={s.dropRow}>
              {/* Month */}
              <ScrollView style={s.dropScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity key={m} style={[s.dropItem, rStartMonth === i && s.dropItemActive]} onPress={() => setRStartMonth(i)} activeOpacity={0.75}>
                    <Text style={[s.dropText, rStartMonth === i && s.dropTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {/* Day */}
              <ScrollView style={s.dropScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <TouchableOpacity key={d} style={[s.dropItem, rStartDay === d && s.dropItemActive]} onPress={() => setRStartDay(d)} activeOpacity={0.75}>
                    <Text style={[s.dropText, rStartDay === d && s.dropTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {/* Year */}
              <ScrollView style={s.dropScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {YEARS.map(y => (
                  <TouchableOpacity key={y} style={[s.dropItem, rStartYear === y && s.dropItemActive]} onPress={() => setRStartYear(y)} activeOpacity={0.75}>
                    <Text style={[s.dropText, rStartYear === y && s.dropTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        {/* monthly: only month + year for start */}
        {rFrequency === 'monthly' && (
          <>
            <Text style={s.label}>starts from</Text>
            <View style={s.dropRow}>
              <ScrollView style={s.dropScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity key={m} style={[s.dropItem, rStartMonth === i && s.dropItemActive]} onPress={() => setRStartMonth(i)} activeOpacity={0.75}>
                    <Text style={[s.dropText, rStartMonth === i && s.dropTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView style={s.dropScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {YEARS.map(y => (
                  <TouchableOpacity key={y} style={[s.dropItem, rStartYear === y && s.dropItemActive]} onPress={() => setRStartYear(y)} activeOpacity={0.75}>
                    <Text style={[s.dropText, rStartYear === y && s.dropTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        <Text style={s.label}>end date <Text style={{ fontFamily: Fonts.mono, textTransform: 'none' }}>(optional)</Text></Text>
        <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.faint} value={rEndDate} onChangeText={setREndDate} keyboardType="numbers-and-punctuation" maxLength={10} />

        <Text style={s.label}>space <Text style={{ fontFamily: Fonts.mono, textTransform: 'none' }}>(optional)</Text></Text>
        <View style={s.chipRow}>
          <TouchableOpacity style={[s.chip, !rSpaceId && s.chipActive]} onPress={() => setRSpaceId('')} activeOpacity={0.75}>
            <Text style={[s.chipText, !rSpaceId && s.chipTextActive]}>none</Text>
          </TouchableOpacity>
          {(spaces as any[]).map((sp: any) => (
            <TouchableOpacity key={sp.id} style={[s.chip, rSpaceId === sp.id && s.chipActive]} onPress={() => setRSpaceId(sp.id)} activeOpacity={0.75}>
              <Text style={[s.chipText, rSpaceId === sp.id && s.chipTextActive]}>{sp.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>category <Text style={{ fontFamily: Fonts.mono, textTransform: 'none' }}>(optional)</Text></Text>
        <View style={s.chipRow}>
          <TouchableOpacity style={[s.chip, !rCategoryId && s.chipActive]} onPress={() => setRCategoryId('')} activeOpacity={0.75}>
            <Text style={[s.chipText, !rCategoryId && s.chipTextActive]}>none</Text>
          </TouchableOpacity>
          {(categories as any[]).map((c: any) => (
            <TouchableOpacity key={c.id} style={[s.chip, rCategoryId === c.id && s.chipActive]} onPress={() => setRCategoryId(c.id)} activeOpacity={0.75}>
              <Text style={[s.chipText, rCategoryId === c.id && s.chipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>account <Text style={{ fontFamily: Fonts.mono, textTransform: 'none' }}>(optional)</Text></Text>
        <View style={s.chipRow}>
          <TouchableOpacity style={[s.chip, !rAccountId && s.chipActive]} onPress={() => setRAccountId('')} activeOpacity={0.75}>
            <Text style={[s.chipText, !rAccountId && s.chipTextActive]}>none</Text>
          </TouchableOpacity>
          {(accounts as any[]).map((a: any) => (
            <TouchableOpacity key={a.id} style={[s.chip, rAccountId === a.id && s.chipActive]} onPress={() => setRAccountId(a.id)} activeOpacity={0.75}>
              <Text style={[s.chipText, rAccountId === a.id && s.chipTextActive]}>{a.account_name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[s.saveBtn, (!rName.trim() || saving) && { opacity: 0.4 }]}
          onPress={handleSave} disabled={saving || !rName.trim()} activeOpacity={0.8}
        >
          {saving ? <ActivityIndicator color={Colors.text} /> : <Text style={s.saveBtnText}>{editTarget ? 'save changes' : 'create reminder'}</Text>}
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Fill reminder modal ── */}
      <BottomSheet visible={fillModal} onClose={() => setFillModal(false)} title="fill reminder">
        {fillTarget && (
          <>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text, marginBottom: 2 }}>{fillTarget.name}</Text>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 12 }}>
              {reminderFrequencyLabel(fillTarget)}{fillTarget.space ? ` · ${fillTarget.space.name}` : ''} · {fillTarget.recording_type ?? 'expense'}
            </Text>

            {/* Step 3+5: existing linked recordings */}
            {fillLinked.length > 0 && (
              <>
                <Text style={s.label}>previous payments</Text>
                {fillLinked.map(r => (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text }}>{Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>{r.transaction_date} · {r.type} · {r.status}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteLinkedRecording(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle-outline" size={18} color={Colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {/* Step 3: sub-type toggle */}
            {fillTarget.recording_type === 'expense' && (
              <>
                <Text style={s.label}>mark as</Text>
                <View style={s.chipRow}>
                  <TouchableOpacity style={[s.chip, !fillIsDue && s.chipActive]} onPress={() => setFillIsDue(false)} activeOpacity={0.75}>
                    <Text style={[s.chipText, !fillIsDue && s.chipTextActive]}>expense</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.chip, fillIsDue && s.chipActive]} onPress={() => setFillIsDue(true)} activeOpacity={0.75}>
                    <Text style={[s.chipText, fillIsDue && s.chipTextActive]}>due (owed back)</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {fillTarget.recording_type === 'income' && (
              <>
                <Text style={s.label}>mark as</Text>
                <View style={s.chipRow}>
                  <TouchableOpacity style={[s.chip, !fillIsLoan && s.chipActive]} onPress={() => setFillIsLoan(false)} activeOpacity={0.75}>
                    <Text style={[s.chipText, !fillIsLoan && s.chipTextActive]}>income</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.chip, fillIsLoan && s.chipActive]} onPress={() => setFillIsLoan(true)} activeOpacity={0.75}>
                    <Text style={[s.chipText, fillIsLoan && s.chipTextActive]}>loan (payable)</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 4: partial/complete toggle */}
            <Text style={s.label}>payment type</Text>
            <View style={s.chipRow}>
              <TouchableOpacity style={[s.chip, !fillIsPartial && s.chipActive]} onPress={() => setFillIsPartial(false)} activeOpacity={0.75}>
                <Text style={[s.chipText, !fillIsPartial && s.chipTextActive]}>complete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.chip, fillIsPartial && s.chipActive]} onPress={() => setFillIsPartial(true)} activeOpacity={0.75}>
                <Text style={[s.chipText, fillIsPartial && s.chipTextActive]}>partial</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.label}>amount</Text>
            <TextInput
              style={s.input} placeholder="0.00" placeholderTextColor={Colors.faint}
              value={fillAmount} onChangeText={setFillAmount} keyboardType="decimal-pad" autoFocus
            />

            {/* Step 7: dynamic button label */}
            <TouchableOpacity
              style={[s.saveBtn, (!fillAmount || fillSaving) && { opacity: 0.4 }]}
              onPress={handleFill} disabled={fillSaving || !fillAmount} activeOpacity={0.8}
            >
              {fillSaving
                ? <ActivityIndicator color={Colors.text} />
                : <Text style={s.saveBtnText}>
                    {fillIsPartial ? 'record partial' : `record ${fillIsLoan ? 'loan' : fillIsDue ? 'due' : fillTarget.recording_type ?? 'expense'}`}
                  </Text>
              }
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  scroll: { paddingHorizontal: Spacing.page, paddingBottom: 80, paddingTop: 16 },

  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.surface, marginBottom: 8 },
  addBtnText: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.cyan },

  sectionHeader: { ...Brand.type.sectionHeader, marginTop: 20, marginBottom: 8 },

  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted },

  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowDue:     { backgroundColor: Colors.cyan + '11', borderRadius: Radius.md, borderBottomWidth: 0, marginBottom: 4, paddingHorizontal: 10 },
  rowIcon:    { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  rowIconDue: { backgroundColor: Colors.cyan + '33' },
  rowMid:     { flex: 1, gap: 2 },
  rowDueLabel:{ fontFamily: Fonts.mono, fontSize: 9, color: Colors.cyan, letterSpacing: 0.6, textTransform: 'uppercase' },
  rowName:    { ...Brand.type.cardTitle },
  rowMeta:    { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  rowActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },

  label:          { fontFamily: Fonts.monoBold, fontSize: 10, color: '#1A1A1A', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  input:          { fontFamily: Fonts.mono, fontSize: 14, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.borderMid },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  chipActive:     { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  chipText:       { fontFamily: Fonts.mono,     fontSize: 12, color: Colors.muted },
  chipTextActive: { fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.white },
  saveBtn:        { backgroundColor: Colors.cyan, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText:    { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.text },

  choiceRow:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  choiceIcon: { width: 40, height: 40, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  choiceTitle:{ fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.text },
  choiceSub:  { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, marginTop: 2 },

  // Dropdown column pickers
  dropRow:      { flexDirection: 'row', gap: 8, height: 140 },
  dropScroll:   { flex: 1, borderWidth: 1, borderColor: Colors.borderMid, borderRadius: Radius.lg, backgroundColor: Colors.surface },
  dropItem:     { paddingVertical: 9, paddingHorizontal: 10, alignItems: 'center' },
  dropItemActive:{ backgroundColor: Colors.cyan, borderRadius: Radius.md },
  dropText:     { fontFamily: Fonts.mono,     fontSize: 13, color: Colors.muted },
  dropTextActive:{ fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.white },
});
