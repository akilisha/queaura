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
| `src/generation/` | Writing questions: the prompt, the provider adapters, and the checks on what comes back |
| `src/moderation/wordFilter.ts` | The word list (spec §9), a port of the server's; same lists (`moderation/`), same test cases |

## API

| Route | What |
|---|---|
| `GET /health` | The service and its database are up |
| (all `/v1/` routes) | Need `Authorization: Bearer <Clerk session token>`; checked with Clerk's JWT public key, no network call |
| `GET /v1/balance` | The signed-in host's AI games and questions left in the open one |
| `POST /v1/generate` | `{topic, difficulty, answerType, count, avoid}` → checked questions in the app's shape, and the new balance |

Generation pays before calling the model and gives back whatever isn't delivered, so a failure
or a rejected question costs the host nothing. Every call is recorded in `generations` with its
model, tokens and cost: the data prices are set from.

Stored here: accounts (by Clerk user id), their ledger of AI games, per-request cost records,
and, later, purchases. Never stored here: questions, games, players or answers (spec §4).

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

## Deploy (DigitalOcean App Platform)

`.do/app.yaml` describes the service and its Postgres database. One-time setup, from the
repository root:

1. In the DigitalOcean dashboard, connect GitHub (Apps → Create App → GitHub) and give it access
   to this repository. You can leave the wizard once GitHub is connected.
2. Install `doctl` (on Windows: `winget install DigitalOcean.Doctl`) and sign it in with a token
   from API → Tokens:

   ```bash
   doctl auth init
   ```

3. Check the spec, then create the app (it starts building straight away):

   ```bash
   doctl apps spec validate backend/.do/app.yaml
   ```

   ```bash
   doctl apps create --spec backend/.do/app.yaml
   ```

4. In the dashboard, open the app → Settings → `api` → Environment Variables, fill in the two
   secrets, and save (it redeploys):
   - `CLERK_JWT_KEY`: Clerk dashboard → API keys → JWT public key (the PEM text).
   - `ANTHROPIC_API_KEY`: from the Anthropic console. Set a spending limit there.
5. Find the app's address and check it:

   ```bash
   doctl apps list --format Spec.Name,DefaultIngress
   ```

   ```bash
   curl https://<address>/health
   ```

   It answers `{"ok":true}`. Put the address in `app/.env.local` as `EXPO_PUBLIC_AI_BACKEND_URL`.

Later pushes to the branch named in the spec deploy automatically.
