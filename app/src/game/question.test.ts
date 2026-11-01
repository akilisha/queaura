import { describe, expect, it } from 'vitest';
import { draftOf, emptyDraft, parseNumber, problemsOf, toQuestion, type QuestionDraft } from './question';

const numeric = (patch: Partial<QuestionDraft>): QuestionDraft => ({ ...emptyDraft(), text: 'How many?', ...patch });
const choice = (patch: Partial<QuestionDraft>): QuestionDraft => ({
  ...emptyDraft(),
  text: 'Which?',
  answerType: 'multipleChoice',
  choices: ['Mars', 'Venus'],
  correctIndex: 0,
  ...patch,
});

describe('parseNumber', () => {
  it('accepts plain, negative, decimal and comma-grouped numbers', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber(' -3.5 ')).toBe(-3.5);
    expect(parseNumber('8,849')).toBe(8849);
    expect(parseNumber('−40')).toBe(-40);
  });
  it('refuses anything else', () => {
    for (const bad of ['', 'abc', '1.2.3', '4 5', '.']) expect(parseNumber(bad)).toBeNull();
  });
});

describe('problemsOf', () => {
  it('passes complete questions', () => {
    expect(problemsOf(numeric({ number: '88' }))).toEqual([]);
    expect(problemsOf(choice({}))).toEqual([]);
  });
  it('explains what is missing', () => {
    expect(problemsOf({ ...emptyDraft() })).toEqual(['Write the question', 'Enter the answer']);
    expect(problemsOf(numeric({ number: 'lots' }))).toEqual(['The answer must be a number, like 42 or 3.5']);
    expect(problemsOf(choice({ choices: ['Mars', ''], correctIndex: 0 }))).toContain('Give at least 2 answers to choose from');
    expect(problemsOf(choice({ choices: ['Mars', 'Venus', ''] }))).toEqual(['Fill in or remove the empty answer']);
    expect(problemsOf(choice({ choices: ['Mars', 'mars'] }))).toEqual(['Two answers are the same']);
    expect(problemsOf(choice({ correctIndex: null }))).toEqual(['Mark which answer is right']);
  });
});

describe('toQuestion and draftOf', () => {
  it('round-trips a multiple-choice question', () => {
    const q = toQuestion(choice({ explanation: '  It is red.  ' }), 'q1');
    expect(q).toMatchObject({ id: 'q1', correctChoiceId: 'a', explanation: 'It is red.', source: 'manual' });
    expect(draftOf(q)).toMatchObject({ answerType: 'multipleChoice', choices: ['Mars', 'Venus'], correctIndex: 0 });
  });
  it('round-trips a number question and drops an empty explanation', () => {
    const q = toQuestion(numeric({ number: '1,969', explanation: ' ' }), 'q2');
    expect(q.correctNumber).toBe(1969);
    expect(q.explanation).toBeUndefined();
    expect(draftOf(q).number).toBe('1969');
  });
});

describe('free text (questionnaires)', () => {
  it('needs only the question, and stores no answer or explanation', () => {
    const d: QuestionDraft = { ...emptyDraft(), answerType: 'freeText', text: ' Team name? ', explanation: 'left over' };
    expect(problemsOf(d)).toEqual([]);
    expect(problemsOf({ ...d, text: ' ' })).toEqual(['Write the question']);
    expect(toQuestion(d, 'q1')).toEqual({ id: 'q1', text: 'Team name?', answerType: 'freeText', explanation: undefined, source: 'manual' });
  });
});
