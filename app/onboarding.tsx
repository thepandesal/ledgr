import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Image, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { AppFont } from '../src/lib/fonts';
import TopHeader from '../components/ui/TopHeader';
import { AVATAR_SVGS } from '../src/lib/avatarSvgs';
import { DC } from '../src/lib/design';

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
      <TopHeader title="Let's Start" variant="branded" />
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.sectionHeader}>Name</Text>
        <TextInput
          style={s.input}
          placeholder="Enter your name"
          placeholderTextColor="#d2d2d2"
          value={name}
          onChangeText={(v) => { setName(v); setError(''); }}
          autoFocus
          returnKeyType="done"
        />

        <Text style={s.sectionHeader}>Icon</Text>
        <View style={s.grid}>
          {AVATAR_SVGS.map((uri, i) => (
            <TouchableOpacity
              key={i}
              style={[s.iconCell, selectedIcon === i && s.iconCellSelected]}
              onPress={() => { setSelectedIcon(i); setError(''); }}
              activeOpacity={0.7}
            >
              {Platform.OS === 'web' ? (
                <img src={uri} style={{ width: '100%', height: '100%' }} />
              ) : (
                <WebView
                  originWhitelist={['*']}
                  source={{ html: `<!DOCTYPE html><html><body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;width:100%;height:100%"><img src="${uri}" style="width:100%;height:100%" /></body></html>` }}
                  style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
                  pointerEvents="none"
                  setSupportMultipleWindows={false}
                  scrollEnabled={false}
                />
              )}
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
  scroll: { paddingHorizontal: DC.pagePadding, paddingTop: 16, paddingBottom: 40 },
  sectionHeader: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#373737',
    letterSpacing: 0.4,
    marginBottom: 12,
    marginTop: 12,
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
    justifyContent: 'flex-start',
  },
  iconCell: {
    width: '16%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#d2d2d2',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
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
    backgroundColor: '#deecff',
    marginTop: 32,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: 'Poppins-Regular', fontSize: 15, color: '#4394ff', letterSpacing: 1.5 },
});
