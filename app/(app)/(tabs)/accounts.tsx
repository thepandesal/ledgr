import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  Modal, TextInput, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';

const PASTEL_COLORS = [
  '#FFB3B3', '#FFD9B3', '#FFFAB3', '#B3FFB3', '#B3FFE0',
  '#B3F0FF', '#B3C6FF', '#D9B3FF', '#FFB3F0', '#FFB3C6',
];

const ACCOUNT_TYPES = ['ATM', 'Credit Card', 'Savings', 'Cash'];

const DEFAULT_BANKS = [
  'BDO', 'BPI', 'Metrobank', 'UnionBank', 'Security Bank',
  'PNB', 'Landbank', 'RCBC', 'Chinabank', 'EastWest',
  'GCash', 'Maya', 'Seabank', 'GoTyme', 'Tonik',
];

interface Account {
  id: string;
  bank: string;
  account_type: string;
  account_name: string;
  account_details: string;
  color: string;
}

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userId, setUserId] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [menuModal, setMenuModal] = useState(false);
  const [selected, setSelected] = useState<Account | null>(null);
  const menuFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); loadAccounts(user.id); }
    });
  }, []);

  const loadAccounts = async (uid: string) => {
    const { data } = await supabase.from('accounts').select().eq('user_id', uid).order('created_at');
    if (data) setAccounts(data);
  };

  const openMenu = (account: Account) => {
    setSelected(account);
    setMenuModal(true);
    Animated.timing(menuFade, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };

  const closeMenu = (cb?: () => void) => {
    Animated.timing(menuFade, { toValue: 0, duration: 150, useNativeDriver: false }).start(() => {
      setMenuModal(false);
      cb?.();
    });
  };

  const handleDelete = () => {
    closeMenu(() => {
      Alert.alert(
        'Delete Account',
        'If this account has been used in recordings, those recordings will reflect a null account. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete', style: 'destructive', onPress: async () => {
              await supabase.from('accounts').delete().eq('id', selected!.id);
              await loadAccounts(userId);
            },
          },
        ]
      );
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Accounts</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.grid}>
          {accounts.map(account => (
            <View key={account.id} style={[styles.accountBtn, { backgroundColor: account.color }]}>
              <View style={styles.accountBtnLeft}>
                <Text style={styles.accountName}>{account.account_name}</Text>
                <Text style={styles.accountMeta}>{account.bank} · {account.account_type}</Text>
              </View>
              <TouchableOpacity onPress={() => openMenu(account)} style={styles.menuBtn}>
                <Ionicons name="ellipsis-vertical" size={16} color="#1c1d1d" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color="rgba(255,255,255,0.4)" />
            <Text style={styles.addBtnText}>add an account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AccountForm
        visible={addModal}
        title="new account"
        userId={userId}
        onClose={() => setAddModal(false)}
        onSaved={() => { setAddModal(false); loadAccounts(userId); }}
        banks={DEFAULT_BANKS}
      />

      <AccountForm
        visible={editModal}
        title="edit account"
        userId={userId}
        initial={selected ?? undefined}
        onClose={() => setEditModal(false)}
        onSaved={() => { setEditModal(false); loadAccounts(userId); }}
        banks={DEFAULT_BANKS}
      />

      <Modal visible={menuModal} transparent animationType="none" onRequestClose={() => closeMenu()}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => closeMenu()}>
          <Animated.View style={[styles.menuContent, { opacity: menuFade }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => closeMenu(() => setEditModal(true))}>
              <Ionicons name="pencil-outline" size={18} color="#fff" />
              <Text style={styles.menuItemText}>edit</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color="#e74c3c" />
              <Text style={[styles.menuItemText, { color: '#e74c3c' }]}>delete</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Account Form (separate component to fix typing bug) ─────────────────────

function AccountForm({
  visible, title, userId, initial, onClose, onSaved, banks,
}: {
  visible: boolean;
  title: string;
  userId: string;
  initial?: Account;
  onClose: () => void;
  onSaved: () => void;
  banks: string[];
}) {
  const [bankInput, setBankInput] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showAddBank, setShowAddBank] = useState(false);
  const [accountType, setAccountType] = useState(ACCOUNT_TYPES[0]);
  const [accountName, setAccountName] = useState('');
  const [accountDetails, setAccountDetails] = useState('');
  const [color, setColor] = useState(PASTEL_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [allBanks, setAllBanks] = useState(banks);

  useEffect(() => {
    if (visible) {
      if (initial) {
        setSelectedBank(initial.bank);
        setBankInput('');
        setAccountType(initial.account_type);
        setAccountName(initial.account_name);
        setAccountDetails(initial.account_details ?? '');
        setColor(initial.color);
      } else {
        setSelectedBank(''); setBankInput(''); setAccountType(ACCOUNT_TYPES[0]);
        setAccountName(''); setAccountDetails(''); setColor(PASTEL_COLORS[0]);
      }
      setError(''); setSuggestions([]); setShowAddBank(false);
    }
  }, [visible]);

  const handleBankInput = (val: string) => {
    setBankInput(val);
    setSelectedBank('');
    if (val.trim()) {
      const filtered = allBanks.filter(b => b.toLowerCase().includes(val.toLowerCase()));
      setSuggestions(filtered);
      setShowAddBank(filtered.length === 0 || !filtered.some(b => b.toLowerCase() === val.toLowerCase()));
    } else {
      setSuggestions([]);
      setShowAddBank(false);
    }
  };

  const selectBank = (bank: string) => {
    setSelectedBank(bank);
    setBankInput('');
    setSuggestions([]);
    setShowAddBank(false);
  };

  const addNewBank = () => {
    const newBank = bankInput.trim();
    if (!newBank) return;
    setAllBanks(prev => [...prev, newBank]);
    selectBank(newBank);
  };

  const handleSubmit = async () => {
    const bank = selectedBank || bankInput.trim();
    if (!bank || !accountName.trim()) { setError('Bank and account name are required.'); return; }
    setLoading(true);
    setError('');
    try {
      if (initial) {
        const { error: err } = await supabase.from('accounts').update({
          bank, account_type: accountType, account_name: accountName.trim(),
          account_details: accountDetails.trim(), color,
        }).eq('id', initial.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('accounts').insert({
          user_id: userId, bank, account_type: accountType,
          account_name: accountName.trim(), account_details: accountDetails.trim(), color,
        });
        if (err) throw err;
      }
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const bank = selectedBank || bankInput.trim();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.label}>bank</Text>
            {selectedBank ? (
              <View style={styles.bankBadgeRow}>
                <View style={styles.bankBadge}>
                  <Text style={styles.bankBadgeText}>{selectedBank}</Text>
                  <TouchableOpacity onPress={() => setSelectedBank('')} style={styles.bankBadgeX}>
                    <Ionicons name="close" size={14} color="#1c1d1d" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="type to search or add a bank"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={bankInput}
                  onChangeText={handleBankInput}
                  autoCorrect={false}
                />
                {suggestions.length > 0 && (
                  <View style={styles.suggestions}>
                    {suggestions.map(b => (
                      <TouchableOpacity key={b} style={styles.suggestion} onPress={() => selectBank(b)}>
                        <Text style={styles.suggestionText}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {showAddBank && bankInput.trim() !== '' && (
                  <TouchableOpacity style={styles.addBankRow} onPress={addNewBank}>
                    <Ionicons name="add-circle-outline" size={16} color="#00bf63" />
                    <Text style={styles.addBankText}>add "{bankInput.trim()}" as a new bank</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <Text style={styles.label}>account type</Text>
            <View style={styles.chipRow}>
              {ACCOUNT_TYPES.map(t => (
                <TouchableOpacity key={t} style={[styles.chip, accountType === t && styles.chipActive]} onPress={() => setAccountType(t)}>
                  <Text style={[styles.chipText, accountType === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>account name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. My BDO Savings"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={accountName}
              onChangeText={setAccountName}
            />

            <Text style={styles.label}>account details</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. account number, notes..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={accountDetails}
              onChangeText={setAccountDetails}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.detailsWarning}>⚠️ Do not include CVV, passwords, or any confidential information.</Text>

            <Text style={styles.label}>color</Text>
            <View style={styles.colorRow}>
              {PASTEL_COLORS.map(c => (
                <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSelected]} onPress={() => setColor(c)} />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, !bank || !accountName.trim() ? styles.saveBtnDisabled : null]}
              onPress={handleSubmit}
              disabled={loading || !bank || !accountName.trim()}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{initial ? 'save changes' : 'add account'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c1d1d' },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 22, color: '#ffffff' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  grid: { gap: 10 },
  accountBtn: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accountBtnLeft: { flex: 1 },
  accountName: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#1c1d1d' },
  accountMeta: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: 'rgba(0,0,0,0.5)', marginTop: 2 },
  menuBtn: { padding: 4 },
  addBtn: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a2b2b', borderWidth: 1, borderColor: '#3a3b3b', gap: 6 },
  addBtnText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#242525', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: 'DMSans_700Bold', fontSize: 18, color: '#ffffff' },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16 },
  input: { backgroundColor: '#2a2b2b', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#ffffff', borderWidth: 1, borderColor: '#3a3b3b' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  detailsWarning: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: 'rgba(255,165,0,0.8)', marginTop: 6 },
  bankBadgeRow: { flexDirection: 'row' },
  bankBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, gap: 6 },
  bankBadgeText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: '#1c1d1d' },
  bankBadgeX: { padding: 2 },
  suggestions: { backgroundColor: '#2a2b2b', borderRadius: 12, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#3a3b3b' },
  suggestion: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#3a3b3b' },
  suggestionText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#ffffff' },
  addBankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  addBankText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#00bf63' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#3a3b3b', backgroundColor: '#2a2b2b' },
  chipActive: { backgroundColor: '#00bf63', borderColor: '#00bf63' },
  chipText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  chipTextActive: { color: '#ffffff', fontFamily: 'DMSans_600SemiBold' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotSelected: { borderWidth: 3, borderColor: '#ffffff' },
  saveBtn: { backgroundColor: '#00bf63', borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 20, marginBottom: 10 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#ffffff' },
  error: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#e74c3c', marginBottom: 4 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  menuContent: { backgroundColor: '#2a2b2b', borderRadius: 16, overflow: 'hidden', minWidth: 160 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  menuItemText: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: '#ffffff' },
  menuDivider: { height: 1, backgroundColor: '#3a3b3b' },
});
