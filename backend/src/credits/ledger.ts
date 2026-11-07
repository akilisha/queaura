import { sql, type Kysely } from 'kysely';
import type { Database, LedgerKind } from '../db/database.ts';
import { planCharge } from './blocks.ts';

// Balances and changes to them. Every change is a ledger entry; the balance is their sum.

export interface Balance {
  /** Unopened AI games. */
  aiGames: number;
  /** Questions left in the AI game already opened. */
  questionsLeft: number;
}

/** Creates the account on first sight and gives it the free allowance, exactly once. */
export async function ensureAccount(db: Kysely<Database>, id: string, freeAiGames: number): Promise<void> {
  await db.transaction().execute(async (tx) => {
    const created = await tx.insertInto('accounts').values({ id }).onConflict((c) => c.column('id').doNothing()).returning('id').executeTakeFirst();
    if (created && freeAiGames > 0) {
      await tx.insertInto('ledger').values({ account_id: id, delta: freeAiGames, kind: 'allowance', ref: null }).execute();
    }
  });
}

export async function balanceOf(db: Kysely<Database>, id: string): Promise<Balance> {
  const account = await db.selectFrom('accounts').select('block_remaining').where('id', '=', id).executeTakeFirst();
  return { aiGames: await sumOf(db, id), questionsLeft: account?.block_remaining ?? 0 };
}

/**
 * Adds or takes back AI games for a reason that must count once (a purchase token, a refund).
 * Returns false if that reason was already recorded, so repeated notifications change nothing.
 */
export async function credit(db: Kysely<Database>, id: string, delta: number, kind: Exclude<LedgerKind, 'use'>, ref: string, note?: string): Promise<boolean> {
  const row = await db
    .insertInto('ledger')
    .values({ account_id: id, delta, kind, ref, note: note ?? null })
    .onConflict((c) => c.columns(['kind', 'ref']).where('ref', 'is not', null).doNothing())
    .returning('id')
    .executeTakeFirst();
  return row !== undefined;
}

export type ChargeResult = { ok: true; balance: Balance } | { ok: false; reason: 'tooMany' | 'noAiGames' };

/**
 * Pays for [questions] generated questions before the model is called, so two requests at once
 * cannot spend the same AI game: the account row is locked for the decision.
 */
export async function charge(db: Kysely<Database>, id: string, questions: number, perAiGame: number): Promise<ChargeResult> {
  return db.transaction().execute(async (tx) => {
    const account = await tx.selectFrom('accounts').select('block_remaining').where('id', '=', id).forUpdate().executeTakeFirstOrThrow();
    const aiGames = await sumOf(tx, id);
    const plan = planCharge(aiGames, account.block_remaining, questions, perAiGame);
    if (!plan.ok) return plan;
    if (plan.opensAiGame) await tx.insertInto('ledger').values({ account_id: id, delta: -1, kind: 'use', ref: null }).execute();
    await tx.updateTable('accounts').set({ block_remaining: plan.blockRemaining }).where('id', '=', id).execute();
    return { ok: true, balance: { aiGames: aiGames - (plan.opensAiGame ? 1 : 0), questionsLeft: plan.blockRemaining } };
  });
}

/** Gives back questions that were paid for but not delivered (the model call failed). */
export async function giveBack(db: Kysely<Database>, id: string, questions: number): Promise<void> {
  await db.updateTable('accounts').set({ block_remaining: sql`block_remaining + ${questions}` }).where('id', '=', id).execute();
}

async function sumOf(db: Kysely<Database>, id: string): Promise<number> {
  const row = await db.selectFrom('ledger').select((eb) => eb.fn.coalesce(eb.fn.sum<number>('delta'), sql<number>`0`).as('total')).where('account_id', '=', id).executeTakeFirstOrThrow();
  return Number(row.total);
}

/** The account and AI games a purchase credited, for taking them back on a refund. */
export async function purchaseOf(db: Kysely<Database>, purchaseToken: string): Promise<{ accountId: string; aiGames: number } | null> {
  const row = await db.selectFrom('ledger').select(['account_id', 'delta']).where('kind', '=', 'purchase').where('ref', '=', purchaseToken).executeTakeFirst();
  return row ? { accountId: row.account_id, aiGames: row.delta } : null;
}

/**
 * Deletes an account's data (spec §8): its AI-game history, its request records and its balance.
 * Purchase and refund records stay, as bookkeeping requires; they carry no name or email. The
 * account row stays, marked deleted, so a sign-in token still alive can't recreate it.
 */
export async function deleteAccountData(db: Kysely<Database>, id: string): Promise<void> {
  await db.transaction().execute(async (tx) => {
    await tx.deleteFrom('generations').where('account_id', '=', id).execute();
    await tx.deleteFrom('ledger').where('account_id', '=', id).where('kind', 'not in', ['purchase', 'refund']).execute();
    await tx.updateTable('accounts').set({ deleted_at: new Date(), block_remaining: 0 }).where('id', '=', id).execute();
  });
}

export async function isDeleted(db: Kysely<Database>, id: string): Promise<boolean> {
  const row = await db.selectFrom('accounts').select('deleted_at').where('id', '=', id).executeTakeFirst();
  return Boolean(row?.deleted_at);
}
