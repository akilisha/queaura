import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useConfirm } from '../components/ConfirmDialog';
import { JoinPanel } from '../components/JoinPanel';
import { PlayerList } from '../components/PlayerList';
import { Button, Card, ErrorText, Muted, Screen } from '../components/ui';
import { useLibrary } from '../data/library';
import { sizeOf } from '../game/format';
import { problemOf, resolveGame } from '../game/resolve';
import { connectHost, host, useHost } from '../host/connection';
import { endNetwork } from '../host/hotspot';
import { joinPath } from '../host/network';
import { ensureServer } from '../host/server';
import { closeSession } from '../host/session';
import { useNetwork } from '../host/useNetwork';
import { color, font, glow, opacity, radius, size, space, text } from '../theme';

/** Join code, players, and the game list (spec §5.4). */
const NOBODY_YET_MS = 60_000;

export default function Lobby() {
  useKeepAwake();
  const { width } = useWindowDimensions();
  const wide = width >= size.wide;
  const { state, error } = useHost();
  const library = useLibrary();
  const [running, setRunning] = useState(false);
  const [port, setPort] = useState(8080);
  const [nobodyYet, setNobodyYet] = useState(false);
  const [chosenIp, setChosenIp] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [dialog, confirm] = useConfirm();

  useEffect(() => {
    ensureServer()
      .then((status) => {
        setRunning(true);
        setPort(status.httpPort);
        connectHost(status.wsPort, status.hostKey!);
      })
      .catch((e: Error) => setStartError(e.message));
  }, []);

  const { addresses, hotspot } = useNetwork(running);
  const players = state?.scores ?? [];

  // A minute with the code up and nobody in: make "Players can't join?" hard to miss.
  useEffect(() => {
    if (!running || players.length > 0) {
      setNobodyYet(false);
      return;
    }
    const timer = setTimeout(() => setNobodyYet(true), NOBODY_YET_MS);
    return () => clearTimeout(timer);
  }, [running, players.length]);

  // Once a game is running the host screen takes over.
  useEffect(() => {
    if (state && state.phase !== 'lobby' && state.phase !== 'ended') router.replace('/game');
  }, [state?.phase]);

  const formats = useMemo(
    () => library.games.map((g) => ({ format: g, problem: problemOf(g, library.byId) })),
    [library],
  );
  const chosen = formats.find((f) => f.format.id === gameId && !f.problem);
  const startBlocker = !chosen ? 'Pick a game below' : players.length === 0 ? 'Waiting for players to join' : null;

  const start = () => {
    if (!chosen) return;
    host.start(resolveGame(chosen.format, library.byId));
  };

  const endSession = () => {
    host.endSession();
    closeSession();
  };

  const join = startError ? (
    <Card title="Players join here">
      <ErrorText>{startError}</ErrorText>
    </Card>
  ) : !running ? (
    <Card title="Players join here">
      <Muted>Starting the game server…</Muted>
    </Card>
  ) : (
    <JoinPanel
      path={joinPath(addresses, hotspot, chosenIp)}
      port={port}
      addresses={addresses}
      onChooseAddress={setChosenIp}
      onHelp={() => router.push('/join-help')}
      onEndNetwork={endNetwork}
      nobodyYet={nobodyYet}
    />
  );

  const pick = (
    <>
      <Card title={`Players (${players.filter((p) => p.online).length})`}>
        <PlayerList
          players={players}
          onRemoveRequest={(p) =>
            confirm({ title: `Remove ${p.name}?`, message: 'They will not be able to rejoin this session.', confirmLabel: 'Remove', danger: true, onConfirm: () => host.kick(p.id) })
          }
        />
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
              {problem ?? sizeOf(format)}
            </Muted>
          </Pressable>
        ))}
        {error && <ErrorText>{error}</ErrorText>}
        <Button big label="Start" onPress={start} disabled={!!startBlocker} />
        {startBlocker && <Muted>{startBlocker}</Muted>}
      </Card>
      <Button
        tone="secondary"
        label="End session"
        onPress={() =>
          confirm({ title: 'End the session?', message: 'Players see "Thanks for playing" and the lobby closes.', confirmLabel: 'End session', danger: true, onConfirm: endSession })
        }
      />
    </>
  );

  return (
    <Screen>
      {dialog}
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
  game: { padding: space[3], borderRadius: radius.md, borderWidth: size.borderStrong, borderColor: color.border, gap: space[1] },
  gameChosen: { borderColor: color.gold, backgroundColor: color.surfaceRaised, ...glow.gold },
  gameDisabled: { opacity: opacity.disabled },
  gameTitle: { fontSize: text.lg, fontFamily: font.bodySemi, color: color.text },
});
