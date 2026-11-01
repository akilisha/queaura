import { describe, expect, it } from 'vitest';
import { counts, csvName, parseJournal, toCsv } from './results';

const start = {
  kind: 'start', gameId: 'g1', title: 'Team feedback', startedAt: new Date(2026, 10, 1, 9).getTime(),
  questions: [
    { id: 'q1', text: 'Team name?', answerType: 'freeText', choices: [] },
    { id: 'q2', text: 'Coffees a day', answerType: 'numeric', choices: [] },
    { id: 'q3', text: 'Coffee or tea?', answerType: 'multipleChoice', choices: [{ id: 'a', text: 'Coffee' }, { id: 'b', text: 'Tea' }] },
  ],
};
const answer = (playerId: number, name: string, questionId: string, value: object) =>
  JSON.stringify({ kind: 'answer', at: 1, playerId, name, emoji: '🦊', questionId, value });

const journal = [
  JSON.stringify(start),
  answer(1, 'Jo', 'q1', { text: 'The "Quizzards", obviously' }),
  answer(1, 'Jo', 'q2', { number: 3 }),
  answer(2, 'Sam', 'q1', { text: '=HYPERLINK("x")' }),
  answer(1, 'Jo', 'q3', { choice: 'b' }),
  answer(1, 'Jo', 'q2', { number: 5 }),
].join('\n');

describe('parseJournal', () => {
  it('keeps the latest answer per player and question, in first-answer order', () => {
    const r = parseJournal('f', journal + '\n' + JSON.stringify({ kind: 'end', at: 99 }) + '\n')!;
    expect(r.title).toBe('Team feedback');
    expect(r.endedAt).toBe(99);
    expect(r.players.map((p) => p.name)).toEqual(['Jo', 'Sam']);
    expect(r.responses[1]).toEqual({ q1: { text: 'The "Quizzards", obviously' }, q2: { number: 5 }, q3: { choice: 'b' } });
    expect(counts(r)).toEqual({ players: 2, complete: 1 });
  });
  it('recovers what was saved before a crash, skipping a line cut short', () => {
    const r = parseJournal('f', journal + '\n{"kind":"answer","playerId":2,"na')!;
    expect(r.endedAt).toBeNull();
    expect(Object.keys(r.responses[2])).toEqual(['q1']);
  });
  it('gives up on a file with no start line', () => {
    expect(parseJournal('f', '')).toBeNull();
    expect(parseJournal('f', '{"kind":"st')).toBeNull();
  });
});

describe('toCsv', () => {
  it('one row per player, choices as words, quoted where needed, formulas defused', () => {
    const csv = toCsv(parseJournal('f', journal)!);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Player,Team name?,Coffees a day,Coffee or tea?',
      'Jo,"The ""Quizzards"", obviously",5,Tea',
      `Sam,"'=HYPERLINK(""x"")",,`,
      '',
    ]);
  });
  it('keeps negative numbers as numbers', () => {
    const r = parseJournal('f', [JSON.stringify(start), answer(1, 'Jo', 'q2', { number: -2 })].join('\n'))!;
    expect(toCsv(r).split('\r\n')[1]).toBe('Jo,,-2,');
  });
  it('names the file after the title and day, in safe characters', () => {
    const r = parseJournal('f', JSON.stringify({ ...start, title: 'Q&A: Café / night' }))!;
    expect(csvName(r)).toBe('Q A Cafe night 2026-11-01.csv');
  });
});
