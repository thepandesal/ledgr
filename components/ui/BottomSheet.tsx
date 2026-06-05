/**
 * BottomSheet.tsx
 * Reusable bottom sheet modal. Design matches AddItemModal exactly:
 * - height: '90%', padding 24, borderTopRadius 24, white bg
 * - Header: ChillaxMedium sub + Avenelle title + close button
 * - BlurView backdrop + dismiss overlay
 *
 * Usage:
 *   <BottomSheet visible={open} onClose={close} sub="split bill" title="add people">
 *     ...scrollable content...
 *     <View style={formStyles.actions}>
 *       <TouchableOpacity style={formStyles.cancelBtn} onPress={close}>
 *         <Text style={formStyles.cancelBtnText}>cancel</Text>
 *       </TouchableOpacity>
 *       <TouchableOpacity style={formStyles.primaryBtn} onPress={save}>
 *         <Text style={formStyles.primaryBtnText}>save</Text>
 *       </TouchableOpacity>
 *     </View>
 *   </BottomSheet>
 */

import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import formStyles from './formStyles';

interface Props {
  visible: boolean;
  onClose: () => void;
  sub?: string;
  title: string;
  children: React.ReactNode;
}

export default function BottomSheet({ visible, onClose, sub, title, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

        {/* Tap outside to dismiss */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        {/* Sheet — matches AddItemModal exactly */}
        <View style={formStyles.sheet}>
          {/* Header */}
          <View style={formStyles.header}>
            <View>
              {sub ? <Text style={formStyles.headerSub}>{sub}</Text> : null}
              <Text style={formStyles.headerTitle}>{title}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={20} color="#929090" />
            </TouchableOpacity>
          </View>

          {/* Scrollable content */}
          <ScrollView
            style={s.flex}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 16 },
});
