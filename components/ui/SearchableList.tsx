/**
 * SearchableList.tsx
 * A scrollable list with a search input, used inside BottomSheet for
 * category, account, and receipt pickers.
 *
 * Usage:
 *   <SearchableList
 *     items={categories}
 *     selected={selectedCategory}
 *     onSelect={c => { setSelectedCategory(c); setModal(false); }}
 *     keyExtractor={c => c.id}
 *     labelExtractor={c => c.name}
 *     renderLeft={c => <CategoryDot color={c.color} icon={c.icon} />}
 *     renderRight={c => <SubText>{c.bank}</SubText>}
 *   />
 */

import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Colors, Fonts, Radius } from './theme';

interface Props<T> {
  items: T[];
  selected?: T | null;
  onSelect: (item: T) => void;
  keyExtractor: (item: T) => string;
  labelExtractor: (item: T) => string;
  subLabelExtractor?: (item: T) => string;
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
  renderLeft,
  emptyText = 'nothing found',
  searchPlaceholder = 'search...',
}: Props<T>) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? items.filter(i =>
        labelExtractor(i).toLowerCase().includes(query.toLowerCase())
      )
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
                {renderLeft ? renderLeft(item, isSelected) : null}
                <View style={styles.itemText}>
                  <Text style={[styles.label, isSelected && styles.labelActive]}>
                    {labelExtractor(item)}
                  </Text>
                  {subLabelExtractor && (
                    <Text style={[styles.sub, isSelected && styles.subActive]}>
                      {subLabelExtractor(item)}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <Ionicons name="checkmark" size={14} color={Colors.white} />
                )}
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
    backgroundColor: Colors.input,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  list: {
    maxHeight: 220,
  },
  empty: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.faint,
    textAlign: 'center',
    paddingVertical: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: Radius.md,
  },
  itemActive: {
    backgroundColor: Colors.text,
    paddingHorizontal: 10,
  },
  itemText: {
    flex: 1,
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.text,
  },
  labelActive: {
    fontFamily: Fonts.monoBold,
    color: Colors.white,
  },
  sub: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.muted,
    marginTop: 1,
  },
  subActive: {
    color: 'rgba(255,255,255,0.7)',
  },
});
