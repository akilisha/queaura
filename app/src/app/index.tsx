import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Muted, Screen } from '../components/ui';
import { color, space, text, weight } from '../theme';

/** First screen: play now with a sample game (spec §5.1). No onboarding carousel. */
export default function Home() {
  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>Host a trivia night</Text>
        <Muted>Players join with their phones by scanning a code. No app needed for them.</Muted>
      </View>
      <Card>
        <Button big label="Start a game now" onPress={() => router.push('/lobby')} />
        <Muted>Opens a lobby with ready-made sample games. Pick one, let people join, press Start.</Muted>
      </Card>
      <Card>
        <Button tone="secondary" label="Your questions" onPress={() => router.push('/questions')} />
        <Muted>See the questions on this phone, and write your own.</Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space[2], paddingVertical: space[5] },
  title: { fontSize: text.xxl, fontWeight: weight.bold, color: color.text },
});
