import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { Colors } from '../../../src/constants/theme';

export default function SpacesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.OS === 'web' ? 'fade' : 'slide_from_right',
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
