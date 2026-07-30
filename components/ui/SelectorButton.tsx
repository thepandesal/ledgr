/**
 * SelectorButton.tsx
 * Dropdown-style button for picker fields (category, account, receipt, etc).
 * Shows selected value or placeholder, with optional clear button and chevron.
 *
 * Usage:
 *   <SelectorButton
 *     placeholder="select category"
 *     onPress={() => setCategoryModal(true)}
 *     onClear={() => setSelectedCategory(null)}
 *   >
 *     {selectedCategory && <CategoryDisplay ... />}
 *   </SelectorButton>
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Fonts, Radius } from './theme';

interface Props {
  placeholder: string;
  onPress: () => void;
  onClear?: () => void;
  hasValue?: boolean;
  children?: React.ReactNode;
}

export default function SelectorButton({
  placeholder,
  onPress,
  onClear,
  hasValue,
  children,
}: Props) {
  return (
    <TouchableOpacity style={styles.selector} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.left}>
        {hasValue && children
          ? children
          : <Text style={styles.placeholder}>{placeholder}</Text>}
      </View>
      <View style={styles.right}>

      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeholder: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.faint,
  },
});
