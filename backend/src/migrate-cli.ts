import { loadConfig } from './config.ts';
import { createDb } from './db/database.ts';
import { migrateToLatest } from './db/migrations.ts';

// Applies schema changes without starting the server: `npm run migrate`.
const config = loadConfig();
const db = createDb(config.DATABASE_URL, config.DATABASE_CA_CERT, config.DATABASE_SCHEMA);
await migrateToLatest(db, config.DATABASE_SCHEMA);
await db.destroy();
console.log('Database is up to date.');
