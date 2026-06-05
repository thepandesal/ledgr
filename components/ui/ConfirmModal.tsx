/**
 * ConfirmModal.tsx
 * Reusable centered confirmation/alert dialog.
 * Replaces all raw Modal + BlurView confirmation patterns across the app.
 *
 * Usage:
 *   <ConfirmModal
 *     visible={deleteConfirm}
 *     onClose={() => setDeleteConfirm(false)}
 *     title="delete recording"
 *     message="this cannot be undone."
 *     actions={[
 *       { label: 'cancel', onPress: () => setDeleteConfirm(false) },
 *       { label: 'delete', onPress: confirmDelete, destructive: true },
 *     ]}
 *   />
 */

import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Fonts, Radius, Shadow } from './theme';

interface Action {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  muted?: boolean;
  disabled?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  children?: React.ReactNode;
  actions: Action[];
}

export default function ConfirmModal({ visible, onClose, title, message, children, actions }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.box}>
              <Text style={styles.title}>{title}</Text>
              {message ? <Text style={styles.message}>{message}</Text> : null}
              {children}
              <View style={styles.actions}>
                {actions.map((a, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.btn,
                      a.destructive && styles.btnDestructive,
                      a.muted && styles.btnMuted,
                      a.disabled && styles.btnDisabled,
                    ]}
                    onPress={a.onPress}
                    disabled={a.disabled}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.btnText,
                      a.muted && styles.btnTextMuted,
                    ]}>
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  box: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 20,
    width: 300,
    gap: 12,
    alignItems: 'center',
    ...Shadow.card,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    color: Colors.text,
    alignSelf: 'flex-start',
  },
  message: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  btn: {
    flex: 1,
    backgroundColor: Colors.text,
    borderRadius: Radius.pill,
    paddingVertical: 11,
    alignItems: 'center',
  },
  btnDestructive: { backgroundColor: Colors.danger },
  btnMuted: { backgroundColor: Colors.input },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.white },
  btnTextMuted: { color: '#8a8a8a' },
});
