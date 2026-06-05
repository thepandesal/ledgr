/**
 * BottomSheet.tsx
 * Reusable bottom sheet modal with BlurView backdrop, dismiss overlay,
 * standard header (sub-label + Avenelle title + close button), and
 * scrollable content area.
 *
 * Usage:
 *   <BottomSheet visible={open} onClose={close} sub="split bill" title="add people">
 *     ...content...
 *   </BottomSheet>
 */

import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Spacing } from './theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  sub?: string;
  title: string;
  /** Wrap content in a ScrollView (default true) */
  scrollable?: boolean;
  children: React.ReactNode;
  /** Extra padding at the bottom (default 48) */
  bottomPadding?: number;
  /** Max height as percentage string e.g. '85%' (default '85%') */
  maxHeight?: string;
}

export default function BottomSheet({
  visible,
  onClose,
  sub,
  title,
  scrollable = true,
  children,
  bottomPadding = 48,
  maxHeight = '85%',
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

        {/* Tap outside to dismiss */}
        <TouchableOpacity
          style={styles.flex}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Sheet */}
        <View style={[styles.sheet, { maxHeight, paddingBottom: bottomPadding }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              {sub ? <Text style={styles.sub}>{sub}</Text> : null}
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {scrollable ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  sub: {
    fontFamily: Fonts.heading,
    fontSize: 11,
    color: Colors.muted,
    marginBottom: 2,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.text,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
});
