import type { AnswerValue } from '../../../protocol/src';
import { game, joining, notice } from './store';
import { send } from './transport';

// What views may do. Views call these; they never touch the transport directly.

export function join(name: string, emoji: string): void {
  notice.value = null;
  joining.value = true;
  send({ t: 'join', name, emoji });
}

export function answerNumber(value: number): void {
  const seq = game.value?.question?.seq;
  if (seq !== undefined) send({ t: 'answer', seq, number: value });
}

/** Questionnaire: save the answer to question [index]; the server moves the player on. */
export function questionnaireAnswer(index: number, value: AnswerValue): void {
  send({ t: 'qAnswer', index, ...value });
}

/** Questionnaire: back, or to review from the start. */
export function questionnaireGo(index: number): void {
  send({ t: 'qGo', index });
}

export function answerChoice(choiceId: string): void {
  const seq = game.value?.question?.seq;
  if (seq !== undefined) send({ t: 'answer', seq, choice: choiceId });
}
