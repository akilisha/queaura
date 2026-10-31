import type { AnswerType, Choice } from '../../../protocol/src';
import type { BankQuestion } from '../data/types';

// Rules for writing a question by hand (spec §5.3). Pure, so the editor and tests share them.

export const MAX_TEXT = 200;
export const MAX_CHOICE = 60;
export const MAX_EXPLANATION = 300;
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 4;

/** What the editor holds while the host types: everything as strings. */
export interface QuestionDraft {
  text: string;
  answerType: AnswerType;
  number: string;
  choices: string[];
  correctIndex: number | null;
  explanation: string;
}

export function emptyDraft(): QuestionDraft {
  return { text: '', answerType: 'numeric', number: '', choices: ['', ''], correctIndex: null, explanation: '' };
}

export function draftOf(q: BankQuestion): QuestionDraft {
  const choices = q.choices?.map((c) => c.text) ?? ['', ''];
  return {
    text: q.text,
    answerType: q.answerType,
    number: q.correctNumber !== undefined ? String(q.correctNumber) : '',
    choices,
    correctIndex: q.choices ? Math.max(0, q.choices.findIndex((c) => c.id === q.correctChoiceId)) : null,
    explanation: q.explanation ?? '',
  };
}

/** A typed number: digits with an optional minus and decimal point; thousands commas allowed. */
export function parseNumber(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, '').replace(/^−/, '-');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Everything that stops the draft from being saved, in plain language; empty when it can be. */
export function problemsOf(d: QuestionDraft): string[] {
  const problems: string[] = [];
  if (!d.text.trim()) problems.push('Write the question');
  if (d.answerType === 'numeric') {
    if (!d.number.trim()) problems.push('Enter the answer');
    else if (parseNumber(d.number) === null) problems.push('The answer must be a number, like 42 or 3.5');
  } else {
    const filled = d.choices.map((c) => c.trim());
    if (filled.filter(Boolean).length < MIN_CHOICES) problems.push(`Give at least ${MIN_CHOICES} answers to choose from`);
    else if (filled.some((c) => !c)) problems.push('Fill in or remove the empty answer');
    const lower = filled.filter(Boolean).map((c) => c.toLowerCase());
    if (new Set(lower).size !== lower.length) problems.push('Two answers are the same');
    if (d.correctIndex === null || !filled[d.correctIndex]) problems.push('Mark which answer is right');
  }
  return problems;
}

/** Builds the stored question; call only when [problemsOf] is empty. */
export function toQuestion(d: QuestionDraft, id: string, previous?: BankQuestion): BankQuestion {
  const base = {
    id,
    text: d.text.trim(),
    answerType: d.answerType,
    explanation: d.explanation.trim() || undefined,
    source: previous?.source ?? ('manual' as const),
  };
  if (d.answerType === 'numeric') return { ...base, correctNumber: parseNumber(d.number)! };
  const ids = ['a', 'b', 'c', 'd'];
  const choices: Choice[] = d.choices.map((text, i) => ({ id: ids[i], text: text.trim() }));
  return { ...base, choices, correctChoiceId: ids[d.correctIndex!] };
}

export function newQuestionId(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
