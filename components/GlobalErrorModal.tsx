import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { Colors, Fonts, Radius } from './ui/theme';

let _setError: ((msg: string) => void) | null = null;

export function showGlobalError(message: string) {
  _setError?.(message);
}

export default function GlobalErrorModal() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    _setError = setError;
    return () => { _setError = null; };
  }, []);

  if (!error) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setError(null)}>
      <View style={s.overlay}>
        <View style={s.box}>
          <Text style={s.title}>something went wrong</Text>
          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
            <Text style={s.message}>{error}</Text>
          </ScrollView>
          <TouchableOpacity style={s.btn} onPress={() => setError(null)} activeOpacity={0.8}>
            <Text style={s.btnText}>dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  box: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 24,
    width: '100%',
    gap: 12,
  },
  title: {
    fontFamily: Fonts.monoBold,
    fontSize: 14,
    color: Colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  message: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
  },
  btn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderMid,
    marginTop: 4,
  },
  btnText: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: Colors.muted,
  },
});
