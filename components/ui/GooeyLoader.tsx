import { View, StyleSheet } from 'react-native';
import AnimatedIcon from './AnimatedIcon';

interface Props {
  size?: number;
  color?: string;
}

export default function GooeyLoader({ size = 48, color = '#9cd7d2' }: Props) {
  return (
    <View style={s.wrap}>
      <AnimatedIcon set="svg-spinners" icon="gooey-balls-1" size={size} color={color} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
