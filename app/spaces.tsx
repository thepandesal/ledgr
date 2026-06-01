import { View, Text, StyleSheet } from 'react-native';

export default function SpacesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🍳</Text>
      <Text style={styles.text}>we're cooking something!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1d1d',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emoji: {
    fontSize: 48,
  },
  text: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
  },
});
