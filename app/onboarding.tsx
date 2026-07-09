import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../src/lib/supabase';
import SlideScreen from '../components/SlideScreen';
import { Colors, Fonts, Radius } from '../components/ui/theme';

const DEFAULT_CATEGORIES = [
  { name: 'Food',          icon: 'restaurant-outline',   color: '#FFAB91' },
  { name: 'Transport',     icon: 'car-outline',           color: '#80CBC4' },
  { name: 'Utilities',     icon: 'flash-outline',         color: '#FFE082' },
  { name: 'Rent',          icon: 'home-outline',          color: '#B39DDB' },
  { name: 'Entertainment', icon: 'musical-notes-outline', color: '#F48FB1' },
  { name: 'Health',        icon: 'medkit-outline',        color: '#A5D6A7' },
  { name: 'Shopping',      icon: 'bag-outline',           color: '#90CAF9' },
  { name: 'Subscriptions', icon: 'card-outline',          color: '#FFCC80' },
  { name: 'Fitness',       icon: 'fitness-outline',       color: '#80DEEA' },
  { name: 'Others',        icon: 'ellipse-outline',       color: '#CFD8DC' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNameSubmit = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: name.trim(), onboarding_pending: true },
      });
      if (updateError) throw updateError;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { count } = await supabase
          .from('categories')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (!count) {
          await supabase.from('categories').insert(
            DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: user.id, is_default: true }))
          );
        }
      }

      router.replace('/(app)/(tabs)');
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideScreen>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView style={styles.inner} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Text style={styles.welcome}>welcome to ledgr</Text>
          <Text style={styles.title}>what's your name?</Text>
          <Text style={styles.subtitle}>we'll use this to personalize your experience.</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="your name"
            placeholderTextColor="#b0b0b0"
            value={name}
            onChangeText={(v) => { setName(v); setError(''); }}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleNameSubmit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.button, !name.trim() && styles.buttonDisabled]}
            onPress={handleNameSubmit}
            disabled={loading || !name.trim()}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>continue</Text>}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SlideScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 12 },
  welcome: {
    fontFamily: 'MuseoModerno_Black',
    fontSize: 14,
    color: Colors.cyan,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: { fontFamily: Fonts.sansBold, fontSize: 28, color: '#1c1d1d', marginBottom: 4 },
  subtitle: { fontFamily: Fonts.sans, fontSize: 14, color: '#8a8a8a', marginBottom: 8 },
  input: {
    backgroundColor: Colors.input,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: '#1c1d1d',
    borderWidth: 1,
    borderColor: Colors.borderMid,
  },
  inputError: { borderColor: '#e74c3c' },
  error: { fontFamily: Fonts.sans, fontSize: 13, color: '#e74c3c' },
  button: {
    backgroundColor: '#00bf63',
    borderRadius: Radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: Colors.white },
});
