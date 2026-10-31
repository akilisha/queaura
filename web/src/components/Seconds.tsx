import { remaining, seconds } from '../lib/time';
import { useNow } from './Countdown';
import styles from './Seconds.module.css';

interface Props {
  remainingMs: number;
  receivedAt: number;
  paused: boolean;
  label: string;
}

/** "Next round in 12" style countdown for phases that just wait. */
export function Seconds({ remainingMs, receivedAt, paused, label }: Props) {
  const now = useNow(!paused);
  return (
    <p class={styles.seconds}>
      {label} <span class={styles.value}>{seconds(remaining(remainingMs, receivedAt, now, paused))}</span>
    </p>
  );
}
