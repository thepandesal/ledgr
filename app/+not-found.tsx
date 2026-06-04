import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function NotFound() {
  const router = useRouter();
  return (
    <View style={s.container}>
      <Text style={s.title}>ledgr</Text>
      <Ionicons name="unlink-outline" size={48} color="#e8e8e8" style={{ marginBottom: 16 }} />
      <Text style={s.heading}>page not found</Text>
      <Text style={s.sub}>this link is invalid or no longer exists.</Text>
      <TouchableOpacity style={s.btn} onPress={() => router.replace('/')}>
        <Text style={s.btnText}>go home</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 32 },
  title: { fontFamily: 'Avenelle', fontSize: 22, color: '#0ccfcf', marginBottom: 16 },
  heading: { fontFamily: 'Avenelle', fontSize: 28, color: '#425252', letterSpacing: -0.5 },
  sub: { fontFamily: 'RobotoMono_400Regular', fontSize: 12, color: '#929090', textAlign: 'center', lineHeight: 18 },
  btn: { marginTop: 24, backgroundColor: '#425252', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 32 },
  btnText: { fontFamily: 'RobotoMono_700Bold', fontSize: 13, color: '#fff' },
});
