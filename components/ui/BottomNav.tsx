import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform, TextInput, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppFont } from '../../src/lib/fonts';
import { useNav } from '../../src/lib/NavContext';
import { useUser } from '../../src/hooks/useUser';
import { supabase } from '../../src/lib/supabase';
import NavIcon from './NavIcons';
import { useState } from 'react';
import {
  NAV_ICON_MYNAUI__CHAT_PLUS_SOLID,
  NAV_ICON_BXS__CATEGORY_ALT,
  NAV_ICON_SOLAR__WALLET_BOLD,
  NAV_ICON_MINGCUTE__FOLDERS_FILL,
  NAV_ICON_DUO_ICONS__DASHBOARD,
} from '../../src/lib/navIconSvgs';

const TABS = [
  { key: 'home',       label: 'Dashboard',  svgUri: NAV_ICON_DUO_ICONS__DASHBOARD },
  { key: 'spaces',     label: 'Folders',    svgUri: NAV_ICON_MINGCUTE__FOLDERS_FILL },
  { key: 'record',     label: 'Record',     svgUri: null },
  { key: 'accounts',   label: 'Accounts',   svgUri: NAV_ICON_SOLAR__WALLET_BOLD },
  { key: 'categories', label: 'Categories', svgUri: NAV_ICON_BXS__CATEGORY_ALT },
];

const NAV_BG       = '#fffffd';
const NAV_ACTIVE   = '#6085d3';
const NAV_INACTIVE = 'rgba(0,0,0,0.35)';
const ADD_SIZE     = 56;

