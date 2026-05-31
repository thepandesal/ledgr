import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, isLoading, isSigningIn, signInWithGoogle, signInWithApple, error } = useAuth();

  useEffect(() => {
    if (session && !isLoading) {
      router.replace('/(app)/workspaces');
    }
  }, [session, isLoading, router]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Google sign-in failed';
      Alert.alert('Sign-in Failed', errorMessage);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Apple sign-in failed';
      Alert.alert('Sign-in Failed', errorMessage);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Logo */}
      <Image
        source={require('@/assets/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Tagline */}
      <Text style={styles.tagline}>Your finances</Text>
      <Text style={styles.taglineAccent}>your way</Text>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Buttons Container */}
      <View style={styles.buttonsContainer}>
        {/* Google Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleGoogleSignIn}
          disabled={isSigningIn}
          activeOpacity={0.8}
        >
          {isSigningIn ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.buttonText}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        {/* Apple Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleAppleSignIn}
          disabled={isSigningIn}
          activeOpacity={0.8}
        >
          {isSigningIn ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.buttonText}>Continue with Apple</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: Spacing.xl,
  },
  tagline: {
    fontFamily: Fonts.header,
    fontSize: 36,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  taglineAccent: {
    fontFamily: Fonts.header,
    fontSize: 36,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  buttonsContainer: {
    width: '100%',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  button: {
    backgroundColor: Colors.authButton,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 16,
    color: Colors.white,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.white,
    textAlign: 'center',
  },
});
