import { Platform } from 'react-native';

export default function AnimatedIcon(_props: any) {
  if (Platform.OS === 'web') return null;
  return null;
}
