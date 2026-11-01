import { z } from 'zod';

// What a host may ask for, what the model must return, and what the app receives (spec §8:
// strict JSON per question matching the Question model; malformed output is rejected).

/** Limits match the app's question editor (app/src/game/question.ts). */
export const LIMITS = { text: 200, choice: 60, explanation: 300, topic: 80, avoid: 50, perRequest: 20 } as const;

export const generateRequest = z.object({
  topic: z.string().trim().min(1).max(LIMITS.topic),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']),
  answerType: z.enum(['numeric', 'multipleChoice', 'mixed']),
  count: z.number().int().min(1).max(LIMITS.perRequest),
  /** Questions already in the host's bank on this topic, so the model doesn't repeat them. */
  avoid: z.array(z.string().max(LIMITS.text)).max(LIMITS.avoid).default([]),
});
export type GenerateRequest = z.infer<typeof generateRequest>;

/** The JSON the model is told to return; given to Claude as a structured-output schema. */
export const modelOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['declined', 'questions'],
  properties: {
    declined: { type: ['string', 'null'], description: 'Why the topic is unsuitable, or null.' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'answerType', 'correctNumber', 'choices', 'correctChoiceIndex', 'explanation', 'difficulty'],
        properties: {
          text: { type: 'string' },
          answerType: { type: 'string', enum: ['numeric', 'multipleChoice'] },
          correctNumber: { type: ['number', 'null'] },
          choices: { type: 'array', items: { type: 'string' } },
          correctChoiceIndex: { type: ['integer', 'null'] },
          explanation: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
      },
    },
  },
} as const;

const rawQuestion = z.object({
  text: z.string(),
  answerType: z.enum(['numeric', 'multipleChoice']),
  correctNumber: z.number().nullable(),
  choices: z.array(z.string()),
  correctChoiceIndex: z.number().int().nullable(),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});
export const modelOutput = z.object({ declined: z.string().nullable(), questions: z.array(z.unknown()) });

/** A question as the app stores it (BankQuestion without its id, which the app assigns). */
export interface GeneratedQuestion {
  text: string;
  answerType: 'numeric' | 'multipleChoice';
  correctNumber?: number;
  choices?: { id: string; text: string }[];
  correctChoiceId?: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  source: 'ai';
}

const IDS = ['a', 'b', 'c', 'd'];

/**
 * Checks one question from the model and turns it into the app's shape, or says why it is
 * unusable. Never trusts the output: every rule the app's editor enforces is enforced here too.
 */
export function toQuestion(raw: unknown, req: GenerateRequest): { ok: true; question: GeneratedQuestion } | { ok: false; reason: string } {
  const parsed = rawQuestion.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'malformed' };
  const q = parsed.data;
  const text = q.text.trim();
  const explanation = q.explanation.trim();
  if (!text || text.length > LIMITS.text) return { ok: false, reason: 'text length' };
  if (explanation.length > LIMITS.explanation) return { ok: false, reason: 'explanation length' };
  if (req.answerType !== 'mixed' && q.answerType !== req.answerType) return { ok: false, reason: 'wrong answer type' };
  const base = { text, explanation, difficulty: q.difficulty, category: req.topic, source: 'ai' as const };
  if (q.answerType === 'numeric') {
    if (q.correctNumber === null || !Number.isFinite(q.correctNumber)) return { ok: false, reason: 'no number' };
    return { ok: true, question: { ...base, answerType: 'numeric', correctNumber: q.correctNumber } };
  }
  const choices = q.choices.map((c) => c.trim());
  if (choices.length < 2 || choices.length > 4) return { ok: false, reason: 'choice count' };
  if (choices.some((c) => !c || c.length > LIMITS.choice)) return { ok: false, reason: 'choice length' };
  if (new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) return { ok: false, reason: 'duplicate choices' };
  const i = q.correctChoiceIndex;
  if (i === null || i < 0 || i >= choices.length) return { ok: false, reason: 'no right answer' };
  return {
    ok: true,
    question: { ...base, answerType: 'multipleChoice', choices: choices.map((c, j) => ({ id: IDS[j], text: c })), correctChoiceId: IDS[i] },
  };
}
