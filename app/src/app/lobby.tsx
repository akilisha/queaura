import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { LanAddress } from '../../modules/game-server/src/GameServerModule';
import { PlayerList } from '../components/PlayerList';
import { Button, Card, ErrorText, Muted, Screen } from '../components/ui';
import { useLibrary } from '../data/library';
import { problemOf, resolveGame } from '../game/resolve';
import { connectHost, host, useHost } from '../host/connection';
import { ensureServer } from '../host/server';
import { closeSession } from '../host/session';
import { color, opacity, radius, size, space, text, weight } from '../theme';

/** Join code, players, and the game list (spec §5.4). */
export default function Lobby() {
  useKeepAwake();
  const { width } = useWindowDimensions();
  const wide = width >= size.wide;
  const { state, error } = useHost();
  const library = useLibrary();
  const [addresses, setAddresses] = useState<LanAddress[]>([]);
  const [port, setPort] = useState(8080);
  const [chosenIp, setChosenIp] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  useEffect(() => {
    ensureServer()
      .then((status) => {
        setAddresses(status.addresses);
        setPort(status.httpPort);
        connectHost(status.wsPort, status.hostKey!);
      })
      .catch((e: Error) => setStartError(e.message));
  }, []);

  // Once a game is running the host screen takes over.
  useEffect(() => {
    if (state && state.phase !== 'lobby' && state.phase !== 'ended') router.replace('/game');
  }, [state?.phase]);

  const formats = useMemo(
    () => library.games.map((g) => ({ format: g, problem: problemOf(g, library.byId) })),
    [library],
  );
  const chosen = formats.find((f) => f.format.id === gameId && !f.problem);
  const players = state?.scores ?? [];
  const address = addresses.find((a) => a.ip === chosenIp) ?? addresses[0];
  const base = address ? `http://${address.ip}:${port}` : null;
  const startBlocker = !chosen ? 'Pick a game below' : players.length === 0 ? 'Waiting for players to join' : null;

  const start = () => {
    if (!chosen) return;
    host.start(resolveGame(chosen.format, library.byId));
  };

  const endSession = () => {
    host.endSession();
    closeSession();
  };

  const join = (
    <Card title="Players join here">
      {startError && <ErrorText>{startError}</ErrorText>}
      {!startError && !base && <Muted>Starting the game server…</Muted>}
      {base && (
        <>
          <View style={styles.qr}>
            <QRCode value={`${base}/`} size={size.qr} color={color.qrDark} backgroundColor={color.qrLight} />
          </View>
          <Text style={styles.url}>{base}</Text>
          <Muted>On a TV, open this in the browser to show the game to the room:</Muted>
          <Text style={styles.tvUrl}>{`${base}/?mode=tv`}</Text>
          {addresses.length > 1 && (
            <View style={styles.networks}>
              <Muted>This phone is on more than one network. Players must be on the same one:</Muted>
              {addresses.map((a) => (
                <Button
                  key={a.ip}
                  tone={a.ip === address?.ip ? 'primary' : 'secondary'}
                  label={`${a.kind === 'hotspot' ? 'Hotspot' : a.kind === 'wifi' ? 'Wi-Fi' : a.name} · ${a.ip}`}
                  onPress={() => setChosenIp(a.ip)}
                />
              ))}
            </View>
          )}
        </>
      )}
    </Card>
  );

  const pick = (
    <>
      <Card title={`Players (${players.filter((p) => p.online).length})`}>
        <PlayerList players={players} onKick={(p) => host.kick(p.id)} />
      </Card>
      <Card title="Choose a game">
        {formats.map(({ format, problem }) => (
          <Pressable
            key={format.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: format.id === gameId, disabled: !!problem }}
            disabled={!!problem}
            onPress={() => setGameId(format.id)}
            style={[styles.game, format.id === gameId && styles.gameChosen, !!problem && styles.gameDisabled]}
          >
            <Text style={styles.gameTitle}>{format.title}</Text>
            <Muted>
              {problem ?? `${format.rounds.length} ${format.rounds.length === 1 ? 'round' : 'rounds'}, ${format.rounds.reduce((n, r) => n + r.slots.length, 0)} questions`}
            </Muted>
          </Pressable>
        ))}
        {error && <ErrorText>{error}</ErrorText>}
        <Button big label="Start" onPress={start} disabled={!!startBlocker} />
        {startBlocker && <Muted>{startBlocker}</Muted>}
      </Card>
      <Button tone="secondary" label="End session" onPress={endSession} />
    </>
  );

  return (
    <Screen>
      {wide ? (
        <View style={styles.columns}>
          <View style={styles.column}>{join}</View>
          <View style={styles.column}>{pick}</View>
        </View>
      ) : (
        <>
          {join}
          {pick}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: space[4], alignItems: 'flex-start' },
  column: { flex: 1, gap: space[4] },
  qr: { alignItems: 'center', padding: space[3], backgroundColor: color.qrLight, borderRadius: radius.md },
  url: { fontSize: text.xl, fontWeight: weight.bold, color: color.text, textAlign: 'center' },
  tvUrl: { fontSize: text.lg, fontWeight: weight.semibold, color: color.text, textAlign: 'center' },
  networks: { gap: space[2] },
  game: { padding: space[3], borderRadius: radius.md, borderWidth: size.borderWidth, borderColor: color.border, gap: space[1] },
  gameChosen: { borderColor: color.primary, backgroundColor: color.surfaceRaised },
  gameDisabled: { opacity: opacity.disabled },
  gameTitle: { fontSize: text.lg, fontWeight: weight.semibold, color: color.text },
});
