import { View } from 'react-native';

interface Props {
  size?: number;
  color?: string;
}

export default function GooeyLoader({ size = 48, color = '#9cd7d2' }: Props) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} />;
}
