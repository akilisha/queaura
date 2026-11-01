import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import type { Database } from '../src/db/database.ts';
import { freshDb, newId, url } from './db.ts';

describe.skipIf(!url)('HTTP API (needs TEST_DATABASE_URL)', () => {
  let db: Kysely<Database>;
  let server: Server;
  let base: string;
  const user = newId();

  beforeAll(async () => {
    db = await freshDb();
    const config = loadConfig({ DATABASE_URL: url, FREE_AI_GAMES: '2' });
    // Test sign-in: the header names the account. Production uses Clerk.
    const app = createApp({ config, db, authenticate: async (req) => req.header('x-test-user') ?? null });
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
});
