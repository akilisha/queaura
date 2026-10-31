import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { GameState, Phase, ScoreEntry } from '../../../protocol/src';
import { useConfirm } from '../components/ConfirmDialog';
import { PlayerList } from '../components/PlayerList';
import { STYLES } from '../game/copy';
import { Body, Button, Card, ErrorText, Heading, Muted, Screen } from '../components/ui';
import { host, useHost } from '../host/connection';
import { closeSession } from '../host/session';
import { useSeconds } from '../host/useSeconds';
import { color, radius, size, space, text, weight } from '../theme';

const PHASE_LABEL: Record<Phase, string> = {
  lobby: 'Lobby',
  gameStarting: 'Get ready',
  roundIntro: 'Round intro',
  question: 'Question open',
  timesUp: "Time's up",
  reveal: 'Showing the answer',
  roundScores: 'Round scores',
  roundBreak: 'Break before the next round',
  finalScores: 'Final scores',
  ended: 'Session ended',
};


/** The in-game host screen (spec §5.5) and the end of game (§5.6). The screen stays on (§5.5). */
export default function Game() {
  useKeepAwake();
  const { width } = useWindowDimensions();
  const wide = width >= size.wide;
  const { state, receivedAt, error, connected } = useHost();
  const seconds = useSeconds(state?.remainingMs, receivedAt, state?.paused ?? false);
  const [dialog, confirm] = useConfirm();

  const confirmStop = () =>
    confirm({ title: 'Stop the game?', message: 'Everyone goes to the final scores now.', confirmLabel: 'Stop', cancelLabel: 'Keep playing', danger: true, onConfirm: host.stop });
  const confirmEnd = () =>
    confirm({ title: 'End the session?', message: 'Players see "Thanks for playing" and the game closes.', confirmLabel: 'End session', danger: true, onConfirm: host.endSession });
  const confirmRemove = (p: ScoreEntry) =>
    confirm({ title: `Remove ${p.name}?`, message: 'They will not be able to rejoin this session.', confirmLabel: 'Remove', danger: true, onConfirm: () => host.kick(p.id) });

  useEffect(() => {
    if (state?.phase === 'lobby') router.replace('/lobby');
    if (state?.phase === 'ended') closeSession();
  }, [state?.phase]);

  if (!state) return <Screen><Muted>Connecting to the game…</Muted></Screen>;

  const final = state.phase === 'finalScores';
  const controls = final ? (
    <Card title={state.stopped ? 'Game stopped' : 'Game over'}>
      <Body>Play another game with the same players?</Body>
      <Button big label="Play another" onPress={host.playAnother} />
      <Button tone="secondary" label="End session" onPress={confirmEnd} />
      {seconds !== null && <Muted>The session ends by itself in {seconds} s.</Muted>}
    </Card>
  ) : (
    <Card>
      <View style={styles.controls}>
        <View style={styles.control}>
          <Button label={state.paused ? 'Resume' : 'Pause'} onPress={state.paused ? host.resume : host.pause} />
        </View>
        <View style={styles.control}>
          <Button tone="secondary" label="Skip question" onPress={host.skip} disabled={state.phase !== 'question'} />
        </View>
        <View style={styles.control}>
          <Button tone="danger" label="Stop game" onPress={confirmStop} />
        </View>
      </View>
    </Card>
  );

  const now = (
    <Card>
      <View style={styles.status}>
        <Text style={styles.phase}>{state.paused ? 'Paused' : PHASE_LABEL[state.phase]}</Text>
        {seconds !== null && <Text style={styles.seconds}>{seconds}</Text>}
      </View>
      {state.round && (
        <Muted>
          {state.title} · Round {state.round.number} of {state.round.count} ({STYLES[state.round.style].name})
          {state.question ? ` · Question ${state.question.number} of ${state.round.questionCount}` : ''}
        </Muted>
      )}
      {!connected && <ErrorText>Reconnecting to the game server…</ErrorText>}
      {error && <ErrorText>{error}</ErrorText>}
      {state.question && <QuestionPanel state={state} />}
    </Card>
  );

  const scores = (
    <Card title="Scores">
      <PlayerList
        players={state.scores}
        columns={['lastPoints', 'roundPoints', 'total']}
        answeredIds={state.phase === 'question' ? state.host?.answeredIds : undefined}
        onRemoveRequest={final ? undefined : confirmRemove}
      />
    </Card>
  );

  return (
    <Screen>
      {dialog}
      {wide ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {now}
            {controls}
          </View>
          <View style={styles.column}>{scores}</View>
        </View>
      ) : (
        <>
          {now}
          {controls}
          {scores}
        </>
      )}
    </Screen>
  );
}

/** The question with its correct answer, which only the host sees while it is open. */
function QuestionPanel({ state }: { state: GameState }) {
  const q = state.question!;
  const correct =
    q.answerType === 'numeric'
      ? String(state.host?.correctNumber ?? state.reveal?.correctNumber ?? '–')
      : q.choices.find((c) => c.id === (state.host?.correctChoiceId ?? state.reveal?.correctChoiceId))?.text ?? '–';
  return (
    <View style={styles.question}>
      <Heading>{q.text}</Heading>
      <View style={styles.answer}>
        <Muted>Answer</Muted>
        <Text style={styles.answerText}>{correct}</Text>
      </View>
      {state.host?.explanation && <Muted>{state.host.explanation}</Muted>}
      {state.phase === 'question' && (
        <Body>
          {state.answeredCount} of {state.eligibleCount} answered
        </Body>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: space[4], alignItems: 'flex-start' },
  column: { flex: 1, gap: space[4] },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  phase: { fontSize: text.lg, fontWeight: weight.bold, color: color.text },
  seconds: { fontSize: text.xxl, fontWeight: weight.bold, color: color.accent, fontVariant: ['tabular-nums'] },
  question: { gap: space[3] },
  answer: { padding: space[3], borderRadius: radius.md, backgroundColor: color.surfaceRaised, gap: space[1] },
  answerText: { fontSize: text.xl, fontWeight: weight.bold, color: color.success },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  control: { flexGrow: 1, flexBasis: size.controlMin },
});
