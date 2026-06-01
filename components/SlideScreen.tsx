import { Animated, Dimensions, StyleSheet } from 'react-native';
import { useEffect, useRef } from 'react';

const { width } = Dimensions.get('window');

export default function SlideScreen({ children }: { children: React.ReactNode }) {
  const slideAnim = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1d1d',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
