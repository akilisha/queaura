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

`.do/app.yaml` describes the service; it uses a managed Postgres cluster created first. Run from
the repository root in Git Bash, signed in with `doctl auth init`.

### 1. The database (once)

Create the cluster (it takes a few minutes to come online; the second command waits for it):

```bash
doctl databases create queaura-db --engine pg --version 17 --region nyc1 --size db-s-1vcpu-1gb --num-nodes 1
```

```bash
CLUSTER=$(doctl databases list --format ID,Name --no-header | awk '$2=="queaura-db"{print $1}'); until doctl databases get $CLUSTER --format Status --no-header | grep -q online; do sleep 15; done; echo online
```

Create the app's database and user, then make the user its owner (Postgres 15+ lets only the
owner create tables). This step uses the cluster's admin connection, so do it before step 2,
which limits who may connect to the app:

```bash
doctl databases db create $CLUSTER queaura
```

```bash
doctl databases user create $CLUSTER queaura
```

```bash
cd backend && DATABASE_URL="$(doctl databases connection $CLUSTER --format URI --no-header)" DATABASE_CA_CERT="$(doctl databases get-ca $CLUSTER --format Certificate --no-header)" npm run db:own -- queaura queaura; cd ..
```

It prints `queaura now owns queaura.`

### 2. The app

The first time, create it; after that, apply spec changes with update (`doctl apps list` shows
the app's ID):

```bash
doctl apps create --spec backend/.do/app.yaml
```

```bash
doctl apps update <app-id> --spec backend/.do/app.yaml
```

Then, in the dashboard, open the app → Settings → `api` → Environment Variables, fill in the two
secrets, and save (it redeploys):
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
