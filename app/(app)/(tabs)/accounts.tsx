import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  Modal, TextInput, ActivityIndicator, Alert, Animated, Image,
  KeyboardAvoidingView, Platform, PanResponder, Dimensions,
} from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { BlurView } from 'expo-blur';

const { width: SW, height: SH } = Dimensions.get('window');
const DEFAULT_BANKS = ['BDO', 'BPI', 'Metrobank', 'UnionBank', 'Security Bank', 'PNB', 'Landbank', 'RCBC', 'Chinabank', 'EastWest', 'GCash', 'Maya', 'Seabank', 'GoTyme', 'Tonik'];
const MIN_CROP = 80;
const INIT_CROP = SW * 0.7;
const HANDLE_HIT = 32;

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
            <TouchableOpacity key={account.id} style={styles.accountCard} activeOpacity={0.85} onLongPress={() => openMenu(account)}>
              <View style={styles.accountLeft}>
                <View style={styles.accountIconWrap}>
                  <Ionicons name="card-outline" size={18} color="#0ccfcf" />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName} numberOfLines={1}>{account.account_name}</Text>
                  <Text style={styles.accountBank}>{account.bank}</Text>
                  {account.account_number ? <Text style={styles.accountNumber}>•••• {account.account_number.slice(-4)}</Text> : null}
                </View>
              </View>
              <View style={styles.accountRight}>
                {account.qr_code
                  ? <Image source={{ uri: account.qr_code }} style={styles.qrThumb} resizeMode="cover" />
                  : <View style={styles.qrEmpty}><Ionicons name="qr-code-outline" size={16} color="#c0c0c0" /></View>}
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

      {addModal && <AccountForm userId={userId} onClose={() => setAddModal(false)} onSaved={() => { setAddModal(false); loadAccounts(userId); }} />}
      {editAccount && <AccountForm userId={userId} initial={editAccount} onClose={() => setEditAccount(null)} onSaved={() => { setEditAccount(null); loadAccounts(userId); }} />}

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

