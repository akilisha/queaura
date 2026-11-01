import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { balanceOf, charge, credit, ensureAccount, giveBack } from '../src/credits/ledger.ts';
import type { Database } from '../src/db/database.ts';
import { freshDb, newId, url } from './db.ts';

describe.skipIf(!url)('ledger (needs TEST_DATABASE_URL)', () => {
  let db: Kysely<Database>;
  beforeAll(async () => {
    db = await freshDb();
  });
  afterAll(() => db?.destroy());

  it('gives the free allowance once, however often the account is seen', async () => {
    const id = newId();
    await ensureAccount(db, id, 2);
    await ensureAccount(db, id, 2);
    expect(await balanceOf(db, id)).toEqual({ aiGames: 2, questionsLeft: 0 });
  });

  it('opens an AI game for the first questions, then uses it up before opening another', async () => {
    const id = newId();
    await ensureAccount(db, id, 2);
    expect(await charge(db, id, 10, 50)).toEqual({ ok: true, balance: { aiGames: 1, questionsLeft: 40 } });
    expect(await charge(db, id, 40, 50)).toEqual({ ok: true, balance: { aiGames: 1, questionsLeft: 0 } });
    expect(await charge(db, id, 10, 50)).toEqual({ ok: true, balance: { aiGames: 0, questionsLeft: 40 } });
    await giveBack(db, id, 10); // that request failed
    expect(await balanceOf(db, id)).toEqual({ aiGames: 0, questionsLeft: 50 });
    expect(await charge(db, id, 50, 50)).toMatchObject({ ok: true });
    expect(await charge(db, id, 1, 50)).toEqual({ ok: false, reason: 'noAiGames' });
  });

  it('two requests at the same moment cannot spend the same AI game', async () => {
    const id = newId();
    await ensureAccount(db, id, 1);
    const results = await Promise.all(Array.from({ length: 5 }, () => charge(db, id, 50, 50)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await balanceOf(db, id)).toEqual({ aiGames: 0, questionsLeft: 0 });
  });

  it('credits a purchase once and takes it back once, however often it is reported', async () => {
    const id = newId();
    await ensureAccount(db, id, 0);
    expect(await credit(db, id, 10, 'purchase', 'token-1')).toBe(true);
    expect(await credit(db, id, 10, 'purchase', 'token-1')).toBe(false);
    expect((await balanceOf(db, id)).aiGames).toBe(10);
    expect(await credit(db, id, -10, 'refund', 'token-1')).toBe(true);
    expect(await credit(db, id, -10, 'refund', 'token-1')).toBe(false);
    expect((await balanceOf(db, id)).aiGames).toBe(0);
  });
});
