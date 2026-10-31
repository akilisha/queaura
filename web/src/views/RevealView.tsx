import { Card } from '../components/Card';
import { ChoiceGrid } from '../components/ChoiceGrid';
import { PhaseHeader } from '../components/PhaseHeader';
import { RankedGuesses } from '../components/RankedGuesses';
import { ResultCard } from '../components/ResultCard';
import { formatNumber } from '../lib/format';
import * as store from '../state/store';
import { GameScreen } from './GameScreen';
import styles from './views.module.css';

/** Most rows the TV shows before "+ N more" (spec §7.3: the TV never scrolls). */
const TV_LIMIT = 15;

export function RevealView() {
  const g = store.game.value!;
  const q = g.question!;
  const r = g.reveal!;
  const isTv = store.mode.value === 'tv';
  const you = g.you;
  const closest = q.answerType === 'numeric';
  return (
    <GameScreen>
      <div class={isTv && closest ? styles.board : styles.column}>
        <Card fill={isTv}>
          <PhaseHeader round={g.round!.number} roundCount={g.round!.count} question={q.number} questionCount={g.round!.questionCount} />
          <p class={styles.question}>{q.text}</p>
          {closest ? (
            <div class={styles.centered}>
              <p class={styles.muted}>The answer</p>
              <p class={styles.headline}>{r.correctNumber !== null ? formatNumber(r.correctNumber) : '–'}</p>
            </div>
          ) : (
            <ChoiceGrid
              choices={q.choices}
              correctId={r.correctChoiceId}
              picked={you?.result?.value && 'choice' in you.result.value ? you.result.value.choice : null}
              counts={isTv ? r.choiceCounts : undefined}
            />
          )}
          {r.explanation && <p class={styles.explanation}>{r.explanation}</p>}
          {!isTv && you && <ResultCard result={you.result} scoring={g.scoring} />}
        </Card>
        {isTv && closest && (
          <Card title="Guesses" fill>
            <RankedGuesses entries={r.ranking} players={g.scores} limit={TV_LIMIT} />
          </Card>
        )}
      </div>
    </GameScreen>
  );
}
