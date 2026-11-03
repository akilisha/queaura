import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import type { Database } from '../src/db/database.ts';
import { WordFilter } from '../src/moderation/wordFilter.ts';
import { freshDb, newId, url } from './db.ts';

const TOKEN = 'admin-test-token-that-is-long-enough-1234';

describe.skipIf(!url)('granting AI games by hand (needs TEST_DATABASE_URL)', () => {
  let db: Kysely<Database>;
  const servers: Server[] = [];
  let base: string;
  let closed: string;
  const known = newId();

  const start = (adminToken?: string) => {
    const config = loadConfig({ DATABASE_URL: url, FREE_AI_GAMES: '2', ...(adminToken ? { ADMIN_TOKEN: adminToken } : {}) });
    const app = createApp({
      config,
      db,
      authenticate: async () => null,
      providers: [],
      filter: WordFilter.load(),
      play: null,
      verifyPush: null,
      findAccountByEmail: async (email) => (email === 'host@example.com' ? known : null),
    });
    const server = app.listen(0);
    servers.push(server);
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };

  beforeAll(async () => {
    db = await freshDb();
    base = start(TOKEN);
    closed = start();
  });
  afterAll(async () => {
    servers.forEach((s) => s.close());
    await db?.destroy();
  });

  const grant = (body: object, token = TOKEN, at = base) =>
    fetch(`${at}/admin/grants`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it("doesn't exist without ADMIN_TOKEN, and refuses a wrong token", async () => {
    expect((await grant({ account: 'x', aiGames: 5, reason: 'promo' }, TOKEN, closed)).status).toBe(404);
    expect((await grant({ account: 'x', aiGames: 5, reason: 'promo' }, 'wrong')).status).toBe(401);
  });

  it('grants to an account id, with the free allowance for a new account, recording the reason', async () => {
    const who = newId();
    const res = await grant({ account: who, aiGames: 5, reason: 'Demo for a pub owner' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ account: who, granted: true, balance: { aiGames: 7 } });
    const entry = await db.selectFrom('ledger').select(['kind', 'delta', 'note']).where('account_id', '=', who).where('kind', '=', 'adjustment').executeTakeFirstOrThrow();
    expect(entry).toEqual({ kind: 'adjustment', delta: 5, note: 'Demo for a pub owner' });
  });

  it('finds an account by email', async () => {
    expect(await (await grant({ email: 'host@example.com', aiGames: 3, reason: 'Customer care' })).json()).toMatchObject({ account: known, granted: true });
    expect((await grant({ email: 'nobody@example.com', aiGames: 3, reason: 'Customer care' })).status).toBe(404);
  });

  it('grants once per ref, and corrects with a negative amount', async () => {
    const who = newId();
    await grant({ account: who, aiGames: 10, reason: 'Promo', ref: 'promo-nov-1' });
    expect(await (await grant({ account: who, aiGames: 10, reason: 'Promo', ref: 'promo-nov-1' })).json()).toMatchObject({ granted: false, balance: { aiGames: 12 } });
    expect(await (await grant({ account: who, aiGames: -10, reason: 'Granted twice by mistake' })).json()).toMatchObject({ balance: { aiGames: 2 } });
  });

  it('says what is wrong with a request', async () => {
    const res = await grant({ account: 'x', email: 'host@example.com', aiGames: 0, reason: '' });
    expect(res.status).toBe(400);
    const error = (await res.json()).error;
    expect(error).toContain('aiGames');
    expect(error).toContain('reason');
    expect(error).toContain('either account or email');
  });
});
