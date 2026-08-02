import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, ActivityIndicator, Alert, Image, Dimensions, Modal, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { useEffect, useRef, useState, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../src/hooks/useUser';
import type { Account } from '../../../src/types';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { Colors, Radius } from '@/components/ui/theme';
import { BlurContext } from '../../../src/lib/BlurContext';
import { DC } from '../../../src/lib/design';
import { AppFont } from '../../../src/lib/fonts';

import { SvgXml } from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');
const DEFAULT_BANKS = ['BDO', 'BPI', 'Metrobank', 'UnionBank', 'Security Bank', 'PNB', 'Landbank', 'RCBC', 'Chinabank', 'EastWest', 'GCash', 'Maya', 'Seabank', 'GoTyme', 'Tonik'];
const COLOR_PALETTE = ['#373737','#8c52ff','#e53935','#43a047','#1e88e5','#fb8c00','#00acc1','#d81b60','#6d4c41','#546e7a'];
const MIN_CROP = 80;
const INIT_CROP = Math.min(SW, SH) * 0.7;

const SVG_ADD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10s10-4.477 10-10S17.523 2 12 2m5 11h-4v4h-2v-4H7v-2h4V7h2v4h4z" /></svg>`;

const WALLET_TYPE_LABELS: Record<string, string> = {
  bank: 'Bank',
  credit_card: 'Credit Card',
  cash: 'Cash',
  e_wallet: 'E-Wallet',
};
const WALLET_TYPE_ORDER = ['bank', 'credit_card', 'cash', 'e_wallet'];


export default function AccountsScreen({ isActive }: { isActive?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId } = useUser();
  const { setBlur, registerAdd, unregisterAdd } = useContext(BlurContext);
  const [addModal, setAddModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [selected, setSelected] = useState<Account | null>(null);
  const [menuModal, setMenuModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['accounts', userId] });
    setRefreshing(false);
  };

  const grouped = WALLET_TYPE_ORDER.map(type => ({
    type,
    label: WALLET_TYPE_LABELS[type],
    items: accounts.filter(a => (a.wallet_type ?? 'bank') === type),
  })).filter(g => g.items.length > 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* ── Frozen header ── */}
      <View style={s.frozen}>
        <View style={s.header}>
          <Text style={s.title}>Accounts</Text>
          <TouchableOpacity onPress={openAdd} activeOpacity={0.7}>
            <SvgXml xml={SVG_ADD} width={26} height={26} color="#373737" />
          </TouchableOpacity>
        </View>
        <View style={s.divider} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        {accounts.length === 0 ? (
          <View style={s.emptyBox}><Text style={s.emptyText}>no accounts saved yet</Text></View>
        ) : (
          grouped.map(group => (
            <View key={group.type}>
              <Text style={s.sectionHeader}>{group.label}</Text>
              {group.items.map(account => (
                <TouchableOpacity
                  key={account.id}
                  style={s.card}
                  activeOpacity={0.7}
                  onPress={() => { setSelected(account); setMenuModal(true); }}
                >
                  <View style={s.cardLeft}>
                    <Text style={[s.cardBank, { color: account.color || '#373737' }]}>{account.bank}</Text>
                    <Text style={s.cardHolder}>{account.account_name}</Text>
                    <Text style={s.cardHolder}>{account.holder_name}</Text>
                    {account.account_number ? <Text style={s.cardNumber}>{account.account_number}</Text> : null}
                  </View>
                  {account.qr_code ? (
                    <Image source={{ uri: account.qr_code }} style={s.qrThumb} resizeMode="cover" />
                  ) : null}
                  {copiedId === account.id && (
                    <View style={s.toast}><Text style={s.toastText}>copied</Text></View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
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
        title={selected?.bank || selected?.account_name || 'account'}
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
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 1, h: 1 });
  const [box, setBox] = useState({ x: 0, y: 0, size: INIT_CROP });
  const imgDisplay = useRef({ x: 0, y: 0, w: SW, h: SH });
  const drag = useRef<{ type: 'move' | 'tl' | 'tr' | 'bl' | 'br'; startX: number; startY: number; origBox: typeof box } | null>(null);

  useEffect(() => {
    Image.getSize(uri, (w, h) => {
      setImgNaturalSize({ w, h });
      const ratio = Math.min(SW / w, SH / h);
      const dw = w * ratio, dh = h * ratio;
      const dx = (SW - dw) / 2, dy = (SH - dh) / 2;
      imgDisplay.current = { x: dx, y: dy, w: dw, h: dh };
      const initSize = Math.min(dw, dh) * 0.7;
      setBox({ x: dx + (dw - initSize) / 2, y: dy + (dh - initSize) / 2, size: initSize });
    });
  }, [uri]);

  const clampBox = (x: number, y: number, size: number) => {
    const { x: ix, y: iy, w: iw, h: ih } = imgDisplay.current;
    const s = Math.max(MIN_CROP, Math.min(size, iw, ih));
    return {
      x: Math.max(ix, Math.min(ix + iw - s, x)),
      y: Math.max(iy, Math.min(iy + ih - s, y)),
      size: s,
    };
  };

  const getClientXY = (e: any) => {
    if (e.touches && e.touches[0]) return { cx: e.touches[0].clientX, cy: e.touches[0].clientY };
    return { cx: e.clientX, cy: e.clientY };
  };

  const onMoveStart = (e: any) => {
    e.preventDefault();
    const { cx, cy } = getClientXY(e);
    drag.current = { type: 'move', startX: cx, startY: cy, origBox: box };
  };

  const onResizeStart = (corner: 'tl' | 'tr' | 'bl' | 'br') => (e: any) => {
    e.preventDefault();
    e.stopPropagation();
    const { cx, cy } = getClientXY(e);
    drag.current = { type: corner, startX: cx, startY: cy, origBox: box };
  };

  useEffect(() => {
    const onMove = (e: any) => {
      if (!drag.current) return;
      const { cx, cy } = getClientXY(e);
      const dx = cx - drag.current.startX;
      const dy = cy - drag.current.startY;
      const { origBox } = drag.current;
      if (drag.current.type === 'move') {
        setBox(clampBox(origBox.x + dx, origBox.y + dy, origBox.size));
      } else {
        const t = drag.current.type;
        // anchor is the opposite corner — size grows toward drag direction
        const newSize = Math.max(MIN_CROP, origBox.size + (t === 'tl' ? -Math.min(dx, dy) : t === 'tr' ? Math.max(-dy, dx) : t === 'bl' ? Math.max(dy, -dx) : Math.max(dx, dy)));
        const nx = (t === 'tl' || t === 'bl') ? origBox.x + origBox.size - newSize : origBox.x;
        const ny = (t === 'tl' || t === 'tr') ? origBox.y + origBox.size - newSize : origBox.y;
        setBox(clampBox(nx, ny, newSize));
      }
    };
    const onUp = () => { drag.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [box]);

  const doCrop = async () => {
    const { x: ix, y: iy, w: iw, h: ih } = imgDisplay.current;
    const originX = Math.max(0, (box.x - ix) / iw * imgNaturalSize.w);
    const originY = Math.max(0, (box.y - iy) / ih * imgNaturalSize.h);
    const cropW = Math.min(imgNaturalSize.w - originX, box.size / iw * imgNaturalSize.w);
    const cropH = Math.min(imgNaturalSize.h - originY, box.size / ih * imgNaturalSize.h);
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX, originY, width: cropW, height: cropH } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    onCrop(`data:image/jpeg;base64,${result.base64}`);
  };

  const CORNER = 20;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Image source={{ uri }} style={{ position: 'absolute', top: 0, left: 0, width: SW, height: SH }} resizeMode="contain" />

      {/* dark overlays */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: box.y, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{ position: 'absolute', top: box.y, left: 0, width: box.x, height: box.size, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{ position: 'absolute', top: box.y, left: box.x + box.size, right: 0, height: box.size, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{ position: 'absolute', top: box.y + box.size, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />

      {/* crop box — move handle */}
      <div
        onMouseDown={onMoveStart}
        onTouchStart={onMoveStart}
        style={{ position: 'absolute', left: box.x, top: box.y, width: box.size, height: box.size, border: '1px solid rgba(255,255,255,0.4)', cursor: 'move', boxSizing: 'border-box' }}
      >
        <div onMouseDown={onResizeStart('tl')} onTouchStart={onResizeStart('tl')} style={{ position: 'absolute', top: 0, left: 0, width: CORNER, height: CORNER, borderTop: '2.5px solid #0ccfcf', borderLeft: '2.5px solid #0ccfcf', cursor: 'nwse-resize' }} />
        <div onMouseDown={onResizeStart('tr')} onTouchStart={onResizeStart('tr')} style={{ position: 'absolute', top: 0, right: 0, width: CORNER, height: CORNER, borderTop: '2.5px solid #0ccfcf', borderRight: '2.5px solid #0ccfcf', cursor: 'nesw-resize' }} />
        <div onMouseDown={onResizeStart('bl')} onTouchStart={onResizeStart('bl')} style={{ position: 'absolute', bottom: 0, left: 0, width: CORNER, height: CORNER, borderBottom: '2.5px solid #0ccfcf', borderLeft: '2.5px solid #0ccfcf', cursor: 'nesw-resize' }} />
        <div onMouseDown={onResizeStart('br')} onTouchStart={onResizeStart('br')} style={{ position: 'absolute', bottom: 0, right: 0, width: CORNER, height: CORNER, borderBottom: '2.5px solid #0ccfcf', borderRight: '2.5px solid #0ccfcf', cursor: 'nwse-resize' }} />
      </div>

      {/* header */}
      <View style={{ position: 'absolute', top: 52, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }}>
        <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>drag to move · corner to resize</Text>
      </View>
      <TouchableOpacity style={{ position: 'absolute', bottom: 48, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0ccfcf', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 32 }} onPress={doCrop}>
        <Text style={{ fontFamily: AppFont.semiBold, fontSize: 14, color: '#000' }}>save crop</Text>
      </TouchableOpacity>
    </View>
  );
}

const cs = StyleSheet.create({
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
});

// ─── AccountForm ─────────────────────────────────────────────────────────────

function AccountForm({ visible, userId, initial, onClose, onSaved }: {
  visible: boolean; userId: string; initial?: Account | null; onClose: () => void; onSaved: () => void;
}) {
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [onCropDone, setOnCropDone] = useState<((b64: string) => void) | null>(null);
  const [bankInput, setBankInput] = useState(initial?.bank ?? '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [holderName, setHolderName] = useState(initial?.holder_name ?? '');
  const [accountName, setAccountName] = useState(initial?.account_name ?? '');
  const [accountNumber, setAccountNumber] = useState(initial?.account_number ?? '');
  const [qrCode, setQrCode] = useState<string | null>(initial?.qr_code ?? null);
  const [color, setColor] = useState(initial?.color ?? '#373737');
  const [walletType, setWalletType] = useState<'bank'|'credit_card'|'cash'|'e_wallet'>(initial?.wallet_type ?? 'bank');
  const [isNewBank, setIsNewBank] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customHex, setCustomHex] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load saved banks for autocomplete
  const { data: savedBanks = [] } = useQuery({
    queryKey: ['banks', userId],
    queryFn: async () => {
      const { data } = await supabase.from('banks').select('name, color').eq('user_id', userId).order('name');
      return (data ?? []) as { name: string; color: string }[];
    },
    enabled: !!userId && visible,
  });

  useEffect(() => {
    setBankInput(initial?.bank ?? '');
    setHolderName(initial?.holder_name ?? '');
    setAccountName(initial?.account_name ?? '');
    setAccountNumber(initial?.account_number ?? '');
    setQrCode(initial?.qr_code ?? null);
    setColor(initial?.color ?? '#373737');
    setWalletType(initial?.wallet_type ?? 'bank');
    setIsNewBank(false);
    setError('');
  }, [initial, visible]);

  const allBankNames = [...new Set([...DEFAULT_BANKS, ...savedBanks.map(b => b.name)])];

  const handleBankInput = (val: string) => {
    setBankInput(val);
    if (!val.trim()) { setSuggestions([]); setIsNewBank(false); return; }
    const matches = allBankNames.filter(b => b.toLowerCase().includes(val.toLowerCase()));
    setSuggestions(matches);
    const exactMatch = savedBanks.find(b => b.name.toLowerCase() === val.toLowerCase());
    if (exactMatch) {
      setColor(exactMatch.color);
      setIsNewBank(false);
    } else {
      setIsNewBank(true);
    }
  };

  const selectBank = (name: string) => {
    setBankInput(name);
    setSuggestions([]);
    const saved = savedBanks.find(b => b.name.toLowerCase() === name.toLowerCase());
    if (saved) { setColor(saved.color); setIsNewBank(false); }
    else setIsNewBank(true);
  };

  const canSave = bankInput.trim() && holderName.trim() && accountName.trim();

  const pickQR = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) { setCropUri(result.assets[0].uri); setOnCropDone(() => (b64: string) => setQrCode(b64)); }
  };

  const handleSubmit = async () => {
    if (!canSave) { setError('bank, account name and holder are required.'); return; }
    setLoading(true); setError('');
    try {
      // Save bank if new
      if (isNewBank && bankInput.trim()) {
        const exists = savedBanks.find(b => b.name.toLowerCase() === bankInput.trim().toLowerCase());
        if (!exists) await supabase.from('banks').insert({ user_id: userId, name: bankInput.trim(), color });
      }
      const payload = { bank: bankInput.trim(), holder_name: holderName.trim(), account_name: accountName.trim(), account_number: accountNumber.trim(), qr_code: qrCode, account_type: 'Savings', account_details: '', color, wallet_type: walletType };
      if (initial) { const { error: err } = await supabase.from('accounts').update(payload).eq('id', initial.id); if (err) throw err; }
      else { const { error: err } = await supabase.from('accounts').insert({ ...payload, user_id: userId }); if (err) throw err; }
      setLoading(false);
      onSaved();
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  if (cropUri) return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={() => setCropUri(null)}>
      <InlineCropModal
        uri={cropUri}
        onCrop={(b64) => { onCropDone?.(b64); setCropUri(null); setOnCropDone(null); }}
        onCancel={() => { setCropUri(null); setOnCropDone(null); }}
      />
    </Modal>
  );

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose} title={initial ? 'edit wallet' : 'new wallet'} height="70%">
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {error ? <Text style={f.error}>{error}</Text> : null}

          <Text style={f.label}>wallet type</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
            {(['bank','credit_card','cash','e_wallet'] as const).map(t => (
              <TouchableOpacity key={t} style={[f.typeBtn, walletType === t && f.typeBtnActive]} onPress={() => setWalletType(t)} activeOpacity={0.75}>
                <Text style={[f.typeBtnText, walletType === t && f.typeBtnTextActive]}>{t === 'credit_card' ? 'CC' : t === 'e_wallet' ? 'E-Wallet' : t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={f.label}>bank / institution</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput style={[f.input, { flex: 1 }]} placeholder="e.g. GCash" placeholderTextColor={Colors.faint} value={bankInput} onChangeText={handleBankInput} autoFocus />
            <TouchableOpacity
              onPress={() => { setCustomHex(color); setShowColorPicker(true); }}
              activeOpacity={0.8}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: color, borderWidth: 1, borderColor: '#d2d2d2' }}
            />
          </View>
          {suggestions.length > 0 && (
            <View style={f.suggestionBox}>
              {suggestions.map(b => (
                <TouchableOpacity key={b} style={f.suggestion} onPress={() => selectBank(b)}>
                  <Text style={f.suggestionText}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {isNewBank && bankInput.trim() ? (
            <>
              <Text style={f.label}>color for "{bankInput.trim()}"</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
                {COLOR_PALETTE.map(c => (
                  <TouchableOpacity key={c} onPress={() => setColor(c)} activeOpacity={0.8}
                    style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: color === c ? 3 : 1, borderColor: color === c ? '#fff' : 'transparent', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 }}
                  />
                ))}
                <TouchableOpacity
                  onPress={() => { setCustomHex(color); setShowColorPicker(true); }}
                  activeOpacity={0.8}
                  style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#d2d2d2', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 16, color: '#d2d2d2' }}>+</Text>
                </TouchableOpacity>
              </View>
              {color && !COLOR_PALETTE.includes(color) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: color }} />
                  <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: DC.pageTextMuted }}>{color}</Text>
                </View>
              )}
            </>
          ) : null}

          <Text style={f.label}>account name</Text>
          <TextInput style={f.input} placeholder="e.g. My GCash" placeholderTextColor={Colors.faint} value={accountName} onChangeText={v => { setAccountName(v); setError(''); }} />

          <Text style={f.label}>account number <Text style={{ fontFamily: AppFont.regular, color: Colors.muted, textTransform: 'none' }}>(optional)</Text></Text>
          <TextInput style={f.input} placeholder="e.g. 09190000000" placeholderTextColor={Colors.faint} value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" />

          <Text style={f.label}>account holder</Text>
          <TextInput style={f.input} placeholder="e.g. Juan Dela Cruz" placeholderTextColor={Colors.faint} value={holderName} onChangeText={setHolderName} />

          <Text style={f.label}>qr code <Text style={{ fontFamily: AppFont.regular, color: Colors.muted, textTransform: 'none' }}>(optional)</Text></Text>
          <TouchableOpacity style={f.qrBtn} onPress={pickQR} activeOpacity={0.8}>
            {qrCode ? (
              <View style={{ alignItems: 'center', padding: 16 }}>
                <Image source={{ uri: qrCode }} style={f.qrPreview} resizeMode="cover" />
              </View>
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20 }}>
                <Text style={{ fontFamily: AppFont.regular, fontSize: 11, color: Colors.muted }}>tap to upload & crop</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[f.saveBtn, (!canSave || loading) && { opacity: 0.4 }]} onPress={handleSubmit} disabled={!canSave || loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={f.saveBtnText}>{initial ? 'save changes' : 'add wallet'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>

      {/* Color picker modal */}
      <Modal visible={showColorPicker} transparent animationType="fade" onRequestClose={() => setShowColorPicker(false)} statusBarTranslucent>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 } as any} activeOpacity={1} onPress={() => setShowColorPicker(false)}>
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: 300 }}>
            <Text style={{ fontFamily: AppFont.semiBold, fontSize: 14, color: '#373737', marginBottom: 16 }}>Custom Color</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: /^#[0-9a-fA-F]{6}$/.test(customHex) ? customHex : '#d2d2d2', borderWidth: 1, borderColor: '#d2d2d2' }} />
              <TextInput
                style={[f.input, { flex: 1 }]}
                placeholder="#ff5733"
                placeholderTextColor={Colors.faint}
                value={customHex}
                onChangeText={setCustomHex}
                autoCapitalize="none"
                autoFocus
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: '#d2d2d2', alignItems: 'center' }} onPress={() => setShowColorPicker(false)} activeOpacity={0.8}>
                <Text style={{ fontFamily: AppFont.regular, fontSize: 13, color: '#666' }}>cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 999, backgroundColor: '#373737', alignItems: 'center', opacity: /^#[0-9a-fA-F]{6}$/.test(customHex) ? 1 : 0.4 }}
                onPress={() => { if (/^#[0-9a-fA-F]{6}$/.test(customHex)) { setColor(customHex); setShowColorPicker(false); } }}
                activeOpacity={0.8}
              >
                <Text style={{ fontFamily: AppFont.semiBold, fontSize: 13, color: '#fff' }}>apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  frozen: { backgroundColor: '#fff' },
  divider: { height: 1, backgroundColor: '#d2d2d2' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingTop: 28, paddingBottom: 16 },
  title:        { ...DC.typography.pageTitle },
  scroll:       { paddingHorizontal: DC.pagePadding, paddingTop: 20, paddingBottom: 80 },
  sectionHeader:{ ...DC.typography.sectionHeader, marginTop: 20, marginBottom: 10 },
  card:         { ...DC.dottedCard, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cardLeft:     { flex: 1 },
  cardBank:     { ...DC.typography.sectionHeader, fontFamily: 'Poppins-Bold' as string },
  cardHolder:   { ...DC.typography.sectionBody, marginTop: 2, fontStyle: 'italic', lineHeight: undefined },
  cardNumber:   { ...DC.typography.sectionBody, marginTop: 1, lineHeight: undefined },
  qrThumb:      { width: 52, height: 52, borderRadius: 6 },
  emptyBox:     { alignItems: 'center', paddingVertical: 64 },
  emptyText:    { ...DC.typography.muted },
  toast:        { position: 'absolute', bottom: -24, left: 0, right: 0, alignItems: 'center' },
  toastText:    { ...DC.typography.subContent, color: '#fff', backgroundColor: '#373737', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
});

const f = StyleSheet.create({
  error:         { fontFamily: AppFont.regular, fontSize: 12, color: Colors.expense, marginBottom: 8 },
  label:         { fontFamily: AppFont.semiBold, fontSize: 11, color: DC.pageTextMuted, marginBottom: 6, marginTop: 14, letterSpacing: 0.4, textTransform: 'uppercase' },
  input:         { fontFamily: AppFont.regular, fontSize: 15, color: DC.pageText, backgroundColor: DC.inputBg, borderRadius: DC.inputRadius, paddingHorizontal: DC.inputPaddingH, paddingVertical: DC.inputPaddingV, borderWidth: DC.inputBorderWidth, borderColor: DC.inputBorder },
  typeBtn:       { flex: 1, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: DC.cardBorder, alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#373737', borderColor: '#373737' },
  typeBtnText:   { fontFamily: AppFont.regular, fontSize: 11, color: DC.pageTextMuted },
  typeBtnTextActive: { fontFamily: AppFont.semiBold, fontSize: 11, color: '#fff' },
  suggestionBox: { backgroundColor: DC.pageBg, borderRadius: DC.cardRadius / 2, borderWidth: DC.cardBorderWidth, borderColor: DC.cardBorder, marginTop: 4, overflow: 'hidden' },
  suggestion:    { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: DC.cardBorder },
  suggestionText:{ fontFamily: AppFont.regular, fontSize: 13, color: DC.pageText },
  qrBtn:         { borderRadius: DC.cardRadius / 2, borderWidth: DC.cardBorderWidth, borderColor: DC.cardBorder, backgroundColor: DC.cardBg, overflow: 'hidden', marginBottom: 4 },
  qrPreview:     { width: 160, height: 160, borderRadius: 8 },
  saveBtn:       { backgroundColor: DC.pageText, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 20, marginBottom: 8 },
  saveBtnText:   { fontFamily: AppFont.semiBold, fontSize: 14, color: DC.pageBg },
});
