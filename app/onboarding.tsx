import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
);

export default function OnboardingScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: name.trim() },
      });
      if (updateError) throw updateError;

      // Also upsert into profiles table
      await supabase.from('profiles').upsert({ id: user.id, display_name: name.trim() });

      router.replace('/spaces');
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.title}>what's your name?</Text>
        <Text style={styles.subtitle}>we'll use this to personalize your experience.</Text>

        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          placeholder="your name"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={name}
          onChangeText={(v) => { setName(v); setError(''); }}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, !name.trim() && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !name.trim()}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>continue</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 28,
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2a2b2b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#3a3b3b',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    color: '#e74c3c',
  },
  button: {
    backgroundColor: '#00bf63',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 15,
    color: '#ffffff',
  },
});
