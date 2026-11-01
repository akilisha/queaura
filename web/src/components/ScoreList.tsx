import type { ScoreEntry } from '../../../protocol/src';
import styles from './ScoreList.module.css';

interface Props {
  players: ScoreEntry[];
  highlightId?: number | null;
  /** Which number to show beside each name; the lobby shows none. */
  metric?: 'total' | 'roundPoints' | 'none';
  /** Show only the first N, then "+ M more" (big rooms on the TV). */
  limit?: number;
  ranked?: boolean;
}

export function ScoreList({ players, highlightId, metric = 'total', limit, ranked = false }: Props) {
  if (players.length === 0) return <p class={styles.empty}>No players yet</p>;
  const sorted = metric === 'roundPoints' ? [...players].sort((a, b) => b.roundPoints - a.roundPoints || a.id - b.id) : players;
  const shown = limit !== undefined && sorted.length > limit ? sorted.slice(0, limit - 1) : sorted;
  const more = sorted.length - shown.length;
  return (
    <ol class={`${styles.list} ${ranked ? styles.ranked : ''}`}>
      {shown.map((p, i) => (
        <li key={p.id} class={`${styles.row} ${p.id === highlightId ? styles.mine : ''} ${p.online ? '' : styles.offline}`}>
          {ranked && <span class={styles.rank}>{i + 1}</span>}
          <span class={styles.emoji} aria-hidden="true">{p.emoji}</span>
          <span class={styles.name}>{p.name}</span>
          {metric !== 'none' && <span class={styles.score}>{metric === 'total' ? p.total : p.roundPoints}</span>}
        </li>
      ))}
      {more > 0 && <li class={`${styles.row} ${styles.more}`}>+ {more} more</li>}
    </ol>
  );
}
