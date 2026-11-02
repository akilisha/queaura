import type { Style } from '../../../protocol/src';
import type { BankQuestion } from '../data/types';

// The rules for asking AI for questions and keeping them (spec §5.3, §8). Pure, so tests cover them.

export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type AnswerChoice = 'numeric' | 'multipleChoice' | 'mixed';

export interface GenerateRequest {
  topic: string;
  difficulty: Difficulty;
  answerType: AnswerChoice;
  count: number;
  avoid: string[];
}

/** A question as the backend returns it: the app's shape without an id. */
export type GeneratedQuestion = Omit<BankQuestion, 'id' | 'builtIn'> & { source: 'ai' };

export interface GenerateResponse {
  questions: GeneratedQuestion[];
  balance: { aiGames: number; questionsLeft: number };
}

export const MAX_PER_REQUEST = 20;
export const MAX_TOPIC = 80;
const MAX_AVOID = 50;

/**
 * Questions the host already has on this topic, so the AI doesn't write them again: ones AI
 * wrote for the same topic, then any whose text mentions it. At most 50, newest first.
 */
export function avoidFor(bank: readonly BankQuestion[], topic: string): string[] {
  const t = topic.trim().toLowerCase();
  if (!t) return [];
  const sameTopic = bank.filter((q) => q.category?.trim().toLowerCase() === t);
  const mentions = bank.filter((q) => !sameTopic.includes(q) && q.text.toLowerCase().includes(t));
  return [...sameTopic, ...mentions].slice(0, MAX_AVOID).map((q) => q.text);
}

/** What a round can take (spec §4): a closest-guess round needs number answers. */
export function answerTypeFor(style: Style): AnswerChoice {
  if (style === 'closestWithoutGoingOver') return 'numeric';
  if (style === 'multipleChoice' || style === 'fastestFinger') return 'multipleChoice';
  return 'mixed';
}

/** The kept questions, ready for the bank. */
export function toBank(kept: readonly GeneratedQuestion[], newId: () => string): BankQuestion[] {
  return kept.map((q) => ({ ...q, id: newId(), source: 'ai' }));
}
