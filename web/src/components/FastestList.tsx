import type { Reveal, ScoreEntry } from '../../../protocol/src';
import styles from './FastestList.module.css';

interface Props {
  entries: Reveal['ranking'];
  players: ScoreEntry[];
  limit?: number;
}

/** Fastest finger reveal: the right answers in the order they landed, with their points. */
export function FastestList({ entries, players, limit }: Props) {
  const winners = entries.filter((e) => e.correct);
  if (winners.length === 0) return <p class={styles.empty}>Nobody got it this time</p>;
  const byId = new Map(players.map((p) => [p.id, p]));
  const shown = limit !== undefined && winners.length > limit ? winners.slice(0, limit - 1) : winners;
  const more = winners.length - shown.length;
  return (
    <ol class={styles.list}>
      {shown.map((e, i) => {
        const p = byId.get(e.playerId);
        return (
          <li key={e.playerId} class={`${styles.row} ${i === 0 ? styles.first : ''}`}>
            <span class={styles.place}>{i + 1}</span>
            <span class={styles.emoji} aria-hidden="true">{p?.emoji}</span>
            <span class={styles.name}>{p?.name ?? 'Gone'}</span>
            <span class={styles.points}>+{e.points}</span>
          </li>
        );
      })}
      {more > 0 && <li class={`${styles.row} ${styles.more}`}>+ {more} more</li>}
    </ol>
  );
}
