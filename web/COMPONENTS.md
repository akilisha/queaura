# Web client: component and token plan

One Preact bundle served by the host device. Two modes from the URL: player (default) and TV
(`?mode=tv`). The TV is the same tree with input components not rendered, laid out to fit the
screen without scrolling (spec §2.2, §7.3).

## Data flow

```
WebSocket ─> state/transport.ts ─> state/store.ts (Signals) ─> views ─> components
                   ^                                            │
                   └──────────── state/actions.ts <─────────────┘
```

- `transport.ts`: the only socket code. Hello, reconnect with backoff, silence watchdog,
  visibility reports, ping. Writes server messages into the store.
- `store.ts`: one store. `game` holds the latest server state and `receivedAt` when it arrived,
  so countdowns are `remainingMs - (now - receivedAt)` on the phone's own stopwatch (no clock sync).
- `actions.ts`: what views may do (`join`, `answerNumber`, `answerChoice`).
- `lib/`: pure helpers with unit tests (countdown math, keypad entry, number formatting).

## Views (containers, read the store; `views/`)

| Phase | View | Player | TV |
|---|---|---|---|
| (no seat) | `JoinView` | nickname + preselected emoji | – |
| lobby | `LobbyView` | "You're in", players | big QR, join address, players |
| gameStarting | `GetReadyView` | title, seconds | same, larger |
| roundIntro | `RoundIntroView` | round n of m, style and what to do | same |
| question | `QuestionView` | question, countdown, `Keypad` or `ChoiceGrid`, then `LockedIn` | question, countdown, choices, answered count |
| timesUp | `TimesUpView` | "Time's up", your answer | "Time's up", answered count |
| reveal | `RevealView` | right answer, explanation, `ResultCard` | right answer, choice counts or ranked guesses |
| roundScores / roundBreak | `ScoresView` | round or total scores, next-round seconds | same, fitted columns |
| finalScores | `FinalView` | your place, final scores | podium, final scores |
| ended, kicked | `NoticeView` | message | message |

`App` picks the view; `PausedBanner` overlays any phase while paused.

## Components (presentational, props only; `components/`)

Kept from the spike: `Screen` (fit option for the TV), `Card` (fill option), `Button`, `TextField`,
`EmojiPicker`, `StatusBadge`, `KeyValueList`.

New:

| Component | Props | Used by |
|---|---|---|
| `Countdown` | `remainingMs`, `receivedAt`, `totalMs`, `holdMs`, `paused` | question, phases with a timer |
| `Seconds` | `remainingMs`, `receivedAt`, `paused` | get ready, intro, break, play-another |
| `PhaseHeader` | `round`, `questionNumber`, `questionCount` | question, times up, reveal |
| `Keypad` | `value`, `onChange`, `onSubmit`, `disabled` | question (closest) |
| `ChoiceGrid` | `choices`, `onPick?`, `picked?`, `correctId?`, `counts?` | question, reveal (player and TV) |
| `ResultCard` | `result`, `scoring` | reveal (player) |
| `RankedGuesses` | `entries`, `players`, `correctNumber` | reveal (TV, closest) |
| `ScoreList` | `players`, `highlightId`, `metric`, `limit` | lobby, scores, final |
| `QRCode` | `text` | lobby (TV), drawn as SVG rects from `uqr`'s matrix (no innerHTML) |
| `Banner` | `tone`, `children` | paused, errors |

## Tokens (`styles/tokens.css`)

From the spike: color (bg, surface, text, muted, border, primary, accent, success, warning,
danger, focus), type scale, space, radius, sizes, motion, TV scale from viewport height.

Added: `--color-choice-1..4` and `--color-on-choice` (choices keep the same color on phone and
TV, so players can match them at a glance), `--color-correct` / `--color-wrong` aliases,
`--countdown-height`, `--keypad-key`, `--qr-size`.
