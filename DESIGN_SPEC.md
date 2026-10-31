# LAN Trivia Game — Design Spec

Working title: TBD. Platform for v1: Android host app. Status: Phase 0 (spike) complete; Phase 1 is next.

---

## 1. The benchmark (non-negotiable)

Every design decision is judged against two numbers:

- **Host:** a first-time host goes from install to a running game, with players joined, in about **2 minutes**, without reading instructions.
- **Player:** a first-time player goes from scanning the QR code to answering a question in **under 15 seconds**.

If someone installs the app and can't figure out how to create or run a game, the product has failed. Reliability is part of usability: a flaky demo counts as a failed demo. When a feature conflicts with the benchmark, the benchmark wins.

**Test protocol:** hand the build to someone who has never seen it (or its predecessor, TriviaHost), say nothing, and watch where they stall. Any explanation invalidates the test. Four testers are available; each can be a first-timer only once, so use two after Phase 1 and two after Phase 3.

---

## 2. System overview

| Component | What it is | Runs on |
|---|---|---|
| Host app | Native app: game creation, question bank, hosting, controls | Android phone or tablet (iOS later) |
| Embedded game server | HTTP + WebSocket server inside the host app; authoritative game state | Host device |
| Player client | Web page served by the host device; joined by QR code; no install | Players' phone browsers |
| TV display | Same web client in a read-only display mode, no input controls | Samsung / LG smart TV browser |
| Cloud backend | AI question generation, moderation, metering, subscriptions | Cloud (Node.js; DigitalOcean acceptable) |

Gameplay is LAN-only. The cloud backend is involved only for AI generation and subscription; a game with manual questions never touches it.

### 2.1 Stack guidance

- Host app UI: React Native (Expo dev build), so iOS later is a port rather than a rewrite.
- Embedded server: prefer a **native Kotlin/Java module** (for example NanoHTTPD plus Java-WebSocket, or an equivalent) running inside an Android **foreground service**, exposed to React Native through a bridge. The only JS alternative, considered only if the Phase 0 spike shows the native server is unstable, is an **embedded Node.js runtime** (for example nodejs-mobile with `ws`) running in the foreground service. Socket libraries that run on the React Native JS thread (for example react-native-tcp-socket) are excluded: JS timers can be throttled with the screen off, which breaks server-authoritative timing. Server stability is the top technical risk; choose by measurement, not preference.
- Player and TV client: a single **Preact** web bundle, built and bundled in the app and served from the device. Small is still better because TV browsers run old engines; Preact is small enough. See §2.2.
- The server is the authority on game state and time. Client countdowns are cosmetic.

### 2.2 Web UI standards (mandatory)

- Scope: the web pages that players' phones and the TV open in a browser. Players have no app. The only app is the host app, which is React Native, fixed and not up for change.
- **All web UI is built with Preact. No vanilla-JS UI code anywhere**: no hand-built DOM manipulation, no `innerHTML` templating, no imperative widget code. This applies to every phase, including the Phase 0 spike.
- **Component-based architecture, designed up front.** Small, single-purpose components with clear props; presentational components separated from state and container logic; shared primitives (Button, Card, Countdown, QRPanel, ScoreList, AnswerInput variants) reused across the player and TV views rather than duplicated.
- **One client, two modes.** The TV display is the same component tree as the player client with input components not rendered, not a second codebase.
- **State:** game state arrives from the server over WebSocket into a single store (for example Preact Signals); components subscribe and never talk to the socket directly.
- **Theming through design tokens.** All color, typography, spacing, radius and motion values are defined once as CSS custom properties (a token file), with a deliberately chosen palette and type scale. Components use tokens only; no hard-coded colors or ad-hoc pixel values. Light and dark variants come from tokens. The TV gets its own scale tokens (larger type, higher contrast) rather than separate styles.
- **CSS discipline:** styles scoped per component (CSS Modules or an equivalent), no inline style sprawl, no global overrides, no `!important`.
- **Build:** Vite with `@vitejs/plugin-legacy`. JSX is compiled at build time. Current browsers get the modern bundle (Phase 0: the 2025 Samsung TV runs Chromium 130 and gets it). A legacy bundle targeting Chromium 56 (Tizen 4, 2018 TVs) is downloaded only by older browsers, so it costs current devices nothing. No minimum TV model year is set; revisit only if a TV fails to load the game.
- **Quality bar:** code that reads as deliberately designed. Before building a screen, sketch its component breakdown and the tokens it uses.

