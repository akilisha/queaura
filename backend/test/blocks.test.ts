import { describe, expect, it } from 'vitest';
import { planCharge } from '../src/credits/blocks.ts';

describe('planCharge', () => {
  it('uses the opened AI game first', () => {
    expect(planCharge(0, 30, 10, 50)).toEqual({ ok: true, opensAiGame: false, blockRemaining: 20 });
    expect(planCharge(0, 10, 10, 50)).toEqual({ ok: true, opensAiGame: false, blockRemaining: 0 });
  });
  it('opens the next AI game only when the current one runs short, keeping what was left', () => {
    expect(planCharge(2, 5, 10, 50)).toEqual({ ok: true, opensAiGame: true, blockRemaining: 45 });
    expect(planCharge(1, 0, 50, 50)).toEqual({ ok: true, opensAiGame: true, blockRemaining: 0 });
  });
  it('refuses without AI games, and requests bigger than one AI game', () => {
    expect(planCharge(0, 5, 10, 50)).toEqual({ ok: false, reason: 'noAiGames' });
    expect(planCharge(9, 0, 51, 50)).toEqual({ ok: false, reason: 'tooMany' });
    expect(planCharge(9, 0, 0, 50)).toEqual({ ok: false, reason: 'tooMany' });
    expect(planCharge(9, 0, 2.5, 50)).toEqual({ ok: false, reason: 'tooMany' });
  });
});
