import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, ActivityIndicator, Alert, Image, Dimensions, Modal, Animated, PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import type { Account } from '../../../src/types';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Fonts, Radius, Spacing } from '@/components/ui/theme';
import { BlurContext } from '../../../src/lib/BlurContext';

const { width: SW, height: SH } = Dimensions.get('window');
const DEFAULT_BANKS = ['BDO', 'BPI', 'Metrobank', 'UnionBank', 'Security Bank', 'PNB', 'Landbank', 'RCBC', 'Chinabank', 'EastWest', 'GCash', 'Maya', 'Seabank', 'GoTyme', 'Tonik'];
const MIN_CROP = 80;
const INIT_CROP = Math.min(SW, SH) * 0.7;
const ACCENT      = '#B6E1DE'; // prev: #96D7D4
const ACCENT_TEXT = '#101514';

export default function AccountsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useUser();
  const { setBlur, registerAdd, unregisterAdd } = useContext(BlurContext);
  const [addModal, setAddModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [menuModal, setMenuModal] = useState(false);
  const [selected, setSelected] = useState<Account | null>(null);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts', userId],
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select().eq('user_id', userId).order('created_at');
      return (data ?? []) as Account[];
    },
    enabled: !!userId,
  });

  const openAdd = () => { setAddModal(true); setBlur(true); };
  const openEdit = (acc: Account) => { setEditAccount(acc); setBlur(true); };
  const closeModal = () => { setAddModal(false); setEditAccount(null); setBlur(false); };

  useEffect(() => {
    registerAdd('accounts', openAdd);
    return () => unregisterAdd('accounts');
  }, []);

  const handleDelete = async () => {
    setMenuModal(false);
    await supabase.from('accounts').delete().eq('id', selected!.id);
    queryClient.invalidateQueries({ queryKey: ['accounts', userId] });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {accounts.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="card-outline" size={32} color={Colors.faint} />
            <Text style={s.emptyText}>no accounts saved yet</Text>
          </View>
        ) : (
          <View style={s.list}>
            {accounts.map(account => (
              <TouchableOpacity
                key={account.id}
                style={s.card}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/(app)/account-detail', params: { accountId: account.id, accountName: account.account_name, bankName: account.bank } } as any)}
                onLongPress={() => { setSelected(account); setMenuModal(true); }}
              >
                <View style={s.cardLeft}>
                  <Text style={s.cardName} numberOfLines={1}>{account.account_name}</Text>
                  <Text style={s.cardMeta}>{account.holder_name} · {account.bank}</Text>
                  <Text style={s.cardNumber}>•••• {account.account_number?.slice(-4) ?? ''}</Text>
                </View>
                <View style={s.cardRight}>
                  {account.qr_code
                    ? <Image source={{ uri: account.qr_code }} style={s.qrThumb} resizeMode="cover" />
                    : <View style={s.qrEmpty}><Ionicons name="qr-code-outline" size={16} color={Colors.faint} /></View>
                  }
                  <TouchableOpacity onPress={() => { setSelected(account); setMenuModal(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="ellipsis-horizontal" size={15} color={Colors.muted} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={s.footer}>managed by LEDGR</Text>
      </ScrollView>

      <AccountForm
        visible={addModal || !!editAccount}
        userId={userId}
        initial={editAccount}
        onClose={closeModal}
        onSaved={() => { closeModal(); queryClient.invalidateQueries({ queryKey: ['accounts', userId] }); }}
      />

      <ConfirmModal
        visible={menuModal}
        onClose={() => setMenuModal(false)}
        title={selected?.holder_name || selected?.account_name || 'account'}
        actions={[
          { label: 'cancel', onPress: () => setMenuModal(false), muted: true },
          { label: 'edit',   onPress: () => { setMenuModal(false); openEdit(selected!); } },
          { label: 'delete', onPress: handleDelete, destructive: true },
        ]}
      />
    </SafeAreaView>
  );
}

// ─── InlineCropModal ─────────────────────────────────────────────────────────

function InlineCropModal({ uri, onCrop, onCancel }: { uri: string; onCrop: (b64: string) => void; onCancel: () => void }) {
  const [imgDisplay, setImgDisplay] = useState({ x: 0, y: 0, w: SW, h: SH });
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 1, h: 1 });

  const boxX = useRef((SW - INIT_CROP) / 2);
  const boxY = useRef((SH - INIT_CROP) / 2);
  const boxSize = useRef(INIT_CROP);
  const animX = useRef(new Animated.Value(boxX.current)).current;
  const animY = useRef(new Animated.Value(boxY.current)).current;
  const animSize = useRef(new Animated.Value(boxSize.current)).current;
  const startMove = useRef({ x: 0, y: 0 });
  const startSize = useRef(0);

  useEffect(() => {
    Image.getSize(uri, (w, h) => {
      setImgNaturalSize({ w, h });
      const ratio = Math.min(SW / w, SH / h);
      const dw = w * ratio, dh = h * ratio;
      setImgDisplay({ x: (SW - dw) / 2, y: (SH - dh) / 2, w: dw, h: dh });
    });
  }, [uri]);

  const movePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startMove.current = { x: boxX.current, y: boxY.current }; },
    onPanResponderMove: (_, gs) => {
      animX.setValue(Math.max(0, Math.min(SW - boxSize.current, startMove.current.x + gs.dx)));
      animY.setValue(Math.max(0, Math.min(SH - boxSize.current, startMove.current.y + gs.dy)));
    },
    onPanResponderRelease: (_, gs) => {
      boxX.current = Math.max(0, Math.min(SW - boxSize.current, startMove.current.x + gs.dx));
      boxY.current = Math.max(0, Math.min(SH - boxSize.current, startMove.current.y + gs.dy));
    },
  })).current;

  const resizePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startSize.current = boxSize.current; },
    onPanResponderMove: (_, gs) => {
      const s = Math.max(MIN_CROP, Math.min(Math.min(SW - boxX.current, SH - boxY.current), startSize.current + gs.dx));
      animSize.setValue(s);
    },
    onPanResponderRelease: (_, gs) => {
      boxSize.current = Math.max(MIN_CROP, Math.min(Math.min(SW - boxX.current, SH - boxY.current), startSize.current + gs.dx));
    },
  })).current;

  const doCrop = async () => {
    const cx = boxX.current, cy = boxY.current, cs = boxSize.current;
    const relX = (cx - imgDisplay.x) / imgDisplay.w;
    const relY = (cy - imgDisplay.y) / imgDisplay.h;
    const relS = cs / imgDisplay.w;
    const originX = Math.max(0, relX * imgNaturalSize.w);
    const originY = Math.max(0, relY * imgNaturalSize.h);
    const cropW = Math.min(imgNaturalSize.w - originX, relS * imgNaturalSize.w);
    const cropH = Math.min(imgNaturalSize.h - originY, relS * imgNaturalSize.h);
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX, originY, width: cropW, height: cropH } }, { resize: { width: 300, height: 300 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    onCrop(`data:image/jpeg;base64,${result.base64}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Image source={{ uri }} style={{ position: 'absolute', top: 0, left: 0, width: SW, height: SH }} resizeMode="contain" />
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', height: animY }} pointerEvents="none" />
      <Animated.View style={{ position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)', top: animY, width: animX, height: animSize }} pointerEvents="none" />
      <Animated.View style={{ position: 'absolute', right: 0, backgroundColor: 'rgba(0,0,0,0.6)', top: animY, left: Animated.add(animX, animSize), height: animSize }} pointerEvents="none" />
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', top: Animated.add(animY, animSize) }} pointerEvents="none" />
      <Animated.View style={{ position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', left: animX, top: animY, width: animSize, height: animSize }} {...movePan.panHandlers}>
        <View style={[cs.corner, { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 }]} />
        <View style={[cs.corner, { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 }]} />
        <View style={[cs.corner, { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 }]} />
        <View style={[cs.corner, { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 }]} {...resizePan.panHandlers} />
      </Animated.View>
      <View style={{ position: 'absolute', top: 52, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }}>
        <TouchableOpacity onPress={onCancel} style={cs.headerBtn}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
        <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>drag to move · corner to resize</Text>
        <TouchableOpacity onPress={doCrop} style={cs.headerBtn}><Ionicons name="checkmark" size={24} color="#0ccfcf" /></TouchableOpacity>
      </View>
      <TouchableOpacity style={{ position: 'absolute', bottom: 48, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0ccfcf', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 32 }} onPress={doCrop}>
        <Ionicons name="checkmark-circle" size={20} color="#000" />
        <Text style={{ fontFamily: Fonts.monoBold, fontSize: 14, color: '#000' }}>save crop</Text>
      </TouchableOpacity>
    </View>
  );
}

const cs = StyleSheet.create({
  corner:    { position: 'absolute', width: 22, height: 22, borderColor: '#0ccfcf', borderWidth: 2.5 },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
});

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const [cropUri, setCropUri] = useState<string | null>(null);

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
      if (initial) { const { error: err } = await supabase.from('accounts').update(payload).eq('id', initial.id); if (err) throw err; }
      else { const { error: err } = await supabase.from('accounts').insert({ ...payload, user_id: userId }); if (err) throw err; }
      setLoading(false);
      onSaved();
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  return (
    <>
      <Modal visible={!!cropUri} transparent={false} animationType="slide" onRequestClose={() => setCropUri(null)}>
        {cropUri && <InlineCropModal uri={cropUri} onCrop={(b64) => { setQrCode(b64); setCropUri(null); }} onCancel={() => setCropUri(null)} />}
      </Modal>
      <BottomSheet visible={visible} onClose={onClose} title={initial ? 'edit account' : 'new account'} height="60%">
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {error ? <Text style={f.error}>{error}</Text> : null}

          <Text style={f.label}>name</Text>
          <TextInput style={f.input} placeholder="e.g. my gcash" placeholderTextColor={Colors.faint} value={accountName} onChangeText={v => { setAccountName(v); setError(''); }} autoFocus />

          <Text style={f.label}>bank</Text>
          <TextInput style={f.input} placeholder="e.g. gcash" placeholderTextColor={Colors.faint} value={bankInput} onChangeText={handleBankInput} />
          {suggestions.length > 0 && (
            <View style={f.suggestionBox}>
              {suggestions.map(b => (
                <TouchableOpacity key={b} style={f.suggestion} onPress={() => { setBankInput(b); setSuggestions([]); }}>
                  <Text style={f.suggestionText}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={f.label}>account number</Text>
          <TextInput style={f.input} placeholder="required" placeholderTextColor={Colors.faint} value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" />

          <Text style={f.label}>account holder</Text>
          <TextInput style={f.input} placeholder="e.g. juan dela cruz" placeholderTextColor={Colors.faint} value={holderName} onChangeText={setHolderName} />

          <Text style={f.label}>qr code <Text style={{ fontFamily: Fonts.mono, color: Colors.muted, textTransform: 'none' }}>(optional)</Text></Text>
          <TouchableOpacity style={f.qrBtn} onPress={pickQR} activeOpacity={0.8}>
            {qrCode ? (
              <View style={{ alignItems: 'center', padding: 16 }}>
                <Image source={{ uri: qrCode }} style={f.qrPreview} resizeMode="cover" />
                <TouchableOpacity style={{ position: 'absolute', top: 8, right: 8 }} onPress={() => setQrCode(null)}>
                  <Ionicons name="close-circle" size={20} color={Colors.expense} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 6 }}>
                <Ionicons name="qr-code-outline" size={26} color={Colors.faint} />
                <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted }}>tap to upload & crop</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[f.saveBtn, (!canSave || loading) && { opacity: 0.4 }]} onPress={handleSubmit} disabled={!canSave || loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={f.saveBtnText}>{initial ? 'save changes' : 'add account'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const s = StyleSheet.create({
  scroll:     { paddingTop: 20, paddingBottom: 60 },
  list:       { marginBottom: 16 },
  card:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: Spacing.page, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cardLeft:   { flex: 1, gap: 3 },
  cardName:   { fontFamily: 'ChillaxMedium', fontSize: 14, color: Colors.text },
  cardMeta:   { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted },
  cardNumber: { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.text, letterSpacing: 1 },
  cardRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qrThumb:    { width: 36, height: 36, borderRadius: Radius.sm },
  qrEmpty:    { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.input, justifyContent: 'center', alignItems: 'center' },
  emptyBox:   { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: Spacing.page },
  emptyText:  { fontFamily: Fonts.mono, fontSize: 13, color: Colors.muted },
  footer:     { fontFamily: Fonts.mono, fontSize: 10, color: Colors.faint, textAlign: 'center', marginTop: 24, paddingHorizontal: Spacing.page },
});

const f = StyleSheet.create({
  error:         { fontFamily: Fonts.mono, fontSize: 12, color: Colors.expense, marginBottom: 8 },
  label:         { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, marginBottom: 6, marginTop: 14, letterSpacing: 0.4, textTransform: 'uppercase' },
  input:         { fontFamily: Fonts.monoBold, fontSize: 15, color: Colors.text, backgroundColor: Colors.white, borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: Colors.borderMid },
  suggestionBox: { backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginTop: 4, overflow: 'hidden' },
  suggestion:    { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestionText:{ fontFamily: Fonts.mono, fontSize: 13, color: Colors.text },
  qrBtn:         { borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, overflow: 'hidden', marginBottom: 4 },
  qrPreview:     { width: 160, height: 160, borderRadius: Radius.md },
  saveBtn:       { backgroundColor: ACCENT, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  saveBtnText:   { fontFamily: Fonts.monoBold, fontSize: 14, color: ACCENT_TEXT },
});
