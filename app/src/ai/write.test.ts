import { describe, expect, it } from 'vitest';
import type { BankQuestion } from '../data/types';
import { answerTypeFor, avoidFor, toBank, type GeneratedQuestion } from './write';

const q = (id: string, text: string, category?: string): BankQuestion => ({ id, text, answerType: 'numeric', correctNumber: 1, source: 'manual', category });

describe('avoidFor', () => {
  it("lists the host's questions on the topic: same topic first, then ones that mention it", () => {
    const bank = [q('1', 'How far is the Moon?'), q('2', 'Which planet is red?', 'Space'), q('3', 'Who painted the ceiling?'), q('4', 'First dog in space?')];
    expect(avoidFor(bank, ' space ')).toEqual(['Which planet is red?', 'First dog in space?']);
    expect(avoidFor(bank, '')).toEqual([]);
  });
  it('sends at most 50', () => {
    const bank = Array.from({ length: 70 }, (_, i) => q(String(i), `Space ${i}`));
    expect(avoidFor(bank, 'space')).toHaveLength(50);
  });
});

it('asks for answers that fit the round', () => {
  expect(answerTypeFor('closestWithoutGoingOver')).toBe('numeric');
  expect(answerTypeFor('multipleChoice')).toBe('multipleChoice');
  expect(answerTypeFor('fastestFinger')).toBe('multipleChoice');
  expect(answerTypeFor('questionnaire')).toBe('mixed');
});

it('gives kept questions ids and marks them as AI-written', () => {
  const generated: GeneratedQuestion = { text: 'Q?', answerType: 'numeric', correctNumber: 3, explanation: 'E.', category: 'Space', difficulty: 'easy', source: 'ai' };
  let n = 0;
  expect(toBank([generated], () => `ai-${++n}`)).toEqual([{ ...generated, id: 'ai-1', source: 'ai' }]);
});
