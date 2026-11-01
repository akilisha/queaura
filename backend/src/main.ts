import { createApp } from './app.ts';
import { notConfigured } from './auth.ts';
import { loadConfig } from './config.ts';
import { createDb } from './db/database.ts';
import { migrateToLatest } from './db/migrations.ts';
import { providerFrom } from './generation/index.ts';
import { WordFilter } from './moderation/wordFilter.ts';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
await migrateToLatest(db);

const server = createApp({ config, db, authenticate: notConfigured, provider: providerFrom(config), filter: WordFilter.load() }).listen(config.PORT, () => {
  console.log(JSON.stringify({ level: 'info', message: `Listening on port ${config.PORT}` }));
});

// The host platform stops the service with SIGTERM on each deploy: finish requests, then close.
process.on('SIGTERM', () => {
  server.close(() => void db.destroy().then(() => process.exit(0)));
});
