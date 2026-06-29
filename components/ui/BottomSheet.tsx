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
import { Ionicons } from '@expo/vector-icons';
import formStyles from './formStyles';

interface Props {
  visible: boolean;
  onClose: () => void;
  sub?: string;
  title: string;
  height?: string | number;
  children: React.ReactNode;
}

export default function BottomSheet({ visible, onClose, sub, title, height, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[s.flex, s.justify]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Transparent dismiss area */}
        <TouchableOpacity style={s.flex} activeOpacity={1} onPress={onClose} />

        {/* Sheet */}
        <View style={[formStyles.sheet, height ? { height } : undefined]}>
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
  flex:    { flex: 1 },
  justify: { justifyContent: 'flex-end' },
  blur:    { justifyContent: 'flex-end' },
  content: { paddingBottom: 16 },
});
