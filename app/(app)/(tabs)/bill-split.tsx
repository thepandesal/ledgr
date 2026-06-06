import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function BillSplitScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🍳</Text>
        <Text style={styles.text}>we're cooking something!</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 48 },
  text: { fontFamily: 'DMSans_400Regular', fontSize: 18, color: '#8a8a8a' },
});

