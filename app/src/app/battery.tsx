import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Muted, Screen } from '../components/ui';
import { batteryRestricted, markBatteryWalkthroughShown, openAppSettings } from '../host/battery';
import { color, font, space, text } from '../theme';

/**
 * Before the first game (spec §3.1): phones like Samsung and Xiaomi pause apps in the background,
 * which would stop the game for everyone. One screen, one setting, in plain language.
 */
export default function BatteryWalkthrough() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    markBatteryWalkthroughShown();
    // Coming back from Settings: if it's allowed now, go straight on to the lobby.
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      setChecked(true);
      if (!batteryRestricted()) router.replace('/lobby');
    });
    return () => sub.remove();
  }, []);

  return (
    <Screen form>
      <View style={styles.body}>
        <Text style={styles.title}>Keep the game running</Text>
        <Muted>
          Your phone runs the game for everyone. Android can pause apps to save battery, which would freeze the game when your
          screen goes dark.
        </Muted>
        <Card title="One setting, once">
          <Step n={1} label="Tap Open settings below" />
          <Step n={2} label="Tap Battery" />
          <Step n={3} label="Choose Unrestricted" />
          <Step n={4} label="Come back here" />
        </Card>
        {checked && batteryRestricted() && <Muted>It's still limited. You can set it now, or carry on and set it later.</Muted>}
      </View>
      <View style={styles.actions}>
        <Button big label="Open settings" onPress={openAppSettings} />
        <Button tone="secondary" label="Not now" onPress={() => router.replace('/lobby')} />
      </View>
    </Screen>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.step}>
      <Text style={styles.number}>{n}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: space[4], paddingTop: space[6] },
  title: { fontFamily: font.display, fontSize: text.xxl, color: color.text, textTransform: 'uppercase' },
  step: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  number: { fontFamily: font.display, fontSize: text.xl, color: color.gold, minWidth: space[6] },
  label: { fontFamily: font.bodySemi, fontSize: text.md, color: color.text },
  actions: { gap: space[3], paddingBottom: space[4] },
});
