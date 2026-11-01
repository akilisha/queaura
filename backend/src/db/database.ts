import { Kysely, PostgresDialect, type ColumnType, type Generated } from 'kysely';
import pg from 'pg';

// The backend's records (spec §8): accounts and their AI-game balances. Questions, games and
// players never come here; they stay on the host's phone (spec §4).

export interface AccountTable {
  /** The Clerk user id. */
  id: string;
  created_at: ColumnType<Date, never, never>;
  /** Questions left in the AI game being used up (spec §8: a started block is used up first). */
  block_remaining: ColumnType<number, number | undefined, number>;
}

export type LedgerKind = 'allowance' | 'purchase' | 'refund' | 'use' | 'adjustment';

/** Every change to a balance, so a balance can always be explained and a refund undone exactly. */
export interface LedgerTable {
  id: Generated<string>;
  account_id: string;
  /** AI games added (positive) or used or taken back (negative). */
  delta: number;
  kind: LedgerKind;
  /** What caused it, such as a Google purchase token; one entry per kind and ref, ever. */
  ref: string | null;
  created_at: ColumnType<Date, never, never>;
}

export interface Database {
  accounts: AccountTable;
  ledger: LedgerTable;
}

export function createDb(url: string): Kysely<Database> {
  // BIGINT sums come back as strings by default; balances are small, so read them as numbers.
  pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: url, max: 10 }) }) });
}
