/**
 * FormActions.tsx
 * Standard cancel + primary button row used at the bottom of all forms.
 *
 * Usage:
 *   <FormActions
 *     onCancel={() => setModal(false)}
 *     onConfirm={handleSave}
 *     confirmLabel="save"
 *     loading={saving}
 *     disabled={!isValid}
 *   />
 */

import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors, Fonts, Radius } from './theme';

interface Props {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}

export default function FormActions({
  onCancel,
  onConfirm,
  confirmLabel = 'save',
  cancelLabel = 'cancel',
  loading = false,
  disabled = false,
  destructive = false,
}: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.cancel} onPress={onCancel} activeOpacity={0.8}>
        <Text style={styles.cancelText}>{cancelLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.confirm,
          destructive && styles.confirmDestructive,
          (disabled || loading) && styles.disabled,
        ]}
        onPress={onConfirm}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator color={Colors.white} />
          : <Text style={styles.confirmText}>{confirmLabel}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancel: {
    flex: 1,
    backgroundColor: Colors.input,
    borderRadius: Radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: '#8a8a8a',
  },
  confirm: {
    flex: 1,
    backgroundColor: Colors.text,
    borderRadius: Radius.pill,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmDestructive: {
    backgroundColor: Colors.danger,
  },
  disabled: {
    opacity: 0.4,
  },
  confirmText: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: Colors.white,
  },
});
