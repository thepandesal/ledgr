/**
 * ScreenWrapper.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps every detail screen with a consistent slide-in/out transition.
 * The screen slides in from the right on mount and slides out to the right
 * on back, leaving the previous screen visible behind it.
 *
 * Usage:
 *   export default function MyScreen() {
 *     return (
 *       <ScreenWrapper>
 *         ...content...
 *       </ScreenWrapper>
 *     );
 *   }
 *
 * For a custom back action (e.g. with pending state):
 *   <ScreenWrapper onBack={() => { handleFocusDate(); }}>
 */

import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Colors } from './theme';

const { width } = Dimensions.get('window');

interface Props {
  children: React.ReactNode;
  /** Called just before router.back() fires. Use for cleanup/pending state. */
  onBack?: () => void;
  /** Expose the handleBack fn to children via render prop, if needed. */
  renderContent?: (handleBack: () => void) => React.ReactNode;
}

export function useScreenAnim(onBack?: () => void) {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleBack = () => {
    Animated.timing(slideAnim, {
      toValue: width,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onBack?.();
      router.back();
    });
  };

  return { slideAnim, handleBack };
}

export default function ScreenWrapper({ children, onBack, renderContent }: Props) {
  const { slideAnim, handleBack } = useScreenAnim(onBack);

  return (
    <Animated.View style={[s.root, { transform: [{ translateX: slideAnim }] }]}>
      {renderContent ? renderContent(handleBack) : children}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.white,
  },
});
