import express, { type Request } from 'express';
import { sql, type Kysely } from 'kysely';
import type { Authenticator } from './auth.ts';
import type { Config } from './config.ts';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { purchaseAccountId, type GooglePlay } from './billing/google.ts';
import { applyRefund, checkRefunds } from './billing/refunds.ts';
import { balanceOf, charge, credit, ensureAccount, giveBack } from './credits/ledger.ts';
import type { Database, GenerationOutcome } from './db/database.ts';
import { generateRequest } from './generation/contract.ts';
import { generate } from './generation/generate.ts';
import { costMicroUsd, type Link } from './generation/index.ts';
import { ProviderError } from './generation/providers.ts';
import { errorHandler, HttpError } from './http.ts';
import type { WordFilter } from './moderation/wordFilter.ts';

export interface Deps {
  config: Config;
  db: Kysely<Database>;
  authenticate: Authenticator;
  /** The providers to try in order (spec §8); empty means generation answers it is unavailable. */
  providers: Link[];
  filter: WordFilter;
  /** Google Play: null when no service account is set, and purchases are refused. */
  play: GooglePlay | null;
  /** Checks a purchase notification came from Google; null when notifications aren't set up. */
  verifyPush: ((authorization: string | undefined) => Promise<boolean>) | null;
  /** Finds an account (Clerk user id) by email, for admin grants; null without Clerk's secret key. */
  findAccountByEmail?: ((email: string) => Promise<string | null>) | null;
}

const grantRequest = z
  .object({
    account: z.string().min(1).max(100).optional(),
    email: z.string().email().max(200).optional(),
    aiGames: z.number().int().min(-100).max(1000).refine((n) => n !== 0, 'not zero'),
    reason: z.string().trim().min(3).max(200),
    /** Makes the grant happen once however often it's sent, e.g. "promo-nov-2026-alex". */
    ref: z.string().trim().min(1).max(100).optional(),
  })
  .refine((g) => (g.account ? 1 : 0) + (g.email ? 1 : 0) === 1, 'give either account or email');

const purchaseRequest = z.object({ productId: z.string().min(1).max(100), purchaseToken: z.string().min(1).max(1000) });

