import { useEffect, useRef } from 'react';
import { Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface UseSlideScreenOptions {
  /** Duration of the slide-in animation on mount. Default: 280ms */
  inDuration?: number;
  /** Duration of the slide-out animation on back. Default: 250ms */
  outDuration?: number;
  /**
   * Called after the slide-out animation completes, just before router.back().
   * Use this to set any pending state (e.g. setPendingFocusDate).
   */
  onBeforeBack?: () => void;
}

/**
 * useSlideScreen
 * ─────────────────────────────────────────────────────────────────────────────
 * Encapsulates the standard slide-in/slide-out screen transition used across
 * all detail screens in ledgr. Always uses useNativeDriver: true so the
 * animation runs on the UI thread, not the JS thread.
 *
 * Usage:
 *   const { slideAnim, handleBack } = useSlideScreen();
 *
 *   return (
 *     <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: slideAnim }] }]}>
 *       ...
 *       <TouchableOpacity onPress={handleBack} />
 *     </Animated.View>
 *   );
 */
export function useSlideScreen(options: UseSlideScreenOptions = {}) {
  const { inDuration = 280, outDuration = 250, onBeforeBack } = options;
  const router   = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  // Slide in on mount
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue:         0,
      duration:        inDuration,
      useNativeDriver: true,
    }).start();
  }, []);

  // Slide out, then go back.
  // Accepts an optional callback — guards against React event objects being
  // passed in when used directly as onPress={handleBack}.
  const handleBack = (callback?: () => void) => {
    Animated.timing(slideAnim, {
      toValue:         width,
      duration:        outDuration,
      useNativeDriver: true,
    }).start(() => {
      onBeforeBack?.();
      if (typeof callback === 'function') callback();
      router.back();
    });
  };

  return { slideAnim, handleBack };
}
