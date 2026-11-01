import type { Choice } from '../../../protocol/src';
import { ChoiceShape } from './ChoiceShape';
import styles from './ChoiceGrid.module.css';

interface Props {
  choices: Choice[];
  /** Players tap; the TV passes nothing and the tiles are not buttons. */
  onPick?: (id: string) => void;
  picked?: string | null;
  /** In the reveal: the right choice is marked, others dimmed. */
  correctId?: string | null;
  /** In the reveal on the TV: how many picked each choice. */
  counts?: Record<string, number>;
  disabled?: boolean;
}

export function ChoiceGrid({ choices, onPick, picked, correctId, counts, disabled }: Props) {
  return (
    <ul class={styles.grid}>
      {choices.map((choice, i) => {
        const state =
          correctId != null ? (choice.id === correctId ? styles.correct : styles.dimmed) : picked && picked !== choice.id ? styles.dimmed : '';
        const content = (
          <>
            <ChoiceShape index={i} class={styles.shape} />
            <span class={styles.text}>{choice.text}</span>
            {counts && <span class={styles.count}>{counts[choice.id] ?? 0}</span>}
            {picked === choice.id && <span class={styles.mark} aria-label="Your answer">✓</span>}
          </>
        );
        return (
          <li key={choice.id} class={`${styles.choice} ${styles[`c${(i % 4) + 1}`]} ${state}`}>
            {onPick ? (
              <button type="button" class={styles.button} disabled={disabled} onClick={() => onPick(choice.id)}>
                {content}
              </button>
            ) : (
              <div class={styles.tile}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
