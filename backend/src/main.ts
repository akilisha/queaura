import { createApp } from './app.ts';
import { clerkAuthenticator, notConfigured } from './auth.ts';
import { loadConfig } from './config.ts';
import { createDb } from './db/database.ts';
import { migrateToLatest } from './db/migrations.ts';
import { providerFrom } from './generation/index.ts';
import { WordFilter } from './moderation/wordFilter.ts';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const signIn = config.CLERK_JWT_KEY || config.CLERK_SECRET_KEY;
if (!signIn) console.warn(JSON.stringify({ level: 'warn', message: 'No Clerk keys: every signed-in request will be refused.' }));
// PEM keys set as one-line environment variables carry literal \n; turn them back into newlines.
const authenticate = signIn ? clerkAuthenticator({ jwtKey: config.CLERK_JWT_KEY?.replace(/\\n/g, '\n'), secretKey: config.CLERK_SECRET_KEY }) : notConfigured;
await migrateToLatest(db);

const server = createApp({ config, db, authenticate, provider: providerFrom(config), filter: WordFilter.load() }).listen(config.PORT, () => {
  console.log(JSON.stringify({ level: 'info', message: `Listening on port ${config.PORT}` }));
});

// The host platform stops the service with SIGTERM on each deploy: finish requests, then close.
process.on('SIGTERM', () => {
  server.close(() => void db.destroy().then(() => process.exit(0)));
});
