import { describe as group, expect, it } from 'vitest';
import { starterBank, starterGames } from '../starter/starter';
import {
  candidates,
  describe,
  emptySlots,
  kindOf,
  MAX_QUESTIONNAIRE,
  MAX_ROUNDS,
  newGame,
  titleProblem,
  withDurations,
  withKind,
  withQuestionCount,
  withRoundCount,
  withSlot,
  withStyle,
} from './format';

const bankList = starterBank();
const bank = new Map(bankList.map((q) => [q.id, q]));

group('round and question counts', () => {
  it('adds rounds that copy the last style and keeps existing rounds', () => {
    let g = newGame('g');
    g = withStyle(g, 0, 'multipleChoice', bank).game;
    g = withSlot(g, 0, 0, 's-m-mars');
    g = withRoundCount(g, 3);
    expect(g.rounds.map((r) => r.style)).toEqual(['multipleChoice', 'multipleChoice', 'multipleChoice']);
    expect(g.rounds[0].slots[0]).toBe('s-m-mars');
    expect(withRoundCount(g, 1).rounds).toHaveLength(1);
    expect(withRoundCount(g, 99).rounds).toHaveLength(MAX_ROUNDS);
    expect(withRoundCount(g, 0).rounds).toHaveLength(1);
  });
  it('grows with empty slots and shrinks from the end', () => {
    let g = withSlot(newGame('g'), 0, 0, 's-n-piano');
    g = withQuestionCount(g, 0, 7);
    expect(g.rounds[0].slots).toEqual(['s-n-piano', null, null, null, null, null, null]);
    expect(withQuestionCount(g, 0, 1).rounds[0].slots).toEqual(['s-n-piano']);
  });
});

group('changing a style', () => {
  it('takes out questions that no longer fit and says how many', () => {
    let g = withStyle(newGame('g'), 0, 'multipleChoice', bank).game;
    g = withSlot(withSlot(g, 0, 0, 's-m-mars'), 0, 1, 's-n-piano');
    const { game, cleared } = withStyle(g, 0, 'closestWithoutGoingOver', bank);
    expect(cleared).toBe(1);
    expect(game.rounds[0].slots.slice(0, 2)).toEqual([null, 's-n-piano']);
  });
});

group('timing overrides', () => {
  it('stores only real overrides', () => {
    let g = withDurations(newGame('g'), 0, { answerMs: 30_000 });
    expect(g.rounds[0].durations).toEqual({ answerMs: 30_000 });
    g = withDurations(g, 0, { answerMs: undefined });
    expect(g.rounds[0].durations).toBeUndefined();
  });
});

group('the question picker', () => {
  it('offers only questions that fit and are not already in the game', () => {
    let g = withSlot(newGame('g'), 0, 0, 's-n-piano');
    const offered = candidates(g, 0, bankList);
    expect(offered.every((q) => q.answerType === 'numeric')).toBe(true);
    expect(offered.some((q) => q.id === 's-n-piano')).toBe(false);
    g = withStyle(g, 0, 'multipleChoice', bank).game;
    expect(candidates(g, 0, bankList).some((q) => q.answerType === 'multipleChoice')).toBe(true);
  });
});

group('summary', () => {
  it('restates a ready game in plain language', () => {
    const warmup = starterGames()[0];
    const { lines, status } = describe(warmup, bank);
    expect(lines[0]).toBe('"Warm-up": 2 rounds, 8 questions.');
    expect(lines[1]).toContain('Round 1: Closest without going over, 4 questions, 20 seconds to answer.');
    expect(lines).toContain('Each question ends when the clock runs out.');
    expect(status).toBe('Ready to play.');
  });
  it('explains an unfinished game and that it can still be saved', () => {
    const g = { ...newGame('g'), title: 'Pub night' };
    expect(emptySlots(g, bank)).toBe(5);
    expect(describe(g, bank).status).toBe('Not ready yet: Round 1 has 5 empty slots. You can save it now and finish it later.');
    expect(titleProblem({ ...g, title: '  ' })).toBe('Give the game a name');
  });
});

group('quiz or questionnaire (spec §6.4)', () => {
  const free = { id: 'f1', text: 'Team name?', answerType: 'freeText' as const, source: 'manual' as const };
  const withFree = new Map([...bank, [free.id, free]]);

  it('a questionnaire is one round of every chosen question, with no points', () => {
    let g = withSlot(newGame('g'), 0, 0, 's-n-piano');
    g = withRoundCount(g, 2);
    g = withSlot(g, 1, 0, 's-m-mars');
    const { game, cleared } = withKind(g, 'questionnaire', bank);
    expect(cleared).toBe(0);
    expect(kindOf(game)).toBe('questionnaire');
    expect(game.scoring).toBe('none');
    expect(game.rounds).toHaveLength(1);
    expect(game.rounds[0].style).toBe('questionnaire');
    expect(game.rounds[0].slots.filter(Boolean)).toEqual(['s-n-piano', 's-m-mars']);
    expect(withQuestionCount(game, 0, 99).rounds[0].slots).toHaveLength(MAX_QUESTIONNAIRE);
  });
  it('going back to a quiz takes out free-text questions and says how many', () => {
    let g = withKind(newGame('g'), 'questionnaire', withFree).game;
    g = withSlot(g, 0, 0, 'f1');
    g = withSlot(g, 0, 1, 's-m-mars');
    const { game, cleared } = withKind(g, 'quiz', withFree);
    expect(cleared).toBe(1);
    expect(kindOf(game)).toBe('quiz');
    expect(game.scoring).toBe('allOrNothing');
    expect(game.rounds[0]).toMatchObject({ style: 'multipleChoice', slots: [null, 's-m-mars', null, null, null] });
  });
  it('offers free-text questions only to a questionnaire', () => {
    const quiz = withStyle(newGame('g'), 0, 'multipleChoice', withFree).game;
    expect(candidates(quiz, 0, [free])).toEqual([]);
    expect(candidates(withKind(quiz, 'questionnaire', withFree).game, 0, [free])).toEqual([free]);
  });
  it('restates a questionnaire without rounds, timing or points', () => {
    let g = { ...withKind(newGame('g'), 'questionnaire', bank).game, title: 'Office survey' };
    g = withQuestionCount(g, 0, 1);
    g = withSlot(g, 0, 0, 's-m-mars');
    const { lines, status } = describe(g, bank);
    expect(lines[0]).toBe('"Office survey": a questionnaire, 1 question.');
    expect(lines.join(' ')).not.toMatch(/seconds|Scoring/);
    expect(status).toBe('Ready to play.');
  });
});
