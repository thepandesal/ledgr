/**
 * FormInput.tsx
 * Standard text input for forms.
 * - fontSize always 16 to prevent iOS auto-zoom on focus
 * - Consistent background, border, padding across all screens
 */

import { TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors, Fonts, Radius } from './theme';

interface Props extends TextInputProps {
  multiline?: boolean;
}

export default function FormInput({ style, ...props }: Props) {
  return (
    <TextInput
      placeholderTextColor={Colors.faint}
      style={[styles.input, props.multiline && styles.multiline, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.input,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
});