---

## 3. Networking

### 3.1 Joining
- The host device runs the server. Players scan a QR code encoding the game URL (`<scheme>://<host-ip>:<port>/`).
- The QR code appears on the host device and, if connected, on the TV.
- Android: the server runs in a foreground service. On first host, detect battery optimization and walk the host through exempting the app once, in plain language (Samsung, Xiaomi and other OEMs kill background work aggressively).

### 3.2 Failure modes the app must handle
- **Venue Wi-Fi client isolation:** phones on the same network can't reach each other. This is common on bar and guest networks.
- **Players on cellular** instead of Wi-Fi.
- **TV on a different network** from the host.

Never fail silently. If players can't connect, the host sees a plain-language helper with the fix, including a hotspot fallback.

### 3.3 Hotspot fallback (DECIDED: LocalOnlyHotspot)
- Option A: Android **LocalOnlyHotspot**. The app creates its own network with generated credentials and shows a Wi-Fi QR code (scan 1: join network), then the game QR code (scan 2: join game). This bypasses venue isolation entirely.
- Option B: the host enables the regular phone hotspot manually; the app detects it and shows the game QR code.
- **Decision: Option A.** Phase 0 joined a player through LocalOnlyHotspot on the S21 host. It needs no trip into Android settings, which suits the no-instructions benchmark. Players have no internet while on it, which gameplay does not need (§2). Option B was not tested; revisit only if a phone refuses to stay on a network without internet.

### 3.4 HTTP vs HTTPS (DECIDED: plain HTTP)
- **Player and TV pages are served over plain HTTP.** No HTTPS in any form.
- Rejected: self-signed certificates (every player hits a full-page browser security warning, which fails the 15-second benchmark and looks like malware) and publicly trusted per-device certificates (the Plex `plex.direct` model: needs a backend certificate service, internet at game start, and fails on routers with DNS rebind protection).
- Consequence: HTTPS-only browser features are unavailable and must not be relied on, including the Wake Lock API, `crypto.randomUUID`, the async Clipboard API and service workers.
- **Player screens may sleep, and that is normal.** Phase 0 showed there is no plain-HTTP way to keep a screen on: a muted looping video, hidden or visible, does not stop Chrome on Android from sleeping. The game does not try.
- **A player is never penalized for their screen sleeping.** Their seat, score and identity are kept (§3.5); waking the phone reconnects automatically and lands on the current game state, because the server is the authority (§2.1). The only effect is the one any idle player has: no answer is submitted while the screen is off.

### 3.5 Reconnection
- Each player gets a session token in browser storage. A refresh, a reopened tab, or a dropped connection puts them straight back into their seat with their score.
- Browser storage is tied to the origin (including the IP address), so identity persists within a session but not across sessions when the IP changes.

---

## 4. Data model

The **question bank** and **game formats** are independent. A game is a format; questions are fillers plugged into it.

