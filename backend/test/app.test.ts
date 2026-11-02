import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { WordFilter } from '../src/moderation/wordFilter.ts';
import { loadConfig } from '../src/config.ts';
import type { Database } from '../src/db/database.ts';
import { freshDb, newId, url } from './db.ts';
import { fakeProvider, mc } from './fixtures.ts';
import type { Provider } from '../src/generation/providers.ts';
import { ProviderError } from '../src/generation/providers.ts';

describe.skipIf(!url)('HTTP API (needs TEST_DATABASE_URL)', () => {
  let db: Kysely<Database>;
  let server: Server;
  let base: string;
  const user = newId();
  // Each test swaps in the provider reply it needs.
  let provider: Provider | null = null;

  beforeAll(async () => {
    db = await freshDb();
    const config = loadConfig({ DATABASE_URL: url, FREE_AI_GAMES: '2', GENERATE_PER_MINUTE: '6' });
    // Test sign-in: the header names the account. Production uses Clerk.
    const app = createApp({ config, db, authenticate: async (req) => req.header('x-test-user') ?? null, provider: { name: 'fake', model: 'fake-1', complete: (s, u) => provider!.complete(s, u) }, filter: WordFilter.load() });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server?.close();
    await db?.destroy();
  });

  it('reports health', async () => {
    const res = await fetch(`${base}/health`);
    expect(await res.json()).toEqual({ ok: true });
  });
  it('asks to sign in, in plain language', async () => {
    const res = await fetch(`${base}/v1/balance`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Please sign in to use AI questions.' });
  });
  it('tells a refused sign-in apart from no sign-in', async () => {
    const res = await fetch(`${base}/v1/balance`, { headers: { authorization: 'Bearer not-valid' } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Your sign-in couldn't be checked. Please sign out and sign in again." });
  });
  it('shows a new account its free allowance', async () => {
    const res = await fetch(`${base}/v1/balance`, { headers: { 'x-test-user': user } });
    expect(await res.json()).toEqual({ aiGames: 2, questionsLeft: 0, questionsPerAiGame: 50 });
  });
  it('answers unknown routes and unreadable bodies without leaking details', async () => {
    expect((await fetch(`${base}/nope`)).status).toBe(404);
    const bad = await fetch(`${base}/v1/balance`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'That request could not be read.' });
    const big = await fetch(`${base}/v1/balance`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 'a'.repeat(70_000) }) });
    expect(big.status).toBe(413);
  });

  const generate = (who: string, body: object) =>
    fetch(`${base}/v1/generate`, { method: 'POST', headers: { 'x-test-user': who, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const ask = { topic: 'Space', difficulty: 'easy', answerType: 'multipleChoice', count: 3 };

  it('writes questions, pays only for those delivered, and records the cost', async () => {
    const who = newId();
    provider = fakeProvider({ declined: null, questions: [mc('Which planet is red?'), mc('Which planet is largest?', { correctChoiceIndex: 2 })] });
    const res = await generate(who, ask);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toHaveLength(2);
    // 3 asked, 2 delivered: one AI game opened (50), 2 used.
    expect(body.balance).toEqual({ aiGames: 1, questionsLeft: 48 });
    const row = await db.selectFrom('generations').selectAll().where('account_id', '=', who).executeTakeFirstOrThrow();
    expect(row).toMatchObject({ provider: 'fake', requested: 3, delivered: 2, input_tokens: 1000, output_tokens: 3000, cost_micro_usd: 32000, outcome: 'ok' });
  });

  it('gives everything back when the AI fails or refuses, with a plain message', async () => {
    const who = newId();
    provider = fakeProvider(new ProviderError('unavailable', 'Anthropic 529: overloaded'));
    const failed = await generate(who, ask);
    expect(failed.status).toBe(503);
    expect((await failed.json()).error).toContain('Nothing was used up');
    provider = fakeProvider(new ProviderError('refused', 'refusal'));
    expect((await generate(who, ask)).status).toBe(422);
    provider = fakeProvider({ declined: 'Not suitable', questions: [] });
    expect((await generate(who, ask)).status).toBe(422);
    const balance = await (await fetch(`${base}/v1/balance`, { headers: { 'x-test-user': who } })).json();
    expect(balance).toMatchObject({ aiGames: 1, questionsLeft: 50 });
  });

  it('says plainly when there are no AI games left, before calling the AI', async () => {
    const who = newId();
    await db.insertInto('accounts').values({ id: who }).execute(); // an account with no allowance
    provider = fakeProvider({ declined: null, questions: [] });
    const p = provider as ReturnType<typeof fakeProvider>;
    const res = await generate(who, ask);
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: 'You have no AI games left.' });
    expect(p.calls).toBe(0);
  });

  it('refuses a topic on the word list, and malformed requests', async () => {
    const who = newId();
    const blocked = await generate(who, { ...ask, topic: 'shit jokes' });
    expect(blocked.status).toBe(400);
    expect((await blocked.json()).error).toContain('"shit"');
    expect((await generate(who, { ...ask, count: 99 })).status).toBe(400);
    expect((await generate(who, { topic: 'Space' })).status).toBe(400);
  });

  it('limits how often one host can generate, with a plain message', async () => {
    const who = newId();
    provider = fakeProvider({ declined: 'No', questions: [] });
    for (let i = 0; i < 6; i++) expect((await generate(who, ask)).status).toBe(422);
    const res = await generate(who, ask);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain('wait a minute');
    expect((await generate(newId(), ask)).status).toBe(422); // other hosts are unaffected
  });
});
