import type { Scoring, Style } from '../../../protocol/src';

// Every name and explanation of a style or scoring, written once (spec §5.2: every choice is
// explained in plain language). Screens import from here so the wording never drifts.

export const STYLES: Record<Style, { name: string; description: string }> = {
  closestWithoutGoingOver: {
    name: 'Closest without going over',
    description: 'Players type a number. The closest guess that is not over the real answer wins.',
  },
  multipleChoice: {
    name: 'Multiple choice',
    description: 'Players tap one of up to four answers before time runs out.',
  },
  fastestFinger: {
    name: 'Fastest finger',
    description: 'Like multiple choice, but the first right answer scores most: 100, then 90, 80… whatever the scoring below.',
  },
  questionnaire: {
    name: 'Questionnaire',
    description: 'Everyone answers at their own pace. No clock and no points.',
  },
};

/** The two kinds of game, chosen in the wizard's first step (spec §6.4). */
export const KINDS = {
  quiz: {
    name: 'Quiz',
    description: 'Rounds of questions on a clock, with points and a winner.',
  },
  questionnaire: {
    name: 'Questionnaire',
    description: 'Everyone answers at their own pace, with no clock and no points. You end it when you are ready, and the answers are saved on this phone.',
  },
} as const;

export const ANSWER_TYPES = {
  numeric: 'Number',
  multipleChoice: 'Multiple choice',
  freeText: 'Free text',
} as const;

export const SCORINGS: Record<Scoring, { name: string; description: string }> = {
  allOrNothing: {
    name: 'All or nothing',
    description: '100 points for every right answer, however long it took.',
  },
  timeWeighted: {
    name: 'Faster is better',
    description: 'Answer while the question is being read for 100 points; after that the points drop, down to 10 at the buzzer.',
  },
  none: {
    name: 'Just for fun',
    description: 'No points. Answers are still shown and revealed.',
  },
};

export const CLOSE_EARLY = {
  on: { name: 'When everyone has answered', description: 'Moves on as soon as every player with their screen on has answered.' },
  off: { name: 'When the clock runs out', description: 'Every question runs its full time, so nobody feels rushed.' },
} as const;

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Why a word was refused (spec §9). The host sees the word so a false alarm is easy to reword. */
export function blockedMessage(word: string, what: string): string {
  return `"${word}" can't be used: ${what} show on shared screens like the TV. Please reword.`;
}
