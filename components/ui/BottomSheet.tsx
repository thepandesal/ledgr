/**
 * BottomSheet.tsx
 * Bottom sheet modal that auto-sizes to content, capped at maxHeight (default 50%).
 * Pass `height` prop to force a fixed height instead.
 *
 * Blur behaviour:
 * - Inside a BlurContext (tab screens) → calls setBlur(true/false) on the root overlay
 * - Outside BlurContext (detail screens) → renders its own fade-in blur overlay
 */

import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, KeyboardAvoidingView, Platform, Animated, useWindowDimensions,
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

  // Track real screen height via visualViewport to compute pixel-based sheet heights.
  // Percentages are unreliable on mobile Safari because the Modal container height
  // is tied to window.innerHeight which shrinks with the keyboard and may not restore.
  const [vpHeight, setVpHeight] = useState<number | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const naturalHeightRef = useRef(0);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const vv = (window as any).visualViewport;
    if (!vv) return;
    naturalHeightRef.current = Math.max(naturalHeightRef.current, vv.height);
    setVpHeight(naturalHeightRef.current);
    const onResize = () => {
      naturalHeightRef.current = Math.max(naturalHeightRef.current, vv.height);
      const diff = naturalHeightRef.current - vv.height;
      setKeyboardOpen(diff > 100);
      setVpHeight(naturalHeightRef.current);
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // Inject a one-time CSS rule to stop RN Web's Modal from adding overflow:hidden
  // to the body, which causes a scrollbar-width shift on the page behind the modal.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'rnw-modal-no-shift';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = 'body { overflow: auto !important; }';
      document.head.appendChild(style);
    }
  }, []);

  const blurAnim = useRef(new Animated.Value(0)).current;
  const [blurMounted, setBlurMounted] = useState(false);

  useEffect(() => {
    if (hasContext) {
      // Delegate to root BlurContext overlay
      setBlur(visible);
    } else {
      // Own internal blur
      if (visible) {
        setBlurMounted(true);
        Animated.timing(blurAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      } else {
        Animated.timing(blurAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setBlurMounted(false));
      }
    }
  }, [visible]);

  // Compute pixel heights from the real screen height so percentages are always
  // relative to the full screen, not the (potentially shrunken) Modal container.
  const baseHeight = Platform.OS === 'web' && vpHeight ? vpHeight : screenHeight;
  const resolveHeight = (val: string | number) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.endsWith('%')) {
      return baseHeight * (parseFloat(val) / 100);
    }
    return val;
  };
  const sheetStyle = keyboardOpen
    ? { maxHeight: resolveHeight('80%') }
    : height
      ? { height: resolveHeight(height), maxHeight: resolveHeight(height) }
      : { maxHeight: resolveHeight(maxHeight) };

  return (
    <>
      {/* Own blur — only used when outside BlurContext */}
      {!hasContext && blurMounted && (
        <Animated.View style={[s.blur, { opacity: blurAnim }]} pointerEvents="none" />
      )}

      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
        <KeyboardAvoidingView
          style={[s.flex, s.justify]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <TouchableOpacity style={s.flex} activeOpacity={1} onPress={onClose} />

          <View style={[formStyles.sheet, sheetStyle]}>
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}


const s = StyleSheet.create({
  flex:    { flex: 1 },
  justify: { justifyContent: 'flex-end' },
  content: { paddingBottom: 16 },
  blur: {
    ...StyleSheet.absoluteFillObject,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    backgroundColor: 'rgba(0,0,0,0.05)',
    zIndex: 999,
  } as any,
});
