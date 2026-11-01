import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Logo } from '../../components/Logo';
import { PendingResults } from '../../components/PendingResults';
import { shouldWalkThroughBattery } from '../../host/battery';
import { Button, Muted, Screen } from '../../components/ui';
import { color, font, space, text, tracking } from '../../theme';

/** Play tab, the first screen: one big way in (spec §5.1). No onboarding carousel. */
export default function Play() {
  return (
    <Screen form>
      {/* Answers left behind if the app stopped mid-questionnaire (spec §6.4 crash recovery). */}
      <PendingResults />
      <View style={styles.hero}>
        <Text style={styles.kicker}>Tonight's quiz</Text>
        <Logo />
        <Muted>Everyone plays on their own phone. No app for them, just a scan.</Muted>
      </View>
      <View style={styles.actions}>
        <Button big label="Start a game now" onPress={() => router.push(shouldWalkThroughBattery() ? '/battery' : '/lobby')} />
        <Muted>Ready-made games to play straight away.</Muted>
        <Pressable accessibilityRole="link" onPress={() => router.push('/games/new')} style={styles.link}>
          <Text style={styles.linkLabel}>Or create your own game</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], paddingTop: space[8] },
  kicker: { fontFamily: font.displayBold, fontSize: text.md, letterSpacing: tracking.caps * 2, textTransform: 'uppercase', color: color.violet },
  actions: { gap: space[3], paddingBottom: space[4], alignItems: 'stretch' },
  link: { alignSelf: 'center', paddingVertical: space[3], paddingHorizontal: space[4] },
  linkLabel: { fontFamily: font.bodyBold, fontSize: text.md, color: color.violetLight, textDecorationLine: 'underline' },
});
