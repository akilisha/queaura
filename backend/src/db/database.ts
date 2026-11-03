import { CompiledQuery, Kysely, PostgresDialect, type ColumnType, type Generated } from 'kysely';
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
  /** Why, for entries made by hand (admin grants). */
  note: ColumnType<string | null, string | null | undefined, string | null>;
  created_at: ColumnType<Date, never, never>;
}

export type GenerationOutcome = 'ok' | 'declined' | 'refused' | 'failed' | 'unusable';

/** One request to the AI provider: the measured cost data prices are set from (spec §8). */
export interface GenerationTable {
  id: Generated<string>;
  account_id: string;
  created_at: ColumnType<Date, never, never>;
  provider: string;
  model: string;
  requested: number;
  delivered: number;
  /** Returned but failing a check, by reason, as JSON ({"word list": 1}). */
  rejected: ColumnType<Record<string, number>, string, string>;
  input_tokens: number;
  output_tokens: number;
  cost_micro_usd: number;
  duration_ms: number;
  outcome: GenerationOutcome;
}

export interface Database {
  accounts: AccountTable;
  ledger: LedgerTable;
  generations: GenerationTable;
}

/** A schema name we can safely put in SQL: lowercase letters, digits and underscores. */
export const SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * [caCert] is the database's certificate authority (Supabase provides it): with it the
 * connection is encrypted and the server's certificate is checked against it.
 *
 * [schema] keeps one environment's tables apart from another's in the same database (dev and
 * prod share one Supabase database): every connection looks only in that schema.
 */
export function createDb(url: string, caCert?: string, schema = 'public'): Kysely<Database> {
  if (!SCHEMA_NAME.test(schema)) throw new Error(`Not a usable schema name: ${schema}`);
  // BIGINT sums come back as strings by default; balances are small, so read them as numbers.
  pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ ...connection(url, caCert), max: 10 }),
      onCreateConnection: async (conn) => {
        await conn.executeQuery(CompiledQuery.raw(`set search_path to "${schema}"`));
      },
    }),
  });
}

/** pg lets `sslmode` in the URL override the ssl option, so with a certificate it is taken out. */
export function connection(url: string, caCert?: string): pg.PoolConfig {
  if (!caCert) return { connectionString: url };
  const u = new URL(url);
  u.searchParams.delete('sslmode');
  return { connectionString: u.toString(), ssl: { ca: caCert, rejectUnauthorized: true } };
}
