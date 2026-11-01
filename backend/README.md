# Queaura backend

The cloud backend (spec §2, §8): AI question generation and AI-game balances. Gameplay never
touches it; a game with hand-written questions works with no internet and no account.

Node 22.18+ runs the TypeScript directly; `tsc` only checks types. Express 5 for HTTP, Kysely
over Postgres for the records, zod to check what comes in.

| File | What |
|---|---|
| `src/app.ts` | The HTTP API, built from its dependencies so tests can run it |
| `src/credits/blocks.ts` | The rule for paying for questions with AI games (pure) |
| `src/credits/ledger.ts` | Balances: every change is a ledger entry; charges lock the account |
| `src/db/migrations.ts` | Schema changes, applied at start; add new ones, never edit old ones |
| `src/config.ts` | Settings from the environment, checked at start (see `.env.example`) |

Stored here: accounts (by Clerk user id), their ledger of AI games, and, later, purchases and
per-request cost records. Never stored here: questions, games, players or answers (spec §4).

## Run locally

Needs a Postgres database.

```bash
npm install
```

```bash
DATABASE_URL=postgres://postgres@127.0.0.1:5432/queaura npm run dev
```

## Tests

The rule tests always run. The database and API tests need a disposable Postgres database (it is
wiped on every run) and are skipped without one:

```bash
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/queaura_test npm test
```

```bash
npm run typecheck
```
