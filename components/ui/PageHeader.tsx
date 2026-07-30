import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Radius } from './theme';
import { AppFont } from '../../src/lib/fonts';
import { DC } from '../../src/lib/design';

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  titleColor?: string;
}

export default function PageHeader({ title, onBack, right, titleColor }: Props) {
  return (
    <View style={s.header}>
      <View style={s.side}>

      </View>
      <View style={s.center}>
        <Text style={s.brand}>LEDGR</Text>
        <Text style={[s.title, titleColor ? { color: titleColor } : undefined]} numberOfLines={1}>{title}</Text>
      </View>
      <View style={s.side}>
        {right}
      </View>
    </View>
  );
}

export const PAGE_HEADER_ACTIONS_STYLE = {
  flexDirection: 'row' as const,
  gap: 6,
};

export function HeaderActionBtn({ onPress, loading }: { onPress: () => void; loading?: boolean }) {
  const { ActivityIndicator } = require('react-native');
  return (
    <TouchableOpacity style={s.actionBtn} onPress={onPress} activeOpacity={0.8}>
      {loading && <ActivityIndicator size="small" color={DC.accent1} />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DC.pagePadding,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: DC.cardBorder,
  },
  side:    { width: 80, flexDirection: 'row', alignItems: 'center' },
  center:  { flex: 1, alignItems: 'center' },
  brand:   { fontFamily: 'MuseoModerno_Regular', fontSize: 11, color: DC.pageTextMuted, letterSpacing: 2, marginBottom: -4 },
  title:   { fontFamily: AppFont.bold, fontSize: 24, color: DC.accent1, letterSpacing: -0.5 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: DC.cardBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DC.cardBorder },
});
