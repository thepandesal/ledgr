/**
 * FormBlock.tsx + FormRow.tsx
 * The grouped input block used for structured form fields (name, amount, date).
 *
 * Usage:
 *   <FormBlock>
 *     <FormRow label="name">
 *       <TextInput ... />
 *     </FormRow>
 *     <FormRow label="amount">
 *       <TextInput ... />
 *     </FormRow>
 *   </FormBlock>
 */

import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Radius } from './theme';

// ─── FormBlock ───────────────────────────────────────────────────────────────

interface FormBlockProps {
  children: React.ReactNode;
  style?: object;
}

export function FormBlock({ children, style }: FormBlockProps) {
  return (
    <View style={[styles.block, style]}>
      {children}
    </View>
  );
}

// ─── FormRow ─────────────────────────────────────────────────────────────────

interface FormRowProps {
  label: string;
  children: React.ReactNode;
  /** If true, stacks label above content instead of side-by-side */
  stacked?: boolean;
}

export function FormRow({ label, children, stacked }: FormRowProps) {
  if (stacked) {
    return (
      <View style={[styles.row, styles.rowStacked]}>
        <Text style={styles.label}>{label}</Text>
        {children}
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 0,
  },
  rowStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 12,
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.muted,
    width: 80,
    flexShrink: 0,
  },
});
