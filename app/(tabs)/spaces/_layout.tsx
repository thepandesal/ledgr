import { Stack } from 'expo-router';
import { Colors, Fonts } from '../../../src/constants/theme';

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
