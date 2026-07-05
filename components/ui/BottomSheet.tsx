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

  // On web/Safari, listen for visualViewport resize (keyboard appearing)
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const onResize = () => setKeyboardHeight(Math.max(0, window.innerHeight - vv.height));
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
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

  const sheetStyle = Platform.OS === 'web' && keyboardHeight > 0
    ? { maxHeight: screenHeight - keyboardHeight - 20 }
    : height ? { height, maxHeight: height } : { maxHeight };

  return (
    <>
      {/* Own blur — only used when outside BlurContext */}
      {!hasContext && blurMounted && (
        <Animated.View style={[s.blur, { opacity: blurAnim }]} pointerEvents="none" />
      )}

      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
              contentContainerStyle={s.content}
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
  content: { paddingBottom: Platform.OS === 'web' ? 120 : 16 },
  blur: {
    ...StyleSheet.absoluteFillObject,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    backgroundColor: 'rgba(0,0,0,0.05)',
    zIndex: 999,
  } as any,
});
