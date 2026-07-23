import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppFont } from '../../src/lib/fonts';
import { DC } from '../../src/lib/design';
import { Colors, Radius } from './theme';

interface Props {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onLabelPress?: () => void;
  style?: any;
}

export default function DateNavBar({ label, onPrev, onNext, onLabelPress, style }: Props) {
  return (
    <TouchableOpacity style={[s.btn, style]} onPress={onLabelPress} activeOpacity={0.8}>
      <Text style={s.arrow} onPress={onPrev}>{DC.navArrowLeft}</Text>
      <Text style={s.label}>{label}</Text>
      <Text style={s.arrow} onPress={onNext}>{DC.navArrowRight}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: DC.pageActionPaddingH, paddingVertical: DC.pageActionPaddingV, borderRadius: DC.pageActionRadius, backgroundColor: DC.pageActionBg, borderWidth: DC.pageActionBorderWidth },
  arrow: { fontFamily: AppFont.regular, fontSize: 14, color: DC.pageActionText },
  label: { flex: 1, fontFamily: AppFont.regular, fontSize: 13, color: DC.pageActionText, textAlign: 'center' },
});
