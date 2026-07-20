import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, Platform, Animated, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useContext, useEffect, useRef, useState } from 'react';
import formStyles from './formStyles';
import { BlurContext } from '../../src/lib/BlurContext';
import { DC } from '../../src/lib/design';
import { AppFont } from '../../src/lib/fonts';

interface Props {
  visible: boolean;
  onClose: () => void;
  sub?: string;
  title: string;
  height?: string | number;
  maxHeight?: string | number;
  children: React.ReactNode;
}

export default function BottomSheet({ visible, onClose, sub, title, children }: Props) {
  const { setBlur, __hasProvider } = useContext(BlurContext);
  const hasContext = !!__hasProvider;

  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (hasContext) setBlur(visible);
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(scaleAnim,   { toValue: 1,    duration: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1,    duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim,   { toValue: 0.95, duration: 150, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0,    duration: 150, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[s.backdrop, { opacity: opacityAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <View style={s.centeredWrap} pointerEvents="box-none">
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[s.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
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
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={s.content}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  centeredWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: DC.modalBg,
    borderRadius: DC.cardRadius,
    padding: DC.modalPadding,
    paddingBottom: 0,
  },
  content: {
    paddingBottom: 24,
  },
});
