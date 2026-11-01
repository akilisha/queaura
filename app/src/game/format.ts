import type { Durations, Style } from '../../../protocol/src';
import type { BankQuestion, GameFormat, RoundFormat } from '../data/types';
import { CLOSE_EARLY, KINDS, plural, SCORINGS, STYLES } from './copy';
import { fits, problemOf } from './resolve';

// The rules of the game wizard (spec §5.2). Pure; the wizard screens only call these.

export const MAX_ROUNDS = 10;
export const MAX_QUESTIONS = 20;
/** A questionnaire is one round holding every question, so it may be longer than a quiz round. */
export const MAX_QUESTIONNAIRE = 50;
export const MAX_TITLE = 40;
export const DEFAULT_QUESTIONS = 5;

/** Starting values (spec §6.3); the wizard's timing controls show these when nothing is overridden. */
export const DEFAULT_SECONDS = { answer: 20, reveal: 8, break: 15 } as const;
export const ANSWER_SECONDS = [10, 15, 20, 30, 45, 60] as const;
export const READING_SECONDS = [3, 5, 8, 10] as const;

export function newRound(style: Style = 'closestWithoutGoingOver', questions = DEFAULT_QUESTIONS): RoundFormat {
  return { style, slots: Array<string | null>(questions).fill(null) };
}

export function newGame(id: string): GameFormat {
  return { id, title: '', scoring: 'allOrNothing', closeEarly: false, rounds: [newRound()] };
}

