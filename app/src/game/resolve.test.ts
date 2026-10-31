import { describe, expect, it } from 'vitest';
import starter from '../starter/starter.json';
import type { BankQuestion, GameFormat } from '../data/types';
import { isYearQuestion, numericChoices, problemOf, resolveGame } from './resolve';
import { starterBank, starterGames } from '../starter/starter';

const bank = new Map(starterBank().map((q) => [q.id, q]));

describe('resolveGame', () => {
  it('resolves every starter game', () => {
    for (const format of starterGames()) {
      expect(problemOf(format, bank)).toBeNull();
      const game = resolveGame(format, bank);
      expect(game.rounds.length).toBe(format.rounds.length);
    }
  });

  it('reports empty slots in plain language', () => {
    const format: GameFormat = {
      id: 'g', title: 'T', scoring: 'allOrNothing',
      rounds: [{ style: 'multipleChoice', slots: ['s-m-mars'] }, { style: 'multipleChoice', slots: [null, null, 'gone'] }],
    };
    expect(problemOf(format, bank)).toBe('Round 2 has 3 empty slots');
  });

  it('refuses choice questions in a closest-guess round', () => {
    const format: GameFormat = { id: 'g', title: 'T', scoring: 'none', rounds: [{ style: 'closestWithoutGoingOver', slots: ['s-m-mars'] }] };
    expect(problemOf(format, bank)).toBe('Round 1 has a question that does not fit its style');
  });

  it('gives number questions generated choices in a multiple-choice round', () => {
    const quick = starterGames().find((g) => g.id === 's-game-quick')!;
    const chess = resolveGame(quick, bank).rounds[0].questions.find((q) => q.id === 's-n-chess')!;
    expect(chess.answerType).toBe('multipleChoice');
    expect(chess.choices).toHaveLength(4);
    expect(chess.choices!.find((c) => c.id === chess.correctChoiceId)!.text).toBe('64');
  });
});

describe('numericChoices', () => {
  it('spots year questions from the wording', () => {
    expect(isYearQuestion('In what year did the Titanic sink?', 1912)).toBe(true);
    expect(isYearQuestion('How many minutes are there in a day?', 1440)).toBe(false);
  });

  it('is stable for a question and never repeats the answer', () => {
    expect(numericChoices('q', 1969, true)).toEqual(numericChoices('q', 1969, true));
    for (const [seed, n] of [['a', 3], ['b', 1969], ['c', 0.5], ['d', 1440], ['e', 1]] as const) {
      const { choices, correctChoiceId } = numericChoices(seed, n);
      const texts = choices.map((c) => c.text);
      expect(new Set(texts).size).toBe(4);
      expect(choices.filter((c) => c.id === correctChoiceId)).toHaveLength(1);
    }
  });

  it('keeps years close and unseparated, other numbers spread out, counts non-negative', () => {
    const years = numericChoices('y', 1969, true).choices.map((c) => c.text);
    expect(years.every((t) => /^\d{4}$/.test(t))).toBe(true);
    expect(Math.max(...years.map(Number)) - Math.min(...years.map(Number))).toBeLessThanOrEqual(30);
    const minutes = numericChoices('m', 1440).choices.map((c) => Number(c.text.replace(/,/g, ''))).sort((a, b) => a - b);
    expect(minutes.every((v, i) => i === 0 || v - minutes[i - 1] >= 72)).toBe(true);
    const small = numericChoices('s', 3).choices.map((c) => Number(c.text));
    expect(Math.min(...small)).toBeGreaterThanOrEqual(0);
  });
});

// The JSON import is how the app reads it; keep the shape honest.
it('starter.json has a version', () => expect(starter.version).toBeGreaterThan(0));
