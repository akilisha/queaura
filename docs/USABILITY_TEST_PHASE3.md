# Usability test: Phase 3 (the remaining 2 testers)

Same benchmark as Phase 1 (spec §1), now with the whole product a real host gets from Google Play:

- **Host:** first-time host, from opening the app to a running game with players, in about **2 minutes**.
- **Player:** first-time player, from scanning the QR code to answering a question, in **under 15 seconds**.
- **New in this phase:** can a first-time host get **AI to write a quiz** and run it, without help?

These two testers must not have seen the app. Use the internal-testing build from Google Play.

## Before the testers arrive

1. Make the tester's Google account an **internal tester** and a **license tester** (Play Console →
   Manage account → Play apps settings → License testing), so a purchase uses test cards. Have
   them install QueAura **from Play** on the phone they'll host from; the clock starts when they
   first open it.
2. Battery: Settings → Apps → QueAura → Battery → **Unrestricted** (or let the in-app walkthrough
   do it, and note whether they understood it).
3. Two or three players with their own phones on the same Wi-Fi; a TV with its browser closed.
4. Stopwatch and this sheet.

## Run 1: a quiz, written by AI

Say exactly this, then nothing more:

> "This is a trivia game app. Make a quiz about something you like, and run it for these two."

Don't help, point or hint. If they ask, say "Do whatever you'd do if I weren't here." Stuck for
2 minutes: note it and end the run.

| Moment | Time | Notes |
|---|---|---|
| Opens the app | 0:00 | |
| Finds AI (Questions tab card, "Create a game with AI", or the wizard)? | | Which way? |
| Signs in (email code or Google) | | Any confusion? |
| Chooses topic, rounds, style | | |
| Review screen: keeps / leaves out questions | | Did "Leave out" make sense? |
| Game saved, lobby with QR code | | |
| First player in | | Player's own time, scan to joined: |
| Start pressed | | **Host benchmark: target ~2:00, plus AI wait** |
| Each player's first answer | | **Player: scan to first answer, under 15 s** |
| End of game | | Found "Play another" / "End session"? |

Also time the AI wait itself (tap "Write questions" to review screen).

## Run 2: more AI games

When run 1 is over, say:

> "Suppose you'd used up your AI games. Get more."

| Moment | Time | Notes |
|---|---|---|
| Finds "Get more AI games" | | Where did they look first? |
| Picks a pack, Google's sheet opens | | Did the prices make sense? |
| Pays with "Test card, always approves" | | |
| Sees the AI games added | | |

## Stalls

Every pause over ~5 seconds: where, how long, what they tried, what they said.

| Where | How long | What they tried | Quote |
|---|---|---|---|
| | | | |

## After the runs

1. "What was confusing, if anything?"
2. "Did you trust the AI's questions? Did you check them?"
3. "Was it clear what an AI game is, and what you were paying for?"
4. To the players: "Was joining easy? Anything odd on your phone or the TV?"
5. "Would you host this at a party? Would you pay for AI games?" (and why)

Record results in `docs/USABILITY_RESULTS.md`, under a Phase 3 heading.
