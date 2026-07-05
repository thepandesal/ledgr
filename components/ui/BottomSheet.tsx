/**
 * BottomSheet.tsx
 * Bottom sheet rendered as an absolutely-positioned overlay (no Modal).
 * Using RN Web's Modal is unreliable on mobile Safari — it creates a new
 * stacking context whose height is tied to window.innerHeight, which Safari
 * shrinks/restores unpredictably with the keyboard, and it injects
 * overflow:hidden on <body> causing a layout-shift on the page behind it.
 *
 * By rendering directly in the tree we stay in the normal document flow,
 * visualViewport events work correctly, and there is no body mutation.
 *
 * Blur behaviour:
 * - Inside a BlurContext (tab screens) → calls setBlur(true/false) on the root overlay
 * - Outside BlurContext (detail screens) → renders its own fade-in backdrop
 */

import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Animated, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useContext, useEffect, useRef, useState } from 'react';
import formStyles from './formStyles';
import { BlurContext } from '../../src/lib/BlurContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  sub?: string;
  title: string;
  height?: string | number;
  maxHeight?: string | number;
  children: React.ReactNode;
}

export default function BottomSheet({ visible, onClose, sub, title, height, maxHeight = '50%', children }: Props) {
  const { setBlur, __hasProvider } = useContext(BlurContext);
  const hasContext = !!__hasProvider;
  const { height: screenHeight } = useWindowDimensions();

  // On web, track the real viewport height via visualViewport so we can compute
  // sheet heights correctly even when Safari shrinks window.innerHeight with the keyboard.
  const [vpHeight, setVpHeight] = useState<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const naturalHeightRef = useRef(0);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const vv = (window as any).visualViewport;
    if (!vv) return;
    naturalHeightRef.current = vv.height;
    setVpHeight(vv.height);
    const onResize = () => {
      if (vv.height > naturalHeightRef.current) {
        naturalHeightRef.current = vv.height;
        setVpHeight(vv.height);
      }
      setKeyboardOpen(naturalHeightRef.current - vv.height > 100);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  const blurAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hasContext) setBlur(visible);

    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(blurAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(blurAnim,  { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  const baseHeight = Platform.OS === 'web' && vpHeight ? vpHeight : screenHeight;
  const resolveHeight = (val: string | number) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.endsWith('%'))
      return baseHeight * (parseFloat(val) / 100);
    return val;
  };

  const sheetMaxHeight = keyboardOpen
    ? resolveHeight('80%')
    : height
      ? resolveHeight(height)
      : resolveHeight(maxHeight);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetMaxHeight, 0],
  });

  if (!mounted) return null;

  return (
    <View style={s.overlay} pointerEvents="box-none">
      {/* Backdrop — only rendered when outside BlurContext */}
      {!hasContext && (
        <Animated.View style={[s.backdrop, { opacity: blurAnim }]} pointerEvents="auto">
          <TouchableOpacity style={s.flex} activeOpacity={1} onPress={onClose} />
        </Animated.View>
      )}
      {hasContext && (
        <TouchableOpacity style={s.flex} activeOpacity={1} onPress={onClose} />
      )}

      <Animated.View
        style={[
          formStyles.sheet,
          { maxHeight: sheetMaxHeight, transform: [{ translateY }] },
        ]}
      >
        <View style={formStyles.header}>
          <View>
            {sub ? <Text style={formStyles.headerSub}>{sub}</Text> : null}
            <Text style={formStyles.headerTitle}>{title}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color="#929090" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={s.flex}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[s.content, keyboardOpen && { paddingBottom: 120 }]}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  flex:    { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    backgroundColor: 'rgba(0,0,0,0.05)',
  } as any,
  content: { paddingBottom: 16 },
});
