import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from '../ai/Store';
import { describeBalance } from '../ai/api';
import { useBalance } from '../ai/useBalance';
import { Body, Button, Card, ErrorText, Muted, Screen } from '../components/ui';
import { color, font, space, text } from '../theme';

/** Buying AI games through Google Play (spec §8). Prices come from Google, in the host's currency. */
export default function GetAiGames() {
  const store = useStore();
  const { balance } = useBalance();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (id: string) => {
    setError(null);
    setBusy(id);
    try {
      await store!.buy(id);
    } catch (e) {
      // Cancelling Google's sheet isn't an error worth showing.
      const message = e instanceof Error ? e.message : String(e);
      if (!/cancel/i.test(message)) setError(`The purchase didn't go through: ${message}`);
    } finally {
      setBusy(null);
    }
  };

  const status = store?.outcome?.status;
  return (
    <Screen form>
      <Card title="Get more AI games">
        <Body>One AI game is {balance?.questionsPerAiGame ?? 50} questions written by AI, enough for a whole quiz night with room to swap some out. They never expire.</Body>
        {balance && <Muted>You have {describeBalance(balance)}.</Muted>}
      </Card>
      {!store?.connected ? (
        <Card>
          <Body>Google Play isn't available here. Purchases work in the version of QueAura installed from Google Play, with this phone online.</Body>
        </Card>
      ) : store.products.length === 0 ? (
        <Muted>Getting the packs from Google Play…</Muted>
      ) : (
        store.products.map((p) => (
          <Card key={p.id}>
            <View style={styles.row}>
              <View style={styles.what}>
                <Text style={styles.name}>{p.title}</Text>
                {p.description ? <Muted>{p.description}</Muted> : null}
              </View>
              <Text style={styles.price}>{p.displayPrice}</Text>
            </View>
            <Button label={busy === p.id ? 'Opening Google Play…' : 'Buy'} disabled={busy !== null} onPress={() => buy(p.id)} />
          </Card>
        ))
      )}
      {status?.status === 'entitled' && (
        <Card>
          <Body>Thanks! Your AI games have been added.</Body>
          <Button big label="Done" onPress={() => router.back()} />
        </Card>
      )}
      {status?.status === 'store_pending' && <Muted>Your payment is pending. The AI games are added as soon as Google Play confirms it, even if you close the app.</Muted>}
      {(status?.status === 'failed' || status?.status === 'verification_delayed') && (
        <Muted>Your purchase is safe, but it couldn't be confirmed just now. QueAura will try again automatically, including the next time you open it.</Muted>
      )}
      {status?.status === 'invalid' && <ErrorText>Google Play couldn't confirm that purchase, so nothing was added. If you were charged, Google refunds it automatically.</ErrorText>}
      {status?.status === 'ownership_conflict' && <ErrorText>That purchase belongs to a different QueAura account. Sign in with the account that bought it.</ErrorText>}
      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  what: { flex: 1, gap: space[1] },
  name: { fontSize: text.lg, fontFamily: font.bodyBold, color: color.text },
  price: { fontSize: text.xl, fontFamily: font.display, color: color.gold },
});
