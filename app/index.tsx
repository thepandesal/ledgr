import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { useState } from 'react';

const { width } = Dimensions.get('window');
const IMG_ASPECT = 1830 / 1320;
const heroHeight = width * IMG_ASPECT;

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
    <SafeAreaView style={s.container} edges={['bottom', 'top']}>

      {/* Hero — full width, correct aspect ratio, no cropping */}
      <Image
        source={require('../assets/login-vector.png')}
        style={{ width, height: heroHeight }}
        resizeMode="contain"
      />

      {/* Content */}
      <View style={s.content}>
        <Text style={s.brand}>LEDGR</Text>
        <Text style={s.tagline}>track your numbers.</Text>
        <View style={s.buttons}>
          <TouchableOpacity style={s.button} activeOpacity={0.8} onPress={() => signIn('google')} disabled={loading !== null}>
            {loading === 'google'
              ? <ActivityIndicator color="#545454" />
              : <Text style={s.buttonText}>continue with google</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.button} activeOpacity={0.8} onPress={() => signIn('apple')} disabled={loading !== null}>
            {loading === 'apple'
              ? <ActivityIndicator color="#545454" />
              : <Text style={s.buttonText}>continue with apple</Text>}
          </TouchableOpacity>
        </View>
      </View>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: {
    alignItems: 'center',
    paddingHorizontal: 48,
    marginTop: -16,
  },
  brand: { fontFamily: 'MuseoModerno_Black', fontSize: 72, color: '#7fd8cd', letterSpacing: -1, marginBottom: 4 },
  tagline: { fontFamily: 'ChillaxMedium', fontSize: 18, color: '#545454', marginBottom: 32 },
  buttons: { width: '100%', gap: 12 },
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#929090',
    backgroundColor: '#ffffff',
  },
  buttonText: { fontFamily: 'CalSans', fontSize: 15, color: '#545454', letterSpacing: 1.5 },
});
