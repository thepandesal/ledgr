import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Colors, Fonts, Radius } from './theme';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

interface Props {
  date: string;
  onChange: (date: string) => void;
}

export default function MonthPicker({ date, onChange }: Props) {
  const parts = date ? date.split('-') : [];
  const [month, setMonth] = useState(parts[1] ? parseInt(parts[1]) - 1 : new Date().getMonth());
  const [day,   setDay]   = useState(parts[2] ? parseInt(parts[2]) : new Date().getDate());
  const [year,  setYear]  = useState(parts[0] ? parseInt(parts[0]) : new Date().getFullYear());
  const [open,  setOpen]  = useState(false);
  const [view,  setView]  = useState<'main' | 'month' | 'day' | 'year'>('main');

  const monthRef = useRef<FlatList>(null);

  useEffect(() => {
    if (date) {
      const p = date.split('-');
      setMonth(parseInt(p[1] ?? '1') - 1);
      setDay(parseInt(p[2] ?? '1'));
      setYear(parseInt(p[0] ?? String(new Date().getFullYear())));
    }
  }, []);

  const apply = (m: number, d: number, y: number) => {
    const maxDay = daysInMonth(m, y);
    const safeDay = Math.min(d, maxDay);
    setDay(safeDay);
    onChange(`${y}-${String(m + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`);
  };

  const openModal = () => { setView('main'); setOpen(true); };

  const maxDay = daysInMonth(month, year);
  const days   = Array.from({ length: maxDay }, (_, i) => i + 1);
  const years  = Array.from({ length: 2050 - 2020 + 1 }, (_, i) => 2020 + i);

  const formattedBadge = `${MONTH_SHORT[month]} ${day}, ${year}`;

  return (
    <>
      {/* Badge */}
      <TouchableOpacity style={s.badge} onPress={openModal} activeOpacity={0.8}>
        <Text style={s.badgeText}>{formattedBadge}</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={s.card} activeOpacity={1} onPress={() => {}}>

            {view === 'main' ? (
              <>
                <Text style={s.cardTitle}>select date</Text>

                {/* Month badge — tap to open wheel */}
                <Text style={s.fieldLabel}>month</Text>
                <TouchableOpacity style={s.fieldBtn} onPress={() => setView('month')} activeOpacity={0.8}>
                  <Text style={s.fieldValue}>{MONTHS[month]}</Text>
                  <Text style={s.fieldChevron}>›</Text>
                </TouchableOpacity>

                {/* Day */}
                <Text style={s.fieldLabel}>day</Text>
                <TouchableOpacity style={s.fieldBtn} onPress={() => setView('day')} activeOpacity={0.8}>
                  <Text style={s.fieldValue}>{day}</Text>
                  <Text style={s.fieldChevron}>›</Text>
                </TouchableOpacity>

                {/* Year */}
                <Text style={s.fieldLabel}>year</Text>
                <TouchableOpacity style={s.fieldBtn} onPress={() => setView('year')} activeOpacity={0.8}>
                  <Text style={s.fieldValue}>{year}</Text>
                  <Text style={s.fieldChevron}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.doneBtn} onPress={() => setOpen(false)}>
                  <Text style={s.doneBtnText}>done</Text>
                </TouchableOpacity>
              </>
            ) : view === 'month' ? (
              <>
                <Text style={s.cardTitle}>select month</Text>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity
                    key={m}
                    style={[s.monthRow, month === i && s.monthRowActive]}
                    onPress={() => { setMonth(i); apply(i, day, year); setView('main'); }}
                  >
                    <Text style={[s.monthText, month === i && s.monthTextActive]}>{m}</Text>
                    {month === i && <Text style={s.monthCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </>
            ) : view === 'day' ? (
              <>
                <Text style={s.cardTitle}>select day</Text>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
                  {days.map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[s.monthRow, day === d && s.monthRowActive]}
                      onPress={() => { setDay(d); apply(month, d, year); setView('main'); }}
                    >
                      <Text style={[s.monthText, day === d && s.monthTextActive]}>{d}</Text>
                      {day === d && <Text style={s.monthCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={s.cardTitle}>select year</Text>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
                  {years.map(y => (
                    <TouchableOpacity
                      key={y}
                      style={[s.monthRow, year === y && s.monthRowActive]}
                      onPress={() => { setYear(y); apply(month, day, y); setView('main'); }}
                    >
                      <Text style={[s.monthText, year === y && s.monthTextActive]}>{y}</Text>
                      {year === y && <Text style={s.monthCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const ACCENT = '#7fd8cd';
const ACCENT_DARK = '#2A7A6F';

const s = StyleSheet.create({
  badge:        { alignSelf: 'flex-start', backgroundColor: Colors.surface, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.borderMid },
  badgeText:    { fontFamily: Fonts.monoBold, fontSize: 13, color: Colors.text },

  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  card:         { backgroundColor: Colors.white, borderRadius: 20, padding: 20, width: 300, maxHeight: '80%' },
  cardTitle:    { fontFamily: 'Poppins-Bold', fontSize: 20, color: Colors.text, marginBottom: 16 },

  fieldLabel:   { fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 12 },
  fieldBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.borderMid },
  fieldValue:   { fontFamily: Fonts.monoBold, fontSize: 14, color: Colors.text },
  fieldChevron: { fontFamily: Fonts.mono, fontSize: 18, color: Colors.muted },

  doneBtn:      { backgroundColor: ACCENT, borderRadius: Radius.pill, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  doneBtnText:  { fontFamily: Fonts.monoBold, fontSize: 13, color: ACCENT_DARK },

  monthRow:       { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthRowActive: { backgroundColor: ACCENT + '22', borderRadius: Radius.md, paddingHorizontal: 8 },
  monthText:      { fontFamily: Fonts.mono, fontSize: 14, color: Colors.text },
  monthTextActive:{ fontFamily: Fonts.monoBold, color: ACCENT_DARK },
  monthCheck:     { fontFamily: Fonts.monoBold, fontSize: 14, color: ACCENT_DARK },
});
