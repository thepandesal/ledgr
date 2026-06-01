import { View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
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
        <View style={styles.logoWrap}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.tagline}>
          track your money <Text style={styles.taglineBold}>the right way.</Text>
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.8}
            onPress={() => signIn('google')}
            disabled={loading !== null}
          >
            {loading === 'google' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue with Google</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.8}
            onPress={() => signIn('apple')}
            disabled={loading !== null}
          >
            {loading === 'apple' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue with Apple</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1d1d',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 0,
  },
  logoWrap: {
    width: '100%',
    alignItems: 'center',
  },
  logo: {
    width: '90%',
    height: 320,
  },
  tagline: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 28,
  },
  taglineBold: {
    fontFamily: 'DMSans_700Bold',
    color: '#ffffff',
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  button: {
    backgroundColor: '#2a2b2b',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3b3b',
  },
  buttonText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: '#ffffff',
  },
});