export function newGameId(): string {
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export type GameKind = keyof typeof KINDS;

export function kindOf(g: GameFormat): GameKind {
  return g.progression === 'manual' ? 'questionnaire' : 'quiz';
}

export function maxQuestions(g: GameFormat): number {
  return kindOf(g) === 'questionnaire' ? MAX_QUESTIONNAIRE : MAX_QUESTIONS;
}

/**
 * Switches between a quiz and a questionnaire (spec §6.4). A questionnaire is exactly one round
 * of style questionnaire with no points; the chosen questions carry over. Going back to a quiz
 * makes one multiple-choice round, and questions without a right answer (free text, opinions),
 * which only questionnaires take, are taken out of their slots; [cleared] says how many.
 */
export function withKind(g: GameFormat, kind: GameKind, bank: ReadonlyMap<string, BankQuestion>): { game: GameFormat; cleared: number } {
  if (kind === kindOf(g)) return { game: g, cleared: 0 };
  const slots = g.rounds.flatMap((r) => r.slots);
  if (kind === 'questionnaire') {
    const kept = slots.slice(0, MAX_QUESTIONNAIRE);
    return {
      game: { ...g, progression: 'manual', scoring: 'none', closeEarly: false, rounds: [{ style: 'questionnaire', slots: kept }] },
      cleared: 0,
    };
  }
  const quiz: GameFormat = { ...g, progression: 'auto', scoring: 'allOrNothing', rounds: [{ style: 'questionnaire', slots: slots.slice(0, MAX_QUESTIONS) }] };
  return withStyle(quiz, 0, 'multipleChoice', bank);
}

/** Adds rounds at the end or removes them from the end; kept rounds are untouched. */
export function withRoundCount(g: GameFormat, count: number): GameFormat {
  const n = clamp(count, 1, MAX_ROUNDS);
  const rounds = g.rounds.slice(0, n);
  while (rounds.length < n) rounds.push(newRound(rounds[rounds.length - 1]?.style));
  return { ...g, rounds };
}

export function withQuestionCount(g: GameFormat, round: number, count: number): GameFormat {
  const n = clamp(count, 1, maxQuestions(g));
  return updateRound(g, round, (r) => {
    const slots = r.slots.slice(0, n);
    while (slots.length < n) slots.push(null);
    return { ...r, slots };
  });
}

/**
 * Changes a round's style. Questions that no longer fit (choice questions in a closest-guess round)
 * are taken out of their slots; [cleared] says how many, so the screen can tell the host.
 */
export function withStyle(
  g: GameFormat,
  round: number,
  style: Style,
  bank: ReadonlyMap<string, BankQuestion>,
): { game: GameFormat; cleared: number } {
  let cleared = 0;
  const game = updateRound(g, round, (r) => ({
    ...r,
    style,
    slots: r.slots.map((id) => {
      const q = id ? bank.get(id) : undefined;
      if (q && !fits(style, q)) {
        cleared++;
        return null;
      }
      return id;
    }),
  }));
  return { game, cleared };
}

export function withDurations(g: GameFormat, round: number, patch: Durations): GameFormat {
  return updateRound(g, round, (r) => {
    const durations = { ...r.durations, ...patch };
    // Drop keys set back to "default" so the stored format only holds real overrides.
    for (const key of Object.keys(durations) as (keyof Durations)[]) if (durations[key] === undefined) delete durations[key];
    return { ...r, durations: Object.keys(durations).length ? durations : undefined };
  });
}

export function withSlot(g: GameFormat, round: number, slot: number, questionId: string | null): GameFormat {
  return updateRound(g, round, (r) => ({ ...r, slots: r.slots.map((id, i) => (i === slot ? questionId : id)) }));
}

/** Questions the picker offers for a round: ones that fit its style and are not already in this game. */
export function candidates(g: GameFormat, round: number, bank: readonly BankQuestion[]): BankQuestion[] {
  const used = new Set(g.rounds.flatMap((r) => r.slots).filter((id): id is string => id !== null));
  return bank.filter((q) => fits(g.rounds[round].style, q) && !used.has(q.id));
}

/** "2 rounds, 10 questions" or "Questionnaire, 8 questions", for lists of games. */
export function sizeOf(g: GameFormat): string {
  const questions = plural(g.rounds.reduce((n, r) => n + r.slots.length, 0), 'question');
  return kindOf(g) === 'questionnaire' ? `Questionnaire, ${questions}` : `${plural(g.rounds.length, 'round')}, ${questions}`;
}

export function titleProblem(g: GameFormat): string | null {
  return g.title.trim() ? null : 'Give the game a name';
}

export function emptySlots(g: GameFormat, bank: ReadonlyMap<string, BankQuestion>): number {
  return g.rounds.reduce((n, r) => n + r.slots.filter((id) => id === null || !bank.has(id)).length, 0);
}

/** The summary screen: every choice restated in plain language (spec §5.2). */
export function describe(g: GameFormat, bank: ReadonlyMap<string, BankQuestion>): { lines: string[]; status: string } {
  const questions = g.rounds.reduce((n, r) => n + r.slots.length, 0);
  const problem = problemOf(g, bank);
  const status = problem ? `Not ready yet: ${problem}. You can save it now and finish it later.` : 'Ready to play.';
  if (kindOf(g) === 'questionnaire') {
    return { lines: [`"${g.title.trim()}": a questionnaire, ${plural(questions, 'question')}.`, KINDS.questionnaire.description], status };
  }
  const lines = [`"${g.title.trim()}": ${plural(g.rounds.length, 'round')}, ${plural(questions, 'question')}.`];
  g.rounds.forEach((r, i) => {
    const answer = r.durations?.answerMs ? r.durations.answerMs / 1000 : DEFAULT_SECONDS.answer;
    lines.push(`Round ${i + 1}: ${STYLES[r.style].name}, ${plural(r.slots.length, 'question')}, ${answer} seconds to answer. ${STYLES[r.style].description}`);
  });
  lines.push(`Scoring: ${SCORINGS[g.scoring].name}. ${SCORINGS[g.scoring].description}`);
  const close = g.closeEarly ? CLOSE_EARLY.on : CLOSE_EARLY.off;
  lines.push(`Each question ends ${close.name.toLowerCase()}.`);
  return { lines, status };
}

function updateRound(g: GameFormat, index: number, change: (r: RoundFormat) => RoundFormat): GameFormat {
  return { ...g, rounds: g.rounds.map((r, i) => (i === index ? change(r) : r)) };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}
