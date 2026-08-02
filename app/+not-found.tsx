import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function NotFound() {
  const router = useRouter();
  return (
    <View style={s.container}>
      <Text style={s.title}>ledgr</Text>
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
  title: { fontFamily: 'Poppins-Bold', fontSize: 22, color: '#0ccfcf', marginBottom: 16 },
  heading: { fontFamily: 'Poppins-Bold', fontSize: 28, color: '#425252', letterSpacing: -0.5 },
  sub: { fontFamily: 'Poppins-Regular', fontSize: 12, color: '#929090', textAlign: 'center', lineHeight: 18 },
  btn: { marginTop: 24, backgroundColor: '#425252', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 32 },
  btnText: { fontFamily: 'Poppins-Bold', fontSize: 13, color: '#fff' },
});

