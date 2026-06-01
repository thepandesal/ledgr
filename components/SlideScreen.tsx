import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

const { width } = Dimensions.get('window');

export default function SlideScreen({ children }: { children: React.ReactNode }) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        slideAnim.setValue(width);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
        return;
      }
      slideAnim.setValue(width);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, [])
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: slideAnim }],
          zIndex: 10,
        },
      ]}
    >
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
