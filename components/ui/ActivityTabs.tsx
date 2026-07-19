import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Fonts } from './theme';
import { AppFont } from '../../src/lib/fonts';
import { DC } from '../../src/lib/design';

export const ACTIVITY_TABS = [
  { key: 'all',         label: 'All',      types: ['income','expense','debt','due','payment','return'] },
  { key: 'money-in',   label: 'Money In', types: ['income','return'] },
  { key: 'money-out',  label: 'Money Out',types: ['expense','payment'] },
  { key: 'loans',      label: 'Debt',     types: ['debt','payment'] },
  { key: 'receivables',label: 'Due',      types: ['due','expense'] },
] as const;

export type ActivityTab = typeof ACTIVITY_TABS[number]['key'];

interface Props {
  selectedTabs: Set<ActivityTab>;
  onToggle: (key: ActivityTab) => void;
  tabValue: (key: string) => string;
  activeColor?: string;
  activeTextColor?: string;
}

export default function ActivityTabs({ selectedTabs, onToggle, tabValue, activeColor = DC.tabActiveBg, activeTextColor = DC.tabActiveText }: Props) {
  return (
    <View style={s.tabRow}>
      {ACTIVITY_TABS.map(tab => {
        const isActive = selectedTabs.has(tab.key);
        return (
          <TouchableOpacity key={tab.key} style={s.tabWrap} onPress={() => onToggle(tab.key)} activeOpacity={0.75}>
            <View style={[s.tabCircle, { backgroundColor: isActive ? activeColor : '#111111' }]}>
              <Text style={[s.tabCircleValue, { color: isActive ? activeTextColor : '#ffffff' }]}>{tabValue(tab.key)}</Text>
            </View>
            <Text style={[s.tabLabel, isActive && { color: activeTextColor, fontFamily: AppFont.semiBold }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  tabRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  tabWrap:        { flex: 1, alignItems: 'center' },
  tabCircle:      { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  tabCircleValue: { fontFamily: AppFont.bold, fontSize: 11, color: '#ffffff', letterSpacing: -0.3 },
  tabLabel:       { fontFamily: AppFont.regular, fontSize: 9, color: DC.pageTextMuted, marginTop: 5, letterSpacing: 0.2 },
});
