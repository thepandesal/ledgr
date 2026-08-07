import { View, Text, TouchableOpacity } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { DC } from '../../src/lib/design';

const SVG_BACK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path fill="currentColor" d="M10.5 6a.75.75 0 0 0-.75-.75H3.81l1.97-1.97a.75.75 0 0 0-1.06-1.06L1.47 5.47a.75.75 0 0 0 0 1.06l3.25 3.25a.75.75 0 0 0 1.06-1.06L3.81 6.75h5.94A.75.75 0 0 0 10.5 6" /></svg>`;

interface Props {
  title: string;
  subtitle?: string;
  onSubtitlePress?: () => void;
  onBack?: () => void;
  right?: React.ReactNode;
  topInset?: number;
  centered?: boolean;
  variant?: 'default' | 'branded' | 'panel' | 'blue';
}

export default function TopHeader({ title, subtitle, onSubtitlePress, onBack, right, topInset = 0, centered = false, variant = 'default' }: Props) {
  const branded = variant === 'branded';
  const panel   = variant === 'panel';
  const blue    = variant === 'blue';
  const colored = branded || panel;

  const wrapStyle: any = blue ? {
    backgroundColor: DC.headerBlueBg,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  } : colored ? {
    backgroundColor: '#deecff',
    borderBottomLeftRadius: branded ? 40 : 32,
    borderBottomRightRadius: branded ? 40 : 32,
  } : {};

  const textColor  = blue ? '#ffffff' : colored ? '#373737' : '#111111';
  const arrowColor = blue ? '#ffffff' : colored ? '#373737' : DC.backBtn.color;
  const fontFamily = (colored || blue) ? 'Poppins-Bold' : 'Poppins-SemiBold';
  const fontSize   = (colored || blue) ? 16 : 15;

  return (
    <View style={wrapStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingTop: DC.headerPaddingTop + topInset, paddingBottom: blue ? DC.headerPaddingBottom : (subtitle ? 10 : 14), minHeight: DC.headerPaddingTop + topInset + (blue ? DC.headerContentHeight : 56) }}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} disabled={!onBack} style={{ width: DC.backBtn.width }}>
          {onBack && <SvgXml xml={SVG_BACK} width={DC.backBtn.width} height={DC.backBtn.height} color={arrowColor} />}
        </TouchableOpacity>
        {centered ? (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily, fontSize, color: textColor, textAlign: 'center' }}>{title}</Text>
            {subtitle ? (
              <TouchableOpacity onPress={onSubtitlePress} disabled={!onSubtitlePress} activeOpacity={onSubtitlePress ? 0.6 : 1}>
                <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: textColor, opacity: onSubtitlePress ? 0.85 : 1, textAlign: 'center' }} numberOfLines={1}>{subtitle}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={(colored || blue) ? { fontFamily, fontSize, color: textColor } : { ...DC.typography.pageTitle }}>{title}</Text>
          </View>
        )}
        <View style={{ width: DC.backBtn.width, alignItems: 'flex-end' }}>{right}</View>
      </View>
      {!(colored || blue) && <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />}
    </View>
  );
}
