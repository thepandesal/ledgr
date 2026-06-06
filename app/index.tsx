import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';
import { useState } from 'react';

const { width, height } = Dimensions.get('window');

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
    <SafeAreaView style={s.container} edges={['bottom']}>

      {/* Hero — fills top half edge to edge */}
      <Image
        source={require('../assets/login-vector.png')}
        style={s.hero}
        resizeMode="cover"
      />

      {/* Content — bottom half */}
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
  hero: { width, height: height * 0.5 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 0,
  },
  brand: { fontFamily: 'MuseoModerno_Black', fontSize: 104, color: '#7fd8cd', letterSpacing: -1, marginBottom: 4 },
  tagline: { fontFamily: 'ChillaxMedium', fontSize: 13, color: '#545454', marginBottom: 32 },
  buttons: { width: '100%', gap: 12 },
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#929090',
    backgroundColor: '#ffffff',
  },
  buttonText: { fontFamily: 'CalSans', fontSize: 15, color: '#545454' },
});
