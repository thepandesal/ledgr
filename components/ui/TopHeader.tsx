import { View, Text, TouchableOpacity } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { DC } from '../../src/lib/design';

const SVG_BACK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path fill="currentColor" d="M10.5 6a.75.75 0 0 0-.75-.75H3.81l1.97-1.97a.75.75 0 0 0-1.06-1.06L1.47 5.47a.75.75 0 0 0 0 1.06l3.25 3.25a.75.75 0 0 0 1.06-1.06L3.81 6.75h5.94A.75.75 0 0 0 10.5 6" /></svg>`;

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  topInset?: number;
  centered?: boolean;
}

export default function TopHeader({ title, subtitle, onBack, right, topInset = 0, centered = false }: Props) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingTop: 28 + topInset, paddingBottom: subtitle ? 10 : 14, minHeight: 28 + topInset + 56 }}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} disabled={!onBack} style={{ width: DC.backBtn.width }}>
          {onBack && <SvgXml xml={SVG_BACK} width={DC.backBtn.width} height={DC.backBtn.height} color={DC.backBtn.color} />}
        </TouchableOpacity>
        {centered ? (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#111111', textAlign: 'center' }}>{title}</Text>
            {subtitle ? <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: '#111111', fontStyle: 'italic', textAlign: 'center' }} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={{ ...DC.typography.pageTitle }}>{title}</Text>
          </View>
        )}
        <View style={{ width: DC.backBtn.width, alignItems: 'flex-end' }}>{right}</View>
      </View>
      <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />
    </View>
  );
}
