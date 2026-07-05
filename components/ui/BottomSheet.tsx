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

  const blurAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (hasContext) setBlur(visible);
    if (visible) {
      setMounted(true);
      Animated.timing(blurAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    } else {
      Animated.timing(blurAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMounted(false));
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

  if (!mounted) return null;

  // On web use CSS transition so translateY('100%') works correctly —
  // it's relative to the element's own height, always fully off-screen.
  const webSlideStyle = Platform.OS === 'web' ? {
    transform: [{ translateY: visible ? '0%' : '100%' } as any],
    transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
  } : {};

  return (
    <View style={s.overlay} pointerEvents="box-none">
      {!hasContext && (
        <Animated.View style={[s.backdrop, { opacity: blurAnim }]} pointerEvents="auto">
          <TouchableOpacity style={s.flex} activeOpacity={1} onPress={onClose} />
        </Animated.View>
      )}
      {hasContext && (
        <TouchableOpacity style={s.flex} activeOpacity={1} onPress={onClose} />
      )}

      <Animated.View style={[formStyles.sheet, { maxHeight: sheetMaxHeight }, webSlideStyle]}>
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
