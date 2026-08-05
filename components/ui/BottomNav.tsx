import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppFont } from '@/src/lib/fonts';
import { useNav } from '@/src/lib/NavContext';
import NavIcon from './NavIcons';
import { useState } from 'react';

const TABS = [
  { key: 'home',       label: 'Dashboard', icon: 'home-outline' },
  { key: 'spaces',     label: 'Folders',   icon: 'folder-outline' },
  { key: 'record',     label: 'Record',    icon: 'add' },
  { key: 'accounts',   label: 'Accounts',  icon: 'wallet-outline' },
  { key: 'categories', label: 'Categories', icon: 'pricetag-outline' },
];

const NAV_BG       = '#fffffd';
const NAV_ACTIVE   = '#000000';
const NAV_INACTIVE = 'rgba(0,0,0,0.35)';

const ADD_SIZE = 56;

export default function BottomNav() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeTab, handleNavPress } = useNav();

  const [showChoice, setShowChoice] = useState(false);

  const handlePress = (key: string) => {
    if (key === 'record') { setShowChoice(true); return; }
    if (router.canDismiss()) {
      handleNavPress(key);
      router.dismissAll();
    } else {
      handleNavPress(key);
    }
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

  return (
    <View style={s.wrap}>
      <View style={[s.pill, { paddingBottom: insets.bottom || 10 }]}>

        {TABS.map(tab => {
          if (tab.key === 'record') return <View key={tab.key} style={s.spacer} />;

          const isActive = activeTab === tab.key;
          const iconName = tab.icon;
          const badge = 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.item}
              onPress={() => handlePress(tab.key)}
              activeOpacity={0.7}
            >
              <View style={s.iconWrap}>
                <NavIcon name={iconName} size={22} color={isActive ? NAV_ACTIVE : NAV_INACTIVE} />
                {badge > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{badge > 9 ? '9+' : String(badge)}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.label, isActive && s.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Floating add button */}
        <TouchableOpacity
          style={[s.addBtn, activeTab === 'record' && s.addBtnActive]}
          onPress={() => handlePress('record')}
          activeOpacity={0.8}
        >
          <NavIcon name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Choice modal */}
      <Modal visible={showChoice} transparent animationType="fade" onRequestClose={() => setShowChoice(false)}>
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
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: NAV_BG,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  spacer: {
    flex: 1,
  },
  addBtn: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    marginLeft: -(ADD_SIZE / 2),
    width: ADD_SIZE,
    height: ADD_SIZE,
    borderRadius: ADD_SIZE / 2,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  addBtnActive: {
    backgroundColor: '#8c52ff',
  },
  addLabel: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: AppFont.regular,
    fontSize: 10,
    color: NAV_INACTIVE,
    letterSpacing: 0.3,
  },
  addLabelActive: {
    fontFamily: AppFont.semiBold,
    color: NAV_ACTIVE,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: AppFont.regular,
    fontSize: 10,
    color: NAV_INACTIVE,
    letterSpacing: 0.3,
  },
  labelActive: {
    fontFamily: AppFont.semiBold,
    color: NAV_ACTIVE,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -6,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#ed6a6a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: AppFont.semiBold,
    fontSize: 8,
    color: '#fff',
    lineHeight: 13,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 48,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  choiceDivider: { height: 1, backgroundColor: '#f0f0f0' },
  choiceTitle: { fontFamily: AppFont.semiBold, fontSize: 15, color: '#111' },
  choiceSub:   { fontFamily: AppFont.regular,  fontSize: 12, color: '#999', marginTop: 2 },
});
