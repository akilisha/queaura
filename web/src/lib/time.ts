/**
 * Countdown math. The server sends "time left" with each state; the phone measures how long ago
 * that arrived on its own stopwatch (performance.now). No clock sync is needed.
 */

/** Time left in the phase now, given what the server said and when it arrived. */
export function remaining(remainingMs: number, receivedAt: number, now: number, paused: boolean): number {
  if (paused) return remainingMs;
  return Math.max(0, remainingMs - (now - receivedAt));
}

/**
 * A question's phase time is the reading buffer followed by the answer window. During reading the
 * bar stays full; then it drains over the answer window (spec §6.2).
 */
export function answerFraction(phaseRemainingMs: number, answerMs: number): number {
  if (answerMs <= 0) return 0;
  return Math.min(1, Math.max(0, phaseRemainingMs / answerMs));
}

/** Whole seconds to show, rounding up so "1" stays on screen until the very end. */
export function seconds(ms: number): number {
  return Math.ceil(ms / 1000);
}
