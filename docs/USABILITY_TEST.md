# Usability test: Phase 1

The benchmark (spec §1) is the whole point of this test:

- **Host:** a first-time host goes from opening the app to a running game, with players joined,
  in about **2 minutes**, without reading instructions.
- **Player:** a first-time player goes from scanning the QR code to answering a question in
  **under 15 seconds**.

Phase 1 uses **2 of the 4 testers**. Each person can be a first-timer only once, so keep the other
two away from the app (and from watching this session) until after Phase 3.

## Before the testers arrive

1. **Install the test build** on the phone the tester will host from (see "Build the APK"). The
   clock starts when the tester first opens the app, not at install: sideloading an APK is not
   what a real host does from the Play Store.
2. **Fresh start:** if the app was used before on that phone, clear its data (Settings → Apps →
   Queaura → Storage → Clear data) so the tester sees exactly what a new host sees.
3. **Battery:** Settings → Apps → Queaura → Battery → **Unrestricted** on the host phone. (The
   in-app battery walkthrough is Phase 2; don't let One UI end the test early.)
4. **Players:** two or three people with their own phones on the **same Wi-Fi** as the host phone.
   They should not have seen the game either, if possible; if they have, note it.
5. **TV (optional):** a TV with its browser closed. Don't open the TV page for them.
6. Have a stopwatch and this sheet. Phone on silent.

## What to say

Say exactly this, then nothing more:

> "This is a trivia game app. Please run a quiz for these two."

**Do not help, point, hint or answer questions.** If they ask, say "Do whatever you'd do if I
weren't here." Any explanation invalidates the run. If they are truly stuck for **2 minutes**,
note it and end the run; that's the result.

## What to time and note

| Moment | Time | Notes |
|---|---|---|
| Tester opens the app | 0:00 | |
| Taps "Start a game now" (or something else first?) | | |
| Lobby with QR code on screen | | |
| First player scans the code | | |
| First player is in (their name shows in the lobby) | | Player's own time, scan to joined: |
| Second player is in | | |
| Tester picks a game | | Which one? Did they understand the list? |
| Tester presses Start | | **Host benchmark: target ~2:00** |
| First question shown | | |
| Each player's first answer | | **Player benchmark: scan to first answer, under 15 s** |
| End of game | | Did they find "Play another" / "End session"? |

**Stalls:** every time the tester pauses for more than ~5 seconds, write down where, for how long,
and what they did next. Hesitations are the most valuable thing this test produces.

| Where | How long | What they tried | Quote |
|---|---|---|---|
| | | | |
| | | | |
| | | | |

## After the run (now you may talk)

1. "What was confusing, if anything?"
2. "Was there a moment you didn't know what to do next?"
3. "What did you expect to happen when you first opened it?"
4. To the players: "Was joining easy? Anything odd on your phone?"
5. "Would you host this at a party?" (and why / why not)

## Collect the evidence

- This sheet, filled in.
- The server's log from the host phone: connect the phone over USB and copy the newest
  `session-*.jsonl` from `Android/data/com.queaura.host/files/logs/` (or ask Claude to read it
  from a pull: `adb pull /sdcard/Android/data/com.queaura.host/files/logs`).
- Photos of anything that looked wrong, on the host phone, a player's phone or the TV.

## Build the APK

A release build carries everything inside it, so it runs without the laptop or Metro. On the
laptop, with the host phone connected over USB:

```bash
cd web && npm install && npm run build
```

```bash
cd app && npm install && npx expo run:android --variant release --device
```

That installs it on the connected phone. The APK file itself is at
`app/android/app/build/outputs/apk/release/app-release.apk`; copy it to another Android phone to
install it there ("Install unknown apps" must be allowed for the app you open it with). It is
signed with a development key: fine for testing, not for the Play Store.

The release build is installed as the same app as the development build (`com.queaura.host`), so
installing one replaces the other. To go back to development, run `npx expo run:android --device`.
