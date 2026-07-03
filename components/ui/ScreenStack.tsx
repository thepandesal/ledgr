/**
 * ScreenStack.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * A lightweight overlay-based navigation stack. Instead of replacing the
 * previous screen, new screens slide in on top while the previous one stays
 * fully rendered behind it.
 *
 * Usage — push a screen:
 *   const { pushScreen, popScreen } = useScreenStack();
 *   pushScreen(<RecordingDetail recordingId={id} onBack={popScreen} />);
 *
 * Wrap your root layout with <ScreenStackProvider>:
 *   <ScreenStackProvider>
 *     <YourTabsLayout />
 *   </ScreenStackProvider>
 */

import {
  Animated, Dimensions, StyleSheet, View,
} from 'react-native';
import { createContext, useContext, useRef, useState, useCallback } from 'react';
import { Colors } from './theme';

const { width } = Dimensions.get('window');

interface ScreenEntry {
  id: number;
  element: React.ReactNode;
  slideAnim: Animated.Value;
}

interface ScreenStackContextValue {
  pushScreen: (element: React.ReactNode) => void;
  popScreen: () => void;
}

const ScreenStackContext = createContext<ScreenStackContextValue>({
  pushScreen: () => {},
  popScreen: () => {},
});

export function useScreenStack() {
  return useContext(ScreenStackContext);
}

let _id = 0;

export function ScreenStackProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<ScreenEntry[]>([]);

  const pushScreen = useCallback((element: React.ReactNode) => {
    const slideAnim = new Animated.Value(width);
    const id = ++_id;
    setStack(prev => [...prev, { id, element, slideAnim }]);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, []);

  const popScreen = useCallback(() => {
    setStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      Animated.timing(last.slideAnim, {
        toValue: width,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setStack(s => s.filter(e => e.id !== last.id));
      });
      return prev; // keep in tree until animation finishes
    });
  }, []);

  return (
    <ScreenStackContext.Provider value={{ pushScreen, popScreen }}>
      <View style={s.root}>
        {/* Base content (tabs) */}
        {children}

        {/* Overlay screens */}
        {stack.map(entry => (
          <Animated.View
            key={entry.id}
            style={[s.overlay, { transform: [{ translateX: entry.slideAnim }] }]}
          >
            {entry.element}
          </Animated.View>
        ))}
      </View>
    </ScreenStackContext.Provider>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.white,
    zIndex: 100,
  },
});
