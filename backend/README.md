# QueAura backend

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
| `POST /v1/purchases` | `{productId, purchaseToken}` → confirmed with Google Play, the pack's AI games credited once |
| `POST /google/rtdn` | Google Play's purchase notifications (Pub/Sub push, Google-signed); a refund takes its AI games back |
| `POST /venue-requests` | The website's venue-plan form (form-encoded, no sign-in); redirects back to the site |
| `GET /admin/venue-requests` | Venue plan requests, newest first, to reply to by hand; needs `ADMIN_TOKEN` |
| `POST /admin/delete-account` | Deletes an account on request by email (`account` or `email`); needs `ADMIN_TOKEN` |
| `DELETE /v1/account` | The signed-in host deletes their account |
| `POST /admin/check-refunds` | Runs the refund check now (it also runs every 30 minutes); needs `ADMIN_TOKEN` |
| `POST /admin/grants` | Grants AI games by hand (needs `ADMIN_TOKEN`); see below |
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

## Deploy

The service runs on DigitalOcean App Platform (`.do/app.yaml`); its Postgres database is on
Supabase. Run commands from the repository root in Git Bash, signed in with `doctl auth init`.

### 1. The database (Supabase, once)

1. Create a Supabase project in the region nearest the app (the spec uses DigitalOcean `nyc`, so
   US East). Keep the database password it asks for.
2. Turn off Supabase's automatic Data API (project settings → Data API); the backend doesn't use
   it. As a second guard, the backend switches row-level security on for its tables, so that API
   would see nothing even if it were on.
3. Copy the **Session pooler** connection string (the Connect button; port 5432), with your
   password in place of `[YOUR-PASSWORD]`. Use the pooler: the direct address is IPv6-only, and
   App Platform connects over IPv4.
4. Download the SSL certificate (project settings → Database → SSL configuration).

The backend creates its tables itself on its first start, in the schema named by
`DATABASE_SCHEMA`: dev and prod share the one database, each in its own schema (`queaura_dev`,
`queaura_prod`). Supabase's Data API only serves the `public` schema by default, so it doesn't
see these either.

### 2. The app

The first time, create it; after that, apply spec changes with update (`doctl apps list` shows
the app's ID):

```bash
doctl apps create --spec backend/.do/app.yaml
```

```bash
doctl apps update <app-id> --spec backend/.do/app.yaml
```

Then, in the dashboard, open the app → Settings → `api` → Environment Variables, fill in the
secrets, and save (it redeploys). Updating from `backend/.do/app.yaml` can leave secrets empty,
since the file holds none: check afterwards, or update from the live spec instead
(`doctl apps spec get <app-id> > live-spec.yaml`, edit, then `doctl apps update <app-id> --spec live-spec.yaml`).
The start-up log warns about a missing Clerk or AI key.
- `DATABASE_URL`: the session pooler connection string from step 1.
- `DATABASE_CA_CERT`: the text of the certificate file from step 1.
- `CLERK_JWT_KEY`: Clerk dashboard → API keys → JWT public key (the PEM text).
- `ANTHROPIC_API_KEY`: from the Anthropic console. Set a spending limit there.

### 3. Check it

```bash
doctl apps list --format Spec.Name,DefaultIngress
```

```bash
curl https://<address>/health
```

It answers `{"ok":true}`. Put the address in `app/.env.local` as `EXPO_PUBLIC_AI_BACKEND_URL`.
Later pushes to the branch named in the spec deploy automatically. If a deploy fails, its logs
show why:

```bash
doctl apps logs <app-id> --type deploy
```

Supabase's free plan pauses a project after a week without activity; fine for testing, but move
to a paid plan before real users.

## Granting AI games by hand (promos, customer care, demos)

`POST /admin/grants` with `Authorization: Bearer <ADMIN_TOKEN>`. Give the account's Clerk user id
(`account`) or its email (`email`, which needs `CLERK_SECRET_KEY`); the person must have signed in
to QueAura once. `aiGames` is 1 to 1000, or down to -100 to correct a mistake. The `reason` is kept
with the grant in the ledger. `ref` is optional: the same ref grants only once, so a repeated
request is harmless.

```bash
curl -X POST https://<backend>/admin/grants -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"email":"host@example.com","aiGames":5,"reason":"Customer care: generation failed twice","ref":"care-2026-11-03-1"}'
```

The answer gives the account, whether it was granted (false if the ref was used before), and the
new balance.
