import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { AppFont } from '../src/lib/fonts';

import { FACE_IMAGES } from '../src/lib/faceImages';

export default function OnboardingScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.full_name) {
        setName(user.user_metadata.full_name);
      }
    });
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (selectedIcon === null) { setError('Please select an icon.'); return; }
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { full_name: name.trim(), onboarding_pending: true, avatar_index: selectedIcon },
      });
      if (updateError) throw updateError;
      router.replace('/(app)/(tabs)');
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>LETS START</Text>
        <Text style={s.sectionHeader}>NAME</Text>
        <TextInput
          style={s.input}
          placeholder="Enter your name"
          placeholderTextColor="#d2d2d2"
          value={name}
          onChangeText={(v) => { setName(v); setError(''); }}
          autoFocus
          returnKeyType="done"
        />

        <Text style={s.sectionHeader}>ICON</Text>
        <View style={s.grid}>
          {Array.from({ length: 49 }, (_, i) => i).map(i => (
            <TouchableOpacity
              key={i}
              style={[s.iconCell, selectedIcon === i && s.iconCellSelected]}
              onPress={() => { setSelectedIcon(i); setError(''); }}
              activeOpacity={0.7}
            >
              <Image source={FACE_IMAGES[i]} style={{ width: 40, height: 40 }} />
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[s.button, (!name.trim() || selectedIcon === null) && s.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!name.trim() || selectedIcon === null}
          activeOpacity={0.8}
        >
          <Text style={s.buttonText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  sectionHeader: {
    fontFamily: 'Poppins-Medium',
    fontSize: 20,
    color: '#000000',
    letterSpacing: 0.4,
    marginBottom: 12,
    marginTop: 24,
  },
  title: {
    fontFamily: 'Poppins-Medium',
    fontSize: 28,
    color: '#000000',
    letterSpacing: 0.4,
    marginBottom: 32,
  },
  input: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#3a3a34',
    borderWidth: 1,
    borderColor: '#d2d2d2',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d2d2d2',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  iconCellSelected: {
    borderColor: '#2a2a26',
    backgroundColor: '#f0f0f0',
  },
  error: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 12,
  },
  button: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#2a2a26',
    marginTop: 32,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: '#ffffff', letterSpacing: 1.5 },
});
