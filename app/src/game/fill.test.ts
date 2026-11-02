import { describe, expect, it } from 'vitest';
import type { BankQuestion, GameFormat } from '../data/types';
import { emptyIn, onTopic, placeInRounds, randomFill, topicsIn } from './fill';

const num = (id: string, category?: string): BankQuestion => ({ id, text: `How many ${id}?`, answerType: 'numeric', correctNumber: 1, source: 'manual', category });
const mc = (id: string, category?: string): BankQuestion => ({
  id,
  text: `Which ${id}?`,
  answerType: 'multipleChoice',
  choices: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
  ],
  correctChoiceId: 'a',
  source: 'manual',
  category,
});
const game = (rounds: GameFormat['rounds'], id = 'g'): GameFormat => ({ id, title: 'T', scoring: 'allOrNothing', rounds });
const first = () => 0;

describe('randomFill', () => {
  it('fills only empty slots, with questions that fit the style, never twice in a game', () => {
    const bank = [num('n1'), num('n2'), mc('m1')];
    const g = game([
      { style: 'closestWithoutGoingOver', slots: ['n1', null, null] },
      { style: 'multipleChoice', slots: [null] },
    ]);
    const result = randomFill(g, bank, [], { random: first });
    expect(result.game.rounds[0].slots).toEqual(['n1', 'n2', null]);
    expect(result.game.rounds[1].slots).toEqual(['m1']);
    expect(result.picked).toEqual([[1], [0]]);
    expect(result.unfilled).toBe(1);
  });
  it("prefers questions the host's other games use least", () => {
    const bank = [mc('used'), mc('fresh')];
    const other = game([{ style: 'multipleChoice', slots: ['used'] }], 'other');
    const g = game([{ style: 'multipleChoice', slots: [null] }]);
    expect(randomFill(g, bank, [other], { random: first }).game.rounds[0].slots).toEqual(['fresh']);
  });
  it('can stick to a topic', () => {
    const bank = [mc('a', 'Music'), mc('b', 'Space')];
    const g = game([{ style: 'multipleChoice', slots: [null] }]);
    expect(randomFill(g, bank, [], { topic: 'space', random: first }).game.rounds[0].slots).toEqual(['b']);
  });
  it('shuffles just the slots it picked, and may swap in different questions', () => {
    const bank = [mc('a'), mc('b'), mc('c')];
    const g = game([{ style: 'multipleChoice', slots: ['a', null] }]);
    const firstPick = randomFill(g, bank, [], { random: first });
    expect(firstPick.game.rounds[0].slots).toEqual(['a', 'b']);
    const last = () => 0.99;
    const again = randomFill(firstPick.game, bank, [], { slots: firstPick.picked, random: last });
    expect(again.game.rounds[0].slots).toEqual(['a', 'c']);
    expect(again.picked).toEqual([[1]]);
  });
});

it('finds empty slots, counting deleted questions as empty', () => {
  const g = game([{ style: 'multipleChoice', slots: ['m1', null, 'gone'] }]);
  expect(emptyIn(g, 0, new Map([['m1', mc('m1')]]))).toEqual([1, 2]);
});

it('matches a topic by category or wording', () => {
  expect(onTopic(mc('x', 'Space'), ' SPACE ')).toBe(true);
  expect(onTopic({ ...mc('x'), text: 'First dog in space?' }, 'space')).toBe(true);
  expect(onTopic(mc('x', 'Music'), 'space')).toBe(false);
  expect(onTopic(mc('x'), '')).toBe(true);
});

it('places kept AI questions into each round in order, never past its empty slots', () => {
  const g = game([
    { style: 'multipleChoice', slots: ['m1', null, null] },
    { style: 'multipleChoice', slots: [null] },
  ]);
  const bank = new Map([['m1', mc('m1')]]);
  expect(placeInRounds(g, bank, { 0: ['a1'], 1: ['b1', 'b2'] }).rounds.map((r) => r.slots)).toEqual([
    ['m1', 'a1', null],
    ['b1'],
  ]);
});

it('lists topics most common first, once each whatever the case', () => {
  const bank = [mc('a', 'Space'), mc('b', 'space'), mc('c', 'Music'), mc('d')];
  expect(topicsIn(bank)).toEqual(['Space', 'Music']);
});
