import type { BankQuestion, GameFormat } from '../data/types';
import starter from './starter.json';

/** Bumped when the starter content changes, so devices can pick up new built-ins. */
export const STARTER_VERSION: number = starter.version;

/** Starter items carry the version they arrived in (default 1), so a device adds only new ones. */
type Since = { since?: number };

export function starterBank(newerThan = 0): BankQuestion[] {
  return (starter.questions as (Omit<BankQuestion, 'source' | 'builtIn'> & Since)[])
    .filter((q) => (q.since ?? 1) > newerThan)
    .map(({ since: _since, ...q }) => ({ ...q, source: 'manual', builtIn: true }));
}

export function starterGames(newerThan = 0): GameFormat[] {
  return (starter.games as (typeof starter.games[number] & Since)[]).filter((g) => (g.since ?? 1) > newerThan).map((g) => ({
    id: g.id,
    title: g.title,
    scoring: g.scoring as GameFormat['scoring'],
    rounds: g.rounds.map((r) => ({ style: r.style as GameFormat['rounds'][number]['style'], slots: r.questionIds })),
    builtIn: true,
  }));
}
