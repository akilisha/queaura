import type { GenerateRequest } from '../src/generation/contract.ts';
import type { Completion, Provider } from '../src/generation/providers.ts';

export const request = (patch: Partial<GenerateRequest> = {}): GenerateRequest => ({
  topic: 'Space',
  difficulty: 'easy',
  answerType: 'mixed',
  count: 3,
  avoid: [],
  ...patch,
});

export const mc = (text: string, patch: object = {}) => ({
  text,
  answerType: 'multipleChoice',
  correctNumber: null,
  choices: ['Mars', 'Venus', 'Jupiter', 'Mercury'],
  correctChoiceIndex: 0,
  explanation: 'Iron oxide makes it red.',
  difficulty: 'easy',
  ...patch,
});

export const num = (text: string, n: number) => ({
  text,
  answerType: 'numeric',
  correctNumber: n,
  choices: [],
  correctChoiceIndex: null,
  explanation: 'Fact.',
  difficulty: 'easy',
});

/** A provider that replies with whatever the test hands it, or throws. */
export function fakeProvider(reply: object | string | Error): Provider & { calls: number } {
  const p = {
    name: 'fake',
    model: 'fake-1',
    calls: 0,
    async complete(): Promise<Completion> {
      p.calls++;
      if (reply instanceof Error) throw reply;
      return { text: typeof reply === 'string' ? reply : JSON.stringify(reply), inputTokens: 1000, outputTokens: 3000, model: 'fake-1' };
    },
  };
  return p;
}
