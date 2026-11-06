# Google Play setup: sign-in, AI-game packs, purchase confirmation, refunds

Everything after the first internal-testing build is live (spec §8, Phase 3 milestone 5). Google
renames menu items now and then: look for the nearest match. Backend:
`https://queaura-backend-whhaq.ondigitalocean.app`; DigitalOcean app id
`fcce1cea-a5f6-4138-bd90-5bcce39b37ba`. Add every DigitalOcean setting in the dashboard (app →
Settings → `api` → Environment Variables), ticking **Encrypt** for secrets; don't update from the
spec file, which can blank secrets.

## A. Google sign-in in builds installed from Play

Play re-signs the app with its own key, and Google sign-in only accepts apps whose key it knows.

1. Play Console → QueAura → **Test and release → Setup → App integrity → App signing**. Copy the
   **SHA-1** under **App signing key certificate**. (The **Upload key certificate** SHA-1 is for
   release builds you install yourself.)
2. Google Cloud console, the project your Google sign-in uses → **APIs & Services → Credentials →
   Create credentials → OAuth client ID** → type **Android**. Package name `com.queaura.host`, SHA-1
   from step 1 → **Create**. One Android client per fingerprint; keep the existing ones.
3. Nothing to copy back: the app still uses the web client ID. The Google button only shows in a
   build made with `EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID` in `app/.env.local`; if it's missing,
   add it and upload a new build (raise `versionCode`).

## B. The AI-game packs

1. Play Console → QueAura → **Monetize with Play → Products → One-time products** (formerly
   In-app products) → **Create one-time product**.
2. Product ID (can't be changed later), name, description, price; then **Save** and **Activate**:

   | Product ID | Name | Description | Price |
   |---|---|---|---|
   | `ai_games_1` | 1 AI game | 50 AI-written questions: a whole quiz night. | $0.99 |
   | `ai_games_5` | 5 AI games | 250 AI-written questions. Never expire. | $3.99 |
   | `ai_games_10` | 10 AI games | 500 AI-written questions. Best value; never expire. | $5.99 |

   If it asks for a purchase option, use **Buy** with that price; let Play convert other
   countries' prices.
3. Play Console → **Manage account** (left menu) → **Play apps settings** → **License testing**
   (under Monetization settings) → add the Gmail address signed in to the Play Store on your phone
   → **Save**. Its purchases use test cards and cost nothing: the purchase sheet shows "Test card,
   always approves" instead of your real cards. If it still shows real cards, or a new product
   doesn't appear, clear the Play Store's cache on the phone (Settings → Apps → Google Play Store →
   Storage → Clear cache).

## C. Letting the backend confirm purchases (service account)

1. Google Cloud console → **APIs & Services → Library** → **Google Play Android Developer API** →
   **Enable**.
2. **IAM & Admin → Service accounts → Create service account**: name `queaura-play` → **Create and
   continue** → no roles → **Done**.
3. Open it → **Keys → Add key → Create new key → JSON**. A file downloads: keep it safe, it is a
   password.
4. Play Console (account level) → **Users and permissions → Invite new users**: the service
   account's email (`queaura-play@<project-id>.iam.gserviceaccount.com`) → **App permissions → Add
   app → QueAura**, ticking **View financial data** and **Manage orders and subscriptions** →
   **Invite user**. Google can take a few hours to apply this.
5. DigitalOcean: `GOOGLE_SERVICE_ACCOUNT_JSON` = the whole file on one line. In Git Bash:
   `tr -d '\n' < queaura-play-key.json` and copy the output (its `\n` inside the key are meant to
   stay as written).

## D. Refund notifications (Pub/Sub)

1. Google Cloud console → **Pub/Sub → Topics → Create topic**: ID `play-billing` (untick the
   default subscription) → **Create**.
2. In the topic → **Permissions** → **Add principal**:
   `google-play-developer-notifications@system.gserviceaccount.com`, role **Pub/Sub Publisher** →
   **Save**.
3. **Subscriptions → Create subscription**: ID `play-billing-push`, topic `play-billing`, delivery
   type **Push**, endpoint `https://queaura-backend-whhaq.ondigitalocean.app/google/rtdn`, tick
   **Enable authentication**, service account `queaura-play@…`, leave **Audience** empty (it
   defaults to the endpoint URL) → **Create**. (A project made before April 2021 also needs the
   Pub/Sub service agent given **Service Account Token Creator** on `queaura-play`.)
4. DigitalOcean: `RTDN_SERVICE_ACCOUNT` = `queaura-play@<project-id>.iam.gserviceaccount.com`;
   `RTDN_AUDIENCE` = `https://queaura-backend-whhaq.ondigitalocean.app/google/rtdn`.
5. Play Console → QueAura → **Monetize with Play → Monetization setup → Real-time developer
   notifications**: topic `projects/<project-id>/topics/play-billing`; choose the notification
   content that includes **voided purchases** (and one-time products) → **Save** → **Send test
   notification**. Check:
   `doctl apps logs fcce1cea-a5f6-4138-bd90-5bcce39b37ba --type run | grep "test notification"`.

## E. The other backend settings

- `ADMIN_TOKEN`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
  Keep a copy for granting AI games.
- `CLERK_SECRET_KEY`: Clerk dashboard → API keys → **Secret key** (only needed to grant by email).

After saving, the start-up log should have no `No Google service account` or `Purchase
notifications not set up` warnings.

## F. Test it

1. Close QueAura fully and reopen. Questions tab → **Get more AI games**: the three packs, with
   prices.
2. Buy **1 AI game** with **Test card, always approves**. The screen says the AI games were added;
   the balance goes up by one. Log: `"message":"purchase"`.
3. **Test card, always declines**: nothing is added.
4. Play Console → **Order management** → the test order → **Refund**. Within a few minutes the log
   shows `"message":"refund"` and the balance goes down by one.
