import type { WordFilter } from '../moderation/wordFilter.ts';
import { modelOutput, toQuestion, type GenerateRequest, type GeneratedQuestion } from './contract.ts';
import { SYSTEM_PROMPT, userPrompt } from './prompt.ts';
import type { Completion, Provider } from './providers.ts';

export interface Generation {
  questions: GeneratedQuestion[];
  /** Set when the model judged the topic unsuitable. */
  declined: string | null;
  /** Questions the model returned that failed a check, by reason (for the cost records). */
  rejected: Record<string, number>;
  completion: Completion;
}

/** One request to the provider, with every returned question checked before the host sees it. */
export async function generate(provider: Provider, filter: WordFilter, req: GenerateRequest): Promise<Generation> {
  const completion = await provider.complete(SYSTEM_PROMPT, userPrompt(req));
  const rejected: Record<string, number> = {};
  const reject = (reason: string) => (rejected[reason] = (rejected[reason] ?? 0) + 1);

  let json: unknown;
  try {
    json = JSON.parse(completion.text);
  } catch {
    json = null;
  }
  const output = modelOutput.safeParse(json);
  if (!output.success) {
    reject('unreadable reply');
    return { questions: [], declined: null, rejected, completion };
  }

  const seen = new Set(req.avoid.map(normalize));
  const questions: GeneratedQuestion[] = [];
  for (const raw of output.data.questions.slice(0, req.count)) {
    const checked = toQuestion(raw, req);
    if (!checked.ok) {
      reject(checked.reason);
      continue;
    }
    const q = checked.question;
    // The model's guardrails can miss things; the word list is the second check (spec §9).
    const words = [q.text, q.explanation, ...(q.choices?.map((c) => c.text) ?? [])];
    if (words.some((w) => filter.find(w))) {
      reject('word list');
      continue;
    }
    if (seen.has(normalize(q.text))) {
      reject('repeat');
      continue;
    }
    seen.add(normalize(q.text));
    questions.push(q);
  }
  return { questions, declined: output.data.declined, rejected, completion };
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
