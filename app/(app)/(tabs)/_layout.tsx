import { View, TouchableOpacity, Text, StyleSheet, Animated, Dimensions, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useCallback } from 'react';
import SpacesScreen from './spaces';
import AccountsScreen from './accounts';
import BillSplitScreen from './bill-split';
import ReceiptsScreen from './receipts';

const { width } = Dimensions.get('window');

const TABS = [
  { key: 'spaces', label: 'Spaces', icon: 'grid' },
  { key: 'accounts', label: 'Accounts', icon: 'wallet-outline' },
  { key: 'bill-split', label: 'Bill Split', icon: 'people-outline' },
  { key: 'receipts', label: 'Receipts', icon: 'receipt-outline' },
];

function TabScreen({ children, isActive, slideAnim }: { children: React.ReactNode; isActive: boolean; slideAnim: Animated.Value }) {
  return (
    <Animated.View
      style={[
        styles.screen,
        {
          transform: [{ translateX: slideAnim }],
          zIndex: isActive ? 10 : 0,
          pointerEvents: isActive ? 'auto' : 'none',
        } as any,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default function TabsLayout() {
  const [activeTab, setActiveTab] = useState('spaces');
  const slideAnims = useRef<Record<string, Animated.Value>>({
    spaces: new Animated.Value(0),
    accounts: new Animated.Value(width),
    'bill-split': new Animated.Value(width),
    receipts: new Animated.Value(width),
  }).current;

  const switchTab = useCallback((key: string) => {
    if (key === activeTab) return;

    // Slide new tab in from right
    slideAnims[key].setValue(width);
    Animated.timing(slideAnims[key], {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();

    setActiveTab(key);
  }, [activeTab]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TabScreen isActive={activeTab === 'spaces'} slideAnim={slideAnims['spaces']}>
          <SpacesScreen />
        </TabScreen>
        <TabScreen isActive={activeTab === 'accounts'} slideAnim={slideAnims['accounts']}>
          <AccountsScreen />
        </TabScreen>
        <TabScreen isActive={activeTab === 'bill-split'} slideAnim={slideAnims['bill-split']}>
          <BillSplitScreen />
        </TabScreen>
        <TabScreen isActive={activeTab === 'receipts'} slideAnim={slideAnims['receipts']}>
          <ReceiptsScreen />
        </TabScreen>
      </View>

      {/* Custom Bottom Nav */}
      <SafeAreaView style={styles.navSafeArea}>
        <View style={styles.nav}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.navItem}
                onPress={() => switchTab(tab.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={tab.icon as any} size={22} color={isActive ? '#00bf63' : 'rgba(255,255,255,0.4)'} />
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c1d1d' },
  content: { flex: 1, position: 'relative' },
  screen: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#1c1d1d',
  },
  navSafeArea: {
    backgroundColor: '#1c1d1d',
    borderTopWidth: 1,
    borderTopColor: '#2a2b2b',
  },
  nav: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingBottom: 12,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  navLabelActive: { color: '#00bf63', fontFamily: 'DMSans_600SemiBold' },
});
