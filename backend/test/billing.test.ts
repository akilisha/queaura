import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { googlePlay, purchaseAccountId, type GooglePlay, type ProductPurchase } from '../src/billing/google.ts';
import { loadConfig } from '../src/config.ts';
import type { Database } from '../src/db/database.ts';
import { WordFilter } from '../src/moderation/wordFilter.ts';
import { freshDb, newId, url } from './db.ts';

describe('packs setting', () => {
  it('maps products to AI games, and refuses a malformed list', () => {
    expect([...loadConfig({ DATABASE_URL: 'postgres://h/db' }).PACKS]).toEqual([
      ['ai_games_1', 1],
      ['ai_games_5', 5],
      ['ai_games_10', 10],
    ]);
    expect(() => loadConfig({ DATABASE_URL: 'postgres://h/db', PACKS: 'ai_games_5:five' })).toThrow('product id:AI games');
  });
});

describe('Google Play client', () => {
  let server: Server;
  afterAll(() => server?.close());
  it('asks the Play Developer API for the purchase, signed in, and reads the answer', async () => {
    const seen: { path?: string; auth?: string } = {};
    server = createServer((req, res) => {
      seen.path = req.url;
      seen.auth = req.headers.authorization;
      if (req.url?.includes('unknown')) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ purchaseState: 0, obfuscatedExternalAccountId: 'acct', orderId: 'GPA.1' }));
    });
    await new Promise<void>((r) => server.listen(0, r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const key = JSON.stringify({ client_email: 'sa@test', private_key: 'unused' });
    const play = googlePlay(key, 'com.queaura.host', { baseUrl: base, headers: async () => ({ authorization: 'Bearer test-token' }) });
    expect(await play.productPurchase('ai_games_5', 'tok/1')).toEqual({ purchaseState: 0, obfuscatedExternalAccountId: 'acct', orderId: 'GPA.1' });
    expect(seen).toEqual({ path: '/androidpublisher/v3/applications/com.queaura.host/purchases/products/ai_games_5/tokens/tok%2F1', auth: 'Bearer test-token' });
    expect(await play.productPurchase('ai_games_5', 'unknown')).toBeNull();
  });
});

it('gives each account a stable purchase id that reveals nothing', () => {
  expect(purchaseAccountId('user_1')).toBe(purchaseAccountId('user_1'));
  expect(purchaseAccountId('user_1')).not.toBe(purchaseAccountId('user_2'));
  expect(purchaseAccountId('user_1')).not.toContain('user');
  expect(purchaseAccountId('user_1').length).toBeLessThanOrEqual(64);
});

describe.skipIf(!url)('buying AI games (needs TEST_DATABASE_URL)', () => {
  let db: Kysely<Database>;
  let server: Server;
  let base: string;
  // What Google says about each purchase token, as the test sets it.
  const google = new Map<string, ProductPurchase>();
  const play: GooglePlay = { productPurchase: async (_product, token) => google.get(token) ?? null };

  beforeAll(async () => {
    db = await freshDb();
    const config = loadConfig({ DATABASE_URL: url, FREE_AI_GAMES: '2' });
    const app = createApp({
      config,
      db,
      authenticate: async (req) => req.header('x-test-user') ?? null,
      providers: [],
      filter: WordFilter.load(),
      play,
      verifyPush: async (authorization) => authorization === 'Bearer from-google',
    });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server?.close();
    await db?.destroy();
  });

  const buy = (who: string, productId: string, purchaseToken: string) =>
    fetch(`${base}/v1/purchases`, { method: 'POST', headers: { 'x-test-user': who, 'content-type': 'application/json' }, body: JSON.stringify({ productId, purchaseToken }) });
  const notify = (data: object, authorization = 'Bearer from-google') =>
    fetch(`${base}/google/rtdn`, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ message: { data: Buffer.from(JSON.stringify(data)).toString('base64'), messageId: '1' }, subscription: 's' }),
    });
  const aiGames = async (who: string) => (await (await fetch(`${base}/v1/balance`, { headers: { 'x-test-user': who } })).json()).aiGames;

  it('credits a paid purchase once, however often the app sends it', async () => {
    const who = newId();
    google.set('tok-a', { purchaseState: 0, obfuscatedExternalAccountId: purchaseAccountId(who) });
    const first = await buy(who, 'ai_games_5', 'tok-a');
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ credited: true, balance: { aiGames: 7 } });
    expect(await (await buy(who, 'ai_games_5', 'tok-a')).json()).toMatchObject({ credited: false, balance: { aiGames: 7 } });
  });

  it("refuses a purchase meant for another account, an unknown one, a cancelled one, and a pack that isn't sold", async () => {
    const who = newId();
    google.set('tok-other', { purchaseState: 0, obfuscatedExternalAccountId: purchaseAccountId('someone-else') });
    google.set('tok-cancelled', { purchaseState: 1, obfuscatedExternalAccountId: purchaseAccountId(who) });
    expect((await buy(who, 'ai_games_5', 'tok-other')).status).toBe(403);
    expect((await buy(who, 'ai_games_5', 'tok-nobody')).status).toBe(400);
    expect((await buy(who, 'ai_games_5', 'tok-cancelled')).status).toBe(400);
    expect((await buy(who, 'ai_games_99', 'tok-a')).status).toBe(400);
    expect(await aiGames(who)).toBe(2);
  });

  it('waits on a pending purchase (paid later, at a shop, say) without crediting it', async () => {
    const who = newId();
    google.set('tok-pending', { purchaseState: 2, obfuscatedExternalAccountId: purchaseAccountId(who) });
    const res = await buy(who, 'ai_games_10', 'tok-pending');
    expect(res.status).toBe(202);
    expect(await aiGames(who)).toBe(2);
    google.set('tok-pending', { purchaseState: 0, obfuscatedExternalAccountId: purchaseAccountId(who) });
    expect((await buy(who, 'ai_games_10', 'tok-pending')).status).toBe(200);
    expect(await aiGames(who)).toBe(12);
  });

  it('takes a refunded purchase back once, and only on a notification from Google', async () => {
    const who = newId();
    google.set('tok-refund', { purchaseState: 0, obfuscatedExternalAccountId: purchaseAccountId(who) });
    await buy(who, 'ai_games_5', 'tok-refund');
    const refund = { packageName: 'com.queaura.host', voidedPurchaseNotification: { purchaseToken: 'tok-refund', orderId: 'GPA.2' } };
    expect((await notify(refund, 'Bearer forged')).status).toBe(401);
    expect(await aiGames(who)).toBe(7);
    expect((await notify(refund)).status).toBe(204);
    expect((await notify(refund)).status).toBe(204);
    expect(await aiGames(who)).toBe(2);
  });

  it('acknowledges test notifications and ones about other apps without changing anything', async () => {
    expect((await notify({ packageName: 'com.queaura.host', testNotification: { version: '1.0' } })).status).toBe(204);
    expect((await notify({ packageName: 'com.other.app', voidedPurchaseNotification: { purchaseToken: 'tok-a' } })).status).toBe(204);
  });
});
