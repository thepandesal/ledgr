/**
 * FormLabel.tsx
 * Standard section label used above inputs and selectors in forms.
 * Always uppercase, RobotoMono, muted grey.
 */

import { Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from './theme';

interface Props {
  children: React.ReactNode;
  optional?: boolean;
}

export default function FormLabel({ children, optional }: Props) {
  return (
    <Text style={styles.label}>
      {children}
      {optional ? <Text style={styles.optional}> (optional)</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
  },
  optional: {
    fontFamily: Fonts.mono,
    color: Colors.faint,
    textTransform: 'none',
  },
});
