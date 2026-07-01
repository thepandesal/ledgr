import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Fonts } from './theme';

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

export default function ActivityTabs({ selectedTabs, onToggle, tabValue, activeColor = Colors.cyan, activeTextColor = Colors.white }: Props) {
  return (
    <View style={s.tabRow}>
      {ACTIVITY_TABS.map(tab => {
        const isActive = selectedTabs.has(tab.key);
        return (
          <TouchableOpacity key={tab.key} style={s.tabWrap} onPress={() => onToggle(tab.key)} activeOpacity={0.75}>
            <View style={[s.tabCircle, isActive && { backgroundColor: activeColor }]}>
              <Text style={[s.tabCircleValue, isActive && { color: activeTextColor }]}>{tabValue(tab.key)}</Text>
            </View>
            <Text style={[s.tabLabel, isActive && { color: activeColor, fontFamily: Fonts.monoBold }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  tabRow:               { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 4 },
  tabWrap:              { flex: 1, alignItems: 'center' },
  tabCircle:            { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  tabCircleValue:       { fontFamily: Fonts.monoBold, fontSize: 11, color: Colors.muted, letterSpacing: -0.3 },
  tabLabel:             { fontFamily: Fonts.mono, fontSize: 9, color: Colors.muted, marginTop: 5, letterSpacing: 0.2 },
});
