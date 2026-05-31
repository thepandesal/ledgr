import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, Spacing, BorderRadius } from '../../constants/theme';

interface ChipSelectProps {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  label?: string;
}

export function ChipSelect({ options, selected, onSelect, label }: ChipSelectProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.grid}>
        {options.map((option) => (
          <Pressable
            key={option}
            style={[styles.chip, selected === option && styles.chipActive]}
            onPress={() => onSelect(option)}
          >
            <Text style={[styles.chipText, selected === option && styles.chipTextActive]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.text },
  chipTextActive: { color: Colors.white },
});
