import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { Colors, Radius } from './theme';
import { DC } from '../../src/lib/design';
import { AppFont } from '../../src/lib/fonts';

interface Props<T> {
  items: T[];
  selected?: T | null;
  onSelect: (item: T) => void;
  keyExtractor: (item: T) => string;
  labelExtractor: (item: T) => string;
  subLabelExtractor?: (item: T) => string;
  subLabel2Extractor?: (item: T) => string;
  renderLeft?: (item: T, selected: boolean) => React.ReactNode;
  emptyText?: string;
  searchPlaceholder?: string;
}

export default function SearchableList<T>({
  items,
  selected,
  onSelect,
  keyExtractor,
  labelExtractor,
  subLabelExtractor,
  subLabel2Extractor,
  renderLeft,
  emptyText = 'nothing found',
  searchPlaceholder = 'search...',
}: Props<T>) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? items.filter(i => labelExtractor(i).toLowerCase().includes(query.toLowerCase()))
    : items;

  const selectedKey = selected ? keyExtractor(selected) : null;

  return (
    <View>
      <TextInput
        style={styles.search}
        placeholder={searchPlaceholder}
        placeholderTextColor={Colors.faint}
        value={query}
        onChangeText={setQuery}
      />
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>{emptyText}</Text>
        ) : (
          filtered.map(item => {
            const key = keyExtractor(item);
            const isSelected = key === selectedKey;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.item, isSelected && styles.itemActive]}
                onPress={() => onSelect(item)}
                activeOpacity={0.8}
              >
                {renderLeft ? (
                  <View style={styles.iconCard}>
                    {renderLeft(item, isSelected)}
                  </View>
                ) : null}
                <View style={styles.itemText}>
                  <Text style={[styles.label, isSelected && styles.labelActive]} numberOfLines={1}>
                    {labelExtractor(item)}
                  </Text>
                  {subLabelExtractor && (
                    <Text style={[styles.sub, isSelected && styles.subActive]} numberOfLines={1}>
                      {subLabelExtractor(item)}
                    </Text>
                  )}
                  {subLabel2Extractor && (
                    <Text style={[styles.sub, isSelected && styles.subActive]} numberOfLines={1}>
                      {subLabel2Extractor(item)}
                    </Text>
                  )}
                </View>

              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: DC.inputBg,
    borderRadius: DC.inputRadius,
    paddingHorizontal: DC.inputPaddingH,
    paddingVertical: DC.inputPaddingV,
    fontFamily: AppFont.regular,
    fontSize: DC.inputFontSize,
    color: DC.inputTextColor,
    borderWidth: DC.inputBorderWidth,
    borderColor: DC.inputBorder,
    marginBottom: 8,
  },
  list: { maxHeight: 280 },
  empty: {
    fontFamily: AppFont.regular,
    fontSize: 12,
    color: Colors.faint,
    textAlign: 'center',
    paddingVertical: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 999,
    marginBottom: 8,
    borderWidth: DC.cardBorderWidth,
    borderColor: DC.cardBorder,
    backgroundColor: DC.cardBg,
  },
  itemActive: {
    backgroundColor: DC.chipActiveBg,
    borderColor: DC.chipActiveBg,
  },
  iconCard: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: { flex: 1 },
  label: {
    fontFamily: AppFont.semiBold,
    fontSize: DC.chipFontSize,
    color: DC.pageText,
  },
  labelActive: {
    color: DC.chipActiveText,
  },
  sub: {
    fontFamily: AppFont.regular,
    fontSize: 11,
    color: DC.pageTextMuted,
    marginTop: 1,
  },
  subActive: {
    color: DC.chipActiveText,
  },
});