/** The HTTP API. Built from its dependencies so tests can run it against a test database. */
export function createApp({ config, db, authenticate, providers, filter, play, verifyPush, findAccountByEmail = null }: Deps) {
  const app = express();
  app.disable('x-powered-by');
  // One line per request: route, status and time taken (never bodies, tokens or keys).
  // Health checks are left out; the platform makes them every few seconds.
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      if (req.path === '/health') return;
      console.log(JSON.stringify({ level: 'info', message: 'request', method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - started }));
    });
    next();
  });
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
    res.json({ ...(await balanceOf(db, id)), questionsPerAiGame: config.QUESTIONS_PER_AI_GAME, purchaseAccountId: purchaseAccountId(id) });
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
    if (providers.length === 0) throw new HttpError(503, 'AI questions are not available right now. Please try again later.');
    await withinLimits(id);

    const paid = await charge(db, id, request.count, config.QUESTIONS_PER_AI_GAME);
    if (!paid.ok) {
      throw paid.reason === 'noAiGames'
        ? new HttpError(402, 'You have no AI games left.')
        : new HttpError(400, `Ask for at most ${config.QUESTIONS_PER_AI_GAME} questions at a time.`);
    }

    /** Every attempt is recorded with the model that made it and what it cost. */
    const record = (link: Link, attempt: number, started: number, outcome: GenerationOutcome, delivered: number, rejected: Record<string, number>, tokens = { input: 0, output: 0 }, model = link.provider.model) => {
      console.log(JSON.stringify({ level: 'info', message: 'generation', attempt, provider: link.provider.name, outcome, model, requested: request.count, delivered, durationMs: Date.now() - started, rejected }));
      return db
        .insertInto('generations')
        .values({
          account_id: id,
          provider: link.provider.name,
          model,
          requested: request.count,
          delivered,
          rejected: JSON.stringify(rejected),
          input_tokens: tokens.input,
          output_tokens: tokens.output,
          cost_micro_usd: costMicroUsd(link.price, tokens.input, tokens.output),
          duration_ms: Date.now() - started,
          outcome,
        })
        .execute();
    };

    // The main provider first, then each fallback (spec §8). Fail over when a provider is down,
    // out of credit, slow, cut off, refuses, or returns nothing usable; never when the model judges
    // the topic unsuitable, or a bad topic would just be shopped around until one model agreed.
    let lastFailure: 'refused' | 'failed' | 'unusable' = 'failed';
    for (const [attempt, link] of providers.entries()) {
      const started = Date.now();
      let result;
      try {
        result = await generate(link.provider, filter, request);
      } catch (e) {
        const refused = e instanceof ProviderError && e.kind === 'refused';
        console.error(JSON.stringify({ level: 'error', message: 'generation failed', attempt, provider: link.provider.name, model: link.provider.model, kind: e instanceof ProviderError ? e.kind : 'failed', detail: String(e instanceof Error ? e.message : e) }));
        await record(link, attempt, started, refused ? 'refused' : 'failed', 0, {});
        lastFailure = refused ? 'refused' : 'failed';
        continue;
      }
      const { questions, declined, rejected, completion } = result;
      const tokens = { input: completion.inputTokens, output: completion.outputTokens };
      if (questions.length === 0 && !declined) {
        await record(link, attempt, started, 'unusable', 0, rejected, tokens, completion.model);
        lastFailure = 'unusable';
        continue;
      }
      if (questions.length < request.count) await giveBack(db, id, request.count - questions.length);
      await record(link, attempt, started, questions.length > 0 ? 'ok' : 'declined', questions.length, rejected, tokens, completion.model);
      if (questions.length === 0) throw new HttpError(422, "That topic isn't suitable for a family-friendly quiz. Try a different one.");
      res.json({ questions, balance: await balanceOf(db, id) });
      return;
    }

    // Every provider failed: nothing was delivered, so nothing is used up.
    await giveBack(db, id, request.count);
    throw lastFailure === 'refused'
      ? new HttpError(422, "The AI couldn't write questions on that topic. Try a different one.")
      : lastFailure === 'unusable'
        ? new HttpError(503, "The AI's questions didn't pass our checks. Nothing was used up; please try again.")
        : new HttpError(503, "The AI couldn't write questions just now. Nothing was used up; please try again.");
  });

  /**
   * A Google Play purchase (spec §8). Google, not the phone, says whether it was paid; the token
   * is credited once however often it arrives (the app resends purchases it didn't finish).
   */
  app.post('/v1/purchases', async (req, res) => {
    const id = await account(req);
    const parsed = purchaseRequest.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'That request could not be read.');
    const { productId, purchaseToken } = parsed.data;
    const aiGames = config.PACKS.get(productId);
    if (!aiGames) throw new HttpError(400, "That pack isn't sold any more.");
    if (!play) throw new HttpError(503, "Purchases can't be confirmed right now. You haven't been charged twice; please try again later.");

    const purchase = await play.productPurchase(productId, purchaseToken);
    if (!purchase) throw new HttpError(400, "Google Play doesn't know that purchase.");
    if (purchase.obfuscatedExternalAccountId !== purchaseAccountId(id)) {
      console.warn(JSON.stringify({ level: 'warn', message: 'purchase for another account refused', productId }));
      throw new HttpError(403, 'That purchase belongs to a different account.');
    }
    if (purchase.purchaseState === 2) {
      res.status(202).json({ pending: true, balance: await balanceOf(db, id) });
      return;
    }
    if (purchase.purchaseState !== 0) throw new HttpError(400, 'That purchase was cancelled.');

    const credited = await credit(db, id, aiGames, 'purchase', purchaseToken);
    console.log(JSON.stringify({ level: 'info', message: 'purchase', productId, aiGames, credited, orderId: purchase.orderId }));
    res.json({ credited, balance: await balanceOf(db, id) });
  });

  /**
   * Google Play's purchase notifications, pushed through Pub/Sub. A refunded or charged-back
   * purchase takes its AI games back (the balance may go below zero until topped up).
   */
  app.post('/google/rtdn', async (req, res) => {
    if (!verifyPush || !(await verifyPush(req.header('authorization')))) throw new HttpError(401, 'Not a notification from Google.');
    let note: { packageName?: string; voidedPurchaseNotification?: { purchaseToken?: string; orderId?: string }; testNotification?: unknown };
    try {
      note = JSON.parse(Buffer.from(String(req.body?.message?.data ?? ''), 'base64').toString('utf8'));
    } catch {
      note = {};
    }
    const voided = note.voidedPurchaseNotification;
    if (note.packageName === config.GOOGLE_PLAY_PACKAGE && voided?.purchaseToken) {
      await applyRefund(db, voided.purchaseToken, 'notification', voided.orderId);
    } else if (note.testNotification) {
      console.log(JSON.stringify({ level: 'info', message: 'test notification from Google Play' }));
    }
    // Acknowledge everything else too, or Pub/Sub keeps redelivering it.
    res.status(204).end();
  });

  /** The admin secret, compared in constant time; without ADMIN_TOKEN the admin routes don't exist. */
  function admin(req: Request): void {
    if (!config.ADMIN_TOKEN) throw new HttpError(404, 'Not found.');
    const header = req.header('authorization') ?? '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    const digest = (s: string) => createHash('sha256').update(s).digest();
    if (!given || !timingSafeEqual(digest(given), digest(config.ADMIN_TOKEN))) {
      console.warn(JSON.stringify({ level: 'warn', message: 'admin request refused' }));
      throw new HttpError(401, 'Not allowed.');
    }
  }

  /**
   * Grants AI games by hand: promos, customer care, demos (a negative number corrects a mistake).
   * Every grant is in the ledger with its reason, and a ref makes it happen only once.
   */
  app.post('/admin/grants', async (req, res) => {
    admin(req);
    const parsed = grantRequest.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => `${i.path.join('.') || 'request'}: ${i.message}`).join('; '));
    const g = parsed.data;
    let id = g.account ?? null;
    if (g.email) {
      if (!findAccountByEmail) throw new HttpError(503, 'Finding accounts by email needs CLERK_SECRET_KEY; give the account id instead.');
      id = await findAccountByEmail(g.email);
      if (!id) throw new HttpError(404, 'No account with that email. The person needs to sign in to QueAura once first.');
    }
    await ensureAccount(db, id!, config.FREE_AI_GAMES);
    const ref = g.ref ?? `grant-${randomUUID()}`;
    const granted = await credit(db, id!, g.aiGames, 'adjustment', ref, g.reason);
    console.log(JSON.stringify({ level: 'info', message: 'admin grant', account: id, aiGames: g.aiGames, reason: g.reason, ref, granted }));
    res.json({ account: id, granted, ref, balance: await balanceOf(db, id!) });
  });

  /** Runs the refund check now (it also runs on a timer): what Google lists as voided, and what was applied. */
  app.post('/admin/check-refunds', async (req, res) => {
    admin(req);
    if (!play) throw new HttpError(503, 'No Google service account: refunds can\'t be checked.');
    res.json(await checkRefunds(db, play));
  });

  app.use((_req, _res) => {
    throw new HttpError(404, 'Not found.');
  });
  app.use(errorHandler);
  return app;
}
