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

export function answerChoice(choiceId: string): void {
  const seq = game.value?.question?.seq;
  if (seq !== undefined) send({ t: 'answer', seq, choice: choiceId });
}