```
Question
  id
  text
  answerType: numeric | multipleChoice | freeText
  correctAnswer          (numeric value, or choice id; none for freeText)
  choices[]              (multipleChoice only)
  explanation?           (optional; AI always fills it)
  category?, difficulty?
  source: manual | ai
  moderation: passed | flagged

GameFormat
  id, title
  progression: auto | manual       (manual = questionnaire; see §6.4)
  scoring: none | allOrNothing | timeWeighted   (default: allOrNothing)
  closeEarly: boolean   (default: false; close a question once every awake player has answered)
  rounds[]
  status: playable | incomplete    (derived: incomplete if any slot is empty)

Round
  presentationStyle
  slots[]  -> Question id (or empty)
  durations (overrides of style defaults)

Session (a lobby that outlives individual games)
  players[], currentGame?, kickedTokens[]

Player
  sessionToken, nickname (required), emoji (preselected at random, changeable)

QuestionnaireResult
  gameId, startedAt, responses[playerId][questionId] -> answer
```

### Compatibility rule
A slot only accepts questions whose answer type fits the round's style. The question picker shows only compatible questions. A numeric question may be offered to a multiple-choice round with auto-generated wrong choices; the reverse is not possible.

### Storage
- Question bank, game formats, and saved results live **on the host device**. No server-side storage of user content in v1.
- Paid remote storage (the host's own storage link or home server, or a premium hosted option) is **later**, not v1.

---

## 5. Host app

### 5.1 First run
- **No onboarding carousel.** The app teaches through doing.
- First screen offers **"Start a game now"** with built-in sample games, plus "Create your own." A new host can play within seconds.
- The app ships with a small **starter bank**: a handful of sample questions for every presentation style, and at least one prebuilt sample game format using them.

### 5.2 Game creation (guided)
The wizard steps through: title → number of rounds → per round: presentation style and number of questions → scoring strategy → plug in questions (from the bank, write new ones, or AI-fill empty slots).

- Every choice is shown with a plain-language explanation of what it does. Don't assume the host knows what's available.
- Invalid combinations are greyed out with a reason, not allowed and then failed later.
- A **summary screen** before saving restates every choice in plain language.
- Saving is allowed while incomplete. Incomplete games appear in the list **greyed out and unstartable**, with the reason ("Round 2 has 3 empty slots").

### 5.3 Question creation
- A standalone activity, independent of any game.
- Manual entry: text, answer type, answer (and choices), optional explanation.
- AI generation (signed-in, subscribed users; see §8): pick category, difficulty, answer type, and count → questions go into the bank. Alternatively, inside a game: "fill the empty slots in this round."
- All questions pass moderation before entering the bank (§9).

### 5.4 Lobby
- Shows the join QR code, the joined players (nickname plus emoji), and the game list.
- The host picks a playable game and taps Start. No scheduled start in v1.

### 5.5 In-game host screen
Shows: game, round number, round scores, question number, question content **including the correct answer**, latest question scores, an answered count ("7 of 9 answered"), and the controls.

Controls:
- **Pause:** freezes the timer and stops accepting answers; resume continues with the remaining time.
- **Skip:** voids the current question; nobody scores; advance.
- **Kick:** long-press a player in the score list. A kicked player's token is blocked for the rest of the session.
- **Stop:** ends the game.

The host cannot play from the hosting device. To host and play, use a tablet to host and a phone to play. The host app needs a proper **tablet layout**.

The host device's screen is kept on while a game runs. The host is watching it anyway, and Android only gives the server's Wi-Fi low latency while the screen is on (Phase 0 measured round-trip spikes up to ~1.3 s with the host screen off, which would distort time-weighted scoring).

### 5.6 End of game
- Final scores (tally per player across all rounds).
- A brief "Play another?" window. If chosen, the host picks from the game list while participants stay connected on a "waiting for the next game" screen. Otherwise, lights out: the session ends.

---

## 6. Game flow

### 6.1 Structure
Session → Game → Rounds (one presentation style each) → Questions. Rounds group related questions and create natural breaks.

### 6.2 State machine (auto progression)

```
LOBBY
  → GAME_STARTING      (3 s "get ready")
  → ROUND_INTRO        (4 s: round number, style name)
  → QUESTION           (loop per question in round)
       1. Show question number and content on all screens.
       2. Answer window opens immediately.
       3. Reading buffer (default ~5 s, scaled by question length):
          countdown bar not yet draining. Answers submitted here are accepted.
       4. Countdown runs (if the style is timed).
       5. Window stays open until the clock hits 0. Optional per game (off by default):
          close early once every connected player has answered.
  → TIMES_UP           (3 s "time's up" hold, only when the clock ran out; no answers accepted)
  → REVEAL             (correct answer, explanation if present, points)
       auto mode: hold for the default duration, then advance.
  → ROUND_SCORES       (8 s, after the last question of the round)
  → ROUND_BREAK        (countdown to next round)
  → ... next round ...
  → FINAL_SCORES
  → PLAY_ANOTHER_WINDOW (60 s for the host to choose) → LOBBY | ENDED
```

Rules:
- **Server time is authoritative.** Submission time is when the server receives the answer. Time weighting is measured from when the server opened the window.
- Pause can occur in QUESTION (freezes timing) and in REVEAL/BREAK (holds).
- Skip from QUESTION → next QUESTION (or ROUND_SCORES); the question scores for nobody.
- **Early close** is a per-game option, off by default: by default every question runs until the clock hits 0. When on, it counts only players who are connected with their screen on, so a sleeping phone never holds up the room (§3.4); if no such player exists, the window runs to timeout.
- **Late joiners** enter at the next question with zero points, never mid-question.
- **Dropouts:** an answer submitted before the window closed counts; a returning player resumes with their score.

### 6.3 Presentation styles (v1)
| Style | Answer input | Notes |
|---|---|---|
| Closest without going over (**default**) | Numeric keypad | Reveal ranks all guesses against the real number; busts marked |
| Classic multiple choice | Tap a choice | Timed |
| Fastest finger | Tap a choice | First correct answers score highest |
| Questionnaire | Free text, numbers, or taps | Manual progression only (§6.4) |

Outside questionnaire mode, input is tap or numeric only. **No free text in timed modes.**

Durations: every style has defaults (reading buffer, answer window, reveal hold, round break). The host can override any of them per round. Starting defaults, to be tuned in usability tests: reading buffer 2 s + 0.25 s per word of the question, kept between 3 and 10 s; answer window 20 s; reveal 8 s; round break 15 s. Fixed in Phase 1: get-ready 3 s, round intro 4 s, time's-up hold 3 s, round scores 8 s.

### 6.4 Questionnaire mode (manual progression)
- A manual-progression game has **exactly one round** containing all its questions. Choosing manual progression implies questionnaire mode; the wizard enforces this.
- No timers, no flair. Each participant advances at their own pace by tapping. Free text is allowed.
- **The host ends it.** The host manages pace verbally.
- TV shows the join QR code and a completion count ("8 of 12 finished").
- **Each answer is saved to the host device the moment it's submitted**, so ending mid-way keeps partial responses.
- On stop: a prompt to **Save results** or **Discard** (discard needs a second confirmation).
- **Crash recovery:** if the app dies before that prompt, the next launch shows the same save-or-discard prompt for the unresolved game.
- Saved results appear in a Results list on the device. **Export** builds a CSV and opens the native share sheet (email, Drive, messaging, and so on) using the host's own accounts. The data never passes through our servers.

### 6.5 Scoring
- `none`, `allOrNothing` (**default**), `timeWeighted`.
- `allOrNothing`: a correct answer earns **100** points.
- Time-weighted: answers submitted during the reading buffer earn **full points (100)**; weighting decays only once the countdown starts, falling linearly to **10** at the end of the window. A correct answer never earns less than 10.
- Closest-without-going-over: the closest guess not exceeding the answer wins the question and earns 100 (time-weighted as above when that scoring is chosen). **Tied winners each earn the full points.** An **exact** answer earns a **50-point bonus**. Guesses over the answer (busts) earn 0; if everyone busts, nobody scores.
- `none`: answers are collected and revealed but nobody earns points.
- All values are starting points, to be tuned in usability tests.

---

## 7. Player client and TV display

### 7.1 Player join
Scan QR → enter a nickname (required) → an emoji is preselected at random (tap to change, from a fixed grid; **no photo avatars**) → lobby. Target: under 15 seconds.

### 7.2 Player screens
Waiting/lobby, question with input, "answer locked in," reveal (own result: correct or not, points earned), round scores, final scores, waiting for the next game. Answers can only be submitted from a player's own device.

### 7.3 TV display
- Opened manually in the TV browser. The host app shows the URL in large text for typing (targets: Samsung, LG). The TV is **strictly optional**: the game never waits on it.
- Shows everything players see, minus input controls: lobby with a big QR code, questions and countdowns, and the **room reveal** (for closest-numeric, every guess ranked with busts marked), round and final scores.
- Built for old browser engines: Preact compiled to a legacy target (§2.2), large type, high contrast via the TV token scale, no heavy dependencies.
- **The TV view always fits the screen; it never scrolls** (nobody can scroll a TV browser with a remote). Layout and the TV type scale follow the viewport height, because TV browsers report anything from about 720 to 1080 CSS pixels tall (a 2025 Samsung reports 1536 × 749).

---

## 8. AI question generation

- **Not required to play.** Signing in happens only when a host chooses AI generation.
- **Identity:** Clerk.
- **Billing:** a subscription, with a **free allowance of generations** for new users so they can see the value before paying. The allowance is **server-side configuration**, expressed in generations (not tokens), because model costs fluctuate and the provider may change. Users never see tokens. The platform absorbs the spread.
- **Payment provider:** OPEN (Stripe was used previously).
- **Architecture:** host app → backend (authenticated with the Clerk session) → the backend checks the subscription or allowance, meters usage per user, calls the model, moderates the output, and returns structured questions. The host app never calls the AI provider directly.
- **Provider credentials:** a direct provider API key kept in a secrets manager on the backend and rotated, with per-user spending ceilings in our metering. Workload identity federation (for example Claude through Bedrock or Vertex) only becomes worthwhile if the backend moves to AWS or GCP; DigitalOcean doesn't offer the identity tokens it needs.
- **Provider abstraction:** model and provider behind an interface, so swapping them changes only config and the spread calculation. It must be easy to move between providers; starting set: **Claude, ChatGPT, Kimi, DeepSeek**. Two adapters cover them: one for Anthropic's Messages API (Claude), and one for the OpenAI-compatible Chat Completions format, configured by base URL, model name and key (ChatGPT, DeepSeek and Kimi all offer it, as do many others). Adding a provider that speaks either format is configuration only; a provider with its own format needs one new adapter. The active provider and model are backend configuration, never a client change.
- **Output contract:** strict JSON per question matching the Question model (text, answerType, correctAnswer, choices when multiple choice, explanation, category, difficulty). Validate and reject malformed output; never trust it blindly.
- Generation requires internet; gameplay does not.

---

## 9. Moderation (two tiers)

Purpose: guard against harmful or illegal content, because content appears on shared screens (including TVs in public venues).

| Tier | Where | Covers | Cost |
|---|---|---|---|
| On-device | Host app, always on, offline | Manual questions, player nicknames, questionnaire free-text answers shown on any shared screen | Free |
| Model-based | Backend | AI-generated questions, in the same request as generation | Metered with the generation |

- The AI generation prompt carries guardrails (no hateful, sexual, violent or illegal content; age-appropriate defaults). Output is checked again after generation.
- The on-device tier (word list plus a small classifier) will miss things. **Kick** and **Skip** are the human backstops.
- Manual questions are never published, which is why on-device moderation is proportionate for them.

---

## 10. Later (designed for, not built in v1)

Designing for these means not blocking them.

- iOS host app (foreground-only hosting, Local Network permission explainer screen before the system prompt).
- **Sound:** emitted from the TV when connected, otherwise from the host device; players' phones silent; one mute toggle. Needs a one-time "Press OK to enable sound" on TVs (autoplay restrictions). **v1 must emit game events** (question shown, countdown started, last 5 seconds, reveal, round end) so sound can attach later.
- Teams.
- Image and audio questions (the data model should not assume text-only forever).
- **Billboard** between rounds: the host's own custom content (for example a venue's specials); a potential paid feature. Third-party ads, if ever, only inside the host app; ad networks won't serve to LAN pages.
- All-time high scores: honor-system, kept on the host device, keyed by nickname.
- Paid storage: bring-your-own remote storage, or a premium hosted option.
- Scheduled game start.

