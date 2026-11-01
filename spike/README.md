# Phase 0 spike (throwaway)

Goal (spec §11): prove that a phone can reliably serve the game before anything else is built.
Exit criteria: zero dropped sessions over 30 minutes, median join time well under 15 seconds,
automatic reconnect working, and decisions recorded for §3.3 and §3.4 (§3.4 is decided: plain
HTTP, player screens may sleep without penalty). Write results in
[RESULTS.md](RESULTS.md).

| Folder | What |
|---|---|
| `web/` | Preact client: player (default), TV (`?mode=tv`), diagnostics (`?mode=diag`). See `web/COMPONENTS.md`. |
| `host-app/` | Expo dev build. `modules/spike-server` is the native Kotlin server: NanoHTTPD on port 8080 (page, `/config.json`, `/stats.json`, `/log.jsonl`) and Java-WebSocket on port 8090, inside a foreground service with wake and Wi-Fi locks. |
| `tools/` | `loadtest.mjs` (simulated players). |

## Build and install (Windows laptop, S21 over USB)

Needs Node 20+, JDK 17, the Android SDK (`ANDROID_HOME` set), and USB debugging on the S21.

```bash
cd spike/web
```

```bash
npm install
```

```bash
npm run build
```

```bash
cd ../host-app
```

```bash
npm install
```

```bash
npx expo run:android --device
```

The web bundle is compiled into the APK, so rerun `npm run build` in `spike/web` before every
`expo run:android` when the client changes. If `npx expo install` or `prebuild` complains it
can't reach Expo's servers, set `EXPO_OFFLINE=1`.

## Phone setup before testing

- S21: Settings → Apps → Queaura Spike → Battery → **Unrestricted**. One UI kills background
  work otherwise; the spike measures the server, not the battery walkthrough (that is Phase 2).
- Allow notifications when asked (the foreground-service notification).

## Test script

Run each block on all three networks: **home Wi-Fi**, **regular phone hotspot** (S21 hotspot
on, players join it), and **LocalOnlyHotspot** (tap "Start LocalOnlyHotspot" in the app;
players scan the Wi-Fi QR code, then the game QR code). Record everything in RESULTS.md.

1. **Diagnostics, once per browser.** Open `http://<ip>:8080/?mode=diag` on the Samsung TV and
   each phone browser. Photograph or copy the table into RESULTS.md (Chromium version sets the
   Vite legacy target; the feature rows record what works over plain HTTP).
2. **Join time.** For each phone: start a stopwatch when the camera app opens, stop it when the
   Tap button appears. The page also measures page load → seat itself ("Join time" on the
   player screen, `joinMs` in `/stats.json`).
3. **TV.** Type `http://<ip>:8080/?mode=tv` into the TV browser. Counter and scores should update.
4. **Reconnect.** On a phone: (a) refresh the page, (b) close the tab and reopen it from
   history, (c) turn Wi-Fi off for 5 s then on, (d) airplane mode on/off. Each time the player
   should return to the same seat with the same tap count. "Last reconnect" on the player
   screen and `reconnectMs` in `/stats.json` give the times.
5. **Screen sleep.** Screens are allowed to sleep (spec §3.4); what matters is that the player
   loses nothing. Leave a player phone until its screen turns off, or press the power button.
   Wait 30 s, unlock, and note "Last reconnect" (measured from unlock to being back in the
   seat). The player must have the same seat and score and see the current counter.
6. **Soak, 30+ minutes.** 10 phones and the TV joined, plus simulated players from the laptop
   (on the same network):

   ```bash
   cd spike/tools && npm install && node loadtest.mjs <phone-ip> 30 35
   ```

   Turn the S21 screen **off** and leave it on battery. Leave the player phones at their normal
   screen timeout and don't touch them. At the end, check the host app and
   `http://<ip>:8080/stats.json`: `unexpectedCloses` (network drops) must be 0, every player
   must still have their seat, and `tickLateMs.max` shows whether the server's clock kept time
   with the host screen off. `sleepCloses` (player screens sleeping) is expected and fine.
   Save `http://<ip>:8080/log.jsonl` next to RESULTS.md.
## What counts as a drop

The server logs every socket close. Codes 1000/1001 are clean (tab closed, refresh, navigated
away) and 4000 means another tab took over the seat. Any other close is a drop:

- `sleepCloses`: the player's page had reported itself hidden (screen off) before the drop.
  Screens sleeping is normal; these only have to end with the player back in their seat. If a
  page freezes before it can report, the drop is counted as a network drop, so this errs
  against the server.
- `unexpectedCloses`: the page was visible. These must be explained by a test step (Wi-Fi off,
  airplane mode) or the run failed. During the soak there are no test steps, so it must be 0.
