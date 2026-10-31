import type { BankQuestion, GameFormat } from '../data/types';
import starter from './starter.json';

/** Bumped when the starter content changes, so devices can pick up new built-ins. */
export const STARTER_VERSION: number = starter.version;

export function starterBank(): BankQuestion[] {
  return (starter.questions as Omit<BankQuestion, 'source' | 'builtIn'>[]).map((q) => ({ ...q, source: 'manual', builtIn: true }));
}

export function starterGames(): GameFormat[] {
  return starter.games.map((g) => ({
    id: g.id,
    title: g.title,
    scoring: g.scoring as GameFormat['scoring'],
    rounds: g.rounds.map((r) => ({ style: r.style as GameFormat['rounds'][number]['style'], slots: r.questionIds })),
    builtIn: true,
  }));
}
