import type { BankQuestion, GameFormat } from '../data/types';
import { candidates, withSlot } from './format';

// Filling a game's empty slots automatically: at random from the host's questions, or from AI
// (spec §5.2). Pure, so tests cover it; the screens only call these.

/** The slots in a round with no usable question (empty, or the question was deleted). */
export function emptyIn(g: GameFormat, round: number, bank: ReadonlyMap<string, BankQuestion>): number[] {
  return g.rounds[round].slots.flatMap((id, i) => (id === null || !bank.has(id) ? [i] : []));
}

/** Does this question belong to the topic? AI questions carry theirs; others match by wording. */
export function onTopic(q: BankQuestion, topic: string): boolean {
  const t = topic.trim().toLowerCase();
  if (!t) return true;
  return q.category?.trim().toLowerCase() === t || q.text.toLowerCase().includes(t);
}

export interface RandomFill {
  game: GameFormat;
  /** Slots this pick filled, by round, so "Shuffle again" can re-pick just those. */
  picked: number[][];
  /** Slots left empty because nothing unused fits. */
  unfilled: number;
}

/**
 * Fills empty slots (or [slots], to shuffle a previous pick) with questions from the bank that
 * fit each round's style, never twice in one game, preferring questions the host's other games
 * use least so the whole bank gets played. [random] is injectable so tests are repeatable.
 */
export function randomFill(
  g: GameFormat,
  bank: readonly BankQuestion[],
  games: readonly GameFormat[],
  options: { topic?: string; slots?: number[][]; random?: () => number } = {},
): RandomFill {
  const random = options.random ?? Math.random;
  const byId = new Map(bank.map((q) => [q.id, q]));
  const others = games.filter((other) => other.id !== g.id);
  const useCount = (id: string) => others.filter((o) => o.rounds.some((r) => r.slots.includes(id))).length;

  // Shuffling: free the slots being re-picked first, so their questions can be chosen again elsewhere.
  let game = g;
  if (options.slots) options.slots.forEach((slots, r) => slots.forEach((s) => (game = withSlot(game, r, s, null))));

  const picked: number[][] = [];
  let unfilled = 0;
  game.rounds.forEach((_, r) => {
    picked.push([]);
    const targets = options.slots ? (options.slots[r] ?? []) : emptyIn(game, r, byId);
    for (const slot of targets) {
      const pool = candidates(game, r, bank).filter((q) => onTopic(q, options.topic ?? ''));
      if (pool.length === 0) {
        unfilled++;
        continue;
      }
      const least = Math.min(...pool.map((q) => useCount(q.id)));
      const fresh = pool.filter((q) => useCount(q.id) === least);
      const choice = fresh[Math.floor(random() * fresh.length)];
      game = withSlot(game, r, slot, choice.id);
      picked[r].push(slot);
    }
  });
  return { game, picked, unfilled };
}

/** Puts kept AI questions into each round's empty slots, in order. */
export function placeInRounds(g: GameFormat, bank: ReadonlyMap<string, BankQuestion>, keptByRound: Record<number, string[]>): GameFormat {
  let game = g;
  for (const [r, ids] of Object.entries(keptByRound)) {
    const round = Number(r);
    const slots = emptyIn(game, round, bank);
    ids.slice(0, slots.length).forEach((id, i) => (game = withSlot(game, round, slots[i], id)));
  }
  return game;
}

/** The topics in the bank, most common first, for filtering the Questions tab. */
export function topicsIn(bank: readonly BankQuestion[], limit = 8): string[] {
  const counts = new Map<string, { name: string; n: number }>();
  for (const q of bank) {
    const name = q.category?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const entry = counts.get(key) ?? { name, n: 0 };
    entry.n++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, limit).map((e) => e.name);
}
