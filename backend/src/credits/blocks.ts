// How generated questions are paid for (spec §8). Pure, so the rule is tested on its own.
//
// An AI game is a block of questions. A request uses the questions left in the current block
// first; only when they run out does it open the next AI game, so nothing is wasted.

export type ChargePlan =
  | { ok: true; opensAiGame: boolean; blockRemaining: number }
  | { ok: false; reason: 'tooMany' | 'noAiGames' };

export function planCharge(aiGames: number, blockRemaining: number, questions: number, perAiGame: number): ChargePlan {
  if (!Number.isInteger(questions) || questions < 1 || questions > perAiGame) return { ok: false, reason: 'tooMany' };
  if (blockRemaining >= questions) return { ok: true, opensAiGame: false, blockRemaining: blockRemaining - questions };
  if (aiGames < 1) return { ok: false, reason: 'noAiGames' };
  return { ok: true, opensAiGame: true, blockRemaining: blockRemaining + perAiGame - questions };
}
