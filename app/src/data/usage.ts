import type { GameFormat } from './types';

/** How many games have this question in one of their slots. */
export function gamesUsing(questionId: string, games: GameFormat[]): GameFormat[] {
  return games.filter((g) => g.rounds.some((r) => r.slots.includes(questionId)));
}
