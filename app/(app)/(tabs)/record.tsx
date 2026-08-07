import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator, Modal, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WebView } from 'react-native-webview';
import { useUser } from '../../../src/hooks/useUser';
import { supabase } from '../../../src/lib/supabase';
import { AppFont } from '../../../src/lib/fonts';
import { DC } from '../../../src/lib/design';
import { SAVINGS_COIN_LOOP_URI, SAVINGS_DONE_URI } from '../../../src/lib/savingsAnimBase64';
import { SYSTEM_CATEGORIES as CATEGORIES, CatIcon } from '../../../src/lib/systemCategories';

// ── Brand tokens ─────────────────────────────────────────────────────────────
const ACCENT      = DC.headerBlueBg;  // #4394ff
const ACCENT_DARK = DC.headerBlueBg;
const TEXT        = '#373737';
const BORDER      = '#d2d2d2';

const CALC_ROWS: { k: string; op?: boolean }[][] = [
  [{ k: '1' }, { k: '2' }, { k: '3' }, { k: '/', op: true }],
  [{ k: '4' }, { k: '5' }, { k: '6' }, { k: 'x', op: true }],
  [{ k: '7' }, { k: '8' }, { k: '9' }, { k: '-', op: true }],
  [{ k: '.' }, { k: '0' }, { k: '=', op: true }, { k: '+', op: true }],
];

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const applyOp = (a: number, b: number, op: string) => {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '/': return b === 0 ? 0 : a / b;
    default:  return a * b;
  }
};

import { recordDirection } from '../../../src/lib/recordDirection';
import { useNav } from '../../../src/lib/NavContext';

