import type { Reveal, ScoreEntry } from '../../../protocol/src';
import { formatNumber } from '../lib/format';
import styles from './RankedGuesses.module.css';

interface Props {
  entries: Reveal['ranking'];
  players: ScoreEntry[];
  limit?: number;
}

/** The room reveal for closest guesses: every guess ranked, busts marked (spec §7.3). */
export function RankedGuesses({ entries, players, limit }: Props) {
  if (entries.length === 0) return <p class={styles.empty}>Nobody guessed</p>;
  const byId = new Map(players.map((p) => [p.id, p]));
  const shown = limit !== undefined && entries.length > limit ? entries.slice(0, limit - 1) : entries;
  const more = entries.length - shown.length;
  return (
    <ol class={styles.list}>
      {shown.map((e) => {
        const p = byId.get(e.playerId);
        const guess = e.value && 'number' in e.value ? formatNumber(e.value.number) : '–';
        return (
          <li key={e.playerId} class={`${styles.row} ${e.correct ? styles.winner : ''} ${e.bust ? styles.bust : ''}`}>
            <span class={styles.emoji} aria-hidden="true">{p?.emoji}</span>
            <span class={styles.name}>{p?.name ?? 'Gone'}</span>
            <span class={styles.guess}>{guess}</span>
            {e.bust && <span class={styles.tag}>over</span>}
          </li>
        );
      })}
      {more > 0 && <li class={`${styles.row} ${styles.more}`}>+ {more} more</li>}
    </ol>
  );
}
