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
      {/* Inject dividers between children automatically */}
      {Array.isArray(children)
        ? children.filter(Boolean).map((child, i, arr) => (
            <View key={i}>
              {child}
              {i < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))
        : children}
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
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
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
    width: 60,
    flexShrink: 0,
  },
});
