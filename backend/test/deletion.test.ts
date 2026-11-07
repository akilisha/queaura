import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { purchaseAccountId, type GooglePlay } from '../src/billing/google.ts';
import { loadConfig } from '../src/config.ts';
import type { Database } from '../src/db/database.ts';
import { WordFilter } from '../src/moderation/wordFilter.ts';
import { freshDb, newId, url } from './db.ts';
import { fakeProvider, mc } from './fixtures.ts';

const ADMIN = 'admin-test-token-that-is-long-enough-1234';

describe.skipIf(!url)('deleting an account (needs TEST_DATABASE_URL)', () => {
  let db: Kysely<Database>;
  let server: Server;
  let base: string;
  const signInsDeleted: string[] = [];
  const play: GooglePlay = { productPurchase: async (_p, token) => ({ purchaseState: 0, obfuscatedExternalAccountId: purchaseAccountId(token.split(':')[0]) }), voidedPurchases: async () => [] };

  beforeAll(async () => {
    db = await freshDb();
    const app = createApp({
      config: loadConfig({ DATABASE_URL: url, FREE_AI_GAMES: '2', ADMIN_TOKEN: ADMIN }),
      db,
      authenticate: async (req) => req.header('x-test-user') ?? null,
      providers: [{ provider: fakeProvider({ declined: null, questions: [mc('Which planet is red?')] }), price: { input: 1, output: 1 } }],
      filter: WordFilter.load(),
      play,
      verifyPush: null,
      findAccountByEmail: async (email) => (email === 'host@example.com' ? 'user_by_email' : null),
      deleteSignIn: async (id) => void signInsDeleted.push(id),
    });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server?.close();
    await db?.destroy();
  });

  const as = (who: string, method: string, path: string, body?: object) =>
    fetch(`${base}${path}`, { method, headers: { 'x-test-user': who, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

  it('deletes history, requests and balance and the sign-in, keeps purchase records, and the account stays gone', async () => {
    const who = newId();
    await as(who, 'POST', '/v1/purchases', { productId: 'ai_games_5', purchaseToken: `${who}:tok` });
    await as(who, 'POST', '/v1/generate', { topic: 'Space', difficulty: 'easy', answerType: 'multipleChoice', count: 1 });
    expect((await as(who, 'DELETE', '/v1/account')).status).toBe(200);
    expect(signInsDeleted).toContain(who);
    expect(await db.selectFrom('generations').select('id').where('account_id', '=', who).execute()).toHaveLength(0);
    expect((await db.selectFrom('ledger').select('kind').where('account_id', '=', who).execute()).map((r) => r.kind)).toEqual(['purchase']);
    // A sign-in token still alive for a minute can't bring the account back with a new allowance.
    const after = await as(who, 'GET', '/v1/balance');
    expect(after.status).toBe(410);
    expect((await after.json()).error).toContain('deleted');
  });

  it('deletes on request by email, through the admin route', async () => {
    const res = await fetch(`${base}/admin/delete-account`, { method: 'POST', headers: { authorization: `Bearer ${ADMIN}`, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'host@example.com' }) });
    expect(await res.json()).toEqual({ account: 'user_by_email', deleted: true });
    expect(signInsDeleted).toContain('user_by_email');
    expect((await fetch(`${base}/admin/delete-account`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"email":"host@example.com"}' })).status).toBe(401);
  });
});
