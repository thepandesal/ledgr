import { View, TouchableOpacity, Text, StyleSheet, Animated, Dimensions, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, memo } from 'react';
import SpacesScreen from './spaces';
import AccountsScreen from './accounts';
import BillSplitScreen from './bill-split';
import ReceiptsScreen from './receipts';
import CategoriesScreen from './categories';
import { Colors, Fonts } from '@/components/ui/theme';

const { width } = Dimensions.get('window');

const TABS = [
  { key: 'spaces', label: 'Spaces', icon: 'grid' },
  { key: 'accounts', label: 'Accounts', icon: 'wallet-outline' },
  { key: 'categories', label: 'Categories', icon: 'pricetag-outline' },
  { key: 'bill-split', label: 'Bill Split', icon: 'people-outline' },
  { key: 'receipts', label: 'Receipts', icon: 'receipt-outline' },
];

const MemoSpaces = memo(SpacesScreen);
const MemoAccounts = memo(AccountsScreen);
const MemoBillSplit = memo(BillSplitScreen);
const MemoReceipts = memo(ReceiptsScreen);
const MemoCategories = memo(CategoriesScreen);

const SCREENS: Record<string, React.ReactNode> = {
  spaces: <MemoSpaces />,
  accounts: <MemoAccounts />,
  'bill-split': <MemoBillSplit />,
  receipts: <MemoReceipts />,
  categories: <MemoCategories />,
};

export default function TabsLayout() {
  const [activeTab, setActiveTab] = useState('spaces');
  const activeTabRef = useRef('spaces');
  const slideAnims = useRef<Record<string, Animated.Value>>({
    spaces: new Animated.Value(0),
    accounts: new Animated.Value(width),
    categories: new Animated.Value(width),
    'bill-split': new Animated.Value(width),
    receipts: new Animated.Value(width),
  }).current;

  const switchTab = (key: string) => {
    if (key === activeTabRef.current) return;
    activeTabRef.current = key;
    slideAnims[key].setValue(width);
    Animated.timing(slideAnims[key], { toValue: 0, duration: 280, useNativeDriver: false }).start();
    setActiveTab(key);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {TABS.map(tab => (
          <Animated.View
            key={tab.key}
            style={[styles.screen, { transform: [{ translateX: slideAnims[tab.key] }], zIndex: activeTab === tab.key ? 10 : 1 }]}
            pointerEvents={activeTab === tab.key ? 'auto' : 'none'}
          >
            {SCREENS[tab.key]}
          </Animated.View>
        ))}
      </View>
      <SafeAreaView style={styles.navSafeArea}>
        <View style={styles.nav}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity key={tab.key} style={styles.navItem} onPress={() => switchTab(tab.key)} activeOpacity={0.7}>
                <Ionicons name={tab.icon as any} size={22} color={isActive ? Colors.cyan : Colors.faint} />
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1, position: 'relative' },
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f5f5f5' },
  navSafeArea: { backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.muted, borderStyle: 'dashed' },
  nav: { flexDirection: 'row', paddingVertical: 12 },
  navItem: { flex: 1, alignItems: 'center' },
});

