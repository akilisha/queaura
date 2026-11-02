import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { balanceOf, ensureAccount } from '../src/credits/ledger.ts';
import { createDb } from '../src/db/database.ts';
import { migrateToLatest } from '../src/db/migrations.ts';
import { url } from './db.ts';

// Dev and prod share one Supabase database, each in its own schema.
describe.skipIf(!url)('environments in separate schemas (needs TEST_DATABASE_URL)', () => {
  const dev = createDb(url!, undefined, 'test_env_dev');
  const prod = createDb(url!, undefined, 'test_env_prod');
  afterAll(async () => {
    await sql`drop schema if exists test_env_dev cascade; drop schema if exists test_env_prod cascade`.execute(dev);
    await dev.destroy();
    await prod.destroy();
  });

  it('creates each schema with its own tables and migration history, and keeps data apart', async () => {
    await sql`drop schema if exists test_env_dev cascade; drop schema if exists test_env_prod cascade`.execute(dev);
    await migrateToLatest(dev, 'test_env_dev');
    await migrateToLatest(prod, 'test_env_prod');
    await migrateToLatest(prod, 'test_env_prod'); // a restart changes nothing
    await ensureAccount(dev, 'user_1', 5);
    await ensureAccount(prod, 'user_1', 2);
    expect((await balanceOf(dev, 'user_1')).aiGames).toBe(5);
    expect((await balanceOf(prod, 'user_1')).aiGames).toBe(2);
    const tables = await sql<{ schema: string; n: number }>`
      select table_schema as schema, count(*)::int as n from information_schema.tables
      where table_schema in ('test_env_dev', 'test_env_prod') group by table_schema order by 1`.execute(dev);
    expect(tables.rows).toEqual([
      { schema: 'test_env_dev', n: 5 },
      { schema: 'test_env_prod', n: 5 },
    ]);
  });

  it('refuses a schema name that is not safe to use', () => {
    expect(() => createDb(url!, undefined, 'dev; drop table x')).toThrow('Not a usable schema name');
  });
});
