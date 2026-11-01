import { useState } from 'preact/hooks';
import type { AnswerValue, Choice, GameState } from '../../../protocol/src';
import { Banner } from '../components/Banner';
import { Card } from '../components/Card';
import { ChoiceGrid } from '../components/ChoiceGrid';
import { Countdown } from '../components/Countdown';
import { Keypad } from '../components/Keypad';
import { PhaseHeader } from '../components/PhaseHeader';
import { formatNumber } from '../lib/format';
import { answerChoice, answerNumber } from '../state/actions';
import * as store from '../state/store';
import { GameScreen } from './GameScreen';
import styles from './views.module.css';

/** The question with its countdown; players also get their input, the TV the answered count. */
export function QuestionView() {
  const g = store.game.value!;
  const q = g.question!;
  const isTv = store.mode.value === 'tv';
  const timesUp = g.phase === 'timesUp';
  return (
    <GameScreen>
      <Card fill={isTv}>
        <PhaseHeader round={g.round!.number} roundCount={g.round!.count} question={q.number} questionCount={g.round!.questionCount} />
        <p class={styles.question}>{q.text}</p>
        {timesUp ? (
          <p class={styles.headline}>Time's up!</p>
        ) : (
          g.remainingMs !== null && (
            <Countdown remainingMs={g.remainingMs} receivedAt={store.receivedAt.value} answerMs={q.answerMs} paused={g.paused} />
          )
        )}
        {isTv ? <TvAnswers state={g} /> : <PlayerAnswer key={q.seq} state={g} timesUp={timesUp} />}
      </Card>
    </GameScreen>
  );
}

function TvAnswers({ state }: { state: GameState }) {
  return (
    <>
      {state.question!.answerType === 'multipleChoice' && <ChoiceGrid choices={state.question!.choices} />}
      <p class={styles.muted}>
        {state.answeredCount} of {state.eligibleCount} answered
      </p>
    </>
  );
}

function PlayerAnswer({ state, timesUp }: { state: GameState; timesUp: boolean }) {
  const [entry, setEntry] = useState('');
  const q = state.question!;
  const you = state.you;
  if (!you) return null;
  if (you.waitingForNextQuestion) return <Banner tone="info">You joined during this question. You'll play from the next one.</Banner>;
  if (you.answer) return <LockedIn answer={you.answer} choices={q.choices} />;
  if (timesUp) return <Banner tone="info">No answer this time</Banner>;
  const disabled = !you.canAnswer;
  return q.answerType === 'multipleChoice' ? (
    <ChoiceGrid choices={q.choices} onPick={answerChoice} disabled={disabled} />
  ) : (
    <Keypad value={entry} onChange={setEntry} onSubmit={answerNumber} disabled={disabled} />
  );
}

function LockedIn({ answer, choices }: { answer: AnswerValue; choices: Choice[] }) {
  if ('choice' in answer) return <ChoiceGrid choices={choices} picked={answer.choice} />;
  return (
    <div class={styles.centered}>
      <p class={styles.muted}>Locked in</p>
      <p class={styles.headline}>{'number' in answer ? formatNumber(answer.number) : answer.text}</p>
    </div>
  );
}
