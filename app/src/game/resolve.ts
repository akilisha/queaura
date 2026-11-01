import type { Choice, GameDefinition, GameQuestion, Style } from '../../../protocol/src';
import type { BankQuestion, GameFormat } from '../data/types';

// Turns a stored game format plus the question bank into the game the server plays.
// No runtime imports, so tools/ can run this file directly with Node.

/** Has a right answer to mark. Free text and opinion questions do not; they fit questionnaires only. */
export function isGraded(q: Pick<BankQuestion, 'answerType' | 'correctNumber' | 'correctChoiceId'>): boolean {
  if (q.answerType === 'numeric') return q.correctNumber !== undefined;
  if (q.answerType === 'multipleChoice') return q.correctChoiceId !== undefined;
  return false;
}

/** Which answer types fit a style (spec §4 compatibility rule). */
export function fits(style: Style, question: Pick<BankQuestion, 'answerType' | 'correctNumber' | 'correctChoiceId'>): boolean {
  if (style === 'questionnaire') return true; // answered as asked, nothing is marked
  if (!isGraded(question)) return false; // no right answer: questionnaires only (spec §6.4)
  if (style === 'closestWithoutGoingOver') return question.answerType === 'numeric';
  return true; // choice styles take choice questions, and number questions with generated choices
}

/** Why a format cannot be played yet ("Round 2 has 3 empty slots"), or null if it can. */
export function problemOf(format: GameFormat, bank: ReadonlyMap<string, BankQuestion>): string | null {
  if (format.rounds.length === 0) return 'Add at least one round';
  const questionnaire = format.progression === 'manual';
  if (questionnaire && (format.rounds.length !== 1 || format.rounds[0].style !== 'questionnaire')) return 'A questionnaire has exactly one set of questions';
  if (!questionnaire && format.rounds.some((r) => r.style === 'questionnaire')) return 'Only a questionnaire can use the questionnaire style';
  for (let i = 0; i < format.rounds.length; i++) {
    const round = format.rounds[i];
    if (round.slots.length === 0) return `Round ${i + 1} has no questions`;
    const empty = round.slots.filter((id) => id === null || !bank.has(id)).length;
    if (empty > 0) return `Round ${i + 1} has ${empty} empty ${empty === 1 ? 'slot' : 'slots'}`;
    const misfit = round.slots.find((id) => !fits(round.style, bank.get(id!)!));
    if (misfit) return `Round ${i + 1} has a question that does not fit its style`;
  }
  return null;
}

export function resolveGame(format: GameFormat, bank: ReadonlyMap<string, BankQuestion>): GameDefinition {
  const problem = problemOf(format, bank);
  if (problem) throw new Error(problem);
  return {
    id: format.id,
    title: format.title,
    scoring: format.scoring,
    closeEarly: format.closeEarly ?? false,
    progression: format.progression ?? 'auto',
    rounds: format.rounds.map((round) => ({
      style: round.style,
      durations: round.durations,
      questions: round.slots.map((id) => toGameQuestion(bank.get(id!)!, round.style)),
    })),
  };
}

function toGameQuestion(q: BankQuestion, style: Style): GameQuestion {
  if ((style === 'multipleChoice' || style === 'fastestFinger') && q.answerType === 'numeric') {
    const { choices, correctChoiceId } = numericChoices(q.id, q.correctNumber!, isYearQuestion(q.text, q.correctNumber!));
    return { id: q.id, text: q.text, answerType: 'multipleChoice', choices, correctChoiceId, explanation: q.explanation };
  }
  return {
    id: q.id,
    text: q.text,
    answerType: q.answerType,
    correctNumber: q.correctNumber,
    correctChoiceId: q.correctChoiceId,
    choices: q.choices,
    explanation: q.explanation,
  };
}

/** "In what year…": wrong answers a few years apart, written without a thousands separator. */
export function isYearQuestion(text: string, answer: number): boolean {
  return /\byear\b/i.test(text) && Number.isInteger(answer);
}

/**
 * Three plausible wrong answers around the real number, shuffled in with it. Seeded by the
 * question id, so the same question always gets the same choices.
 */
export function numericChoices(seed: string, answer: number, isYear = false): { choices: Choice[]; correctChoiceId: string } {
  const random = seededRandom(seed);
  const decimals = (String(answer).split('.')[1] ?? '').length;
  const step = isYear ? 1 : Math.max(10 ** -decimals, Math.abs(answer) * 0.05);
  const wrong = new Set<number>();
  for (let tries = 0; wrong.size < 3 && tries < 100; tries++) {
    const steps = 1 + Math.floor(random() * (isYear ? 15 : 6));
    const candidate = round(answer + (random() < 0.5 ? -1 : 1) * steps * step, decimals);
    if (candidate !== answer && (answer < 0 || candidate >= 0)) wrong.add(candidate);
  }
  const values = shuffle([answer, ...wrong], random);
  const ids = ['a', 'b', 'c', 'd'];
  return {
    choices: values.map((v, i) => ({ id: ids[i], text: isYear ? String(v) : formatNumber(v) })),
    correctChoiceId: ids[values.indexOf(answer)],
  };
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Small deterministic generator (mulberry32) seeded from a string. */
function seededRandom(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function formatNumber(n: number): string {
  const [whole, fraction] = Math.abs(n).toString().split('.');
  return `${n < 0 ? '-' : ''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? `.${fraction}` : ''}`;
}
