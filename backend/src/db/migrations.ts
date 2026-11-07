import { sql, type Kysely } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';

// Schema changes, applied in name order and never edited once deployed: add a new one instead.

const migrations: Record<string, Migration> = {
  '0001_accounts_and_ledger': {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('accounts')
        .addColumn('id', 'text', (c) => c.primaryKey())
        .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
        .addColumn('block_remaining', 'integer', (c) => c.notNull().defaultTo(0).check(sql`block_remaining >= 0`))
        .execute();
      await db.schema
        .createTable('ledger')
        .addColumn('id', 'bigint', (c) => c.primaryKey().generatedAlwaysAsIdentity())
        .addColumn('account_id', 'text', (c) => c.notNull().references('accounts.id'))
        .addColumn('delta', 'integer', (c) => c.notNull())
        .addColumn('kind', 'text', (c) => c.notNull().check(sql`kind in ('allowance', 'purchase', 'refund', 'use', 'adjustment')`))
        .addColumn('ref', 'text')
        .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
        .execute();
      await db.schema.createIndex('ledger_account').on('ledger').column('account_id').execute();
      // A purchase is credited once and refunded once, however often Google tells us.
      await db.schema.createIndex('ledger_kind_ref').on('ledger').columns(['kind', 'ref']).unique().where(sql.ref('ref'), 'is not', null).execute();
    },
    async down(db: Kysely<any>) {
      await db.schema.dropTable('ledger').execute();
      await db.schema.dropTable('accounts').execute();
    },
  },
  '0002_generations': {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('generations')
        .addColumn('id', 'bigint', (c) => c.primaryKey().generatedAlwaysAsIdentity())
        .addColumn('account_id', 'text', (c) => c.notNull().references('accounts.id'))
        .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
        .addColumn('provider', 'text', (c) => c.notNull())
        .addColumn('model', 'text', (c) => c.notNull())
        .addColumn('requested', 'integer', (c) => c.notNull())
        .addColumn('delivered', 'integer', (c) => c.notNull())
        .addColumn('rejected', 'jsonb', (c) => c.notNull())
        .addColumn('input_tokens', 'integer', (c) => c.notNull())
        .addColumn('output_tokens', 'integer', (c) => c.notNull())
        .addColumn('cost_micro_usd', 'bigint', (c) => c.notNull())
        .addColumn('duration_ms', 'integer', (c) => c.notNull())
        .addColumn('outcome', 'text', (c) => c.notNull())
        .execute();
      await db.schema.createIndex('generations_account').on('generations').columns(['account_id', 'created_at']).execute();
    },
    async down(db: Kysely<any>) {
      await db.schema.dropTable('generations').execute();
    },
  },
  // Hosted Postgres such as Supabase serves tables in the public schema through its own web API
  // to anyone holding the project's public key, unless row-level security is on. With it on and
  // no policies, that API sees nothing; the backend connects as the tables' owner, which bypasses
  // it. Harmless on plain Postgres.
  '0003_row_level_security': {
    async up(db: Kysely<any>) {
      for (const table of ['accounts', 'ledger', 'generations', 'kysely_migration', 'kysely_migration_lock']) {
        await sql`alter table ${sql.table(table)} enable row level security`.execute(db);
      }
    },
    async down(db: Kysely<any>) {
      for (const table of ['accounts', 'ledger', 'generations', 'kysely_migration', 'kysely_migration_lock']) {
        await sql`alter table ${sql.table(table)} disable row level security`.execute(db);
      }
    },
  },
  // Why AI games were granted by hand (a promo, customer care, a demo): the audit trail.
  '0004_ledger_note': {
    async up(db: Kysely<any>) {
      await db.schema.alterTable('ledger').addColumn('note', 'text').execute();
    },
    async down(db: Kysely<any>) {
      await db.schema.alterTable('ledger').dropColumn('note').execute();
    },
  },
  // Account deletion (spec §8): a deleted account stays as a marker so its sign-in can't recreate it.
  '0005_account_deleted': {
    async up(db: Kysely<any>) {
      await db.schema.alterTable('accounts').addColumn('deleted_at', 'timestamptz').execute();
    },
    async down(db: Kysely<any>) {
      await db.schema.alterTable('accounts').dropColumn('deleted_at').execute();
    },
  },
  // Venue plan requests from queaura.com (spec §8): arranged by hand, so just kept to reply to.
  '0006_venue_requests': {
    async up(db: Kysely<any>) {
      await db.schema
        .createTable('venue_requests')
        .addColumn('id', 'bigint', (c) => c.primaryKey().generatedAlwaysAsIdentity())
        .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
        .addColumn('email', 'text', (c) => c.notNull())
        .addColumn('venue', 'text', (c) => c.notNull())
        .addColumn('frequency', 'text', (c) => c.notNull())
        .addColumn('message', 'text', (c) => c.notNull())
        .execute();
      await sql`alter table venue_requests enable row level security`.execute(db);
    },
    async down(db: Kysely<any>) {
      await db.schema.dropTable('venue_requests').execute();
    },
  },
};

/** Creates [schema] if needed and brings its tables up to date; each schema keeps its own history. */
export async function migrateToLatest(db: Kysely<any>, schema = 'public'): Promise<void> {
  await db.schema.createSchema(schema).ifNotExists().execute();
  const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations }, migrationTableSchema: schema });
  const { error, results } = await migrator.migrateToLatest();
  for (const r of results ?? []) {
    if (r.status === 'Error') console.error(`Migration ${r.migrationName} failed`);
  }
  if (error) throw error;
}
