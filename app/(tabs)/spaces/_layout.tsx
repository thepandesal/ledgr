import { Stack } from 'expo-router';
import { Colors } from '../../../src/constants/theme';

export default function SpacesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
