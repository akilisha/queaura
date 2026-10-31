import { useSyncExternalStore } from 'react';
import { games, questions } from './db';
import type { BankQuestion, GameFormat } from './types';

// Screens read the bank and the game list through these hooks and re-render when either changes.

let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Call after any write so every screen showing the library refreshes. */
export function libraryChanged(): void {
  version++;
  cache = null;
  listeners.forEach((l) => l());
}

let cache: { questions: BankQuestion[]; byId: Map<string, BankQuestion>; games: GameFormat[] } | null = null;

function snapshot() {
  if (!cache) {
    const qs = questions.all();
    cache = { questions: qs, byId: new Map(qs.map((q) => [q.id, q])), games: games.all() };
  }
  return cache;
}

export function useLibrary() {
  useSyncExternalStore(subscribe, () => version);
  return snapshot();
}
