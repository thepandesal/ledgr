import { View, Text, Image, StyleSheet } from 'react-native';
import { Button } from '../src/components/ui';
import { signInWithGoogle, signInWithApple } from '../src/services';
import { Colors, Fonts, Spacing } from '../src/constants/theme';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoSection}>
        <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.appName}>Ledgr</Text>
        <Text style={styles.tagline}>Your finances, together.</Text>
      </View>

      <View style={styles.authSection}>
        <Button title="Continue with Google" variant="outline" onPress={signInWithGoogle} />
        <Button
          title="Continue with Apple"
          onPress={signInWithApple}
          style={{ backgroundColor: Colors.black }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  logoSection: { alignItems: 'center', marginBottom: Spacing.xxl },
  logo: { width: 100, height: 100, marginBottom: Spacing.md },
  appName: { fontFamily: Fonts.header, fontSize: 36, color: Colors.primary },
  tagline: { fontFamily: Fonts.body, fontSize: 15, color: Colors.textMuted, marginTop: Spacing.xs },
  authSection: { gap: Spacing.sm },
});
