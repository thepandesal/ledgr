import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, ActivityIndicator, Alert, Animated, Image,
  KeyboardAvoidingView, Platform, PanResponder, Dimensions,
} from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import formStyles from '@/components/ui/formStyles';
import pageStyles from '@/components/ui/pageStyles';
import { Colors, Fonts, Radius, Spacing, Shadow } from '@/components/ui/theme';

const { width: SW, height: SH } = Dimensions.get('window');
const DEFAULT_BANKS = ['BDO', 'BPI', 'Metrobank', 'UnionBank', 'Security Bank', 'PNB', 'Landbank', 'RCBC', 'Chinabank', 'EastWest', 'GCash', 'Maya', 'Seabank', 'GoTyme', 'Tonik'];
const MIN_CROP = 80;
const INIT_CROP = SW * 0.7;
const HANDLE_HIT = 32;

interface Account { id: string; bank: string; account_name: string; account_number: string; qr_code: string | null; holder_name: string; }

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userId, setUserId] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [menuModal, setMenuModal] = useState(false);
  const [selected, setSelected] = useState<Account | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); loadAccounts(user.id); }
    });
  }, []);

  const loadAccounts = async (uid: string) => {
    const { data } = await supabase.from('accounts').select().eq('user_id', uid).order('created_at');
    if (data) setAccounts(data);
  };

  const handleDelete = async () => {
    setMenuModal(false);
    await supabase.from('accounts').delete().eq('id', selected!.id);
    loadAccounts(userId);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>accounts</Text>
        <Text style={s.pageSubtitle}>your saved payment methods.</Text>
        <View style={{ gap: 10, marginBottom: 16 }}>
          {accounts.map(account => (
            <TouchableOpacity key={account.id} style={s.accountCard} activeOpacity={0.85} onLongPress={() => { setSelected(account); setMenuModal(true); }}>
              <View style={s.accountLeft}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.accountName} numberOfLines={1}>{account.account_name}</Text>
                  <Text style={s.accountMeta}>{account.holder_name} · {account.bank} · •••• {account.account_number?.slice(-4) ?? ''}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {account.qr_code
                  ? <Image source={{ uri: account.qr_code }} style={s.qrThumb} resizeMode="cover" />
                  : <View style={s.qrEmpty}><Ionicons name="qr-code-outline" size={16} color={Colors.faint} /></View>}
                <TouchableOpacity onPress={() => { setSelected(account); setMenuModal(true); }} style={{ padding: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="ellipsis-horizontal" size={16} color={Colors.muted} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
          {accounts.length === 0 && (
            <View style={s.emptyBox}>
              <Ionicons name="card-outline" size={32} color={Colors.faint} />
              <Text style={s.emptyText}>no accounts saved yet</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setAddModal(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={14} color={Colors.muted} />
          <Text style={s.addBtnText}>add an account</Text>
        </TouchableOpacity>
      </ScrollView>

      <AccountForm visible={addModal} userId={userId} onClose={() => setAddModal(false)} onSaved={() => { setAddModal(false); loadAccounts(userId); }} />
      <AccountForm visible={!!editAccount} userId={userId} initial={editAccount} onClose={() => setEditAccount(null)} onSaved={() => { setEditAccount(null); loadAccounts(userId); }} />

      <ConfirmModal
        visible={menuModal}
        onClose={() => setMenuModal(false)}
        title={selected?.holder_name || selected?.account_name || 'account'}
        actions={[
          { label: 'cancel', onPress: () => setMenuModal(false), muted: true },
          { label: 'edit', onPress: () => { setMenuModal(false); setEditAccount(selected); } },
          { label: 'delete', onPress: handleDelete, destructive: true },
        ]}
      />
    </SafeAreaView>
  );
}

// ─── CropView ────────────────────────────────────────────────────────────────
// Full-screen QR crop tool — intentionally raw view (not a modal)

function CropView({ uri, onCrop, onCancel }: { uri: string; onCrop: (base64: string) => void; onCancel: () => void }) {
  const [imgNatural, setImgNatural] = useState({ w: 1, h: 1 });
  const [box, setBox] = useState({ x: (SW - INIT_CROP) / 2, y: (SH - INIT_CROP) / 2, s: INIT_CROP });
  const boxRef = useRef(box);
  const animX = useRef(new Animated.Value(box.x)).current;
  const animY = useRef(new Animated.Value(box.y)).current;
  const animS = useRef(new Animated.Value(box.s)).current;

  useEffect(() => { boxRef.current = box; }, [box]);
  useEffect(() => { Image.getSize(uri, (w, h) => setImgNatural({ w, h })); }, [uri]);

  const mode = useRef<'move' | 'resize' | null>(null);
  const startBox = useRef(box);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      startBox.current = boxRef.current;
      const { locationX, locationY } = e.nativeEvent;
      mode.current = (locationX > startBox.current.s - HANDLE_HIT && locationY > startBox.current.s - HANDLE_HIT) ? 'resize' : 'move';
    },
    onPanResponderMove: (_, gs) => {
      const b = startBox.current;
      if (mode.current === 'move') {
        animX.setValue(Math.max(0, Math.min(SW - b.s, b.x + gs.dx)));
        animY.setValue(Math.max(0, Math.min(SH - b.s, b.y + gs.dy)));
      } else {
        animS.setValue(Math.max(MIN_CROP, Math.min(Math.min(SW - b.x, SH - b.y), b.s + gs.dx)));
      }
    },
    onPanResponderRelease: (_, gs) => {
      const b = startBox.current;
      const newBox = mode.current === 'move'
        ? { x: Math.max(0, Math.min(SW - b.s, b.x + gs.dx)), y: Math.max(0, Math.min(SH - b.s, b.y + gs.dy)), s: b.s }
        : { ...b, s: Math.max(MIN_CROP, Math.min(Math.min(SW - b.x, SH - b.y), b.s + gs.dx)) };
      boxRef.current = newBox;
      setBox(newBox);
      mode.current = null;
    },
  })).current;

  const doCrop = async () => {
    const { x: cx, y: cy, s: cs } = boxRef.current;
    const { w: iw, h: ih } = imgNatural;
    const imgRatio = iw / ih;
    const screenRatio = SW / SH;
    let renderedW, renderedH, offsetX, offsetY;
    if (imgRatio > screenRatio) {
      renderedW = SW; renderedH = SW / imgRatio; offsetX = 0; offsetY = (SH - renderedH) / 2;
    } else {
      renderedH = SH; renderedW = SH * imgRatio; offsetX = (SW - renderedW) / 2; offsetY = 0;
    }
    const scaleX = iw / renderedW;
    const scaleY = ih / renderedH;
    const originX = Math.max(0, (cx - offsetX) * scaleX);
    const originY = Math.max(0, (cy - offsetY) * scaleY);
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX, originY, width: Math.min(iw - originX, cs * scaleX), height: Math.min(ih - originY, cs * scaleY) } }, { resize: { width: 600, height: 600 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    onCrop(`data:image/jpeg;base64,${result.base64}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Image source={{ uri }} style={{ position: 'absolute', top: 0, left: 0, width: SW, height: SH }} resizeMode="contain" />
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: animY, backgroundColor: 'rgba(0,0,0,0.6)' }} pointerEvents="none" />
      <Animated.View style={{ position: 'absolute', top: animY, width: animX, height: animS, backgroundColor: 'rgba(0,0,0,0.6)' }} pointerEvents="none" />
      <Animated.View style={{ position: 'absolute', top: animY, left: Animated.add(animX, animS), right: 0, height: animS, backgroundColor: 'rgba(0,0,0,0.6)' }} pointerEvents="none" />
      <Animated.View style={{ position: 'absolute', top: Animated.add(animY, animS), left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} pointerEvents="none" />
      <Animated.View style={{ position: 'absolute', left: animX, top: animY, width: animS, height: animS, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }} {...pan.panHandlers}>
        {[['top',0,'left',0,0,0],['top',0,'right',0,0,0],['bottom',0,'left',0,0,0],['bottom',0,'right',0,0,0]].map((_, i) => {
          const corners = [
            { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
            { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
            { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
            { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
          ];
          return <View key={i} style={[{ position: 'absolute', width: 22, height: 22, borderColor: Colors.cyan, borderWidth: 2.5 }, corners[i]]} />;
        })}
        <View style={{ position: 'absolute', bottom: 6, right: 6 }}>
          <Ionicons name="resize-outline" size={12} color="rgba(255,255,255,0.6)" />
        </View>
      </Animated.View>
      <View style={{ position: 'absolute', top: 52, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }}>
        <TouchableOpacity onPress={onCancel} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="close" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>drag to move · drag corner to resize</Text>
        <TouchableOpacity onPress={doCrop} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="checkmark" size={24} color={Colors.cyan} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── AccountForm ─────────────────────────────────────────────────────────────

function AccountForm({ visible, userId, initial, onClose, onSaved }: {
  visible: boolean; userId: string; initial?: Account | null; onClose: () => void; onSaved: () => void;
}) {
  const [bankInput, setBankInput] = useState(initial?.bank ?? '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [holderName, setHolderName] = useState(initial?.holder_name ?? '');
  const [accountName, setAccountName] = useState(initial?.account_name ?? '');
  const [accountNumber, setAccountNumber] = useState(initial?.account_number ?? '');
  const [qrCode, setQrCode] = useState<string | null>(initial?.qr_code ?? null);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync fields when editing a different account
  useEffect(() => {
    setBankInput(initial?.bank ?? '');
    setHolderName(initial?.holder_name ?? '');
    setAccountName(initial?.account_name ?? '');
    setAccountNumber(initial?.account_number ?? '');
    setQrCode(initial?.qr_code ?? null);
    setError('');
  }, [initial]);

  const canSave = bankInput.trim() && holderName.trim() && accountName.trim() && accountNumber.trim();

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
    if (!canSave) { setError('bank, account name and account number are required.'); return; }
    setLoading(true); setError('');
    try {
      const payload = { bank: bankInput.trim(), holder_name: holderName.trim(), account_name: accountName.trim(), account_number: accountNumber.trim(), qr_code: qrCode, account_type: 'Savings', account_details: '', color: Colors.border };
      if (!canSave) { setError('all fields except QR are required.'); setLoading(false); return; }
      if (initial) { const { error: err } = await supabase.from('accounts').update(payload).eq('id', initial.id); if (err) throw err; }
      else { const { error: err } = await supabase.from('accounts').insert({ ...payload, user_id: userId }); if (err) throw err; }
      setLoading(false);
      onSaved();
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} sub={initial ? 'editing' : 'new'} title="account">
      {cropUri ? (
        <View style={StyleSheet.absoluteFill}>
          <CropView uri={cropUri} onCrop={(b64) => { setQrCode(b64); setCropUri(null); }} onCancel={() => setCropUri(null)} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {error ? <Text style={formStyles.errorText}>{error}</Text> : null}
          <View style={formStyles.block}>
            <View style={formStyles.blockRow}>
              <Text style={formStyles.blockLabel}>name</Text>
              <TextInput style={formStyles.inlineInput} placeholder="e.g. my gcash" placeholderTextColor={Colors.faint} value={accountName} onChangeText={setAccountName} autoFocus />
            </View>
            <View style={formStyles.blockDivider} />
            <View style={formStyles.blockRow}>
              <Text style={formStyles.blockLabel}>bank</Text>
              <TextInput style={formStyles.inlineInput} placeholder="e.g. gcash" placeholderTextColor={Colors.faint} value={bankInput} onChangeText={handleBankInput} />
            </View>
            <View style={formStyles.blockDivider} />
            <View style={formStyles.blockRow}>
              <Text style={formStyles.blockLabel}>acct no.</Text>
              <TextInput style={formStyles.inlineInput} placeholder="required" placeholderTextColor={Colors.faint} value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" />
            </View>
            <View style={formStyles.blockDivider} />
            <View style={formStyles.blockRow}>
              <Text style={formStyles.blockLabel}>holder</Text>
              <TextInput style={formStyles.inlineInput} placeholder="e.g. juan dela cruz" placeholderTextColor={Colors.faint} value={holderName} onChangeText={setHolderName} />
            </View>
          </View>
          {suggestions.length > 0 && (
            <View style={s.suggestionBox}>
              {suggestions.map(b => (
                <TouchableOpacity key={b} style={formStyles.listItem} onPress={() => { setBankInput(b); setSuggestions([]); }}>
                  <Text style={formStyles.listItemText}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <Text style={[formStyles.sectionLabel, { marginTop: 16 }]}>qr code <Text style={{ color: Colors.faint, textTransform: 'none' }}>(optional)</Text></Text>
          <TouchableOpacity style={s.qrUploadBtn} onPress={pickQR} activeOpacity={0.8}>
            {qrCode ? (
              <View style={{ alignItems: 'center', padding: 16 }}>
                <Image source={{ uri: qrCode }} style={s.qrPreview} resizeMode="cover" />
                <TouchableOpacity style={{ position: 'absolute', top: 8, right: 8 }} onPress={() => setQrCode(null)}>
                  <Ionicons name="close-circle" size={20} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 6 }}>
                <Ionicons name="qr-code-outline" size={28} color={Colors.faint} />
                <Text style={{ fontFamily: Fonts.mono, fontSize: 12, color: Colors.muted }}>tap to upload & crop</Text>
                <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint }}>max 300×300 · jpeg compressed</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={formStyles.actions}>
            <TouchableOpacity style={formStyles.cancelBtn} onPress={onClose}>
              <Text style={formStyles.cancelBtnText}>cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[formStyles.primaryBtn, (!canSave || loading) && { opacity: 0.4 }]} onPress={handleSubmit} disabled={!canSave || loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={formStyles.primaryBtnText}>{initial ? 'save changes' : 'add account'}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing.page, paddingBottom: 60, paddingTop: 32 },
  pageTitle: { fontFamily: Fonts.calSans, fontSize: 36, color: '#425252', marginBottom: 4 },
  pageSubtitle: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.muted, marginBottom: 24 },
  accountCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: Radius.pill,
    paddingVertical: 14, paddingHorizontal: 18,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderMid,
  },
  accountLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  accountName: { fontFamily: 'ChillaxMedium', fontSize: 15, color: Colors.text },
  accountMeta: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  qrThumb: { width: 36, height: 36, borderRadius: Radius.sm },
  qrEmpty: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.input, justifyContent: 'center', alignItems: 'center' },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyText: { fontFamily: 'ChillaxRegular', fontSize: 13, color: Colors.faint },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: Radius.pill, borderWidth: 2, borderStyle: 'dotted',
    borderColor: Colors.cyan, backgroundColor: 'transparent', alignSelf: 'flex-start',
  },
  addBtnText: { fontFamily: 'ChillaxMedium', fontSize: 13, color: Colors.muted },
  suggestionBox: { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, overflow: 'hidden' },
  qrUploadBtn: { borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, overflow: 'hidden', marginBottom: 8 },
  qrPreview: { width: 160, height: 160, borderRadius: Radius.md },
});

