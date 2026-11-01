import express, { type Request } from 'express';
import { sql, type Kysely } from 'kysely';
import type { Authenticator } from './auth.ts';
import type { Config } from './config.ts';
import { balanceOf, ensureAccount } from './credits/ledger.ts';
import type { Database } from './db/database.ts';
import { errorHandler, HttpError } from './http.ts';

export interface Deps {
  config: Config;
  db: Kysely<Database>;
  authenticate: Authenticator;
}

/** The HTTP API. Built from its dependencies so tests can run it against a test database. */
export function createApp({ config, db, authenticate }: Deps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  /** The signed-in account, created with its free allowance the first time it is seen. */
  async function account(req: Request): Promise<string> {
    const id = await authenticate(req);
    if (!id) throw new HttpError(401, 'Please sign in to use AI questions.');
    await ensureAccount(db, id, config.FREE_AI_GAMES);
    return id;
  }

  app.get('/health', async (_req, res) => {
    await sql`select 1`.execute(db);
    res.json({ ok: true });
  });

  app.get('/v1/balance', async (req, res) => {
    const id = await account(req);
    res.json({ ...(await balanceOf(db, id)), questionsPerAiGame: config.QUESTIONS_PER_AI_GAME });
  });

  app.use((_req, _res) => {
    throw new HttpError(404, 'Not found.');
  });
  app.use(errorHandler);
  return app;
}