function CropView({ uri, onCrop, onCancel }: { uri: string; onCrop: (base64: string) => void; onCancel: () => void }) {
  const [imgDisplay, setImgDisplay] = useState({ x: 0, y: 0, w: SW, h: SH });
  const [imgNatural, setImgNatural] = useState({ w: 1, h: 1 });

  const bx = useRef((SW - INIT_CROP) / 2);
  const by = useRef((SH - INIT_CROP) / 2);
  const bs = useRef(INIT_CROP);
  const animX = useRef(new Animated.Value(bx.current)).current;
  const animY = useRef(new Animated.Value(by.current)).current;
  const animS = useRef(new Animated.Value(bs.current)).current;

  useEffect(() => {
    Image.getSize(uri, (w, h) => {
      setImgNatural({ w, h });
      const r = Math.min(SW / w, SH / h);
      const dw = w * r, dh = h * r;
      setImgDisplay({ x: (SW - dw) / 2, y: (SH - dh) / 2, w: dw, h: dh });
    });
  }, [uri]);

  const mode = useRef<'move' | 'resize' | null>(null);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      // if touch is near bottom-right corner → resize
      const nearCorner = locationX > bs.current - HANDLE_HIT && locationY > bs.current - HANDLE_HIT;
      mode.current = nearCorner ? 'resize' : 'move';
    },
    onPanResponderMove: (_, gs) => {
      if (mode.current === 'move') {
        const nx = Math.max(0, Math.min(SW - bs.current, bx.current + gs.dx));
        const ny = Math.max(0, Math.min(SH - bs.current, by.current + gs.dy));
        animX.setValue(nx);
        animY.setValue(ny);
      } else {
        const ns = Math.max(MIN_CROP, Math.min(Math.min(SW - bx.current, SH - by.current), bs.current + gs.dx));
        animS.setValue(ns);
      }
    },
    onPanResponderRelease: (_, gs) => {
      if (mode.current === 'move') {
        bx.current = Math.max(0, Math.min(SW - bs.current, bx.current + gs.dx));
        by.current = Math.max(0, Math.min(SH - bs.current, by.current + gs.dy));
      } else {
        bs.current = Math.max(MIN_CROP, Math.min(Math.min(SW - bx.current, SH - by.current), bs.current + gs.dx));
      }
      mode.current = null;
    },
  })).current;

  const doCrop = async () => {
    const relX = (bx.current - imgDisplay.x) / imgDisplay.w;
    const relY = (by.current - imgDisplay.y) / imgDisplay.h;
    const relS = bs.current / imgDisplay.w;
    const originX = Math.max(0, relX * imgNatural.w);
    const originY = Math.max(0, relY * imgNatural.h);
    const cropW = Math.min(imgNatural.w - originX, relS * imgNatural.w);
    const cropH = Math.min(imgNatural.h - originY, relS * imgNatural.h);
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX, originY, width: cropW, height: cropH } }, { resize: { width: 300, height: 300 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    onCrop(`data:image/jpeg;base64,${result.base64}`);
  };

  return (
    <View style={cropStyles.container}>
      <Image source={{ uri }} style={cropStyles.image} resizeMode="contain" />

      {/* Overlays */}
      <Animated.View style={[cropStyles.overlayTop, { height: animY }]} pointerEvents="none" />
      <Animated.View style={[cropStyles.overlayLeft, { top: animY, width: animX, height: animS }]} pointerEvents="none" />
      <Animated.View style={[cropStyles.overlayRight, { top: animY, left: Animated.add(animX, animS), height: animS }]} pointerEvents="none" />
      <Animated.View style={[cropStyles.overlayBottom, { top: Animated.add(animY, animS) }]} pointerEvents="none" />

      {/* Crop frame — single responder handles both move and resize */}
      <Animated.View
        style={[cropStyles.frame, { left: animX, top: animY, width: animS, height: animS }]}
        {...pan.panHandlers}
      >
        <View style={[cropStyles.corner, cropStyles.cTL]} />
        <View style={[cropStyles.corner, cropStyles.cTR]} />
        <View style={[cropStyles.corner, cropStyles.cBL]} />
        <View style={[cropStyles.corner, cropStyles.cBR]} />
        <View style={cropStyles.resizeHint}>
          <Ionicons name="resize-outline" size={12} color="rgba(255,255,255,0.6)" />
        </View>
      </Animated.View>

      <View style={cropStyles.header}>
        <TouchableOpacity onPress={onCancel} style={cropStyles.btn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={cropStyles.hint}>drag to move · drag corner to resize</Text>
        <TouchableOpacity onPress={doCrop} style={cropStyles.btn}>
          <Ionicons name="checkmark" size={24} color="#0ccfcf" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AccountForm({ userId, initial, onClose, onSaved }: {
  userId: string; initial?: Account | null; onClose: () => void; onSaved: () => void;
}) {
  const [bankInput, setBankInput] = useState(initial?.bank ?? '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [accountName, setAccountName] = useState(initial?.account_name ?? '');
  const [accountNumber, setAccountNumber] = useState(initial?.account_number ?? '');
  const [qrCode, setQrCode] = useState<string | null>(initial?.qr_code ?? null);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBankInput = (val: string) => {
    setBankInput(val);
    setSuggestions(val.trim() ? DEFAULT_BANKS.filter(b => b.toLowerCase().includes(val.toLowerCase())) : []);
  };

  const pickQR = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) setCropUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!bankInput.trim() || !accountName.trim() || !accountNumber.trim()) { setError('bank, account name and account number are required.'); return; }
    setLoading(true); setError('');
    try {
      const payload = { bank: bankInput.trim(), account_name: accountName.trim(), account_number: accountNumber.trim(), qr_code: qrCode, account_type: 'Savings', account_details: '', color: '#f0f0f0' };
      if (initial) { const { error: err } = await supabase.from('accounts').update(payload).eq('id', initial.id); if (err) throw err; }
      else { const { error: err } = await supabase.from('accounts').insert({ ...payload, user_id: userId }); if (err) throw err; }
      onSaved();
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.formSheet}>
          <View style={styles.formHeader}>
            <View>
              <Text style={styles.formLabel}>{initial ? 'editing' : 'new'}</Text>
              <Text style={styles.formTitle}>account</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#929090" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.infoBlock}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>account name</Text>
                <TextInput style={styles.infoInput} placeholder="e.g. my gcash" placeholderTextColor="#c0c0c0" value={accountName} onChangeText={setAccountName} autoFocus />
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>bank</Text>
                <TextInput style={styles.infoInput} placeholder="e.g. gcash" placeholderTextColor="#c0c0c0" value={bankInput} onChangeText={handleBankInput} />
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>acct no.</Text>
                <TextInput style={styles.infoInput} placeholder="required" placeholderTextColor="#c0c0c0" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" />
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
            <TouchableOpacity style={[styles.saveBtn, (!bankInput.trim() || !accountName.trim() || !accountNumber.trim()) && { opacity: 0.4 }]} onPress={handleSubmit} disabled={loading || !bankInput.trim() || !accountName.trim() || !accountNumber.trim()} activeOpacity={0.8}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{initial ? 'save changes' : 'add account'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Crop overlay — rendered inside the same Modal, always on top */}
      {cropUri && (
        <View style={StyleSheet.absoluteFill}>
          <CropView
            uri={cropUri}
            onCrop={(b64) => { setQrCode(b64); setCropUri(null); }}
            onCancel={() => setCropUri(null)}
          />
        </View>
      )}
    </Modal>
  );
}

const cropStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  image: { position: 'absolute', top: 0, left: 0, width: SW, height: SH },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayLeft: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayRight: { position: 'absolute', right: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  frame: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  corner: { position: 'absolute', width: 22, height: 22, borderColor: '#0ccfcf', borderWidth: 2.5 },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  resizeHint: { position: 'absolute', bottom: 6, right: 6 },
  header: { position: 'absolute', top: 52, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  btn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  hint: { fontFamily: 'RobotoMono_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.6)' },
});

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
  accountName: { fontFamily: 'ChillaxMedium', fontSize: 16, color: '#425252', letterSpacing: -0.5 },
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
