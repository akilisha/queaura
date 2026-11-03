import { createApp } from './app.ts';
import { clerkAuthenticator, notConfigured } from './auth.ts';
import { loadConfig } from './config.ts';
import { createDb } from './db/database.ts';
import { migrateToLatest } from './db/migrations.ts';
import { googlePlay, pushVerifier } from './billing/google.ts';
import { chainFrom } from './generation/index.ts';
import { WordFilter } from './moderation/wordFilter.ts';

const config = loadConfig();
const db = createDb(config.DATABASE_URL, config.DATABASE_CA_CERT, config.DATABASE_SCHEMA);
const signIn = config.CLERK_JWT_KEY || config.CLERK_SECRET_KEY;
if (!signIn) console.warn(JSON.stringify({ level: 'warn', message: 'No Clerk keys: every signed-in request will be refused.' }));
const authenticate = signIn ? clerkAuthenticator({ jwtKey: config.CLERK_JWT_KEY, secretKey: config.CLERK_SECRET_KEY }) : notConfigured;
await migrateToLatest(db, config.DATABASE_SCHEMA);

const { chain, skipped } = chainFrom(config);
for (const s of skipped) console.warn(JSON.stringify({ level: 'warn', message: `No key for ${s}: left out of the AI providers.` }));
if (chain.length === 0) console.warn(JSON.stringify({ level: 'warn', message: 'No AI provider has a key: generation will answer that AI questions are unavailable.' }));
console.log(JSON.stringify({ level: 'info', message: 'AI providers, in order', providers: chain.map((l) => `${l.provider.name}:${l.provider.model}`) }));
const play = config.GOOGLE_SERVICE_ACCOUNT_JSON ? googlePlay(config.GOOGLE_SERVICE_ACCOUNT_JSON, config.GOOGLE_PLAY_PACKAGE) : null;
if (!play) console.warn(JSON.stringify({ level: 'warn', message: 'No Google service account: purchases will be refused.' }));
const verifyPush = config.RTDN_AUDIENCE && config.RTDN_SERVICE_ACCOUNT ? pushVerifier(config.RTDN_AUDIENCE, config.RTDN_SERVICE_ACCOUNT) : null;
if (!verifyPush) console.warn(JSON.stringify({ level: 'warn', message: 'Purchase notifications not set up: refunds will not take AI games back.' }));
const server = createApp({ config, db, authenticate, providers: chain, filter: WordFilter.load(), play, verifyPush }).listen(config.PORT, () => {
  console.log(JSON.stringify({ level: 'info', message: `Listening on port ${config.PORT}` }));
});

// The host platform stops the service with SIGTERM on each deploy: finish requests, then close.
process.on('SIGTERM', () => {
  server.close(() => void db.destroy().then(() => process.exit(0)));
});
