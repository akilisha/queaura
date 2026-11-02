import express, { type Request } from 'express';
import { sql, type Kysely } from 'kysely';
import type { Authenticator } from './auth.ts';
import type { Config } from './config.ts';
import { balanceOf, charge, ensureAccount, giveBack } from './credits/ledger.ts';
import type { Database, GenerationOutcome } from './db/database.ts';
import { generateRequest } from './generation/contract.ts';
import { generate } from './generation/generate.ts';
import { costMicroUsd } from './generation/index.ts';
import { ProviderError, type Provider } from './generation/providers.ts';
import { errorHandler, HttpError } from './http.ts';
import type { WordFilter } from './moderation/wordFilter.ts';

export interface Deps {
  config: Config;
  db: Kysely<Database>;
  authenticate: Authenticator;
  /** Null when no AI provider is configured: generation answers that it is unavailable. */
  provider: Provider | null;
  filter: WordFilter;
}

/** The HTTP API. Built from its dependencies so tests can run it against a test database. */
export function createApp({ config, db, authenticate, provider, filter }: Deps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  /** The signed-in account, created with its free allowance the first time it is seen. */
  async function account(req: Request): Promise<string> {
    const id = await authenticate(req);
    if (!id) {
      // A token that was sent but refused is a different problem from no token at all.
      throw req.header('authorization')
        ? new HttpError(401, "Your sign-in couldn't be checked. Please sign out and sign in again.")
        : new HttpError(401, 'Please sign in to use AI questions.');
    }
    await ensureAccount(db, id, config.FREE_AI_GAMES);
    return id;
  }

  /** A guard against runaway use (a stuck button, a bug, a leaked session), counted from the records. */
  async function withinLimits(id: string): Promise<void> {
    const since = (ms: number) =>
      db
        .selectFrom('generations')
        .select((eb) => eb.fn.countAll<number>().as('n'))
        .where('account_id', '=', id)
        .where('created_at', '>', new Date(Date.now() - ms))
        .executeTakeFirstOrThrow()
        .then((r) => Number(r.n));
    if ((await since(60_000)) >= config.GENERATE_PER_MINUTE) throw new HttpError(429, 'That was a lot of questions at once. Please wait a minute and try again.');
    if ((await since(86_400_000)) >= config.GENERATE_PER_DAY) throw new HttpError(429, "You've reached today's limit for AI questions. Please try again tomorrow.");
  }

  app.get('/health', async (_req, res) => {
    await sql`select 1`.execute(db);
    res.json({ ok: true });
  });

  app.get('/v1/balance', async (req, res) => {
    const id = await account(req);
    res.json({ ...(await balanceOf(db, id)), questionsPerAiGame: config.QUESTIONS_PER_AI_GAME });
  });

  /**
   * Writes questions (spec §8). Paid for before the model is called, so two requests at once
   * cannot spend the same AI game; questions not delivered are given back. Every call is recorded
   * with its tokens and cost.
   */
  app.post('/v1/generate', async (req, res) => {
    const id = await account(req);
    const parsed = generateRequest.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'That request could not be read.');
    const request = parsed.data;
    const word = filter.find(request.topic);
    if (word) throw new HttpError(400, `"${word}" can't be used in a topic: questions show on shared screens like the TV.`);
    if (!provider) throw new HttpError(503, 'AI questions are not available right now. Please try again later.');
    await withinLimits(id);

    const paid = await charge(db, id, request.count, config.QUESTIONS_PER_AI_GAME);
    if (!paid.ok) {
      throw paid.reason === 'noAiGames'
        ? new HttpError(402, 'You have no AI games left.')
        : new HttpError(400, `Ask for at most ${config.QUESTIONS_PER_AI_GAME} questions at a time.`);
    }

    const started = Date.now();
    const record = (outcome: GenerationOutcome, delivered: number, rejected: Record<string, number>, tokens = { input: 0, output: 0 }, model = provider.model) =>
      db
        .insertInto('generations')
        .values({
          account_id: id,
          provider: provider.name,
          model,
          requested: request.count,
          delivered,
          rejected: JSON.stringify(rejected),
          input_tokens: tokens.input,
          output_tokens: tokens.output,
          cost_micro_usd: costMicroUsd(config, tokens.input, tokens.output),
          duration_ms: Date.now() - started,
          outcome,
        })
        .execute();

    let result;
    try {
      result = await generate(provider, filter, request);
    } catch (e) {
      await giveBack(db, id, request.count);
      const kind = e instanceof ProviderError ? e.kind : 'failed';
      console.error(JSON.stringify({ level: 'error', message: 'generation failed', kind, detail: String(e instanceof Error ? e.message : e) }));
      await record(kind === 'refused' ? 'refused' : 'failed', 0, {});
      throw kind === 'refused'
        ? new HttpError(422, "The AI couldn't write questions on that topic. Try a different one.")
        : new HttpError(503, "The AI couldn't write questions just now. Nothing was used up; please try again.");
    }

    const { questions, declined, rejected, completion } = result;
    if (questions.length < request.count) await giveBack(db, id, request.count - questions.length);
    const outcome: GenerationOutcome = questions.length > 0 ? 'ok' : declined ? 'declined' : 'unusable';
    await record(outcome, questions.length, rejected, { input: completion.inputTokens, output: completion.outputTokens }, completion.model);
    if (outcome === 'declined') throw new HttpError(422, "That topic isn't suitable for a family-friendly quiz. Try a different one.");
    if (outcome === 'unusable') throw new HttpError(503, "The AI's questions didn't pass our checks. Nothing was used up; please try again.");
    res.json({ questions, balance: await balanceOf(db, id) });
  });

  app.use((_req, _res) => {
    throw new HttpError(404, 'Not found.');
  });
  app.use(errorHandler);
  return app;
}
