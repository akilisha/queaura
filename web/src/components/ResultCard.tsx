import type { Result, Scoring } from '../../../protocol/src';
import styles from './ResultCard.module.css';

/** The player's own outcome in the reveal (spec §7.2). */
export function ResultCard({ result, scoring }: { result: Result | null | undefined; scoring?: Scoring }) {
  const { tone, headline } = describe(result);
  return (
    <div class={`${styles.card} ${styles[tone]}`}>
      <p class={styles.headline}>{headline}</p>
      {scoring !== 'none' && result?.answered && <p class={styles.points}>+{result.points}</p>}
    </div>
  );
}

function describe(result: Result | null | undefined): { tone: 'good' | 'bad' | 'neutral'; headline: string } {
  if (!result || !result.answered) return { tone: 'neutral', headline: 'No answer this time' };
  if (result.exact) return { tone: 'good', headline: 'Spot on!' };
  if (result.correct) return { tone: 'good', headline: 'Correct!' };
  if (result.bust) return { tone: 'bad', headline: 'Over the number' };
  return { tone: 'bad', headline: 'Not this time' };
}
