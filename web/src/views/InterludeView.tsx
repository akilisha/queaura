import { Card } from '../components/Card';
import { PhaseHeader } from '../components/PhaseHeader';
import { Seconds } from '../components/Seconds';
import { STYLE_INFO } from '../lib/styles';
import * as store from '../state/store';
import { GameScreen } from './GameScreen';
import styles from './views.module.css';

/** "Get ready" before the first round, and the intro card before each round. */
export function InterludeView() {
  const g = store.game.value!;
  const round = g.round!;
  const intro = g.phase === 'roundIntro';
  return (
    <GameScreen>
      <Card fill={store.mode.value === 'tv'}>
        <div class={styles.centered}>
          {intro ? (
            <>
              <PhaseHeader round={round.number} roundCount={round.count} />
              <p class={styles.headline}>{STYLE_INFO[round.style].name}</p>
              <p class={styles.lead}>{STYLE_INFO[round.style].howTo}</p>
            </>
          ) : (
            <>
              <p class={styles.headline}>{g.title}</p>
              <p class={styles.lead}>Get ready!</p>
            </>
          )}
          {g.remainingMs !== null && (
            <Seconds remainingMs={g.remainingMs} receivedAt={store.receivedAt.value} paused={g.paused} label={intro ? 'First question in' : 'Starting in'} />
          )}
        </div>
      </Card>
    </GameScreen>
  );
}