export default function RecordScreen({ isActive }: { isActive?: boolean }) {
  const { userId, defaultCurrency } = useUser();
  const queryClient = useQueryClient();
  const { switchTab, openRecordingsPanel } = useNav();
  const [returnToPanel, setReturnToPanel] = useState(false);
  const [recordName, setRecordName] = useState('');
  const [useCustomName, setUseCustomName] = useState(false);
  const [isLoan, setIsLoan] = useState(false);
  const [borrower, setBorrower] = useState('');
  const [borrowerInput, setBorrowerInput] = useState('');
  const [showBorrowerDropdown, setShowBorrowerDropdown] = useState(false);
  const [contacts, setContacts] = useState<string[]>([]);
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [entry, setEntry] = useState('');
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('');
  const [userCategories, setUserCategories] = useState<any[]>([]);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    const result = recordDirection.consume();
    if (result) {
      setDirection(result.dir);
      setReturnToPanel(result.returnTab === 'panel');
    } else {
      setReturnToPanel(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (!userId) return;
    supabase.from('categories').select('id,name').eq('user_id', userId)
      .then(({ data }) => setUserCategories(data ?? []));
    supabase.from('spaces').select('id,name').eq('user_id', userId).neq('is_active', false)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .then(({ data }) => setSpaces(data ?? []));
    supabase.from('contacts').select('name').eq('user_id', userId).order('name')
      .then(({ data }) => setContacts((data ?? []).map((c: any) => c.name)));
  }, [userId]);

  const current = entry !== '' ? parseFloat(entry) : (prev ?? 0);
  const displayAmount = fmt(current);

  const pressDigit = (d: string) => {
    setError('');
    setSaved(false);
    if (entry.length >= 12) return;
    setEntry(e => e + d);
  };

  const pressDot = () => {
    setError('');
    setSaved(false);
    if (entry.includes('.')) return;
    if (entry === '') setEntry('0.');
    else setEntry(e => e + '.');
  };

  const pressOp = (next: string) => {
    setError('');
    setSaved(false);
    const cur = entry !== '' ? parseFloat(entry) : null;
    if (prev === null) {
      setPrev(cur ?? 0);
    } else if (cur !== null) {
      setPrev(applyOp(prev, cur, op ?? next));
    }
    setOp(next);
    setEntry('');
  };

  const pressEquals = () => {
    setError('');
    setSaved(false);
    const cur = entry !== '' ? parseFloat(entry) : null;
    if (prev !== null && cur !== null) {
      setEntry(String(applyOp(prev, cur, op ?? '+')));
      setPrev(null);
      setOp(null);
    }
  };

  const pressDel = () => {
    setError('');
    setSaved(false);
    if (entry !== '') setEntry(e => e.slice(0, -1));
    else if (op !== null) { setOp(null); setEntry(String(prev ?? 0)); }
    else setEntry('');
  };

  const onKey = (k: string) => {
    if ('0123456789'.includes(k)) pressDigit(k);
    else if (k === '.') pressDot();
    else if (k === '=') pressEquals();
    else if (k === '+' || k === '-' || k === '/' || k === 'x') pressOp(k);
  };

  const handleSave = async () => {
    if (saving || saved) return;
    if (!userId) { setError('not logged in'); return; }
    const amountVal = parseFloat(entry !== '' ? entry : String(prev ?? 0));
    if (isNaN(amountVal) || amountVal <= 0) { setError('amount is required *'); return; }
    if (!useCustomName && !category) { setError('category is required *'); return; }
    setSaving(true); setError(''); setSaved(false);
    const minDelay = new Promise(res => setTimeout(res, 800));
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) { setError('session expired, please log in again'); setSaving(false); return; }
      const type = isLoan
        ? (direction === 'out' ? 'expense' : 'debt')
        : (direction === 'in' ? 'income' : 'expense');
      const is_due = isLoan && direction === 'out';
      const status = (isLoan && direction === 'out') ? 'unpaid'
        : (isLoan && direction === 'in') ? 'unpaid'
        : (type === 'income' ? 'received' : 'paid');
      const cat = CATEGORIES.find(c => c.key === category);
      const matched = userCategories.find(c => c.name.toLowerCase() === (cat?.label ?? '').toLowerCase());
      const recordingName = useCustomName && recordName.trim()
        ? recordName.trim()
        : cat?.label ?? (isLoan ? 'Loan' : (direction === 'in' ? 'Money In' : 'Expense'));
      const { error: err } = await supabase.from('recordings').insert({
        user_id: currentUser.id,
        name: recordingName,
        type,
        is_due: is_due,
        amount: amountVal,
        transaction_date: new Date().toISOString().split('T')[0],
        space_id: spaceId ?? null,
        category_id: matched?.id ?? null,
        status,
        currency: defaultCurrency,
        person_name: isLoan && borrower.trim() ? borrower.trim() : null,
      });
      if (err) throw err;
      await minDelay;
      queryClient.invalidateQueries({ queryKey: ['home-people', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-spaces', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-recent', userId] });
      queryClient.invalidateQueries({ queryKey: ['home-shared', userId] });
      queryClient.invalidateQueries({ queryKey: ['recordings-panel', userId] });
      setEntry(''); setPrev(null); setOp(null); setIsLoan(false); setSpaceId(null); setBorrower(''); setBorrowerInput(''); setShowBorrowerDropdown(false);
      setShowLoader(true);
      setSaved(true);
      if (returnToPanel) {
        setTimeout(() => { setSaved(false); setSaving(false); setShowLoader(false); openRecordingsPanel(); }, 1200);
      }
    } catch (e: any) {
      await minDelay;
      setError(e?.message ?? 'something went wrong.');
      setSaved(false);
      setShowLoader(false);
    } finally {
      setSaving(false);
    }
  };

  const closeSavedModal = () => { setSaved(false); setSaving(false); setShowLoader(false); };

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingHorizontal: DC.pagePadding }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Add a name ── */}
        <View style={s.nameRow}>
          <TouchableOpacity style={s.loanRow} onPress={() => setUseCustomName(v => !v)} activeOpacity={0.8}>
            <View style={[s.check, useCustomName && s.checkOn]}>
              {useCustomName && <Text style={s.checkMark}>✓</Text>}
            </View>
            <Text style={s.loanText}>Add a name</Text>
          </TouchableOpacity>
          <TextInput
            style={[s.nameInput, !useCustomName && s.nameInputDisabled]}
            placeholder="e.g. grocery run"
            placeholderTextColor={useCustomName ? '#aaa' : '#d2d2d2'}
            value={recordName}
            onChangeText={setRecordName}
            editable={useCustomName}
          />
        </View>

        {/* ── Tag as loan checkbox ── */}
        <View style={s.loanRowWrap}>
          <TouchableOpacity style={s.loanRow} onPress={() => { setIsLoan(v => !v); setShowBorrowerDropdown(false); }} activeOpacity={0.8}>
            <View style={[s.check, isLoan && s.checkOn]}>
              {isLoan && <Text style={s.checkMark}>✓</Text>}
            </View>
            <Text style={s.loanText}>{direction === 'in' ? 'Tag as your loan' : 'Tag as loan'}</Text>
          </TouchableOpacity>
          {isLoan && (
            <View style={s.borrowerWrap}>
              {borrower ? (
                <View style={s.borrowerBadge}>
                  <Text style={s.borrowerBadgeText}>{borrower}</Text>
                  <TouchableOpacity onPress={() => setBorrower('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={s.borrowerBadgeX}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={s.borrowerInput}
                    placeholder={direction === 'in' ? 'Borrowed from...' : 'Borrower...'}
                    placeholderTextColor="#aaa"
                    value={borrowerInput}
                    onChangeText={v => { setBorrowerInput(v); setShowBorrowerDropdown(true); }}
                    onFocus={() => setShowBorrowerDropdown(true)}
                  />
                  {showBorrowerDropdown && (
                    <View style={s.borrowerDropdown}>
                      {contacts
                        .filter(c => !borrowerInput.trim() || c.toLowerCase().includes(borrowerInput.toLowerCase()))
                        .map(c => (
                          <TouchableOpacity
                            key={c}
                            style={s.borrowerOption}
                            onPress={() => { setBorrower(c); setBorrowerInput(''); setShowBorrowerDropdown(false); }}
                            activeOpacity={0.7}
                          >
                            <Text style={s.borrowerOptionText}>{c}</Text>
                          </TouchableOpacity>
                        ))
                      }
                      {borrowerInput.trim() && !contacts.some(c => c.toLowerCase() === borrowerInput.toLowerCase()) && (
                        <TouchableOpacity
                          style={s.borrowerCreateOption}
                          onPress={async () => {
                            const name = borrowerInput.trim();
                            const existing = contacts.find(c => c.toLowerCase() === name.toLowerCase());
                            if (existing) {
                              setBorrower(existing);
                            } else {
                              await supabase.from('contacts').insert({ user_id: userId, name });
                              setContacts(prev => [...prev, name].sort());
                              setBorrower(name);
                            }
                            setBorrowerInput('');
                            setShowBorrowerDropdown(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={s.borrowerCreateText}>+ Add "{borrowerInput.trim()}" as contact</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        {/* ── Money in / out ── */}
        <View style={s.dirRow}>
          <TouchableOpacity
            style={[s.dirBtn, direction === 'in' && s.dirBtnOn]}
            onPress={() => { setDirection('in'); setError(''); setSaved(false); }}
            activeOpacity={0.8}
          >
            <Text style={[s.dirText, direction === 'in' && s.dirTextOn]}>Money In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.dirBtn, direction === 'out' && s.dirBtnOn]}
            onPress={() => { setDirection('out'); setError(''); setSaved(false); }}
            activeOpacity={0.8}
          >
            <Text style={[s.dirText, direction === 'out' && s.dirTextOn]}>Money Out</Text>
          </TouchableOpacity>
        </View>

        {/* ── Currency + amount ── */}
        <View style={[s.amountBox, (isNaN(parseFloat(entry)) || parseFloat(entry) <= 0) && false]}>
          <Text style={s.currencyLabel}>{defaultCurrency} <Text style={s.asterisk}>*</Text></Text>
          <Text style={[s.amountInput, direction === 'in' ? { color: '#2ab671' } : { color: '#ed6a6a' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {displayAmount}
          </Text>
          <TouchableOpacity style={s.amountDel} onPress={pressDel} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.amountDelText}>del</Text>
          </TouchableOpacity>
        </View>

        {/* ── Calculator ── */}
        <View style={s.calc}>
          {CALC_ROWS.map((row, ri) => (
            <View key={ri} style={s.calcRow}>
              {row.map((btn, ci) => (
                <TouchableOpacity
                  key={ci}
                  style={[s.calcBtn, btn.op && s.calcBtnOp]}
                  onPress={() => onKey(btn.k)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.calcText, btn.op && s.calcTextOp]}>{btn.k}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {/* ── Categories ── */}
        <Text style={[s.catLabel, { marginTop: 28 }]}>
          Categories {!useCustomName && <Text style={s.asterisk}>*</Text>}
        </Text>
        <View style={s.catGrid}>
          {CATEGORIES.map(c => {
            const selected = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[s.catChip, selected && s.catChipOn]}
                onPress={() => { setCategory(selected ? '' : c.key); setError(''); setSaved(false); }}
                activeOpacity={0.8}
              >
                <CatIcon name={c.key} color={selected ? '#ffffff' : '#000000'} size={17} />
                <Text style={[s.catName, selected && s.catNameOn]} numberOfLines={1}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Folders ── */}
        {spaces.length > 0 && (
          <>
            <Text style={[s.catLabel, { marginTop: 28 }]}>Folders</Text>
            <View style={s.catGrid}>
              {spaces.map(sp => {
                const selected = spaceId === sp.id;
                return (
                  <TouchableOpacity
                    key={sp.id}
                    style={[s.catChip, selected && s.catChipOn]}
                    onPress={() => { setSpaceId(selected ? null : sp.id); setError(''); setSaved(false); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.catName, selected && s.catNameOn]} numberOfLines={1}>{sp.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {error ? <Text style={s.errorText}>{error}</Text> : null}

        {/* ── Save ── */}
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.saveText}>Save Record</Text>}
        </TouchableOpacity>

      </ScrollView>

      {/* ── Save modal: coin loop while loading, flip to done once saved ── */}
      <Modal visible={saved} transparent animationType="fade" statusBarTranslucent onRequestClose={closeSavedModal}>
        <TouchableOpacity style={s.modalOverlay} onPress={closeSavedModal} activeOpacity={1}>
          <View style={s.modalCard} pointerEvents="box-none">

            <View style={s.modalAnimWrap} pointerEvents="none">
              {Platform.OS === 'web' ? (
                <img key={`done-${showLoader}`} src={SAVINGS_DONE_URI} alt="saved" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <WebView
                  key={`done-${showLoader}`}
                  originWhitelist={['*']}
                  source={{ html: `<!DOCTYPE html><html><body style="margin:0;background:transparent"><img src="${SAVINGS_DONE_URI}" style="width:100%;height:100%;object-fit:contain" /></body></html>` }}
                  style={{ width: '100%', height: '100%' }}
                  pointerEvents="none"
                  setSupportMultipleWindows={false}
                  scrollEnabled={false}
                />
              )}
            </View>

            <Text style={s.modalTitle}>saved!</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { paddingTop: 14, paddingBottom: 150 },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, flex: 1 },
  nameInput: { flex: 1, fontFamily: AppFont.regular, fontSize: 16, color: TEXT, backgroundColor: '#f6f6f6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: BORDER },
  nameInputDisabled: { opacity: 0.4 },

  // ── Loan tag checkbox ──
  loanRowWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, zIndex: 10 },
  loanRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 10 },
  borrowerWrap:    { flex: 1, position: 'relative' },
  borrowerInput:   { fontFamily: AppFont.regular, fontSize: 16, color: TEXT, backgroundColor: '#f6f6f6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: BORDER },
  borrowerBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: DC.viewBtnBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  borrowerBadgeText: { fontFamily: AppFont.semiBold, fontSize: 12, color: DC.headerBlueBg },
  borrowerBadgeX:  { fontFamily: AppFont.bold, fontSize: 11, color: DC.headerBlueBg },
  borrowerDropdown:      { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: BORDER, zIndex: 20, elevation: 6, maxHeight: 180 },
  borrowerDropdownEmpty: { fontFamily: AppFont.regular, fontSize: 12, color: '#aaa', padding: 12, textAlign: 'center' },
  borrowerOption:        { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  borrowerOptionActive:  { backgroundColor: DC.viewBtnBg },
  borrowerOptionText:    { fontFamily: AppFont.regular, fontSize: 13, color: TEXT },
  borrowerOptionTextActive: { fontFamily: AppFont.semiBold, fontSize: 13, color: DC.headerBlueBg },
  borrowerCreateOption:  { paddingHorizontal: 14, paddingVertical: 10 },
  borrowerCreateText:    { fontFamily: AppFont.semiBold, fontSize: 12, color: DC.headerBlueBg },
  check: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: BORDER,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: ACCENT_DARK, borderColor: ACCENT_DARK },
  checkMark: { fontFamily: AppFont.bold, fontSize: 10, color: '#fff', lineHeight: DC.typography.sectionBody.lineHeight },
  loanText: { fontFamily: AppFont.regular, fontSize: 10, color: TEXT },

  // ── Money in / out ──
  dirRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  dirBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: ACCENT,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  dirBtnOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  dirText: { fontFamily: AppFont.regular, fontSize: 10, color: TEXT, letterSpacing: 0.3 },
  dirTextOn: { fontFamily: AppFont.semiBold, fontSize: 10, color: '#ffffff' },

  // ── Currency + amount ──
  amountBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f6f6f6', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16,
    overflow: 'hidden',
  },
  currencyLabel: { fontFamily: AppFont.semiBold, fontSize: 11, color: TEXT, marginRight: 8 },
  amountInput: {
    flex: 1,
    fontFamily: AppFont.bold, fontSize: 17, color: '#000',
    textAlign: 'right',
  },
  amountDel: {
    marginLeft: 10,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: DC.viewBtnBg,
  },
  amountDelText: { fontFamily: AppFont.bold, fontSize: 9, color: DC.headerBlueBg, textTransform: 'uppercase' },

  // ── Calculator ──
  calc: { gap: 8, marginBottom: 22 },
  calcRow: { flexDirection: 'row', gap: 8 },
  calcBtn: {
    flex: 1, height: 48, borderRadius: 12,
    backgroundColor: DC.viewBtnBg,
    alignItems: 'center', justifyContent: 'center',
  },
  calcBtnWide: { flex: 2 },
  calcBtnOp: { backgroundColor: '#6085d3' },
  calcText: { fontFamily: AppFont.bold, fontSize: 20, color: DC.headerBlueBg },
  calcTextOp: { fontFamily: AppFont.bold, fontSize: 22, color: '#ffffff' },

  // ── Categories ──
  catLabel: {
    fontFamily: AppFont.bold, fontSize: 12, color: TEXT,
    textTransform: 'uppercase', letterSpacing: 0.3,
    marginBottom: 10,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    width: '31.5%', flexGrow: 1,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'transparent', borderRadius: 12,
    borderWidth: 1, borderColor: '#d2d2d2',
    paddingVertical: 10, paddingHorizontal: 10,
  },
  catChipOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  catName: { fontFamily: AppFont.regular, fontSize: 9, color: TEXT, flexShrink: 1 },
  catNameOn: { fontFamily: AppFont.semiBold, fontSize: 9, color: '#ffffff' },

  errorText: { fontFamily: AppFont.regular, fontSize: 10, color: '#ed6a6a', marginTop: 12, textAlign: 'center' },
  asterisk:  { color: '#ed6a6a', fontFamily: AppFont.bold },

  // ── Save modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCard: {
    flex: 1, width: '100%',
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  modalAnimWrap: { width: 170, height: 170, marginBottom: 18 },
  modalTitle: { fontFamily: AppFont.brand, fontSize: 17, color: '#373737' },

  // ── Save ──
  saveBtn: {
    marginTop: 18,
    alignSelf: 'center',
    minWidth: 160,
    backgroundColor: DC.headerBlueBg, borderRadius: 999,
    paddingVertical: 14, paddingHorizontal: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  saveText: { fontFamily: AppFont.semiBold, fontSize: 11, color: '#ffffff', letterSpacing: 0.5 },
});
