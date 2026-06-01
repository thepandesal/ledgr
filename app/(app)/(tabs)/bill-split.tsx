import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import SlideScreen from '../../../components/SlideScreen';

export default function BillSplitScreen() {
  return (
    <SlideScreen>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.emoji}>🍳</Text>
          <Text style={styles.text}>we're cooking something!</Text>
        </View>
      </SafeAreaView>
    </SlideScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 48 },
  text: { fontFamily: 'DMSans_400Regular', fontSize: 18, color: 'rgba(255,255,255,0.6)' },
});
