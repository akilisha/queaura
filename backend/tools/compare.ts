import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { GeneratedQuestion } from '../src/generation/contract.ts';
import { generate } from '../src/generation/generate.ts';
import { anthropicProvider, COMPATIBLE, compatibleProvider, type Provider } from '../src/generation/providers.ts';
import { WordFilter } from '../src/moderation/wordFilter.ts';

// Model comparison (Phase 3, milestone 6): every candidate writes the same questions through the
// app's own pipeline (instructions, checks, word list); a separate fact-checker with web search
// grades each one; the report gives accuracy, failures, speed and cost per AI game.
//
//   node tools/compare.ts                 run every candidate in tools/candidates.json
//   node tools/compare.ts --only sonnet   run candidates whose model name contains "sonnet"
//   node tools/compare.ts --list-models   list the models each configured provider offers
//
// Keys come from ANTHROPIC_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY, MOONSHOT_API_KEY.
// Every run costs real money: generation for each candidate, plus the fact-checking.

type ProviderName = 'anthropic' | keyof typeof COMPATIBLE;
interface Candidate {
  provider: ProviderName;
  model: string;
  input: number | null;
  output: number | null;
}
interface Config {
  candidates: Candidate[];
  topics: string[];
  questionsPerTopic: number;
}

const JUDGE_MODEL = 'claude-opus-5-5';
const JUDGE_PRICE = { input: 4, output: 20, perSearch: 0.01 };
const QUESTIONS_PER_AI_GAME = 50;
const PACK = { price: 4.99, games: 10, storeCut: 0.15 };

// With COMPARE_KEYS_FROM_PROXY=1, a network proxy adds the real keys to requests (Claude Code's
// network secrets do this), so the script sends a placeholder the proxy replaces.
const viaProxy = process.env.COMPARE_KEYS_FROM_PROXY === '1' ? 'replaced-by-proxy' : undefined;
const KEYS: Record<ProviderName, string | undefined> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai: process.env.OPENAI_API_KEY ?? viaProxy,
  deepseek: process.env.DEEPSEEK_API_KEY ?? viaProxy,
  moonshot: process.env.MOONSHOT_API_KEY ?? viaProxy,
};

const args = process.argv.slice(2);
const config: Config = JSON.parse(readFileSync(new URL('./candidates.json', import.meta.url), 'utf8'));

if (args.includes('--list-models')) {
  for (const name of Object.keys(COMPATIBLE) as (keyof typeof COMPATIBLE)[]) {
    if (!KEYS[name]) {
      console.log(`${name}: no key`);
      continue;
    }
    const client = new OpenAI({ apiKey: KEYS[name], baseURL: COMPATIBLE[name].baseURL });
    const ids: string[] = [];
    for await (const m of client.models.list()) ids.push(m.id);
    console.log(`${name}: ${ids.sort().join(', ')}`);
  }
  if (KEYS.anthropic) {
    const ids: string[] = [];
    for await (const m of new Anthropic({ apiKey: KEYS.anthropic }).models.list()) ids.push(m.id);
    console.log(`anthropic: ${ids.sort().join(', ')}`);
  }
  process.exit(0);
}

const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const candidates = config.candidates.filter((c) => !only || c.model.includes(only));
const missing = [...new Set(candidates.filter((c) => !KEYS[c.provider]).map((c) => c.provider)), ...(KEYS.anthropic ? [] : ['anthropic (fact-checker)'])];
if (missing.length) {
  console.error(`Missing keys: ${[...new Set(missing)].join(', ')}`);
  process.exit(1);
}

function providerFor(c: Candidate): Provider {
  return c.provider === 'anthropic' ? anthropicProvider(KEYS.anthropic!, c.model, 'medium') : compatibleProvider(c.provider, KEYS[c.provider]!, c.model);
}

// --- Generation --------------------------------------------------------------------------------

interface Written {
  topic: string;
  questions: GeneratedQuestion[];
  rejected: Record<string, number>;
  inputTokens: number;
  outputTokens: number;
  ms: number;
  error?: string;
}

