import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorText, Muted, Screen } from '../components/ui';
import { createNetwork, openWifiSettings } from '../host/hotspot';
import { serverStatus } from '../host/server';
import { color, font, space, text } from '../theme';

/** "Players can't join?" (spec §3.2): the usual causes in order, ending in the phone's own network. */
export default function JoinHelp() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onWifi = serverStatus().addresses.some((a) => a.kind === 'wifi');

  const makeNetwork = async () => {
    setBusy(true);
    setError(null);
    try {
      await createNetwork();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {!onWifi && (
        <Check title="This phone isn't on Wi-Fi">
          <Muted>Players join on the same Wi-Fi as this phone. Connect it to the Wi-Fi everyone's on.</Muted>
          <Button tone="secondary" label="Open Wi-Fi settings" onPress={openWifiSettings} />
        </Check>
      )}
      <Check title="Are they on the same Wi-Fi?">
        <Muted>Each player's phone must be on the same Wi-Fi network as this phone, not a guest network next to it.</Muted>
      </Check>
      <Check title="Are they on mobile data?">
        <Muted>A phone on mobile data can't reach the game. Ask them to switch Wi-Fi on and join the same network.</Muted>
      </Check>
      <Check title="Still stuck? Make this phone's own network">
        <Muted>
          Some venue and guest Wi-Fi stops phones seeing each other. This phone can make a network just for the game: players scan
          one code to join it, then the game code. They're off the internet meanwhile; the game doesn't need it.
        </Muted>
        <Button label={busy ? 'Creating the network…' : 'Create a network for the game'} onPress={makeNetwork} disabled={busy} />
        {error && <ErrorText>{error}</ErrorText>}
        <Muted>If Android asks to allow nearby devices, say yes: it's needed to create the network.</Muted>
      </Check>
    </Screen>
  );
}

function Check({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: font.bodyBold, fontSize: text.lg, color: color.text },
  body: { gap: space[3] },
});
