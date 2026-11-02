import { sql } from 'kysely';
import { createDb } from './db/database.ts';

// One-time setup for a managed Postgres cluster (see README → Deploy). Since Postgres 15 only a
// database's owner may create tables in its public schema, so the app's user must own its
// database. Run with the cluster's ADMIN connection:
//   DATABASE_URL=<admin URI> DATABASE_CA_CERT=<CA> npm run db:own -- <database> <user>
const [database, user] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!database || !user || !url) {
  console.error('Usage: DATABASE_URL=<admin URI> DATABASE_CA_CERT=<CA> npm run db:own -- <database> <user>');
  process.exit(1);
}
const ca = process.env.DATABASE_CA_CERT;
// doctl prints the CA base64-encoded; App Platform passes it as PEM. Accept either.
const pem = ca && !ca.includes('BEGIN CERTIFICATE') ? Buffer.from(ca, 'base64').toString('utf8') : ca;
const db = createDb(url, pem);
await sql`alter database ${sql.id(database)} owner to ${sql.id(user)}`.execute(db);
await db.destroy();
console.log(`${user} now owns ${database}.`);
