import { sql } from 'kysely';
import { createDb } from '../src/db/database.ts';
import { migrateToLatest } from '../src/db/migrations.ts';

// Database tests need a disposable Postgres: set TEST_DATABASE_URL. Its contents are wiped.
export const url = process.env.TEST_DATABASE_URL;

export async function freshDb() {
  const db = createDb(url!);
  await sql`drop schema if exists public cascade; create schema public`.execute(db);
  await migrateToLatest(db);
  return db;
}

let n = 0;
export const newId = () => `user_${Date.now()}_${n++}`;
