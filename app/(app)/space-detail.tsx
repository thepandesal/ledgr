import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';

const { width } = Dimensions.get('window');

export default function SpaceDetailScreen() {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
  }, []);

  const handleBack = () => {
    Animated.timing(slideAnim, { toValue: width, duration: 250, useNativeDriver: false }).start(() => router.back());
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={styles.inner}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
          <Text style={styles.backText}>back</Text>
        </TouchableOpacity>
        <View style={styles.content}>
          <Text style={styles.emoji}>🍳</Text>
          <Text style={styles.text}>we're cooking something!</Text>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1c1d1d', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  inner: { flex: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 20 },
  backText: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 48 },
  text: { fontFamily: 'DMSans_400Regular', fontSize: 18, color: 'rgba(255,255,255,0.6)' },
});
