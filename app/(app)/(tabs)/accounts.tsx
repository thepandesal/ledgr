import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  Modal, TextInput, ActivityIndicator, Alert, Animated, Image,
} from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { BlurView } from 'expo-blur';

const DEFAULT_BANKS = ['BDO', 'BPI', 'Metrobank', 'UnionBank', 'Security Bank', 'PNB', 'Landbank', 'RCBC', 'Chinabank', 'EastWest', 'GCash', 'Maya', 'Seabank', 'GoTyme', 'Tonik'];

interface Account { id: string; bank: string; account_name: string; account_number: string; qr_code: string | null; }

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userId, setUserId] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
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
    setSelected(account); setMenuModal(true);
    Animated.timing(menuFade, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };

  const closeMenu = (cb?: () => void) => {
    Animated.timing(menuFade, { toValue: 0, duration: 150, useNativeDriver: false }).start(() => { setMenuModal(false); cb?.(); });
  };

  const handleDelete = () => {
    closeMenu(() => {
      Alert.alert('Delete Account', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('accounts').delete().eq('id', selected!.id);
          loadAccounts(userId);
        }},
      ]);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.titleBlock}>
          <Text style={styles.pageLabel}>your</Text>
          <Text style={styles.pageTitle}>accounts</Text>
        </View>

        <Text style={styles.sectionHeader}>saved accounts</Text>

        <View style={styles.list}>
          {accounts.map(account => (
            <TouchableOpacity
              key={account.id}
              style={styles.accountCard}
              activeOpacity={0.85}
              onLongPress={() => openMenu(account)}
            >
              <View style={styles.accountLeft}>
                <View style={styles.accountIconWrap}>
                  <Ionicons name="card-outline" size={18} color="#0ccfcf" />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName} numberOfLines={1}>{account.account_name}</Text>
                  <Text style={styles.accountBank}>{account.bank}</Text>
                  {account.account_number ? (
                    <Text style={styles.accountNumber}>•••• {account.account_number.slice(-4)}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.accountRight}>
                {account.qr_code ? (
                  <Image source={{ uri: account.qr_code }} style={styles.qrThumb} resizeMode="cover" />
                ) : (
                  <View style={styles.qrEmpty}>
                    <Ionicons name="qr-code-outline" size={16} color="#c0c0c0" />
                  </View>
                )}
                <TouchableOpacity onPress={() => openMenu(account)} style={styles.menuBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="ellipsis-horizontal" size={16} color="#929090" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={14} color="#425252" />
          <Text style={styles.addBtnText}>add an account</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Add modal */}
      {addModal && (
        <AccountForm
          userId={userId}
          onClose={() => setAddModal(false)}
          onSaved={() => { setAddModal(false); loadAccounts(userId); }}
        />
      )}

      {/* Edit modal */}
      {editAccount && (
        <AccountForm
          userId={userId}
          initial={editAccount}
          onClose={() => setEditAccount(null)}
          onSaved={() => { setEditAccount(null); loadAccounts(userId); }}
        />
      )}

      {/* Menu modal */}
      <Modal visible={menuModal} transparent animationType="none" onRequestClose={() => closeMenu()}>
        <BlurView intensity={40} tint="light" style={{ flex: 1 }}>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => closeMenu()}>
            <Animated.View style={[styles.menuContent, { opacity: menuFade }]}>
              <TouchableOpacity style={styles.menuItem} onPress={() => closeMenu(() => setEditAccount(selected))}>
                <Ionicons name="pencil-outline" size={16} color="#425252" />
                <Text style={styles.menuItemText}>edit</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={16} color="#ed6a6a" />
                <Text style={[styles.menuItemText, { color: '#ed6a6a' }]}>delete</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

function AccountForm({ userId, initial, onClose, onSaved }: {
  userId: string; initial?: Account | null; onClose: () => void; onSaved: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(500)).current;
  const [bankInput, setBankInput] = useState(initial?.bank ?? '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [accountName, setAccountName] = useState(initial?.account_name ?? '');
  const [accountNumber, setAccountNumber] = useState(initial?.account_number ?? '');
  const [qrCode, setQrCode] = useState<string | null>(initial?.qr_code ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [allBanks, setAllBanks] = useState(DEFAULT_BANKS);

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }, []);

  const close = () => {
    Animated.timing(slideAnim, { toValue: 500, duration: 220, useNativeDriver: true }).start(onClose);
  };

  const handleBankInput = (val: string) => {
    setBankInput(val);
    setSuggestions(val.trim() ? allBanks.filter(b => b.toLowerCase().includes(val.toLowerCase())) : []);
  };

  const pickQR = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 300, height: 300 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setQrCode(`data:image/jpeg;base64,${compressed.base64}`);
    }
  };

  const handleSubmit = async () => {
    if (!bankInput.trim() || !accountName.trim() || !accountNumber.trim()) {
      setError('bank, account name and account number are required.');
      return;
    }
    setLoading(true); setError('');
    try {
      const payload = {
        bank: bankInput.trim(),
        account_name: accountName.trim(),
        account_number: accountNumber.trim(),
        qr_code: qrCode,
        account_type: 'Savings',
        account_details: '',
        color: '#f0f0f0',
      };
      if (initial) {
        const { error: err } = await supabase.from('accounts').update(payload).eq('id', initial.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('accounts').insert({ ...payload, user_id: userId });
        if (err) throw err;
      }
      onSaved();
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <BlurView intensity={40} tint="light" style={{ flex: 1 }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
        <Animated.View style={[styles.formSheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.formHeader}>
            <View>
              <Text style={styles.formLabel}>{initial ? 'editing' : 'new'}</Text>
              <Text style={styles.formTitle}>account</Text>
            </View>
            <TouchableOpacity onPress={close}>
              <Ionicons name="close" size={22} color="#929090" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.infoBlock}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>account name</Text>
                <TextInput
                  style={styles.infoInput}
                  placeholder="e.g. my gcash"
                  placeholderTextColor="#c0c0c0"
                  value={accountName}
                  onChangeText={setAccountName}
                  autoFocus
                />
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>bank</Text>
                <TextInput
                  style={styles.infoInput}
                  placeholder="e.g. gcash"
                  placeholderTextColor="#c0c0c0"
                  value={bankInput}
                  onChangeText={handleBankInput}
                />
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>acct no.</Text>
                <TextInput
                  style={styles.infoInput}
                  placeholder="required"
                  placeholderTextColor="#c0c0c0"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {suggestions.length > 0 && (
              <View style={styles.suggestionBox}>
                {suggestions.map(b => (
                  <TouchableOpacity key={b} style={styles.suggestionItem} onPress={() => { setBankInput(b); setSuggestions([]); }}>
                    <Text style={styles.suggestionText}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* QR Code */}
            <Text style={styles.fieldLabel}>qr code <Text style={styles.fieldOptional}>(optional)</Text></Text>
            <TouchableOpacity style={styles.qrUploadBtn} onPress={pickQR} activeOpacity={0.8}>
              {qrCode ? (
                <View style={styles.qrPreviewWrap}>
                  <Image source={{ uri: qrCode }} style={styles.qrPreview} resizeMode="cover" />
                  <TouchableOpacity style={styles.qrRemove} onPress={() => setQrCode(null)}>
                    <Ionicons name="close-circle" size={20} color="#ed6a6a" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.qrEmpty2}>
                  <Ionicons name="qr-code-outline" size={28} color="#c0c0c0" />
                  <Text style={styles.qrUploadText}>tap to upload & crop</Text>
                  <Text style={styles.qrUploadSub}>max 300×300 · jpeg compressed</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, (!bankInput.trim() || !accountName.trim() || !accountNumber.trim()) && { opacity: 0.4 }]}
              onPress={handleSubmit}
              disabled={loading || !bankInput.trim() || !accountName.trim() || !accountNumber.trim()}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{initial ? 'save changes' : 'add account'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { paddingHorizontal: 32, paddingBottom: 60, paddingTop: 52 },
  titleBlock: { marginBottom: 20 },
  pageLabel: { fontFamily: 'ChillaxMedium', fontSize: 11, color: '#929090', marginBottom: 2 },
  pageTitle: { fontFamily: 'Avenelle', fontSize: 32, color: '#425252', lineHeight: 36, letterSpacing: -1, textShadowColor: 'rgba(0,0,0,0.12)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  sectionHeader: { fontFamily: 'ChillaxMedium', fontSize: 15, color: '#0ccfcf', letterSpacing: -0.5, marginBottom: 12 },
  list: { gap: 10, marginBottom: 16 },
  accountCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafafa', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#f0f0f0' },
  accountLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  accountIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f0fffe', justifyContent: 'center', alignItems: 'center' },
  accountInfo: { flex: 1, gap: 2 },
  accountName: { fontFamily: 'Avenelle', fontSize: 16, color: '#425252', letterSpacing: -0.5 },
  accountBank: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090' },
  accountNumber: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#c0c0c0' },
  accountRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qrThumb: { width: 32, height: 32, borderRadius: 6 },
  qrEmpty: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  menuBtn: { padding: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', backgroundColor: '#fafafa', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e8e8e8' },
  addBtnText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#425252' },
  menuOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  menuContent: { backgroundColor: '#ffffff', borderRadius: 14, overflow: 'hidden', minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  menuItemText: { fontFamily: 'RobotoMono_400Regular', fontSize: 13, color: '#425252' },
  menuDivider: { height: 1, backgroundColor: '#f0f0f0' },
  formSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48, maxHeight: '88%' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  formLabel: { fontFamily: 'ChillaxMedium', fontSize: 11, color: '#929090' },
  formTitle: { fontFamily: 'Avenelle', fontSize: 28, color: '#425252', letterSpacing: -0.5, lineHeight: 32 },
  errorText: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#ed6a6a', marginBottom: 10 },
  infoBlock: { backgroundColor: '#fafafa', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 },
  infoLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: '#929090', width: 70, flexShrink: 0 },
  infoInput: { flex: 1, fontFamily: 'RobotoMono_400Regular', fontSize: 16, color: '#425252', padding: 0 },
  infoDivider: { height: 1, backgroundColor: '#f0f0f0' },
  suggestionBox: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 8, overflow: 'hidden' },
  suggestionItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestionText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#425252' },
  fieldLabel: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#929090', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  fieldOptional: { color: '#c0c0c0', textTransform: 'none' },
  qrUploadBtn: { borderRadius: 14, borderWidth: 1, borderColor: '#f0f0f0', backgroundColor: '#fafafa', overflow: 'hidden', marginBottom: 24 },
  qrEmpty2: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 6 },
  qrUploadText: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090' },
  qrUploadSub: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: '#c0c0c0' },
  qrPreviewWrap: { alignItems: 'center', padding: 16 },
  qrPreview: { width: 160, height: 160, borderRadius: 10 },
  qrRemove: { position: 'absolute', top: 8, right: 8 },
  saveBtn: { backgroundColor: '#425252', borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#fff' },
});
