import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { supabase } from '../src/lib/supabase';
import { useState } from 'react';

export default function LoginScreen() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

  const signIn = async (provider: 'google' | 'apple') => {
    setLoading(provider);
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/spaces` : 'ledgr://spaces',
      },
    });
    setLoading(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.tagline}>track your money the right way with</Text>
        <Text style={styles.brand}>ledgr</Text>
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={() => signIn('google')} disabled={loading !== null}>
            {loading === 'google' ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>continue with google</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={() => signIn('apple')} disabled={loading !== null}>
            {loading === 'apple' ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>continue with apple</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  tagline: { fontFamily: 'RobotoMono_400Regular', fontSize: 14, color: '#1c1d1d', textAlign: 'center', marginBottom: 4 },
  brand: { fontFamily: 'Avenelle', fontSize: 288, color: '#0ccfcf', textAlign: 'center', marginBottom: 16, lineHeight: 300 },
  buttons: { width: '70%', gap: 12 },
  button: {
    backgroundColor: '#425252',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#ffffff' },
});