export default function BottomNav() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeTab, handleNavPress, openSplitBill } = useNav();
  const { userId } = useUser();
  const [showChoice, setShowChoice] = useState(false);
  const [showSplitBillName, setShowSplitBillName] = useState(false);
  const [splitBillName, setSplitBillName] = useState('');
  const [creatingSplitBill, setCreatingSplitBill] = useState(false);

  const handlePress = (key: string) => {
    if (key === 'record') { setShowChoice(true); return; }
    if (router.canDismiss()) { handleNavPress(key); router.dismissAll(); }
    else handleNavPress(key);
  };

  const goRecord = () => {
    setShowChoice(false);
    if (router.canDismiss()) { handleNavPress('record'); router.dismissAll(); }
    else handleNavPress('record');
  };

  const goCapture = () => {
    setShowChoice(false);
    router.push('/(app)/capture-receipt' as any);
  };

  const goSplitBill = () => {
    setShowChoice(false);
    setSplitBillName('');
    setShowSplitBillName(true);
  };

  const createSplitBill = async () => {
    if (!splitBillName.trim()) return;
    setCreatingSplitBill(true);
    const { data, error } = await supabase.from('split_bills')
      .insert({ user_id: userId, name: splitBillName.trim() })
      .select('id').single();
    setCreatingSplitBill(false);
    if (!error && data) {
      setShowSplitBillName(false);
      setSplitBillName('');
      openSplitBill(data.id, splitBillName.trim());
    }
  };

  return (
    <View style={s.wrap}>
      <View style={[s.pill, { paddingBottom: insets.bottom || 10 }]}>
        {TABS.map(tab => {
          if (tab.key === 'record') return <View key={tab.key} style={s.spacer} />;
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={s.item} onPress={() => handlePress(tab.key)} activeOpacity={0.7}>
              <View style={s.iconWrap}>
                {tab.svgUri ? (
                  Platform.OS === 'web' ? (
                    <img src={tab.svgUri} style={{ width: 22, height: 22, opacity: isActive ? 1 : 0.35, filter: isActive ? 'invert(44%) sepia(60%) saturate(400%) hue-rotate(190deg) brightness(90%)' : 'none' }} />
                  ) : (
                    <WebView
                      originWhitelist={['*']}
                      source={{ html: `<!DOCTYPE html><html><body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;width:100%;height:100%"><img src="${tab.svgUri}" style="width:22px;height:22px;opacity:${isActive ? 1 : 0.35};filter:${isActive ? 'invert(44%) sepia(60%) saturate(400%) hue-rotate(190deg) brightness(90%)' : 'none'}" /></body></html>` }}
                      style={{ width: 22, height: 22, backgroundColor: 'transparent' }}
                      pointerEvents="none"
                      setSupportMultipleWindows={false}
                      scrollEnabled={false}
                    />
                  )
                ) : (
                  <NavIcon name="add" size={22} color={isActive ? NAV_ACTIVE : NAV_INACTIVE} />
                )}
              </View>
              <Text style={[s.label, isActive && s.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Floating add button */}
        <TouchableOpacity style={s.addBtn} onPress={() => handlePress('record')} activeOpacity={0.8}>
          {Platform.OS === 'web' ? (
            <img src={NAV_ICON_MYNAUI__CHAT_PLUS_SOLID} style={{ width: 52, height: 52 }} />
          ) : (
            <WebView
              originWhitelist={['*']}
              source={{ html: `<!DOCTYPE html><html><body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;width:100%;height:100%"><img src="${NAV_ICON_MYNAUI__CHAT_PLUS_SOLID}" style="width:52px;height:52px" /></body></html>` }}
              style={{ width: 52, height: 52, backgroundColor: 'transparent' }}
              pointerEvents="none"
              setSupportMultipleWindows={false}
              scrollEnabled={false}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Choice modal */}
      <Modal visible={showChoice} transparent animationType="slide" onRequestClose={() => setShowChoice(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowChoice(false)}>
          <View style={s.sheet}>
            <TouchableOpacity style={s.choiceBtn} onPress={goRecord} activeOpacity={0.8}>
              <NavIcon name="create-outline" size={22} color="#000" />
              <View>
                <Text style={s.choiceTitle}>Add Record</Text>
                <Text style={s.choiceSub}>quick-add a transaction</Text>
              </View>
            </TouchableOpacity>
            <View style={s.choiceDivider} />
            <TouchableOpacity style={s.choiceBtn} onPress={goSplitBill} activeOpacity={0.8}>
              <NavIcon name="people-outline" size={22} color="#000" />
              <View>
                <Text style={s.choiceTitle}>Add Split Bill</Text>
                <Text style={s.choiceSub}>split expenses with friends</Text>
              </View>
            </TouchableOpacity>
            <View style={s.choiceDivider} />
            <TouchableOpacity style={s.choiceBtn} onPress={goCapture} activeOpacity={0.8}>
              <NavIcon name="camera-outline" size={22} color="#000" />
              <View>
                <Text style={s.choiceTitle}>Capture Receipt</Text>
                <Text style={s.choiceSub}>photo one or more receipts</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Split bill name modal */}
      <Modal visible={showSplitBillName} transparent animationType="slide" onRequestClose={() => setShowSplitBillName(false)}>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowSplitBillName(false)} />
          <View style={s.sheet}>
            <Text style={s.choiceTitle}>New Split Bill</Text>
            <Text style={[s.choiceSub, { marginBottom: 16, marginTop: 4 }]}>give it a name to get started</Text>
            <TextInput
              style={s.splitBillInput}
              placeholder="e.g. dinner with friends"
              placeholderTextColor="#aaa"
              value={splitBillName}
              onChangeText={setSplitBillName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={createSplitBill}
            />
            <TouchableOpacity
              style={[s.splitBillBtn, (!splitBillName.trim() || creatingSplitBill) && { opacity: 0.4 }]}
              onPress={createSplitBill}
              disabled={!splitBillName.trim() || creatingSplitBill}
              activeOpacity={0.8}
            >
              {creatingSplitBill
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.splitBillBtnText}>Create & Open</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 999 },
  pill: {
    flexDirection: 'row',
    backgroundColor: NAV_BG,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
  item:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4 },
  spacer:  { flex: 1 },
  iconWrap:{ position: 'relative', alignItems: 'center', justifyContent: 'center' },
  label:      { fontFamily: AppFont.regular,  fontSize: 10, color: NAV_INACTIVE, letterSpacing: 0.3 },
  labelActive:{ fontFamily: AppFont.semiBold, fontSize: 10, color: '#6085d3' },
  badge: {
    position: 'absolute', top: -3, right: -6,
    minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: '#ed6a6a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { fontFamily: AppFont.semiBold, fontSize: 8, color: '#fff', lineHeight: 13 },
  addBtn: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    marginLeft: -(ADD_SIZE / 2),
    width: ADD_SIZE,
    height: ADD_SIZE,
    borderRadius: ADD_SIZE / 2,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  overlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 48,
  },
  choiceBtn:     { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  choiceDivider: { height: 1, backgroundColor: '#f0f0f0' },
  choiceTitle:   { fontFamily: AppFont.semiBold, fontSize: 15, color: '#111' },
  choiceSub:     { fontFamily: AppFont.regular,  fontSize: 12, color: '#999', marginTop: 2 },
  splitBillInput: { fontFamily: AppFont.regular, fontSize: 15, color: '#111', backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 16 },
  splitBillBtn:     { backgroundColor: '#4394ff', borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  splitBillBtnText: { fontFamily: AppFont.semiBold, fontSize: 14, color: '#fff' },
});
