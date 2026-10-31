import { useEffect, useState } from 'react';

/** Whole seconds left in a phase, counted on this device from when the state arrived. */
export function useSeconds(remainingMs: number | null | undefined, receivedAt: number, paused: boolean): number | null {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (remainingMs == null || paused) return;
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(timer);
  }, [remainingMs, receivedAt, paused]);
  if (remainingMs == null) return null;
  const left = paused ? remainingMs : Math.max(0, remainingMs - (now - receivedAt));
  return Math.ceil(left / 1000);
}
