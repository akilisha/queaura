import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import type { Database } from '../src/db/database.ts';
import { ProviderError, type Provider } from '../src/generation/providers.ts';
import { WordFilter } from '../src/moderation/wordFilter.ts';
import { freshDb, newId, url } from './db.ts';
import { fakeProvider, mc } from './fixtures.ts';

describe('provider config', () => {
  it('reads the fallback list, and refuses a malformed one', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://h/db', AI_FALLBACKS: 'openai:gpt-6.1-sol:2:10, deepseek:deepseek-flash:0.3:1.2' });
    expect(config.AI_FALLBACKS).toEqual([
      { provider: 'openai', model: 'gpt-6.1-sol', input: 2, output: 10 },
      { provider: 'deepseek', model: 'deepseek-flash', input: 0.3, output: 1.2 },
    ]);
    expect(loadConfig({ DATABASE_URL: 'postgres://h/db' }).AI_FALLBACKS).toEqual([]);
    expect(() => loadConfig({ DATABASE_URL: 'postgres://h/db', AI_FALLBACKS: 'openai:gpt-6.1-sol' })).toThrow('provider:model:input price:output price');
    expect(() => loadConfig({ DATABASE_URL: 'postgres://h/db', AI_FALLBACKS: 'acme:m:1:2' })).toThrow('provider:model');
  });
});

describe.skipIf(!url)('failing over to the next provider (needs TEST_DATABASE_URL)', () => {
  let db: Kysely<Database>;
  let server: Server;
  let base: string;
  // Each test sets what the main provider and the fallback do.
  let main: Provider;
  let backup: Provider;

  beforeAll(async () => {
    db = await freshDb();
    const config = loadConfig({ DATABASE_URL: url, FREE_AI_GAMES: '2' });
    const link = (name: string, get: () => Provider, input: number, output: number) => ({
      provider: { name, model: `${name}-1`, complete: (s: string, u: string) => get().complete(s, u) },
      price: { input, output },
    });
    const app = createApp({
      config,
      db,
      authenticate: async (req) => req.header('x-test-user') ?? null,
      providers: [link('main', () => main, 0.1, 0.5), link('backup', () => backup, 2, 10)],
      filter: WordFilter.load(),
    });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server?.close();
    await db?.destroy();
  });

  const ask = (who: string) =>
    fetch(`${base}/v1/generate`, {
      method: 'POST',
      headers: { 'x-test-user': who, 'content-type': 'application/json' },
      body: JSON.stringify({ topic: 'Space', difficulty: 'easy', answerType: 'multipleChoice', count: 2 }),
    });
  const attempts = (who: string) => db.selectFrom('generations').select(['provider', 'outcome', 'cost_micro_usd']).where('account_id', '=', who).orderBy('id').execute();
  const good = { declined: null, questions: [mc('Which planet is red?'), mc('Which planet is largest?')] };

  it('uses the main provider when it works, and never calls the fallback', async () => {
    const who = newId();
    main = fakeProvider(good);
    const spare = fakeProvider(good);
    backup = spare;
    expect((await ask(who)).status).toBe(200);
    expect(spare.calls).toBe(0);
    expect(await attempts(who)).toEqual([{ provider: 'main', outcome: 'ok', cost_micro_usd: 1600 }]);
  });

  it('fails over when the main provider is down, refuses or returns nothing usable, recording each attempt at its own price', async () => {
    for (const failure of [new ProviderError('unavailable', 'credit balance too low'), new ProviderError('refused', 'refusal'), { declined: null, questions: [{ text: 'broken' }] }]) {
      const who = newId();
      main = fakeProvider(failure);
      backup = fakeProvider(good);
      const res = await ask(who);
      expect(res.status).toBe(200);
      expect((await res.json()).questions).toHaveLength(2);
      const rows = await attempts(who);
      expect(rows.map((r) => [r.provider, r.outcome])).toEqual([
        ['main', failure instanceof ProviderError ? (failure.kind === 'refused' ? 'refused' : 'failed') : 'unusable'],
        ['backup', 'ok'],
      ]);
      expect(rows[1].cost_micro_usd).toBe(32000);
    }
  });

  it('does not shop a declined topic around', async () => {
    const who = newId();
    main = fakeProvider({ declined: 'Not suitable', questions: [] });
    const spare = fakeProvider(good);
    backup = spare;
    expect((await ask(who)).status).toBe(422);
    expect(spare.calls).toBe(0);
  });

  it('gives everything back when every provider fails', async () => {
    const who = newId();
    main = fakeProvider(new ProviderError('unavailable', 'down'));
    backup = fakeProvider(new ProviderError('unavailable', 'down too'));
    const res = await ask(who);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain('Nothing was used up');
    const balance = await (await fetch(`${base}/v1/balance`, { headers: { 'x-test-user': who } })).json();
    expect(balance).toMatchObject({ aiGames: 1, questionsLeft: 50 });
    expect((await attempts(who)).map((r) => r.outcome)).toEqual(['failed', 'failed']);
  });
});
