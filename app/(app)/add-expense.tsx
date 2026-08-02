import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  Modal, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase';
import { AppFont } from '../../src/lib/fonts';
import { Colors, Radius } from '@/components/ui/theme';
import { DC } from '../../src/lib/design';

const BORDER = '#d2d2d2';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

interface Props {
  onClose: () => void;
  userId: string;
  defaultCurrency: string;
  spaceId?: string;
  spaceName?: string;
  type?: 'expense' | 'income';
}

export default function AddExpenseScreen({ onClose, userId, defaultCurrency, spaceId: propSpaceId, spaceName: propSpaceName, type = 'expense' }: Props) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  // ── Mode ──
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  // ── Toggles ──
  const [useOneCategory, setUseOneCategory] = useState(false);
  const [useOneFolder, setUseOneFolder] = useState(false);
  const [useOneAccount, setUseOneAccount] = useState(false);
  const [useOneDate, setUseOneDate] = useState(false);

  // ── Fields ──
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);

  // Date
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selDay, setSelDay] = useState(now.getDate());
  const [selYear, setSelYear] = useState(now.getFullYear());

  // ── Checkboxes ──
  const [isLoan, setIsLoan] = useState(false);
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [personSuggestions, setPersonSuggestions] = useState<string[]>([]);
  const [friendIdMap, setFriendIdMap] = useState<Record<string, string>>({});

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(propSpaceId ?? null);
  const [selectedFolderName, setSelectedFolderName] = useState(propSpaceName ?? '');

  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  // ── Picker data ──
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);

  // ── Dropdown open states ──
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);

  const CURRENCIES = ['PHP','USD','EUR','GBP','JPY','AUD','CAD','SGD','MYR','IDR','THB','VND','KRW','CNY','INR'];

  // ── Load data ──
  useEffect(() => {
    (async () => {
      const [cats, accs, sp] = await Promise.all([
        supabase.from('categories').select().eq('user_id', userId).order('name'),
        supabase.from('accounts').select().eq('user_id', userId).order('account_name'),
        supabase.from('spaces').select('id, name').eq('user_id', userId).neq('is_active', false).order('sort_order', { ascending: true, nullsFirst: false }),
      ]);
      if (cats.data) setCategories(cats.data);
      if (accs.data) setAccounts(accs.data);
      if (sp.data) setSpaces(sp.data);

      // Load person suggestions
      const [{ data: contactsData }, { data: friendships }] = await Promise.all([
        supabase.from('contacts').select('name').eq('user_id', userId).order('name'),
        supabase.from('friendships').select('requester_id, receiver_id').eq('status', 'accepted').or(`requester_id.eq.${userId},receiver_id.eq.${userId}`),
      ]);
      const contactNames = (contactsData ?? []).map((c: any) => c.name);
      const friendIds = (friendships ?? []).map((f: any) => f.requester_id === userId ? f.receiver_id : f.requester_id);
      const friendEntries = await Promise.all(friendIds.map(async (id: string) => {
        const { data: n } = await supabase.rpc('get_user_display_name', { user_id: id });
        return n ? { id, name: n as string } : null;
      }));
      const validFriends = friendEntries.filter(Boolean) as { id: string; name: string }[];
      const idMap: Record<string, string> = {};
      validFriends.forEach(f => { idMap[f.name] = f.id; });
      setFriendIdMap(idMap);
      setPersonSuggestions([...new Set([...validFriends.map(f => f.name), ...contactNames])].sort());
    })();
  }, [userId]);

  const filteredPersonSuggestions = useMemo(() => {
    if (!personSearch.trim()) return personSuggestions;
    return personSuggestions.filter(n => n.toLowerCase().includes(personSearch.toLowerCase()));
  }, [personSearch, personSuggestions]);

  const daysCount = daysInMonth(selMonth + 1, selYear);

  // ── Checkbox component ──
  const Checkbox = ({ checked, onToggle }: { checked: boolean; onToggle: () => void }) => (
    <TouchableOpacity onPress={onToggle} style={s.checkbox} activeOpacity={0.7}>
      {checked && <View style={s.checkboxInner} />}
    </TouchableOpacity>
  );

  // ── Toggle row ──
  const ToggleRow = ({ label, checked, onToggle, disabled }: { label: string; checked: boolean; onToggle: () => void; disabled?: boolean }) => (
    <TouchableOpacity style={[s.toggleRow, disabled && s.toggleDisabled]} onPress={disabled ? undefined : onToggle} activeOpacity={0.7}>
      <Checkbox checked={checked} onToggle={() => {}} />
      <Text style={[s.toggleLabel, disabled && s.toggleLabelDisabled]}>{label}</Text>
    </TouchableOpacity>
  );

  // ── Dropdown ──
  const PillDropdown = ({ id, label, onPress }: { id: string; label: string; onPress: () => void }) => (
    <TouchableOpacity style={s.pillDropdown} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.pillDropdownText}>{label.toUpperCase()}</Text>
    </TouchableOpacity>
  );

  // ── Submit ──
  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (!amount.trim() || isNaN(Number(amount))) return;
    setLoading(true);
    try {
      const txnDate = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;

      const payload: any = {
        user_id: userId,
        name: name.trim(),
        type,
        amount: Number(amount),
        currency,
        transaction_date: txnDate,
        status: 'paid',
      };

      // Batch mode includes USE ONE fields and OPTIONAL INFO fields
      if (mode === 'batch') {
        if (useOneCategory) payload.category_id = selectedCategory?.id ?? null;
        if (useOneFolder) payload.space_id = selectedFolderId ?? null;
        if (useOneAccount) payload.account_id = selectedAccount?.id ?? null;
      }
      // OPTIONAL INFO fields always apply in both modes
      if (selectedFolderId) payload.space_id = selectedFolderId ?? null;
      if (selectedCategory) payload.category_id = selectedCategory.id;
      if (selectedAccount) payload.account_id = selectedAccount.id;
      if (isLoan) {
        payload.is_due = true;
        payload.person_name = selectedPerson || personSearch.trim() || null;
      }

      const { error } = await supabase.from('recordings').insert(payload);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['recordings-panel', userId] });
      onClose();
    } catch (e: any) {
      console.error('submit error', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Add another entry ──
  const handleAddEntry = () => {
    // For now just clears fields for the next entry
    setName('');
    setAmount('');
    setSelectedCategory(null);
    setSelectedAccount(null);
    setIsLoan(false);
    setSelectedPerson('');
    setPersonSearch('');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={s.root}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Title + close */}
          <View style={s.titleRow}>
            <Text style={s.title}>New {type === 'income' ? 'Income' : 'Expense'} Record</Text>

          </View>

          {/* Mode toggle */}
          <View style={s.modeRow}>
            <TouchableOpacity
              style={[s.modePill, mode === 'single' && s.modePillActive]}
              onPress={() => setMode('single')}
              activeOpacity={0.7}
            >
              <Text style={[s.modePillText, mode === 'single' && s.modePillTextActive]}>Single Entry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modePill, mode === 'batch' && s.modePillActive]}
              onPress={() => setMode('batch')}
              activeOpacity={0.7}
            >
              <Text style={[s.modePillText, mode === 'batch' && s.modePillTextActive]}>Batch Mode</Text>
            </TouchableOpacity>
          </View>

          {/* Batch: toggle checkboxes */}
          {mode === 'batch' && (
            <>
              <ToggleRow label="USE ONE CATEGORY" checked={useOneCategory} onToggle={() => setUseOneCategory(p => !p)} />
              {useOneCategory && categories.length > 0 && (
                <View style={s.dropdownSection}>
                  <PillDropdown id="cat" label={selectedCategory?.name ?? 'select category'} onPress={() => setOpenDropdown(openDropdown === 'cat' ? null : 'cat')} />
                  {openDropdown === 'cat' && (
                    <View style={s.overlayList}>
                      {categories.map(c => (
                        <TouchableOpacity key={c.id} style={[s.overlayItem, selectedCategory?.id === c.id && s.overlayItemActive]} onPress={() => { setSelectedCategory(c); setOpenDropdown(null); }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <Text style={[s.overlayItemText, selectedCategory?.id === c.id && s.overlayItemTextActive]}>{c.name.toUpperCase()}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <ToggleRow label="USE ONE FOLDER" checked={useOneFolder} onToggle={() => setUseOneFolder(p => !p)} />
              {useOneFolder && spaces.length > 0 && (
                <View style={s.dropdownSection}>
                  <PillDropdown id="folder" label={selectedFolderName || 'select folder'} onPress={() => setOpenDropdown(openDropdown === 'folder' ? null : 'folder')} />
                  {openDropdown === 'folder' && (
                    <View style={s.overlayList}>
                      {spaces.map(sp => (
                        <TouchableOpacity key={sp.id} style={[s.overlayItem, selectedFolderId === sp.id && s.overlayItemActive]} onPress={() => { setSelectedFolderId(sp.id); setSelectedFolderName(sp.name); setOpenDropdown(null); }}>
                          <Text style={[s.overlayItemText, selectedFolderId === sp.id && s.overlayItemTextActive]}>{sp.name.toUpperCase()}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <ToggleRow label="USE ONE ACCOUNT" checked={useOneAccount} onToggle={() => setUseOneAccount(p => !p)} />
              {useOneAccount && accounts.length > 0 && (
                <View style={s.dropdownSection}>
                  <PillDropdown id="acct" label={selectedAccount?.account_name ?? 'select account'} onPress={() => setOpenDropdown(openDropdown === 'acct' ? null : 'acct')} />
                  {openDropdown === 'acct' && (
                    <View style={s.overlayList}>
                      {accounts.map(a => (
                        <TouchableOpacity key={a.id} style={[s.overlayItem, selectedAccount?.id === a.id && s.overlayItemActive]} onPress={() => { setSelectedAccount(a); setOpenDropdown(null); }}>
                          <Text style={[s.overlayItemText, selectedAccount?.id === a.id && s.overlayItemTextActive]}>{a.account_name.toUpperCase()}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <ToggleRow label="USE ONE DATE" checked={useOneDate} onToggle={() => { setUseOneDate(p => !p); setShowMonthPicker(false); setShowDayPicker(false); setShowYearPicker(false); }} />
              {useOneDate && (
                <View style={s.dropdownSection}>
                  <View style={s.dateRow}>
                    <TouchableOpacity style={[s.pillDropdown, { flex: 1 }]} onPress={() => setShowMonthPicker(p => !p)} activeOpacity={0.7}>
                      <Text style={s.pillDropdownText}>{MONTHS[selMonth]}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.pillDropdown, { flex: 1 }]} onPress={() => setShowDayPicker(p => !p)} activeOpacity={0.7}>
                      <Text style={s.pillDropdownText}>{String(selDay).padStart(2, '0')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.pillDropdown, { flex: 1 }]} onPress={() => setShowYearPicker(p => !p)} activeOpacity={0.7}>
                      <Text style={s.pillDropdownText}>{String(selYear)}</Text>
                    </TouchableOpacity>
                  </View>
                  {showMonthPicker && (
                    <View style={s.overlayList}>
                      {MONTHS.map((m, i) => (
                        <TouchableOpacity key={m} style={[s.overlayItem, selMonth === i && s.overlayItemActive]} onPress={() => { setSelMonth(i); setShowMonthPicker(false); }}>
                          <Text style={[s.overlayItemText, selMonth === i && s.overlayItemTextActive]}>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {showDayPicker && (
                    <View style={s.overlayList}>
                      {Array.from({ length: daysCount }, (_, i) => i + 1).map(d => (
                        <TouchableOpacity key={d} style={[s.overlayItem, selDay === d && s.overlayItemActive]} onPress={() => { setSelDay(d); setShowDayPicker(false); }}>
                          <Text style={[s.overlayItemText, selDay === d && s.overlayItemTextActive]}>{String(d).padStart(2, '0')}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {showYearPicker && (
                    <View style={s.overlayList}>
                      {Array.from({ length: 2040 - 2026 + 1 }, (_, i) => 2026 + i).map(y => (
                        <TouchableOpacity key={y} style={[s.overlayItem, selYear === y && s.overlayItemActive]} onPress={() => { setSelYear(y); setShowYearPicker(false); }}>
                          <Text style={[s.overlayItemText, selYear === y && s.overlayItemTextActive]}>{String(y)}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* Square form section */}
          <View style={s.formBox}>
            {/* Record Name */}
            <Text style={s.fieldLabel}>RECORD NAME <Text style={{ color: '#e74c3c' }}>*</Text></Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g. Groceries"
              placeholderTextColor="#b5b4a4"
              value={name}
              onChangeText={setName}
            />

            {/* Amount */}
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>AMOUNT <Text style={{ color: '#e74c3c' }}>*</Text></Text>
            <View style={s.amountRow}>
              <TouchableOpacity style={s.currencyPill} onPress={() => setShowCurrencyPicker(p => !p)} activeOpacity={0.7}>
                <Text style={s.currencyText}>{currency}</Text>
              </TouchableOpacity>
              <TextInput
                style={s.amountInput}
                placeholder="0.00"
                placeholderTextColor="#b5b4a4"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </View>
            {showCurrencyPicker && (
              <View style={[s.overlayList, { marginTop: 4 }]}>
                {CURRENCIES.map(c => (
                  <TouchableOpacity key={c} style={[s.overlayItem, currency === c && s.overlayItemActive]} onPress={() => { setCurrency(c); setShowCurrencyPicker(false); }}>
                    <Text style={[s.overlayItemText, currency === c && s.overlayItemTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Date - disabled if useOneDate chosen */}
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>DATE <Text style={{ color: '#e74c3c' }}>*</Text></Text>
            <View style={[s.dateRow, { opacity: useOneDate ? 0.4 : 1 }]} pointerEvents={useOneDate ? 'none' : 'auto'}>
              <TouchableOpacity style={[s.pillDropdown, { flex: 1 }]} onPress={() => { setShowMonthPicker(p => !p); }} activeOpacity={0.7}>
                <Text style={s.pillDropdownText}>{MONTHS[selMonth]}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.pillDropdown, { flex: 1 }]} onPress={() => { setShowDayPicker(p => !p); }} activeOpacity={0.7}>
                <Text style={s.pillDropdownText}>{String(selDay).padStart(2, '0')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.pillDropdown, { flex: 1 }]} onPress={() => { setShowYearPicker(p => !p); }} activeOpacity={0.7}>
                <Text style={s.pillDropdownText}>{String(selYear)}</Text>
              </TouchableOpacity>
            </View>

            {/* Optional info section */}
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>OPTIONAL INFO</Text>

            {/* Tag as Loan */}
            <ToggleRow label={type === 'income' ? 'TAG AS YOUR LOAN' : 'TAG AS A LOAN'} checked={isLoan} onToggle={() => setIsLoan(p => !p)} />
            {isLoan && (
              <View style={s.dropdownSection}>
                <View style={s.searchRow}>
                  <TextInput
                    style={s.personInput}
                    placeholder="search or type name..."
                    placeholderTextColor="#b5b4a4"
                    value={selectedPerson || personSearch}
                    onChangeText={v => { setPersonSearch(v); setSelectedPerson(''); setShowPersonDropdown(true); }}
                    onFocus={() => setShowPersonDropdown(true)}
                  />

                </View>
                {showPersonDropdown && filteredPersonSuggestions.length > 0 && !selectedPerson && (
                  <View style={s.overlayList}>
                    {filteredPersonSuggestions.map(n => (
                      <TouchableOpacity
                        key={n}
                        style={s.overlayItem}
                        onPress={() => { setSelectedPerson(n); setPersonSearch(n); setShowPersonDropdown(false); }}
                      >
                        <Text style={s.overlayItemText}>{n.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Save in a Folder */}
            <ToggleRow label="SAVE IN A FOLDER" checked={!!selectedFolderId} disabled={mode === 'batch' && useOneFolder} onToggle={() => {
              if (selectedFolderId) { setSelectedFolderId(null); setSelectedFolderName(''); }
              else if (spaces.length > 0) { setSelectedFolderId(spaces[0].id); setSelectedFolderName(spaces[0].name); }
            }} />
            {selectedFolderId && (
              <View style={s.dropdownSection}>
                <PillDropdown id="save-folder" label={selectedFolderName || 'select folder'} onPress={() => setOpenDropdown(openDropdown === 'save-folder' ? null : 'save-folder')} />
                {openDropdown === 'save-folder' && (
                  <View style={s.overlayList}>
                    {spaces.map(sp => (
                      <TouchableOpacity key={sp.id} style={[s.overlayItem, selectedFolderId === sp.id && s.overlayItemActive]} onPress={() => { setSelectedFolderId(sp.id); setSelectedFolderName(sp.name); setOpenDropdown(null); }}>
                        <Text style={[s.overlayItemText, selectedFolderId === sp.id && s.overlayItemTextActive]}>{sp.name.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Tag a Category */}
            <ToggleRow label="TAG A CATEGORY" checked={!!selectedCategory} disabled={mode === 'batch' && useOneCategory} onToggle={() => {
              if (selectedCategory) setSelectedCategory(null);
              else if (categories.length > 0) setSelectedCategory(categories[0]);
            }} />
            {selectedCategory && (
              <View style={s.dropdownSection}>
                <PillDropdown id="tag-cat" label={selectedCategory.name} onPress={() => setOpenDropdown(openDropdown === 'tag-cat' ? null : 'tag-cat')} />
                {openDropdown === 'tag-cat' && (
                  <View style={s.overlayList}>
                    {categories.map(c => (
                      <TouchableOpacity key={c.id} style={[s.overlayItem, selectedCategory?.id === c.id && s.overlayItemActive]} onPress={() => { setSelectedCategory(c); setOpenDropdown(null); }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Text style={[s.overlayItemText, selectedCategory?.id === c.id && s.overlayItemTextActive]}>{c.name.toUpperCase()}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Tag an Account */}
            <ToggleRow label="TAG AN ACCOUNT" checked={!!selectedAccount} disabled={mode === 'batch' && useOneAccount} onToggle={() => {
              if (selectedAccount) setSelectedAccount(null);
              else if (accounts.length > 0) setSelectedAccount(accounts[0]);
            }} />
            {selectedAccount && (
              <View style={s.dropdownSection}>
                <PillDropdown id="tag-acct" label={selectedAccount.account_name} onPress={() => setOpenDropdown(openDropdown === 'tag-acct' ? null : 'tag-acct')} />
                {openDropdown === 'tag-acct' && (
                  <View style={s.overlayList}>
                    {accounts.map(a => (
                      <TouchableOpacity key={a.id} style={[s.overlayItem, selectedAccount?.id === a.id && s.overlayItemActive]} onPress={() => { setSelectedAccount(a); setOpenDropdown(null); }}>
                        <Text style={[s.overlayItemText, selectedAccount?.id === a.id && s.overlayItemTextActive]}>{a.account_name.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Bottom actions */}
          <View style={[s.bottomRow, mode === 'batch' && s.bottomRowBatch]}>

            <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={loading || !name.trim() || !amount.trim()} activeOpacity={0.7}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },

  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, marginBottom: 16,
  },
  title: {
    fontFamily: 'Poppins-Medium', fontSize: 17, color: '#000000',
    letterSpacing: 0.4,
  },

  scroll: { paddingHorizontal: DC.pagePadding, paddingBottom: 40, paddingTop: 16 },

  // ── Toggle row ──
  // ── Mode toggle ──
  modeRow: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
  },
  modePill: {
    paddingHorizontal: 16, height: 36, justifyContent: 'center',
    borderRadius: Radius.pill, borderWidth: 1, borderColor: BORDER,
  },
  modePillActive: { backgroundColor: '#464646' },
  modePillText:     { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#464646' },
  modePillTextActive: { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: '#fff' },

  // ── Toggle row ──
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 36, marginBottom: 0.5,
  },
  toggleLabel: { fontFamily: 'Poppins-Regular', fontSize: 11, color: '#464646', letterSpacing: 0.3 },
  toggleDisabled: { opacity: 0.35 },
  toggleLabelDisabled: { opacity: 0.5 },

  checkbox: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1, borderColor: '#000',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxInner: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#000',
  },

  // ── Dropdown ──
  dropdownSection: { marginBottom: 12 },
  pillDropdown: {
    height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: BORDER,
  },
  pillDropdownText: { fontFamily: 'Poppins-Regular', fontSize: 11, color: '#464646', letterSpacing: 0.6 },

  overlayList: {
    borderRadius: Radius.lg, borderWidth: 1, borderColor: BORDER,
    backgroundColor: '#fff', overflow: 'hidden', marginTop: 4,
  },
  overlayItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: BORDER,
  },
  overlayItemActive: { backgroundColor: '#f9f9f9' },
  overlayItemText:     { fontFamily: 'Poppins-Regular', fontSize: 11, color: '#464646', letterSpacing: 0.6 },
  overlayItemTextActive: { fontFamily: 'Poppins-Regular', fontSize: 11, color: '#000' },

  // ── Date row ──
  dateRow: { flexDirection: 'row', gap: 8 },

  // ── Form box ──
  formBox: {
    borderWidth: 1, borderColor: BORDER, borderRadius: Radius.lg,
    backgroundColor: '#fff', padding: 16, marginTop: 12,
  },
  fieldLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 11, color: '#464646', letterSpacing: 0.6, marginBottom: 6 },
  textInput: {
    height: 36, borderRadius: Radius.pill, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, fontSize: 16, fontFamily: 'Poppins-Regular', color: '#000',
  },

  // ── Amount ──
  amountRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  currencyPill: {
    height: 36, flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: BORDER,
  },
  currencyText: { fontFamily: 'Poppins-SemiBold', fontSize: 12, color: '#464646' },
  amountInput: {
    flex: 1, height: 36, borderRadius: Radius.pill, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, fontSize: 16, fontFamily: 'Poppins-Regular', color: '#000', minWidth: 0,
  },

  // ── Person search ──
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: Radius.pill, borderWidth: 1, borderColor: BORDER,
  },
  personInput: {
    flex: 1, fontSize: 16, fontFamily: 'Poppins-Regular', color: '#000',
    paddingVertical: 0,
  },

  // ── Bottom ──
  bottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
    marginTop: 24,
  },
  bottomRowBatch: {
    justifyContent: 'space-between',
  },
  addEntryBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#3a3a34',
    justifyContent: 'center', alignItems: 'center',
  },
  submitBtn: {
    paddingHorizontal: 32, height: 36, borderRadius: 18,
    backgroundColor: '#3a3a34',
    justifyContent: 'center', alignItems: 'center',
  },
  submitText: { fontFamily: 'Poppins-Regular', fontSize: 13, color: '#fff' },
});