async function writeAll(c: Candidate): Promise<Written[]> {
  const provider = providerFor(c);
  const filter = WordFilter.load();
  const out: Written[] = [];
  for (const topic of config.topics) {
    const started = Date.now();
    try {
      const g = await generate(provider, filter, { topic, difficulty: 'mixed', answerType: 'mixed', count: config.questionsPerTopic, avoid: [] });
      out.push({ topic, questions: g.questions, rejected: g.rejected, inputTokens: g.completion.inputTokens, outputTokens: g.completion.outputTokens, ms: Date.now() - started });
    } catch (e) {
      out.push({ topic, questions: [], rejected: {}, inputTokens: 0, outputTokens: 0, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) });
    }
    console.log(`  ${c.model} · ${topic}: ${out.at(-1)!.questions.length} questions, ${((Date.now() - started) / 1000).toFixed(1)} s${out.at(-1)!.error ? ` (${out.at(-1)!.error})` : ''}`);
  }
  return out;
}

// --- Fact-checking -----------------------------------------------------------------------------

type Verdict = 'correct' | 'wrong' | 'ambiguous';
interface Graded {
  verdict: Verdict;
  reason: string;
}

const JUDGE_SYSTEM = `You check pub-quiz questions for factual accuracy before they are shown to a room of players.

For each question, decide whether the answer marked as right is right, and the only defensible answer. Use web search whenever you are not certain; prefer authoritative sources.

Rate each question:
- "correct": the marked answer is right and no other listed answer could reasonably be argued.
- "wrong": the marked answer is wrong.
- "ambiguous": more than one answer is defensible, the fact is disputed or out of date, or the question is unclear.

Give a one-sentence reason for each. End your reply with JSON only, in this shape:
{"verdicts": [{"index": 0, "verdict": "correct" | "wrong" | "ambiguous", "reason": "..."}]}`;

function describe(q: GeneratedQuestion, i: number): string {
  if (q.answerType === 'numeric') return `${i}. ${q.text}\n   Marked answer: ${q.correctNumber}`;
  const choices = (q.choices ?? []).map((c) => `${c.id === q.correctChoiceId ? '[right] ' : ''}${c.text}`).join(' | ');
  return `${i}. ${q.text}\n   Choices: ${choices}`;
}

const judgeCost = { input: 0, output: 0, searches: 0 };

async function grade(topic: string, questions: GeneratedQuestion[]): Promise<Graded[]> {
  if (questions.length === 0) return [];
  const client = new Anthropic({ apiKey: KEYS.anthropic, timeout: 300_000, maxRetries: 2 });
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: `Topic: ${topic}\n\n${questions.map(describe).join('\n')}` }];
  let response: Anthropic.Message;
  // Server-side web search can pause a long turn; send it back to let it continue.
  for (let turn = 0; ; turn++) {
    response = await client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 16000,
      system: JUDGE_SYSTEM,
      output_config: { effort: 'medium' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: questions.length }],
      messages,
    });
    judgeCost.input += response.usage.input_tokens;
    judgeCost.output += response.usage.output_tokens;
    judgeCost.searches += response.usage.server_tool_use?.web_search_requests ?? 0;
    if (response.stop_reason !== 'pause_turn' || turn >= 5) break;
    messages.push({ role: 'assistant', content: response.content });
  }
  if (response.stop_reason === 'refusal') return questions.map(() => ({ verdict: 'ambiguous', reason: 'The fact-checker declined to grade this batch.' }));
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  const json = text.slice(text.indexOf('{"verdicts"'), text.lastIndexOf('}') + 1);
  let verdicts: { index: number; verdict: Verdict; reason: string }[] = [];
  try {
    verdicts = JSON.parse(json).verdicts;
  } catch {
    // Unreadable: every question is left for the person to check.
  }
  return questions.map((_, i) => {
    const v = verdicts.find((x) => x.index === i);
    return v && ['correct', 'wrong', 'ambiguous'].includes(v.verdict) ? { verdict: v.verdict, reason: v.reason } : { verdict: 'ambiguous', reason: 'Not graded.' };
  });
}

// --- Run and report ----------------------------------------------------------------------------

const outDir = new URL(`./out/${new Date().toISOString().replace(/[:.]/g, '-')}/`, import.meta.url);
mkdirSync(outDir, { recursive: true });

