import { useEffect, useState } from 'preact/hooks';
import { answerFraction, remaining, seconds } from '../lib/time';
import styles from './Countdown.module.css';

interface Props {
  /** Phase time left when the state arrived (reading buffer + answer window). */
  remainingMs: number;
  receivedAt: number;
  /** Length of the answer window; the bar stays full until only this much is left. */
  answerMs: number;
  paused: boolean;
}

/** The question countdown: full during the reading buffer, then draining (spec §6.2). Cosmetic only. */
export function Countdown({ remainingMs, receivedAt, answerMs, paused }: Props) {
  const now = useNow(!paused);
  const left = remaining(remainingMs, receivedAt, now, paused);
  const fraction = answerFraction(left, answerMs);
  const reading = left > answerMs;
  return (
    <div class={styles.countdown} role="timer" aria-live="off">
      <div class={styles.track}>
        <div class={`${styles.fill} ${fraction <= 0.25 ? styles.low : ''}`} style={{ transform: `scaleX(${fraction})` }} />
      </div>
      <span class={styles.seconds}>{reading ? '' : seconds(Math.min(left, answerMs))}</span>
    </div>
  );
}

/** Re-renders every animation frame while [running]; returns the current stopwatch time. */
export function useNow(running: boolean): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = () => {
      setNow(performance.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
  return now;
}
