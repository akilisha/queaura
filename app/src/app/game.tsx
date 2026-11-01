import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { GameState, Phase, ScoreEntry } from '../../../protocol/src';
import { useConfirm } from '../components/ConfirmDialog';
import { PendingResults } from '../components/PendingResults';
import { PlayerList } from '../components/PlayerList';
import { STYLES } from '../game/copy';
import { Body, Button, Card, ErrorText, Heading, Muted, Screen } from '../components/ui';
import { host, useHost } from '../host/connection';
import { closeSession } from '../host/session';
import { usePendingResults } from '../results/store';
import { useSeconds } from '../host/useSeconds';
import { color, font, glow, radius, size, space, text, tracking } from '../theme';

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
  questionnaire: 'Questionnaire open',
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
  const pending = usePendingResults();

  const confirmStop = () =>
    confirm({ title: 'Stop the game?', message: 'Everyone goes to the final scores now.', confirmLabel: 'Stop', cancelLabel: 'Keep playing', danger: true, onConfirm: host.stop });
  const confirmEndQuestionnaire = () =>
    confirm({
      title: 'End the questionnaire?',
      message: "Players can't change their answers after this. Everything answered so far is kept, and next you choose to save or discard it.",
      confirmLabel: 'End questionnaire',
      cancelLabel: 'Keep it open',
      danger: true,
      onConfirm: host.stop,
    });
  const confirmEnd = () =>
    confirm({ title: 'End the session?', message: 'Players see "Thanks for playing" and the game closes.', confirmLabel: 'End session', danger: true, onConfirm: host.endSession });
  const confirmRemove = (p: ScoreEntry) =>
    confirm({ title: `Remove ${p.name}?`, message: 'They will not be able to rejoin this session.', confirmLabel: 'Remove', danger: true, onConfirm: () => host.kick(p.id) });

  useEffect(() => {
    if (state?.phase === 'lobby') router.replace('/lobby');
    if (state?.phase === 'ended') closeSession();
  }, [state?.phase]);

  if (!state) return <Screen><Muted>Connecting to the game…</Muted></Screen>;
  if (state.progression === 'manual') {
    return (
      <Questionnaire
        state={state}
        wide={wide}
        connected={connected}
        error={error}
        seconds={seconds}
        resolved={pending.length === 0}
        onEnd={confirmEndQuestionnaire}
        onEndSession={confirmEnd}
        onRemove={confirmRemove}
        dialog={dialog}
      />
    );
  }

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

/**
 * A running questionnaire (spec §6.4): no clock, so the host sees who is where and ends it when
 * ready; then saves or discards the answers before anything else.
 */
function Questionnaire(props: {
  state: GameState;
  wide: boolean;
  connected: boolean;
  error: string | null;
  seconds: number | null;
  resolved: boolean;
  onEnd: () => void;
  onEndSession: () => void;
  onRemove: (p: ScoreEntry) => void;
  dialog: ReactNode;
}) {
  const { state, wide, seconds } = props;
  const open = state.phase === 'questionnaire';
  const count = state.questionnaire?.count ?? state.round?.questionCount ?? 0;
  const positions = state.host?.progress ?? {};
  const finished = state.scores.filter((p) => (positions[p.id] ?? 0) >= count).length;

  const now = (
    <Card>
      <Text style={styles.phase}>{open ? 'Questionnaire open' : 'Questionnaire ended'}</Text>
      <Muted>{state.title}</Muted>
      {open && <Text style={styles.tally}>{finished} of {state.scores.length} finished</Text>}
      {!props.connected && <ErrorText>Reconnecting to the game server…</ErrorText>}
      {props.error && <ErrorText>{props.error}</ErrorText>}
      {open && (
        <>
          <Body>Everyone answers at their own pace and can go back to change answers until you end it. Each answer is saved on this phone as it comes in.</Body>
          <Button tone="danger" label="End questionnaire" onPress={props.onEnd} />
        </>
      )}
    </Card>
  );

  // Saving or discarding comes first; the usual end-of-game choices follow.
  const after = open ? null : !props.resolved ? (
    <PendingResults />
  ) : (
    <Card title="What next?">
      <Body>Play another game with the same players?</Body>
      <Button big label="Play another" onPress={host.playAnother} />
      <Button tone="secondary" label="End session" onPress={props.onEndSession} />
      {seconds !== null && <Muted>The session ends by itself in {seconds} s.</Muted>}
    </Card>
  );

  const players = (
    <Card title="Players">
      <PlayerList
        players={state.scores}
        status={{
          header: 'Progress',
          of: (p) => {
            const at = positions[p.id] ?? 0;
            return at >= count ? 'Finished' : `${at + 1} of ${count}`;
          },
        }}
        onRemoveRequest={open ? props.onRemove : undefined}
      />
    </Card>
  );

  return (
    <Screen>
      {props.dialog}
      {wide ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {now}
            {after}
          </View>
          <View style={styles.column}>{players}</View>
        </View>
      ) : (
        <>
          {now}
          {after}
          {players}
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
  phase: { fontFamily: font.display, fontSize: text.xl, textTransform: 'uppercase', letterSpacing: tracking.caps, color: color.text },
  tally: { fontFamily: font.sign, fontSize: text.xxl, color: color.gold, ...glow.softGoldText },
  seconds: { fontFamily: font.display, fontSize: text.xxl, color: color.gold, fontVariant: ['tabular-nums'], ...glow.softGoldText },
  question: { gap: space[3] },
  answer: { padding: space[3], borderRadius: radius.md, backgroundColor: color.surfaceRaised, gap: space[1] },
  answerText: { fontFamily: font.display, fontSize: text.xl, color: color.success },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  control: { flexGrow: 1, flexBasis: size.controlMin },
});
