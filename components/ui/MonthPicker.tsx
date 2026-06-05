/**
 * MonthPicker.tsx
 * Inline date picker: month chips row + day/year text inputs.
 * Enforces fontSize 16 on inputs to prevent iOS zoom.
 *
 * Usage:
 *   <MonthPicker date={date} onChange={setDate} />
 *
 * `date` is a YYYY-MM-DD string. `onChange` receives a new YYYY-MM-DD string
 * when all parts are valid.
 */

import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { Colors, Fonts, Radius } from './theme';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

interface Props {
  date: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

export default function MonthPicker({ date, onChange }: Props) {
  const parts = date ? date.split('-') : ['', '', ''];
  const [month, setMonth] = useState(parseInt(parts[1] ?? '1') - 1);
  const [day, setDay] = useState(parts[2] ?? '');
  const [year, setYear] = useState(parts[0] ?? '');

  // Sync from external date changes (e.g. when editing an existing record)
  useEffect(() => {
    if (date) {
      const p = date.split('-');
      setMonth(parseInt(p[1] ?? '1') - 1);
      setDay(p[2] ?? '');
      setYear(p[0] ?? '');
    }
  }, []);

  const apply = (m: number, d: string, y: string) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    if (y.length === 4 && parseInt(d) > 0 && parseInt(d) <= 31) {
      onChange(`${y}-${mm}-${dd}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Month chips */}
      <View style={styles.months}>
        {MONTHS.map((m, i) => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, month === i && styles.chipActive]}
            onPress={() => { setMonth(i); apply(i, day, year); }}
          >
            <Text style={[styles.chipText, month === i && styles.chipTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Day + Year */}
      <View style={styles.inputs}>
        <TextInput
          style={styles.input}
          placeholder="dd"
          placeholderTextColor={Colors.faint}
          value={day}
          onChangeText={v => { setDay(v); apply(month, v, year); }}
          keyboardType="number-pad"
          maxLength={2}
        />
        <TextInput
          style={styles.input}
          placeholder="yyyy"
          placeholderTextColor={Colors.faint}
          value={year}
          onChangeText={v => { setYear(v); apply(month, day, v); }}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  months: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.cyan,
    borderColor: Colors.cyan,
  },
  chipText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.muted,
  },
  chipTextActive: {
    fontFamily: Fonts.monoBold,
    color: Colors.white,
  },
  inputs: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    backgroundColor: Colors.input,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    width: 70,
  },
});
