import { View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.tagline}>
          track your money{' '}
          <Text style={styles.taglineBold}>the right way.</Text>
        </Text>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.8}
            onPress={() => router.replace('/spaces')}
          >
            <Text style={styles.buttonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.8}
            onPress={() => router.replace('/spaces')}
          >
            <Text style={styles.buttonText}>Continue with Apple</Text>
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
  },
  logo: {
    width: '90%',
    height: undefined,
    aspectRatio: 1,
  },
  tagline: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 36,
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
