import { Stack } from 'expo-router';
import { Colors } from '../../../src/constants/theme';

export default function SpacesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'ios',
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
