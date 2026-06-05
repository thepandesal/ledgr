/**
 * InfoRow.tsx
 * Dotted label ··· value row used in information blocks.
 * Used in recording-detail, space-detail, split share page.
 *
 * Usage:
 *   <InfoRow label="Date of transaction" value="Dec 25, 2024" />
 */

import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from './theme';

interface Props {
  label: string;
  value: string;
  valueColor?: string;
}

export default function InfoRow({ label, value, valueColor }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dots} />
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.muted,
    flexShrink: 0,
  },
  dots: {
    flex: 1,
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderColor: Colors.faint,
    marginHorizontal: 8,
  },
  value: {
    fontFamily: Fonts.monoBold,
    fontSize: 11,
    color: Colors.text,
    flexShrink: 0,
    maxWidth: 130,
  },
});
