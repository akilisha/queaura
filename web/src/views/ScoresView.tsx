import { Card } from '../components/Card';
import { ScoreList } from '../components/ScoreList';
import { Seconds } from '../components/Seconds';
import { ordinal } from '../lib/format';
import * as store from '../state/store';
import { GameScreen } from './GameScreen';
import styles from './views.module.css';

const TV_LIMIT = 15;

/** Round scores, the break before the next round, and the final scores. */
export function ScoresView() {
  const g = store.game.value!;
  const isTv = store.mode.value === 'tv';
  const me = store.you.value;
  const final = g.phase === 'finalScores';
  const roundOnly = g.phase === 'roundScores';
  const questionnaire = g.progression === 'manual';
  const title = questionnaire ? 'Thanks! Your answers are in' : final ? (g.stopped ? 'Game stopped: final scores' : 'Final scores') : roundOnly ? `Round ${g.round!.number} scores` : 'Scores so far';
  const place = me ? g.scores.findIndex((p) => p.id === me.id) + 1 : 0;

  return (
    <GameScreen>
      <div class={styles.column}>
        <Card>
          <p class={styles.headline}>{title}</p>
          {!isTv && me && final && !questionnaire && (
            <p class={styles.lead}>
              You finished {ordinal(place)} with {me.total} points
            </p>
          )}
          {g.phase === 'roundBreak' && g.remainingMs !== null && (
            <Seconds remainingMs={g.remainingMs} receivedAt={store.receivedAt.value} paused={g.paused} label="Next round in" />
          )}
          {/* The play-another window (spec §5.6): say what happens and when, so nobody feels stuck. */}
          {final && g.remainingMs !== null && (
            <>
              <Seconds remainingMs={g.remainingMs} receivedAt={store.receivedAt.value} paused={false} label="Another game, or lights out, in" />
              <p class={styles.muted}>Stay for another round with the same players, or you're free to go.</p>
            </>
          )}
        </Card>
        {!questionnaire && (
          <Card fill={isTv}>
            <ScoreList
              players={g.scores}
              highlightId={me?.id}
              metric={roundOnly ? 'roundPoints' : 'total'}
              ranked
              limit={isTv ? TV_LIMIT : undefined}
            />
          </Card>
        )}
      </div>
    </GameScreen>
  );
}