const results = [];
for (const c of candidates) {
  console.log(`Writing with ${c.provider}/${c.model}…`);
  const written = await writeAll(c);
  console.log(`Fact-checking ${c.model}…`);
  const graded = await Promise.all(written.map((w) => grade(w.topic, w.questions)));
  results.push({ candidate: c, written, graded });
  writeFileSync(new URL('results.json', outDir), JSON.stringify({ results, judgeCost }, null, 2));
}

const money = (n: number) => `$${n.toFixed(n < 0.1 ? 4 : 2)}`;
const lines = ['# Model comparison', '', `${config.topics.length} topics × ${config.questionsPerTopic} questions, mixed difficulty and answer types. Fact-checker: ${JUDGE_MODEL} with web search.`, ''];
lines.push('| Model | Delivered | Failed checks | Correct | Wrong | Ambiguous | Seconds per 10 | Tokens per AI game (in / out) | Cost per AI game | Margin on a $4.99 10-pack |', '|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const delivered = r.written.reduce((n, w) => n + w.questions.length, 0);
  const failed = r.written.reduce((n, w) => n + Object.values(w.rejected).reduce((a, b) => a + b, 0), 0);
  const all = r.graded.flat();
  const count = (v: Verdict) => all.filter((g) => g.verdict === v).length;
  const pct = (n: number) => (delivered ? `${Math.round((100 * n) / delivered)}%` : '–');
  const ms = r.written.reduce((n, w) => n + w.ms, 0) / Math.max(1, r.written.length);
  const tokensIn = r.written.reduce((n, w) => n + w.inputTokens, 0);
  const tokensOut = r.written.reduce((n, w) => n + w.outputTokens, 0);
  let cost = '–';
  let margin = '–';
  if (r.candidate.input !== null && r.candidate.output !== null && delivered > 0) {
    const perQuestion = (tokensIn * r.candidate.input + tokensOut * r.candidate.output) / 1e6 / delivered;
    const perGame = perQuestion * QUESTIONS_PER_AI_GAME;
    const kept = PACK.price * (1 - PACK.storeCut);
    cost = money(perGame);
    margin = `${Math.round((100 * (kept - perGame * PACK.games)) / PACK.price)}%`;
  }
  const perGameTokens = delivered ? `${Math.round((tokensIn / delivered) * QUESTIONS_PER_AI_GAME)} / ${Math.round((tokensOut / delivered) * QUESTIONS_PER_AI_GAME)}` : '–';
  lines.push(`| ${r.candidate.model} | ${delivered} | ${failed} | ${pct(count('correct'))} | ${pct(count('wrong'))} | ${pct(count('ambiguous'))} | ${(ms / 1000).toFixed(1)} | ${perGameTokens} | ${cost} | ${margin} |`);
}
const judgeTotal = (judgeCost.input * JUDGE_PRICE.input + judgeCost.output * JUDGE_PRICE.output) / 1e6 + judgeCost.searches * JUDGE_PRICE.perSearch;
lines.push('', `Fact-checking cost: ${money(judgeTotal)} (${judgeCost.searches} web searches).`, '', 'Margin: what is left of the pack price after the store’s 15% and the model cost of 10 AI games at 50 questions each.', '');
lines.push('## For a person to check', '', 'Every question the fact-checker marked wrong or ambiguous, and 10 it marked correct, at random.', '');
const passed: string[] = [];
for (const r of results) {
  r.written.forEach((w, t) =>
    w.questions.forEach((q, i) => {
      const g = r.graded[t][i];
      const line = `- **${r.candidate.model} · ${w.topic}** · ${g.verdict.toUpperCase()}: ${describe(q, i).replace(/\n\s*/g, ' — ')}  \n  _${g.reason}_`;
      if (g.verdict === 'correct') passed.push(line);
      else lines.push(line);
    }),
  );
}
lines.push('', '### Marked correct (sample)', '', ...passed.sort(() => Math.random() - 0.5).slice(0, 10));
writeFileSync(new URL('report.md', outDir), lines.join('\n') + '\n');
console.log(lines.slice(0, results.length + 7).join('\n'));
console.log(`\nFull report: ${new URL('report.md', outDir).pathname}`);
