import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import type { Database } from '../src/db/database.ts';
import { WordFilter } from '../src/moderation/wordFilter.ts';
import { freshDb, url } from './db.ts';

const ADMIN = 'admin-test-token-that-is-long-enough-1234';

describe.skipIf(!url)('venue plan requests from the website (needs TEST_DATABASE_URL)', () => {
  let db: Kysely<Database>;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    db = await freshDb();
    const app = createApp({
      config: loadConfig({ DATABASE_URL: url, ADMIN_TOKEN: ADMIN, SITE_URL: 'https://queaura.com' }),
      db,
      authenticate: async () => null,
      providers: [],
      filter: WordFilter.load(),
      play: null,
      verifyPush: null,
    });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    server?.close();
    await db?.destroy();
  });

  // The way a browser sends a plain HTML form, from a given address.
  const send = (fields: Record<string, string>, from = '203.0.113.1') =>
    fetch(`${base}/venue-requests`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': from },
      body: new URLSearchParams(fields).toString(),
    });
  const good = { email: 'quizmaster@thekings.pub', venue: 'The Kings Arms', frequency: 'weekly', message: 'Tuesday nights, about 40 people.' };

  it('keeps a request and sends the browser to the thank-you page', async () => {
    const res = await send(good);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://queaura.com/venues-thanks');
    const list = await (await fetch(`${base}/admin/venue-requests`, { headers: { authorization: `Bearer ${ADMIN}` } })).json();
    expect(list[0]).toMatchObject(good);
  });

  it('sends a bad form to the problem page, and keeps nothing a bot sends', async () => {
    expect((await send({ ...good, email: 'not an email' }, '203.0.113.2')).headers.get('location')).toBe('https://queaura.com/venues-problem');
    const before = (await db.selectFrom('venue_requests').select('id').execute()).length;
    expect((await send({ ...good, website: 'http://spam.example' }, '203.0.113.3')).headers.get('location')).toBe('https://queaura.com/venues-thanks');
    expect((await db.selectFrom('venue_requests').select('id').execute()).length).toBe(before);
  });

  it('limits each address to a few requests an hour, and the list needs the admin token', async () => {
    for (let i = 0; i < 5; i++) await send(good, '203.0.113.4');
    expect((await send(good, '203.0.113.4')).headers.get('location')).toBe('https://queaura.com/venues-problem');
    expect((await fetch(`${base}/admin/venue-requests`)).status).toBe(401);
  });
});