---

## 11. Build phases

### Phase 0 — Spike (throwaway code)
Goal: prove phone-as-server is reliable before building anything else.

- Android app with a foreground service serving a Preact page (per §2.2; throwaway logic, but no vanilla-JS UI) plus WebSocket.
- Record the browser engine versions of the target Samsung and LG TVs to set the Vite legacy build target.
- 10 phones and a Samsung or LG TV browser connected; broadcast a counter and collect taps.
- Test on home Wi-Fi, on the phone's regular hotspot, and with LocalOnlyHotspot.
- Measure: join time from scan, message latency, reconnect after refresh or network blip, and survival over 30+ minutes with the host screen dimmed or off.
- Check whether anything can keep player screens on over plain HTTP, and how quickly a player is back in their seat after waking the phone (§3.4).
- Compare the native-module server against an embedded Node.js server only if the native server shows instability (§2.1).

**Exit criteria:** zero dropped sessions over 30 minutes, median join time well under 15 seconds, automatic reconnect working, and decisions recorded for §3.3 and §3.4. If this phase is flaky, stop and fix it here; nothing else matters until it isn't.

Owner decision: the 10-phone soak is waived. Accepted evidence is a 54-minute run with one player phone and the TV (host screen off, server never more than 2.2 ms off schedule, every disconnect explained) plus 40 simulated players against the server on a desktop JVM. Results: `spike/RESULTS.md`.

### Phase 1 — Core game
Embedded server (production-quality), session/lobby, join flow, player and TV clients, game state machine, closest-numeric and classic multiple-choice styles, all three scoring strategies, starter bank and sample game, manual question creation, question bank, guided game creation with summary screen, host controls (pause, skip, kick, stop), play-another window.

→ **Usability test with 2 testers.**

### Phase 2 — Remaining styles and questionnaire
Fastest finger, questionnaire mode with save-as-tapped, the save/discard prompt, crash recovery, CSV export through the share sheet, the on-device moderation tier, tablet layout polish, battery-optimization walkthrough, connection-trouble helper and hotspot fallback.

### Phase 3 — AI
Backend: Clerk auth, subscription and free allowance, metering, provider abstraction, generation into the bank and slot-filling, model-based moderation.

→ **Usability test with the remaining 2 testers.**

---

## 12. Open decisions

1. ~~HTTPS: Path A vs Path B.~~ Decided in Phase 0: plain HTTP, screens may sleep, no penalty for sleeping (§3.4).
2. ~~Hotspot fallback.~~ Decided in Phase 0: LocalOnlyHotspot (§3.3).
3. ~~Embedded server implementation.~~ Decided in Phase 0: the native Kotlin module (NanoHTTPD plus Java-WebSocket in a foreground service). The spike showed no instability, so embedded Node.js was not needed (§2.1).
4. Payment provider for subscriptions.
5. Size of the free AI allowance (configurable; set from real cost data).
6. Default durations per style: starting values set (§6.3); tune in usability tests.
7. ~~Closest-without-going-over tie and exact-answer rules.~~ Decided for Phase 1: tied winners each earn full points, exact answers earn a 50-point bonus (§6.5); tune in testing.
